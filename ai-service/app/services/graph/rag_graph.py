from __future__ import annotations

import json as _json
import logging
import os
from typing import TypedDict, Any

from openai import OpenAI
from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)

from app.services.jobs.dart_service import get_dart_company_info, get_dart_company_info_by_code


# ─── 상태 정의 ────────────────────────────────────────────────────
class RAGState(TypedDict):
    """LangGraph 노드 간에 전달되는 QA 파이프라인 상태."""
    question: str                       # 사용자 원본 질문
    company_name: str                   # 회사명 (외부 소스 검색용)
    dart_corp_code: str                 # DART corp_code (있으면 이름 매핑 스킵)
    prompt: str                         # 백엔드에서 전달된 추가 프롬프트
    model: str                          # 사용할 GPT 모델명

    db_contexts: list[dict[str, Any]]   # 백엔드에서 전달한 DB 임베딩 컨텍스트
    dart_salary: dict[str, Any]         # DART 평균 연봉 정보

    merged_contexts: list[dict[str, Any]]  # 통합된 최종 컨텍스트
    answer: str                         # 최종 답변
    used_contexts: list[dict[str, Any]] # GPT가 실제로 인용한 컨텍스트


SYSTEM_PROMPT = """너는 취업 준비생을 위한 회사 정보 AI 어시스턴트야.

답변 원칙:
1. 제공된 [참고 문서], [DART 공시 정보], [직원 리뷰]가 있으면 적극 활용해 답변해.
2. 참고 자료에 해당 내용이 없더라도 "근거 없음"이라고만 하지 말고, 네가 알고 있는 일반 지식을 활용해 최대한 유용한 답변을 제공해.
3. 단, 연봉·재무 수치처럼 틀리면 큰 문제가 되는 사실은 반드시 출처(DART 공시 또는 직원 리뷰 등)가 있을 때만 언급하고, 없으면 "정확한 수치는 공식 자료를 확인해주세요"라고 안내해.
4. [직원 리뷰]에 "등록된 리뷰가 없습니다"라고 명시된 경우, 답변 첫머리에 "아직 등록된 직원 리뷰가 없어 일반적인 정보로 안내드립니다"라고 먼저 언급하고 일반 지식으로 보완해.
5. 복지, 조직 문화, 사업 분야, 기업 분위기 등 구직자에게 유용한 정보는 일반 지식을 바탕으로 적극적으로 답변해.
6. 답변은 항상 구체적이고 실용적으로, 한국어로 친절하게 작성해.
7. 답변 본문에 "(출처: DART)", "(출처: 뉴스)" 등 출처 표기를 절대 포함하지 마."""


_STOP_WORDS = {
    "이", "가", "을", "를", "은", "는", "의", "에", "도", "로", "와", "과",
    "하고", "하는", "있는", "있습니다", "합니다", "있어", "없어", "the", "and",
    "for", "that", "this", "with", "from", "are", "was", "has",
}


def _source_contributed(answer_lower: str, source_content: str, min_matches: int = 2) -> bool:
    """출처 내용의 핵심 단어가 답변에 충분히 등장하면 해당 출처가 기여한 것으로 판단한다."""
    words = [
        w.strip("[]().,!?\"'")
        for w in source_content.split()
        if len(w) > 3 and w not in _STOP_WORDS
    ]
    if not words:
        return False
    matches = sum(1 for w in words[:30] if w.lower() in answer_lower)
    return matches >= min_matches


def _client() -> OpenAI | None:
    """환경변수에서 OpenAI 클라이언트를 만들고, 설정이 없으면 None을 반환한다."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


# ─── 노드 1: 외부 소스 병렬 수집 ────────────────────────────────
def fetch_external_sources_node(state: RAGState) -> dict:
    """
    DART 데이터를 수집한다.
    dart_corp_code가 있으면 이름 매핑 없이 corp_code로 직접 조회한다.
    API 키 없거나 실패해도 빈 리스트로 graceful fallback.
    """
    company_name = state.get("company_name", "")
    dart_corp_code = state.get("dart_corp_code", "")

    if not company_name and not dart_corp_code:
        return {"dart_salary": {}}

    dart_salary: dict = {}

    try:
        if dart_corp_code:
            dart_salary = get_dart_company_info_by_code(dart_corp_code) or {}
        else:
            dart_salary = get_dart_company_info(company_name) or {}
        logger.info("[RAG] DART result keys: %s", list(dart_salary.keys()) if dart_salary else "empty")
    except Exception as e:
        logger.error("[RAG] dart fetch failed: %s", e)

    return {"dart_salary": dart_salary}


# ─── 노드 2: 소스 통합 ────────────────────────────────────────────
def merge_sources_node(state: RAGState) -> dict:
    """
    DB 컨텍스트 + DART 연봉 + 네이버 뉴스를 단일 컨텍스트 리스트로 통합한다.
    """
    merged: list[dict[str, Any]] = []

    # 1) DB 임베딩 컨텍스트
    for ctx in state.get("db_contexts", []):
        merged.append({
            "source_type": "document",
            "sourceUrl": ctx.get("sourceUrl", ""),
            "content": ctx.get("content", ""),
        })

    # 2) DART 공시 데이터 (기업정보 + 연봉 + 재무)
    dart = state.get("dart_salary", {})
    if dart:
        sections: list[str] = [f"[DART 공시 정보] 출처: {dart.get('source', 'DART')}"]

        # 기업 기본정보
        basic_parts = []
        if dart.get("ceo"):
            basic_parts.append(f"대표자: {dart['ceo']}")
        if dart.get("established"):
            basic_parts.append(f"설립일: {dart['established']}")
        if dart.get("address"):
            basic_parts.append(f"주소: {dart['address']}")
        if dart.get("stock_code"):
            basic_parts.append(f"종목코드: {dart['stock_code']}")
        if basic_parts:
            sections.append("■ 기업 기본정보\n" + " | ".join(basic_parts))

        # 직원 현황 / 연봉
        salary = dart.get("salary", {})
        if salary:
            sal_parts = []
            if salary.get("avg_salary_million"):
                from app.services.jobs.dart_service import format_salary
                sal_parts.append(f"평균 연봉: {format_salary(salary['avg_salary_million'])}")
            if salary.get("total_employees"):
                sal_parts.append(f"직원 수: {salary['total_employees']:,}명")
            if salary.get("avg_tenure_years"):
                sal_parts.append(f"평균 근속: {salary['avg_tenure_years']}년")
            if sal_parts:
                sections.append(f"■ {salary.get('year', '')}년 직원 현황\n" + " | ".join(sal_parts))

        # 재무정보
        fin = dart.get("financials", {})
        if fin:
            fin_parts = []
            def _fmt_billion(val):
                if val is None:
                    return "미공개"
                return f"{val / 100_000:,.1f}억원"  # 백만원 → 억원

            if fin.get("revenue") is not None:
                fin_parts.append(f"매출액: {_fmt_billion(fin['revenue'])}")
            if fin.get("operating_profit") is not None:
                fin_parts.append(f"영업이익: {_fmt_billion(fin['operating_profit'])}")
            if fin.get("net_income") is not None:
                fin_parts.append(f"당기순이익: {_fmt_billion(fin['net_income'])}")
            if fin.get("total_assets") is not None:
                fin_parts.append(f"자산총계: {_fmt_billion(fin['total_assets'])}")
            if fin_parts:
                fs_type = fin.get("fs_type", "")
                sections.append(f"■ {fin.get('year', '')}년 재무정보 ({fs_type})\n" + " | ".join(fin_parts))

        merged.append({
            "source_type": "dart_info",
            "sourceUrl": "https://dart.fss.or.kr",
            "content": "\n".join(sections),
        })

    return {"merged_contexts": merged}


# ─── 노드 3: 답변 생성 (Two-pass + Structured Output) ──────────
def generate_answer_node(state: RAGState) -> dict:
    """
    Pass 1: JSON 구조화 출력으로 답변 생성.
    Pass 2: 생성된 답변과 출처 자료를 비교해 실제 기여한 출처만 추출.
    """
    client = _client()
    merged = state.get("merged_contexts", [])

    if not client:
        fallback = "\n".join(c.get("content", "") for c in merged[:3])
        return {"answer": fallback or "답변을 생성할 수 없습니다.", "used_contexts": []}

    user_content = (state.get("prompt") or state["question"]).strip()
    ctx_index: dict[int, dict] = {}
    counter = 0
    context_block = ""

    if merged:
        sections: list[str] = []
        docs     = [c for c in merged if c.get("source_type") == "document"]
        dart_ctx = [c for c in merged if c.get("source_type") == "dart_info"]
        jobs     = [c for c in merged if c.get("source_type") == "job_posting"]

        if docs:
            lines = []
            for c in docs[:3]:
                counter += 1
                ctx_index[counter] = c
                lines.append(f"[출처{counter}] {c.get('content', '')[:600]}")
            sections.append("[참고 문서]\n" + "\n".join(lines))

        if dart_ctx:
            counter += 1
            ctx_index[counter] = dart_ctx[0]
            sections.append(f"[DART 공시 정보]\n[출처{counter}] {dart_ctx[0].get('content', '')}")

        if jobs:
            lines = []
            for c in jobs:
                counter += 1
                ctx_index[counter] = c
                lines.append(f"[출처{counter}] {c.get('content', '')}")
            sections.append("[현재 채용공고]\n" + "\n".join(lines))

        context_block = "\n\n".join(sections)
        user_content += "\n\n" + context_block

    model = state.get("model", "gpt-4o-mini")

    # ── Pass 1: 답변 생성 (JSON 구조화 출력) ──────────────────────
    try:
        res1 = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT + '\n\n응답은 반드시 JSON 형식으로 반환해: {"answer": "답변 텍스트"}',
                },
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            max_tokens=1200,
            temperature=0.3,
        )
        answer = _json.loads(res1.choices[0].message.content or "{}").get("answer", "").strip()
        if not answer:
            answer = "답변을 생성할 수 없습니다."
    except Exception as e:
        logger.error("[RAG] Pass1 failed: %s", e)
        return {"answer": f"답변 생성 중 오류: {e}", "used_contexts": []}

    # ── Pass 2: 키워드 매칭으로 출처 검증 (추가 API 비용 없음) ────
    used_ctxs: list[dict] = []
    if ctx_index:
        answer_lower = answer.lower()
        for idx, ctx in ctx_index.items():
            content = ctx.get("content", "")
            if _source_contributed(answer_lower, content):
                used_ctxs.append(ctx)

    return {"answer": answer, "used_contexts": used_ctxs}


# ─── 그래프 조립 ──────────────────────────────────────────────────
def _build_graph() -> StateGraph:
    """외부 수집 → 소스 병합 → 답변 생성의 고정 3단계 그래프를 컴파일한다."""
    workflow = StateGraph(RAGState)

    workflow.add_node("fetch_external_sources", fetch_external_sources_node)
    workflow.add_node("merge_sources",          merge_sources_node)
    workflow.add_node("generate_answer",        generate_answer_node)

    workflow.set_entry_point("fetch_external_sources")
    workflow.add_edge("fetch_external_sources", "merge_sources")
    workflow.add_edge("merge_sources",          "generate_answer")
    workflow.add_edge("generate_answer",        END)

    return workflow.compile()


# 모듈 로드 시 그래프 한 번만 컴파일
rag_graph = _build_graph()


# ─── 외부 진입점 ──────────────────────────────────────────────────
def run_rag_pipeline(
    question: str,
    prompt: str,
    contexts: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
    company_name: str = "",
    dart_corp_code: str = "",
) -> dict[str, Any]:
    """멀티 소스 LangGraph RAG 파이프라인을 실행하고 답변과 외부 컨텍스트를 반환한다."""
    initial: RAGState = {
        "question": question,
        "company_name": company_name,
        "dart_corp_code": dart_corp_code,
        "prompt": prompt,
        "model": model,
        "db_contexts": contexts,
        "dart_salary": {},
        "merged_contexts": [],
        "used_contexts": [],
        "answer": "",
    }
    result = rag_graph.invoke(initial)
    return {
        "answer": result.get("answer") or "답변을 생성할 수 없습니다.",
        "contexts": result.get("used_contexts", []),
    }

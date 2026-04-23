from __future__ import annotations

import json as _json
import logging
import os
from typing import Any

from openai import OpenAI

from app.services.agent.tools import TOOL_SCHEMAS, run_tool

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 5

AGENT_SYSTEM_PROMPT = """너는 취업 준비생을 위한 회사 정보 AI 어시스턴트야.

질문을 받으면 다음 도구들을 활용해 필요한 정보를 수집한 뒤 답변해:
- search_company_documents: 회사 홈페이지 크롤링 데이터 (소개, 문화, 채용 등)
- get_dart_info: DART 공시 데이터 (연봉, 재무, 직원수 등 수치)
- search_news: 네이버 뉴스 API로 회사 관련 최신 뉴스 검색

도구 선택 원칙:
1. 질문에 필요한 도구만 호출해. 불필요한 도구는 쓰지 마.
2. 연봉·재무 수치 → get_dart_info 사용
3. 회사 소개·문화·채용 → search_company_documents 사용
4. 최근 동향·이슈·뉴스 → search_news 사용. 회사명이 있으면 회사명으로, 없으면 사용자 프로필의 희망 업종/직군을 활용해 검색해.
   예) 프로필에 "희망 업종: IT", "희망 직군: 백엔드 개발자"가 있고 "최근 뉴스 알려줘"라고 하면 → search_news(query="IT 백엔드 개발자 채용")
5. 복합 질문이면 여러 도구를 순서대로 호출해도 돼.
6. 반드시 도구 기반 근거를 확보한 뒤 답변해.

답변 원칙:
- 수집된 데이터를 근거로 구체적이고 실용적으로 답해.
- 단순히 요약하지 말고, 항목별로 나누어 상세하게 설명해. 예) 복지 → 항목별 복지 내용 열거, 연봉 → 직급/연차별 수치 제시.
- 수치·사례·제도명 등 구체적인 정보를 최대한 포함해.
- 답변이 길어지더라도 빠진 내용 없이 충분히 작성해.
- 연봉·재무 수치는 반드시 DART 출처가 있을 때만 언급해.
- 도구 결과(문서/DART/뉴스)에 없는 사실을 일반 지식으로 보완하거나 추측해 쓰지 마.
- 근거가 부족하면 추측하지 말고 "확인된 정보가 없어 답변할 수 없습니다."라고 안내해.
- 마크다운 형식(##, -, **굵게** 등)을 활용해 읽기 쉽게 구성해.
- 뉴스 답변 시: 본문에 출처 링크나 "[뉴스1]" 같은 출처 참조를 절대 포함하지 마. 각 뉴스는 제목, 핵심 내용 요약, 발행일만 포함해. 출처 URL은 시스템이 별도로 표시하므로 본문에 넣지 마.
- 한국어로 친절하게 작성해."""


def _client() -> OpenAI | None:
    """환경변수에서 OpenAI 클라이언트를 만들고, 설정이 없으면 None을 반환한다."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def run_agent(
    question: str,
    prompt: str,
    db_contexts: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
    company_name: str = "",
    dart_corp_code: str = "",
) -> dict[str, Any]:
    """
    Tool-use ReAct 에이전트를 실행하고 {"answer": str, "contexts": list} 를 반환한다.

    흐름:
      GPT 판단 → 도구 선택 → 도구 실행 → 결과 관찰 → (반복) → 최종 답변
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    # 초기 메시지 구성
    user_msg = question
    if prompt and prompt.strip() and prompt.strip() != question.strip():
        user_msg = f"{prompt}\n\n질문: {question}"

    messages: list[dict] = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    accumulated_ctxs: list[dict[str, Any]] = []

    for iteration in range(MAX_ITERATIONS):
        logger.info("[Agent] iteration=%d", iteration + 1)

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="required" if iteration == 0 else "auto",
                max_tokens=3000,
                temperature=0.3,
            )
        except Exception as e:
            logger.error("[Agent] GPT call failed: %s", e)
            return {"answer": f"답변 생성 중 오류: {e}", "contexts": []}

        choice = response.choices[0]
        messages.append(choice.message)

        # 도구 호출 없음 → 최종 답변
        if choice.finish_reason != "tool_calls":
            if not accumulated_ctxs:
                return {"answer": "확인된 정보가 없어 답변할 수 없습니다. 먼저 회사 정보 수집(크롤링)을 진행해주세요.", "contexts": []}
            if _requires_document_context(question) and not _has_document_context(accumulated_ctxs):
                return {"answer": "회사 복지/문화 관련 문서 근거가 없어 답변할 수 없습니다. 먼저 최신 회사 문서를 수집해주세요.", "contexts": []}
            answer = (choice.message.content or "").strip()
            used = _filter_used_contexts(answer, accumulated_ctxs)
            logger.info("[Agent] done. tools_called=%d used_contexts=%d",
                        iteration, len(used))
            return {"answer": answer, "contexts": used}

        # 도구 호출 실행
        for tool_call in choice.message.tool_calls:
            name = tool_call.function.name
            args = _json.loads(tool_call.function.arguments or "{}")
            logger.info("[Agent] tool=%s args=%s", name, args)
            result_text, ctxs = run_tool(
                tool_name=name,
                tool_args=args,
                db_contexts=db_contexts,
                company_name=company_name,
                dart_corp_code=dart_corp_code,
            )
            accumulated_ctxs.extend(ctxs)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result_text,
            })

    # 최대 반복 초과
    logger.warning("[Agent] max iterations reached")
    return {"answer": "정보를 충분히 수집하지 못해 답변을 생성할 수 없습니다.", "contexts": []}


def _requires_document_context(question: str) -> bool:
    """질문이 회사 문화/복지처럼 문서 근거를 꼭 요구하는 성격인지 판별한다."""
    q = (question or "").lower()
    keywords = [
        "복지", "문화", "조직", "분위기", "워라밸", "근무환경",
        "benefit", "culture", "work-life",
    ]
    return any(k in q for k in keywords)


def _has_document_context(contexts: list[dict[str, Any]]) -> bool:
    """누적 컨텍스트 중 회사 문서 출처가 하나라도 있는지 확인한다."""
    return any((ctx.get("source_type") or "") == "document" for ctx in contexts)


def _normalize_url(url: str) -> str:
    """비교용 URL 정규화: 트레일링 슬래시 제거, 소문자 변환."""
    return url.rstrip("/").lower()


def _filter_used_contexts(
    answer: str, contexts: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """도구 호출로 수집한 컨텍스트를 URL 기준으로 dedupe 해 반환한다.

    현재 에이전트 응답은 명시적 인용 마커를 남기지 않으므로, 본문 키워드 매칭 대신
    실제로 호출된 도구 결과를 보수적으로 노출한다.
    """
    seen_urls: set[str] = set()
    result = []
    for ctx in contexts:
        url = ctx.get("sourceUrl", "")
        if not url:
            continue
        key = _normalize_url(url)
        if key in seen_urls:
            continue
        seen_urls.add(key)
        result.append(ctx)
    return result

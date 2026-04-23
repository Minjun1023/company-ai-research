from __future__ import annotations

import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any


from openai import OpenAI

from app.services.jobs.dart_service import get_dart_company_info, get_dart_company_info_by_code

logger = logging.getLogger(__name__)


COMPARE_SYSTEM_PROMPT = """너는 취업 준비생을 위한 회사 비교 AI 어시스턴트야.

각 회사의 정보가 제공될 거야. 질문에 맞게 각 회사를 체계적으로 비교해서 답변해:

답변 원칙:
1. 표의 항목은 반드시 사용자 질문 주제에만 집중해. 아래 예시를 참고해:
   - 복지·혜택 관련 질문 → 복지 제도, 근무환경, 교육 지원, 사내 문화 항목만
   - 연봉 관련 질문 → 평균연봉, 연봉 인상률, 성과급 항목만
   - 채용·입사 관련 질문 → 채용 프로세스, 서류·면접 전형 항목만
   - 전반적 비교 요청(예: "두 회사 비교해줘") → 연봉, 복지, 문화, 분위기 등 종합 항목
2. 질문 주제와 무관한 항목(예: 복지 질문에 평균연봉·직원수·매출·영업이익)은 표에 절대 포함하지 마.
3. 연봉·재무 수치는 DART 출처가 있을 때만 언급하고, 없으면 "정보 없음"이라고 표시해.
4. 마크다운 표(테이블)로 항목별 비교를 먼저 작성해.
5. 표 아래에 2-3줄 요약 코멘트를 작성하되, "A가 더 낫다" 또는 "B가 더 강점이 있다"처럼 어느 쪽이 더 나은지 명확하게 판단을 제시해.
6. 한국어로 친절하게 작성해.
7. 답변 본문에 "(출처: DART)", "(출처: 뉴스)" 등 출처 표기를 절대 포함하지 마."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def _fetch_company_data(name: str, dart_corp_code: str) -> dict[str, Any]:
    """단일 회사의 DART 데이터를 수집한다."""
    dart_data: dict = {}

    try:
        if dart_corp_code:
            dart_data = get_dart_company_info_by_code(dart_corp_code) or {}
        elif name:
            dart_data = get_dart_company_info(name) or {}
    except Exception as e:
        logger.warning("[Compare] dart fetch failed for %s: %s", name, e)

    return {"name": name, "dart": dart_data}


_SALARY_KEYWORDS = re.compile(r"연봉|salary|급여|임금|페이|pay|재무|매출|영업이익|수익|직원수|인원")
_WELFARE_KEYWORDS = re.compile(r"복지|혜택|근무|문화|분위기|워라밸|wlb|work.life|휴가|연차|사내|교육|지원|복리")


def _is_salary_question(question: str) -> bool:
    return bool(_SALARY_KEYWORDS.search(question))


def _is_welfare_only_question(question: str) -> bool:
    """복지/문화 전용 질문이면서 연봉·재무 관련 키워드가 없는 경우."""
    return bool(_WELFARE_KEYWORDS.search(question)) and not _is_salary_question(question)


def _build_company_block(
    company_input: dict[str, Any],
    fetched: dict[str, Any],
    question: str = "",
) -> str:
    """회사 정보 블록을 텍스트로 구성한다."""
    name = company_input.get("name", "")
    contexts = company_input.get("contexts", [])
    dart = fetched.get("dart", {})

    include_financials = not _is_welfare_only_question(question)

    lines: list[str] = [f"=== {name} ==="]

    # 크롤링 문서
    if contexts:
        for i, ctx in enumerate(contexts[:2]):
            snippet = (ctx.get("content", "") or "")[:400]
            lines.append(f"[문서{i + 1}] {snippet}")

    # DART 공시
    if dart:
        dart_parts = [f"[DART 공시] 출처: {dart.get('source', 'DART')}"]
        basic = []
        if dart.get("ceo"):
            basic.append(f"대표자: {dart['ceo']}")
        if dart.get("established"):
            basic.append(f"설립일: {dart['established']}")
        if basic:
            dart_parts.append("■ 기업정보: " + " | ".join(basic))

        if include_financials:
            salary = dart.get("salary", {})
            if salary:
                sal = []
                if salary.get("avg_salary_million"):
                    from app.services.jobs.dart_service import format_salary
                    sal.append(f"평균연봉: {format_salary(salary['avg_salary_million'])}")
                if salary.get("total_employees"):
                    sal.append(f"직원수: {salary['total_employees']:,}명")
                if salary.get("avg_tenure_years"):
                    sal.append(f"평균근속: {salary['avg_tenure_years']}년")
                if sal:
                    dart_parts.append(f"■ {salary.get('year', '')}년 직원현황: " + " | ".join(sal))

            fin = dart.get("financials", {})
            if fin:
                def _fmt(v):
                    return "미공개" if v is None else f"{v / 100_000:,.1f}억원"
                fin_parts = []
                if fin.get("revenue") is not None:
                    fin_parts.append(f"매출: {_fmt(fin['revenue'])}")
                if fin.get("operating_profit") is not None:
                    fin_parts.append(f"영업이익: {_fmt(fin['operating_profit'])}")
                if fin_parts:
                    dart_parts.append(f"■ {fin.get('year', '')}년 재무: " + " | ".join(fin_parts))

        lines.append("\n".join(dart_parts))

    if len(lines) == 1:
        lines.append("(수집된 정보 없음)")

    return "\n".join(lines)


def compare_companies(
    question: str,
    companies: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    여러 회사를 비교하는 에이전트를 실행한다.

    companies: [{"name": str, "dart_corp_code": str, "contexts": list}, ...]
    반환: {"answer": str, "contexts": list}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    if len(companies) < 2:
        return {"answer": "비교할 회사가 2개 이상 필요합니다.", "contexts": []}

    # 각 회사 데이터를 병렬 수집
    fetched_map: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=len(companies)) as executor:
        futures = {
            executor.submit(
                _fetch_company_data,
                c.get("name", ""),
                c.get("dart_corp_code", ""),
            ): c.get("name", "")
            for c in companies
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                fetched_map[name] = future.result()
            except Exception as e:
                logger.error("[Compare] fetch failed for %s: %s", name, e)
                fetched_map[name] = {"name": name, "dart": {}, "news": []}

    # 회사별 컨텍스트 블록 구성
    blocks: list[str] = []
    all_contexts: list[dict[str, Any]] = []

    for company in companies:
        name = company.get("name", "")
        fetched = fetched_map.get(name, {"name": name, "dart": {}, "news": []})
        block = _build_company_block(company, fetched, question=question)
        blocks.append(block)

        # 출처 수집: LLM에 전달된 것과 동일하게 (DART + 크롤링 문서 + 뉴스 2개)
        dart = fetched.get("dart", {})
        if dart:
            all_contexts.append({
                "source_type": "dart_info",
                "sourceUrl": "https://dart.fss.or.kr",
                "content": f"[{name} DART] {dart.get('source', '')}",
            })
        for ctx in company.get("contexts", [])[:2]:
            all_contexts.append({
                "source_type": "document",
                "sourceUrl": ctx.get("sourceUrl", ""),
                "content": ctx.get("content", ""),
            })
    company_section = "\n\n".join(blocks)
    user_content = f"질문: {question}\n\n{company_section}"

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": COMPARE_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=1500,
            temperature=0.3,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "비교 답변을 생성할 수 없습니다."
    except Exception as e:
        logger.error("[Compare] GPT call failed: %s", e)
        return {"answer": f"비교 답변 생성 중 오류: {e}", "contexts": []}

    # 출처는 크롤링 문서와 DART만 표시한다.
    # 뉴스는 LLM 컨텍스트로 활용하지만 관련성이 낮은 기사가 섞일 수 있어 출처에서 제외한다.
    seen_urls: set[str] = set()
    used_contexts = []
    for c in all_contexts:
        url = c.get("sourceUrl", "")
        if url and c.get("source_type") in ("dart_info", "document") and url not in seen_urls:
            seen_urls.add(url)
            used_contexts.append(c)

    logger.info("[Compare] done. companies=%d contexts=%d", len(companies), len(used_contexts))
    return {"answer": answer, "contexts": used_contexts}
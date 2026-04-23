from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from openai import OpenAI

from app.services.jobs.dart_service import get_dart_company_info, get_dart_company_info_by_code

logger = logging.getLogger(__name__)


RESEARCH_SYSTEM_PROMPT = """너는 취업 준비생과 이직자를 위한 기업 분석 전문 AI야.
제공된 자료를 바탕으로 아래 형식의 기업 분석 리포트를 작성해.

리포트 형식 (마크다운):
## [회사명] 기업 분석 리포트

### 1. 기업 개요
- 설립, 대표, 업종, 주요 사업 등 핵심 정보만 간략하게

### 2. 조직 문화 & 복지
- 근무 환경, 조직 분위기 (수평/수직), 자율성, 워라밸 관련 내용
- 복지 제도, 사내 제도, 구성원 가치관 등
- 회사 문서에 없으면 업종·규모·업력을 근거로 합리적으로 추정하되 추정임을 명시

### 3. 채용 정보
- 주요 채용 직무·분야
- 자격요건 및 우대사항
- 채용 과정 (있으면)

### 4. 연봉 & 근속
- 평균 연봉, 평균 근속연수 (DART 공시 기준, 없으면 "공개 데이터 없음" 명시)
- 직원 수 간략 언급

### 5. 이 회사 어때?
- 취업 준비생/이직자 관점에서 이 회사의 장점과 주의할 점을 솔직하게 2-4문장으로 작성

작성 원칙:
- 각 섹션은 반드시 작성한다. 자료가 없으면 "관련 정보 없음"이라고 명시한다.
- 대표이사는 [회사 홈페이지 문서]에서 "대표이사", "CEO", "대표" 키워드로 찾아 추출한다.
- 직원 수는 [Wanted 기업정보]가 있으면 우선 사용하고, 없으면 DART 데이터를 사용한다.
- 평균연봉은 [Wanted 기업정보]가 있으면 우선 사용하고, 없으면 DART 공시 데이터를 인용한다.
- 재무 정보(매출, 영업이익 등)는 리포트에 포함하지 않는다.
- 뉴스는 리포트에 포함하지 않는다.
- 한국어로 실용적이고 솔직하게 작성한다.
- 답변 본문에 "(출처: DART)" 등 출처 표기를 절대 포함하지 마."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def _build_dart_section(dart: dict[str, Any]) -> str:
    if not dart:
        return ""
    parts = ["[DART 공시]"]

    basic = []
    if dart.get("ceo"):
        basic.append(f"대표자: {dart['ceo']}")
    if dart.get("established"):
        basic.append(f"설립일: {dart['established']}")
    if dart.get("address"):
        basic.append(f"주소: {dart['address']}")
    if basic:
        parts.append("■ 기업정보: " + " | ".join(basic))

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
            parts.append(f"■ {salary.get('year', '')}년 직원현황: " + " | ".join(sal))

    return "\n".join(parts)


def research_company(
    company_name: str,
    dart_corp_code: str,
    contexts: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    회사 심층 리서치 리포트를 생성한다.

    반환: {"answer": str, "contexts": list}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    # DART 공시 수집
    dart_data: dict = {}

    with ThreadPoolExecutor(max_workers=1) as executor:
        if dart_corp_code:
            dart_future = executor.submit(get_dart_company_info_by_code, dart_corp_code)
        elif company_name:
            dart_future = executor.submit(get_dart_company_info, company_name)
        else:
            dart_future = None

        if dart_future:
            try:
                dart_data = dart_future.result() or {}
                logger.info("[Research] DART keys: %s", list(dart_data.keys()) if dart_data else "empty")
            except Exception as e:
                logger.warning("[Research] DART fetch failed: %s", e)

    # 컨텍스트 블록 구성
    sections: list[str] = []

    # 크롤링 문서
    if contexts:
        doc_lines = [
            f"[문서{i + 1}] (출처: {ctx.get('sourceUrl', '')}) {ctx.get('content', '')[:500]}"
            for i, ctx in enumerate(contexts[:5])
        ]
        sections.append("[회사 홈페이지 문서]\n" + "\n\n".join(doc_lines))

    # DART 공시
    dart_section = _build_dart_section(dart_data)
    if dart_section:
        sections.append(dart_section)

    if not sections:
        context_block = "(수집된 정보 없음 — 일반 지식으로 작성)"
    else:
        context_block = "\n\n".join(sections)

    user_content = (
        f"회사명: {company_name}\n\n"
        f"수집된 자료:\n{context_block}\n\n"
        f"위 자료를 바탕으로 '{company_name}'에 대한 상세 기업 분석 리포트를 작성해줘."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2000,
            temperature=0.3,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "리포트를 생성할 수 없습니다."
    except Exception as e:
        logger.error("[Research] GPT call failed: %s", e)
        return {"answer": f"리포트 생성 중 오류: {e}", "contexts": []}

    # 출처: LLM에 실제로 전달된 것만 표시 (DART + 크롤링 문서)
    used_contexts: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    if dart_data:
        seen_urls.add("https://dart.fss.or.kr")
        used_contexts.append({
            "source_type": "dart_info",
            "sourceUrl": "https://dart.fss.or.kr",
            "content": dart_section,
        })
    for ctx in contexts[:5]:
        url = ctx.get("sourceUrl", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            used_contexts.append({
                "source_type": "document",
                "sourceUrl": url,
                "content": ctx.get("content", ""),
            })
    logger.info("[Research] done. contexts=%d", len(used_contexts))
    return {"answer": answer, "contexts": used_contexts}
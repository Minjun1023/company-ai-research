from __future__ import annotations

import logging
from typing import Any

from app.services.jobs.dart_service import (
    get_dart_company_info,
    get_dart_company_info_by_code,
)

logger = logging.getLogger(__name__)

# ─── OpenAI Function Calling 스키마 ──────────────────────────────
TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_company_documents",
            "description": (
                "DB에 저장된 회사 크롤링 문서에서 관련 내용을 검색합니다. "
                "회사 소개, 사업 분야, 조직 문화, 복지, 채용 정보 등 "
                "일반적인 회사 정보를 물을 때 사용하세요."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dart_info",
            "description": (
                "DART 공시에서 재무정보, 평균 연봉, 직원 수, 대표자, 설립일 등 "
                "공식 수치 데이터를 조회합니다. "
                "연봉·재무·실적·직원현황 등 숫자 데이터가 필요할 때 사용하세요."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


# ─── 도구 실행기 ──────────────────────────────────────────────────
def run_tool(
    tool_name: str,
    tool_args: dict[str, Any],
    db_contexts: list[dict[str, Any]],
    company_name: str,
    dart_corp_code: str,
) -> tuple[str, list[dict[str, Any]]]:
    """
    도구를 실행하고 (텍스트 결과, 출처 컨텍스트 리스트)를 반환한다.
    """
    if tool_name == "search_company_documents":
        return _search_documents(db_contexts)

    if tool_name == "get_dart_info":
        return _get_dart_info(company_name, dart_corp_code)

    return f"알 수 없는 도구: {tool_name}", []


# ─── 개별 도구 구현 ───────────────────────────────────────────────
def _search_documents(
    db_contexts: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    if not db_contexts:
        return "DB에 저장된 회사 문서가 없습니다. 먼저 정보 수집이 필요합니다.", []

    lines = [
        f"[문서{i + 1}] {ctx.get('content', '')[:500]}"
        for i, ctx in enumerate(db_contexts[:3])
    ]
    used = [
        {
            "source_type": "document",
            "sourceUrl": ctx.get("sourceUrl", ""),
            "content": ctx.get("content", ""),
        }
        for ctx in db_contexts[:3]
    ]
    return "\n\n".join(lines), used


def _get_dart_info(
    company_name: str, dart_corp_code: str
) -> tuple[str, list[dict[str, Any]]]:
    try:
        if dart_corp_code:
            data = get_dart_company_info_by_code(dart_corp_code)
        elif company_name:
            data = get_dart_company_info(company_name)
        else:
            return "회사 정보가 없어 DART 조회를 할 수 없습니다.", []

        if not data:
            return "DART에서 해당 회사 정보를 찾을 수 없습니다.", []

        parts: list[str] = [f"[DART 공시] 출처: {data.get('source', 'DART')}"]

        basic = []
        if data.get("ceo"):
            basic.append(f"대표자: {data['ceo']}")
        if data.get("established"):
            basic.append(f"설립일: {data['established']}")
        if data.get("address"):
            basic.append(f"주소: {data['address']}")
        if basic:
            parts.append("■ 기업정보\n" + " | ".join(basic))

        salary = data.get("salary", {})
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
                parts.append(f"■ {salary.get('year', '')}년 직원현황\n" + " | ".join(sal))

        fin = data.get("financials", {})
        if fin:
            def _fmt(v):
                return "미공개" if v is None else f"{v / 100_000:,.1f}억원"
            fin_parts = []
            if fin.get("revenue") is not None:
                fin_parts.append(f"매출: {_fmt(fin['revenue'])}")
            if fin.get("operating_profit") is not None:
                fin_parts.append(f"영업이익: {_fmt(fin['operating_profit'])}")
            if fin_parts:
                parts.append(f"■ {fin.get('year', '')}년 재무\n" + " | ".join(fin_parts))

        content = "\n".join(parts)
        ctx = [{"source_type": "dart_info", "sourceUrl": "https://dart.fss.or.kr", "content": content}]
        return content, ctx

    except Exception as e:
        logger.error("[Tool] get_dart_info failed: %s", e)
        return f"DART 조회 중 오류가 발생했습니다: {e}", []



from __future__ import annotations

import logging
from typing import Any

from app.services.jobs.dart_service import (
    get_dart_company_info,
    get_dart_company_info_by_code,
)
from app.services.news.naver_news_service import search_company_news, search_news as search_news_api

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
    {
        "type": "function",
        "function": {
            "name": "search_news",
            "description": (
                "네이버 뉴스 API로 최신 뉴스를 검색합니다. "
                "회사 관련 뉴스, 업종/직무별 채용 동향, 최근 이슈 등을 물을 때 사용하세요. "
                "query에 회사명, 업종 키워드(예: 'IT 채용'), 직무 키워드(예: '백엔드 개발자 채용') 등을 넣을 수 있습니다. "
                "사용자 프로필에 희망 업종이나 직군이 있으면 그에 맞는 키워드로 검색하세요."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "검색할 키워드. 회사명, 업종, 직무 등. 예: '카카오', 'IT 채용 동향', '백엔드 개발자 채용'"
                    }
                },
                "required": [],
            },
        },
    },
]


def run_tool(
    tool_name: str,
    tool_args: dict[str, Any],
    db_contexts: list[dict[str, Any]],
    company_name: str,
    dart_corp_code: str,
) -> tuple[str, list[dict[str, Any]]]:
    """도구 이름에 맞는 내부 검색 함수를 실행한다.

    반환값의 첫 번째 요소는 LLM에게 다시 전달할 텍스트이고,
    두 번째 요소는 프론트 출처 표시에 사용할 구조화 컨텍스트다.
    """
    if tool_name == "search_company_documents":
        return _search_documents(db_contexts)

    if tool_name == "get_dart_info":
        return _get_dart_info(company_name, dart_corp_code)

    if tool_name == "search_news":
        query = tool_args.get("query", "") or company_name
        return _search_news(query)

    return f"알 수 없는 도구: {tool_name}", []


def _search_documents(
    db_contexts: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    """백엔드가 넘긴 회사 문서 컨텍스트를 요약 텍스트와 출처 목록으로 변환한다."""
    if not db_contexts:
        return "DB에 저장된 회사 문서가 없습니다. 먼저 정보 수집이 필요합니다.", []

    lines = [
        f"[문서{i + 1}] {ctx.get('content', '')[:1200]}"
        for i, ctx in enumerate(db_contexts[:5])
    ]
    used = [
        {
            "source_type": "document",
            "sourceUrl": ctx.get("sourceUrl", ""),
            "content": ctx.get("content", ""),
        }
        for ctx in db_contexts[:5]
    ]
    return "\n\n".join(lines), used


def _get_dart_info(
    company_name: str, dart_corp_code: str
) -> tuple[str, list[dict[str, Any]]]:
    """회사명 또는 corp_code로 DART 공시 정보를 조회해 LLM 입력용 텍스트로 정리한다."""
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


def _search_news(query: str) -> tuple[str, list[dict[str, Any]]]:
    """뉴스 검색 결과를 요약 텍스트와 링크 목록으로 반환한다."""
    if not query:
        return "검색 키워드가 없어 뉴스를 검색할 수 없습니다.", []

    try:
        articles = search_news_api(query, display=5)
        if not articles:
            return f"'{query}' 관련 최신 뉴스를 찾을 수 없습니다.", []

        lines = []
        ctxs = []
        for article in articles:
            lines.append(
                f"제목: {article['title']}\n"
                f"내용: {article['description']}\n"
                f"발행일: {article['pub_date']}"
            )
            ctxs.append({
                "source_type": "news",
                "sourceUrl": article["link"],
                "content": f"{article['title']} - {article['description']}",
            })

        return "\n\n".join(lines), ctxs

    except Exception as e:
        logger.error("[Tool] search_news failed: %s", e)
        return f"뉴스 검색 중 오류가 발생했습니다: {e}", []


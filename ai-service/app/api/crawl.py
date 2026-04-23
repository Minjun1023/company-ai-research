from __future__ import annotations

import logging
from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl

from app.services.crawler.crawler_service import CrawlerService

log = logging.getLogger(__name__)


router = APIRouter()


class CrawlRequest(BaseModel):
    # 백엔드에서 company.website를 전달받아 크롤링을 요청하는 입력 스키마.
    url: HttpUrl


class CrawlResponse(BaseModel):
    source_url: str
    links: list[str]
    page_type_map: dict[str, list[str]]
    extracted_text: dict[str, str]
    documents: list[dict[str, object]]


@router.post("/dart/corp-code")
def get_corp_code(body: dict):
    from app.services.jobs.dart_service import (
        find_dart_corp_code, get_dart_company_info_by_code,
        search_companies_by_name,
    )
    company_name = body.get("company_name", "")
    corp_code = find_dart_corp_code(company_name)
    industry = ""
    normalized_name = None
    if corp_code:
        info = get_dart_company_info_by_code(corp_code)
        industry = info.get("industry", "")
        # DART 검색 결과에서 정규화된 회사명 추출 (예: "하이닉스" → "SK하이닉스")
        results = search_companies_by_name(company_name, limit=1)
        if results:
            normalized_name = results[0]["name"]
    return {"corp_code": corp_code, "industry": industry, "company_name": normalized_name}


@router.post("/crawl", response_model=CrawlResponse)
def crawl(request: CrawlRequest) -> CrawlResponse:
    # 회사 URL을 기반으로 HTML 수집 → 링크 탐색 → 주요 페이지 텍스트 추출.
    # 크롤링은 네트워크 상태에 따라 실패할 수 있어 실패 시에도 API는 빈 결과로 정상 반환한다.
    service = CrawlerService()
    source_url = str(request.url)

    try:
        result = service.crawl(source_url)
        return CrawlResponse(
            source_url=result.source_url,
            links=result.links,
            page_type_map=result.page_type_map,
            extracted_text=result.extracted_text,
            documents=result.documents,
        )
    except Exception as e:
        log.error("Crawl failed for url=%s: %s", source_url, e, exc_info=True)
        return CrawlResponse(
            source_url=source_url,
            links=[],
            page_type_map={},
            extracted_text={source_url: ""},
            documents=[],
        )

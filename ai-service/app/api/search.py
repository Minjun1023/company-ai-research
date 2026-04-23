from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.search.naver_search_service import find_company_info, search_company_names, search_company_candidates
from app.services.jobs.dart_service import search_companies_by_name, find_dart_homepage

router = APIRouter()


class CompanyUrlRequest(BaseModel):
    company_name: str


class CompanyUrlResponse(BaseModel):
    company_name: str
    url: str | None


class DartCompanyItem(BaseModel):
    name: str
    corp_code: str | None = None


@router.post("/search/company-url", response_model=CompanyUrlResponse)
def search_company_url(request: CompanyUrlRequest) -> CompanyUrlResponse:
    """
    회사명으로 공식 홈페이지 URL을 검색한다.
    1순위: DART company.json hm_url
    2순위: Naver Search API
    3순위: Wanted 회사 페이지 크롤링
    """
    name = request.company_name.strip()

    # 1순위: DART hm_url
    dart_url = find_dart_homepage(name)
    if dart_url:
        return CompanyUrlResponse(company_name=name, url=dart_url)

    # 2순위: Naver 검색
    info = find_company_info(name)
    if info and info.get("url"):
        return CompanyUrlResponse(company_name=info["name"], url=info["url"])

    return CompanyUrlResponse(company_name=name, url=None)


@router.get("/search/companies", response_model=list[DartCompanyItem])
def search_companies(q: str = Query(..., min_length=1)) -> list[DartCompanyItem]:
    """
    회사명 자동완성 검색.
    1순위: DART 등록 법인 (DART_API_KEY 필요)
    2순위: Naver 웹 검색에서 회사명 추출 (DART 결과 없을 때 폴백)
    """
    dart_results = search_companies_by_name(q, limit=8)
    if dart_results:
        return [DartCompanyItem(name=r["name"], corp_code=r["corp_code"]) for r in dart_results]

    naver_names = search_company_names(q, limit=8)
    return [DartCompanyItem(name=name) for name in naver_names]


class CompanyCandidateItem(BaseModel):
    name: str
    description: str = ""
    url: str | None = None


@router.get("/search/company-candidates", response_model=list[CompanyCandidateItem])
def search_company_candidates_api(name: str = Query(..., min_length=1)) -> list[CompanyCandidateItem]:
    """회사명으로 네이버 업체 후보 목록을 반환한다. 동명 회사 disambiguation용."""
    results = search_company_candidates(name)
    return [CompanyCandidateItem(**{k: v for k, v in r.items() if k in CompanyCandidateItem.model_fields}) for r in results]



from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.research.research_service import research_company

router = APIRouter()


class ResearchRequest(BaseModel):
    company_name: str
    dart_corp_code: str = ""
    contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class ResearchResponse(BaseModel):
    answer: str
    contexts: list[dict] = []


@router.post("/research", response_model=ResearchResponse)
def research(request: ResearchRequest) -> ResearchResponse:
    """회사 심층 분석 리포트를 생성한다."""
    result = research_company(
        company_name=request.company_name,
        dart_corp_code=request.dart_corp_code,
        contexts=request.contexts,
        model=request.model,
    )
    return ResearchResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )
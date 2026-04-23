from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.comparison.compare_service import compare_companies

router = APIRouter()


class CompanyInput(BaseModel):
    name: str
    dart_corp_code: str = ""
    contexts: list[dict[str, Any]] = Field(default_factory=list)


class CompareRequest(BaseModel):
    question: str
    companies: list[CompanyInput]
    model: str = "gpt-4o-mini"


class CompareResponse(BaseModel):
    answer: str
    contexts: list[dict] = []


@router.post("/compare", response_model=CompareResponse)
def compare(request: CompareRequest) -> CompareResponse:
    """여러 회사를 비교 분석한 답변을 생성한다."""
    result = compare_companies(
        question=request.question,
        companies=[c.model_dump() for c in request.companies],
        model=request.model,
    )
    return CompareResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )
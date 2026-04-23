from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.salary.salary_service import generate_salary_guide, conduct_salary_negotiation

router = APIRouter()


class SalaryRequest(BaseModel):
    company_name: str
    job_role: str = ""
    career_years: str = ""
    contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class SalaryResponse(BaseModel):
    answer: str
    contexts: list[dict] = []


class SalaryNegotiationMessage(BaseModel):
    role: str
    content: str


class SalaryNegotiationRequest(BaseModel):
    messages: list[SalaryNegotiationMessage] = Field(default_factory=list)
    company_name: str = ""
    company_contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class SalaryNegotiationResponse(BaseModel):
    answer: str
    is_complete: bool = False


@router.post("/salary-negotiation", response_model=SalaryNegotiationResponse)
def salary_negotiation(request: SalaryNegotiationRequest) -> SalaryNegotiationResponse:
    """대화형 연봉 협상 컨설팅을 진행한다."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    result = conduct_salary_negotiation(
        messages=messages,
        company_name=request.company_name,
        company_contexts=request.company_contexts,
        model=request.model,
    )
    return SalaryNegotiationResponse(
        answer=result["answer"],
        is_complete=result.get("is_complete", False),
    )


@router.post("/salary", response_model=SalaryResponse)
def salary_guide(request: SalaryRequest) -> SalaryResponse:
    """회사 정보 기반 연봉 협상 가이드를 생성한다."""
    result = generate_salary_guide(
        company_name=request.company_name,
        job_role=request.job_role,
        career_years=request.career_years,
        contexts=request.contexts,
        model=request.model,
    )
    return SalaryResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )

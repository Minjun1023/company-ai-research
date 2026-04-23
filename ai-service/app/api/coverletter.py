from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.coverletter.coverletter_service import write_coverletter, conduct_coverletter_consult
from app.services.coverletter.feedback_service import feedback_coverletter

router = APIRouter()


class CoverLetterRequest(BaseModel):
    company_name: str
    job_role: str = ""
    contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class CoverLetterResponse(BaseModel):
    answer: str
    contexts: list[dict] = []


class CoverLetterFeedbackRequest(BaseModel):
    message: str
    company_name: str = ""
    company_contexts: list[dict[str, Any]] = Field(default_factory=list)
    job_url: str = ""
    model: str = "gpt-4o-mini"


class CoverLetterConsultMessage(BaseModel):
    role: str
    content: str


class CoverLetterConsultRequest(BaseModel):
    messages: list[CoverLetterConsultMessage] = Field(default_factory=list)
    company_name: str = ""
    company_contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class CoverLetterConsultResponse(BaseModel):
    answer: str
    is_complete: bool = False


@router.post("/coverletter-consult", response_model=CoverLetterConsultResponse)
def coverletter_consult(request: CoverLetterConsultRequest) -> CoverLetterConsultResponse:
    """소크라틱 방식으로 자기소개서 작성 상담을 진행한다."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    result = conduct_coverletter_consult(
        messages=messages,
        company_name=request.company_name,
        company_contexts=request.company_contexts,
        model=request.model,
    )
    return CoverLetterConsultResponse(
        answer=result["answer"],
        is_complete=result.get("is_complete", False),
    )


@router.post("/coverletter", response_model=CoverLetterResponse)
def coverletter(request: CoverLetterRequest) -> CoverLetterResponse:
    """회사 인재상 기반 자기소개서 초안을 생성한다."""
    result = write_coverletter(
        company_name=request.company_name,
        job_role=request.job_role,
        contexts=request.contexts,
        model=request.model,
    )
    return CoverLetterResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )


@router.post("/coverletter-feedback", response_model=CoverLetterResponse)
def coverletter_feedback(request: CoverLetterFeedbackRequest) -> CoverLetterResponse:
    """사용자 자기소개서를 분석해 상세 피드백을 생성한다."""
    result = feedback_coverletter(
        message=request.message,
        company_name=request.company_name,
        company_contexts=request.company_contexts or [],
        job_url=request.job_url,
        model=request.model,
    )
    return CoverLetterResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )

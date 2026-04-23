from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.interview.interview_service import prepare_interview, conduct_interview_prep_consult

router = APIRouter()


class InterviewRequest(BaseModel):
    company_name: str
    dart_corp_code: str = ""
    contexts: list[dict[str, Any]] = Field(default_factory=list)
    resume_text: str = ""
    model: str = "gpt-4o-mini"


class InterviewResponse(BaseModel):
    answer: str
    contexts: list[dict] = []


class InterviewPrepConsultMessage(BaseModel):
    role: str
    content: str


class InterviewPrepConsultRequest(BaseModel):
    messages: list[InterviewPrepConsultMessage] = Field(default_factory=list)
    company_name: str = ""
    company_contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class InterviewPrepConsultResponse(BaseModel):
    answer: str
    is_complete: bool = False


@router.post("/interview-prep-consult", response_model=InterviewPrepConsultResponse)
def interview_prep_consult(request: InterviewPrepConsultRequest) -> InterviewPrepConsultResponse:
    """소크라틱 방식으로 면접 준비 상담을 진행한다."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    result = conduct_interview_prep_consult(
        messages=messages,
        company_name=request.company_name,
        company_contexts=request.company_contexts,
        model=request.model,
    )
    return InterviewPrepConsultResponse(
        answer=result["answer"],
        is_complete=result.get("is_complete", False),
    )


@router.post("/interview", response_model=InterviewResponse)
def interview(request: InterviewRequest) -> InterviewResponse:
    """회사 면접 준비 가이드를 생성한다."""
    result = prepare_interview(
        company_name=request.company_name,
        dart_corp_code=request.dart_corp_code,
        contexts=request.contexts,
        resume_text=request.resume_text,
        model=request.model,
    )
    return InterviewResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )

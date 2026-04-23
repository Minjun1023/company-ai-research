from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.interview.practice_service import conduct_interview

router = APIRouter()


class PracticeMessage(BaseModel):
    role: str
    content: str


class InterviewPracticeRequest(BaseModel):
    messages: list[PracticeMessage] = Field(default_factory=list)
    company_name: str = ""
    company_contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class InterviewPracticeResponse(BaseModel):
    answer: str
    is_complete: bool = False


@router.post("/interview-practice", response_model=InterviewPracticeResponse)
def interview_practice(request: InterviewPracticeRequest) -> InterviewPracticeResponse:
    """대화형 모의 면접을 진행한다."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    result = conduct_interview(
        messages=messages,
        company_name=request.company_name,
        company_contexts=request.company_contexts,
        model=request.model,
    )
    return InterviewPracticeResponse(
        answer=result["answer"],
        is_complete=result.get("is_complete", False),
    )

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.qa.answer_service import answer_question

_INJECTION_PATTERNS = (
    "ignore previous instructions",
    "ignore all previous",
    "disregard previous",
    "system prompt",
    "you are now",
    "act as",
    "jailbreak",
)

_MAX_QUESTION_LEN = 2000
_MAX_PROMPT_LEN   = 8000

router = APIRouter()


class QARequest(BaseModel):
    # 백엔드에서 구성한 prompt와 검색 콘텍스트를 그대로 전달한다.
    question: str
    prompt: str
    model: str = "gpt-4o-mini"
    contexts: list[dict[str, Any]] = Field(default_factory=list)
    company_name: str = ""
    dart_corp_code: str = ""

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if len(v) > _MAX_QUESTION_LEN:
            raise ValueError(f"question exceeds {_MAX_QUESTION_LEN} characters")
        lower = v.lower()
        for pattern in _INJECTION_PATTERNS:
            if pattern in lower:
                raise ValueError(f"question contains disallowed pattern: '{pattern}'")
        return v

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        if len(v) > _MAX_PROMPT_LEN:
            raise ValueError(f"prompt exceeds {_MAX_PROMPT_LEN} characters")
        return v


class QAResponse(BaseModel):
    model: str
    answer: str
    context_count: int
    used_contexts: list[dict] = []


@router.post("/answer", response_model=QAResponse)
def answer(request: QARequest) -> QAResponse:
    # 질의 + 콘텍스트 기반 답변 생성.
    result = answer_question(
        request.question,
        request.prompt,
        request.contexts,
        request.model,
        request.company_name,
        request.dart_corp_code,
    )
    return QAResponse(
        model=request.model,
        answer=result["answer"],
        context_count=len(request.contexts),
        used_contexts=result.get("contexts", []),
    )

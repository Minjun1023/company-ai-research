from __future__ import annotations

import os

from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel, Field, field_validator

_MAX_LEN = 2000

router = APIRouter()

_SYSTEM_PROMPT = (
    "당신은 취업 준비를 돕는 AI 어시스턴트입니다. "
    "회사 정보 조사, 면접 준비, 자기소개서 작성, 연봉 협상, 채용 공고 분석 등 취업·커리어 관련 주제에만 답변합니다. "
    "인사말(안녕하세요, 반갑습니다 등)에는 간단히 응답하세요. "
    "날씨, 요리, 맛집, 영화, 음악, 주식, 부동산, 여행, 스포츠, 수학, 의학, 법률 등 취업과 무관한 질문은 답변하지 않고, "
    "반드시 다음과 같이 안내하세요: "
    "'저는 취업 준비를 돕는 AI입니다. 기업 조사, 면접 준비, 자기소개서 작성 등 취업 관련 질문을 해주세요.' "
    "항상 한국어로 답변하세요."
)


class GeneralChatRequest(BaseModel):
    message: str = Field(..., min_length=1)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if len(v) > _MAX_LEN:
            raise ValueError(f"message exceeds {_MAX_LEN} characters")
        return v


class GeneralChatResponse(BaseModel):
    answer: str


@router.post("/general-chat", response_model=GeneralChatResponse)
def general_chat(request: GeneralChatRequest) -> GeneralChatResponse:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return GeneralChatResponse(answer="안녕하세요! 궁금한 점이 있으시면 편하게 질문해 주세요.")

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": request.message.strip()},
        ],
        max_tokens=500,
        temperature=0.7,
    )
    answer = (response.choices[0].message.content or "").strip()
    return GeneralChatResponse(answer=answer or "죄송합니다, 답변을 생성하지 못했습니다.")

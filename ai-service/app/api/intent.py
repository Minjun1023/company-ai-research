from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.intent.intent_classifier import classify_intent

router = APIRouter()


class IntentRequest(BaseModel):
    message: str


class IntentResponse(BaseModel):
    intent: str                          # "crawl" | "qa" | "compare"
    company_name: str | None = None      # GPT가 추출한 회사명 (qa/crawl)
    company_names: list[str] = []        # 비교 대상 회사명 목록 (compare)


@router.post("/classify-intent", response_model=IntentResponse)
def classify(request: IntentRequest) -> IntentResponse:
    """사용자 메시지의 의도(crawl/qa/compare)와 회사명을 분류한다."""
    result = classify_intent(request.message)
    return IntentResponse(
        intent=result["intent"],
        company_name=result.get("company_name"),
        company_names=result.get("company_names", []),
    )

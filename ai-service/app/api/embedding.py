from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.embedding.embedding_service import embed_texts


router = APIRouter()


class EmbeddingRequest(BaseModel):
    # 임베딩 생성 대상 텍스트. 빈 문자열은 파이프라인에서 제외한다.
    texts: List[str] = Field(default_factory=list)

    # OpenAI 모델명. fallback 동작에서는 입력값이 사용되지 않는다.
    model: str = "text-embedding-3-small"


class EmbeddingResponse(BaseModel):
    model: str
    embeddings: List[List[float]]
    metadata: Dict[str, Any]


@router.post("/embeddings", response_model=EmbeddingResponse)
def embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    # 텍스트를 임베딩 벡터 배열로 바꿔 백엔드에게 전달한다.
    result = embed_texts(request.texts, request.model)
    return EmbeddingResponse(
        model=request.model,
        embeddings=result,
        metadata={"count": len(result)},
    )

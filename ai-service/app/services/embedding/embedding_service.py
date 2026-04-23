from __future__ import annotations

import hashlib
import logging
import os
from typing import List

from openai import OpenAI, OpenAIError

log = logging.getLogger(__name__)


EMBEDDING_MODEL = os.getenv("AI_EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSION = 1536


def embed_texts(texts: List[str], model: str = EMBEDDING_MODEL) -> List[List[float]]:
    """여러 텍스트를 임베딩 벡터 배열로 변환한다."""
    cleaned_texts = [
        text.strip()
        for text in texts
        if isinstance(text, str) and text.strip()
    ]

    if not cleaned_texts:
        return []

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        log.warning(
            "OPENAI_API_KEY is missing or unconfigured. "
            "Returning deterministic fallback vectors — search quality will be degraded. "
            "texts_count=%d",
            len(cleaned_texts),
        )
        return [_build_deterministic_fallback_vector(text) for text in cleaned_texts]

    try:
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(input=cleaned_texts, model=model)
        items = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in items]
    except (OpenAIError, RuntimeError, ValueError, TypeError) as e:
        log.error(
            "OpenAI embedding API call failed. Falling back to deterministic vectors. "
            "texts_count=%d error=%s",
            len(cleaned_texts),
            e,
        )
        return [_build_deterministic_fallback_vector(text) for text in cleaned_texts]


def _build_deterministic_fallback_vector(text: str) -> List[float]:
    """동일 텍스트면 동일 벡터가 나오도록 결정적 더미 임베딩을 생성한다."""
    hashed = hashlib.sha256(text.encode("utf-8")).digest()
    seed = int.from_bytes(hashed[:8], byteorder="big", signed=False)
    value = (seed % 1_000_000) / 1_000_000
    return [float(value + i * 0.0001) for i in range(EMBEDDING_DIMENSION)]

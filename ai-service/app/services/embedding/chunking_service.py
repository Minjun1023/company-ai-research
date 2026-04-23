from __future__ import annotations


# 문서 텍스트를 고정 길이 + 오버랩 방식으로 분할해 임베딩 단위로 만든다.
def chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    normalized = " ".join(text.split())
    if not normalized:
        return []

    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 5)

    chunks: list[str] = []
    start = 0
    n = len(normalized)

    while start < n:
        end = min(start + chunk_size, n)
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == n:
            break
        start = max(0, end - overlap)

    return chunks

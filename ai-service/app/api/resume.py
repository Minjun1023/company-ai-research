from __future__ import annotations

import io
import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.services.interview.resume_interview_service import analyze_resume_for_interview

logger = logging.getLogger(__name__)

router = APIRouter()


class ResumeInterviewRequest(BaseModel):
    message: str
    company_name: str = ""
    company_contexts: list[dict[str, Any]] = Field(default_factory=list)
    model: str = "gpt-4o-mini"


class ResumeInterviewResponse(BaseModel):
    answer: str
    contexts: list[dict] = []


_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _extract_pdf(content: bytes) -> str:
    import pdfplumber
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        parts = [page.extract_text() or "" for page in pdf.pages]
    return "\n\n".join(p for p in parts if p.strip())


def _extract_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)) -> dict:
    """PDF / DOCX / TXT 파일에서 텍스트를 추출한다."""
    filename = (file.filename or "").lower()
    ext = next((e for e in _ALLOWED_EXTENSIONS if filename.endswith(e)), None)
    if ext is None:
        raise HTTPException(status_code=400, detail="PDF, DOCX, TXT 형식만 지원합니다.")

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기가 10MB를 초과합니다.")

    try:
        if ext == ".pdf":
            text = _extract_pdf(content)
        elif ext == ".docx":
            text = _extract_docx(content)
        else:
            text = content.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.error("[ParseResume] extraction failed: %s", e)
        raise HTTPException(status_code=422, detail="파일 파싱에 실패했습니다. 파일이 손상되지 않았는지 확인해 주세요.")

    return {"text": text.strip()}


@router.post("/resume-interview", response_model=ResumeInterviewResponse)
def resume_interview(request: ResumeInterviewRequest) -> ResumeInterviewResponse:
    """자기소개서 기반 예상 면접 질문을 생성한다."""
    result = analyze_resume_for_interview(
        message=request.message,
        company_name=request.company_name,
        company_contexts=request.company_contexts,
        model=request.model,
    )
    return ResumeInterviewResponse(
        answer=result["answer"],
        contexts=result.get("contexts", []),
    )

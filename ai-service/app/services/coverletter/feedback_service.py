from __future__ import annotations

import logging
import os
import re
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

FEEDBACK_SYSTEM_PROMPT = """너는 취업 전문 컨설턴트야. 사용자가 제출한 자기소개서를 분석하고, 채용공고와 회사 정보가 있다면 그에 맞춰 구체적인 피드백을 제공해.

다음 형식으로 작성해:

## 자기소개서 피드백 리포트

### 종합 평가
전체적인 인상을 2문장 이내로 요약해. 합격 가능성에 대한 솔직한 평가도 포함해.

---

### 항목별 분석

#### 강점 (잘 된 부분)
자기소개서에서 돋보이는 표현, 경험, 논리 구조를 구체적으로 짚어줘. (2개)

#### 개선 필요 (약한 부분)
설득력이 부족하거나 모호한 표현, 빠진 내용을 지적해줘. 각 항목마다 **어떻게 고쳐야 하는지** 대안 문장 예시를 함께 제시해. (2개)

---

### 채용공고 및 회사 인재상 적합도
{company_section}

---

### 핵심 수정 제안 (우선순위 TOP 2)
가장 임팩트가 큰 수정 사항 2가지를 구체적으로 제시해. 각 항목에 수정 전 → 수정 후 예시를 포함해.

---

### 최종 체크리스트
지원 전 반드시 확인해야 할 사항을 체크리스트 형식으로 3개만 제시해.

작성 원칙:
- 막연한 칭찬이나 비판은 하지 마. 반드시 자소서 원문 내용을 인용해서 근거를 대.
- 수정 제안은 실제로 쓸 수 있는 문장 수준으로 구체적으로.
- 채용공고가 제공된 경우 직무 요구사항·우대사항과 자소서의 연결성을 반드시 분석해.
- 전체 분량은 1200자 안팎으로 유지해. 장황하게 반복하지 마.
- 한국어로 작성해."""

COMPANY_SECTION_WITH_JD = """채용공고와 회사 정보를 기반으로 아래를 작성해:
- 채용공고 직무 요구사항 대비 자기소개서의 부합도 (상/중/하)
- 직무 요구사항·우대사항과 잘 연결된 부분 (구체적 예시 포함)
- 직무 요구사항에서 자소서가 다루지 못한 부분 + 보완 방법
- 회사 인재상과의 일치도"""

COMPANY_SECTION_WITH_INFO = """회사 정보를 기반으로 아래를 작성해:
- 이 회사 인재상과 자기소개서의 일치도 (상/중/하)
- 인재상과 잘 연결된 부분
- 인재상과 연결이 부족한 부분 + 보완 방법"""

COMPANY_SECTION_WITHOUT_INFO = """(회사·채용공고 정보 없음 — 일반적인 관점에서 평가)"""

MAX_COMPANY_CONTEXTS = 3
MAX_COMPANY_CONTEXT_CHARS = 250
MAX_COVERLETTER_CHARS = 5000


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def _normalize_feedback_message(message: str) -> str:
    """피드백 요청 문구와 중복 마커를 걷어내고 자기소개서 본문만 최대한 남긴다."""
    text = (message or "").strip()
    if not text:
        return ""

    if "[자기소개서]" in text:
        text = text.split("[자기소개서]", 1)[1].strip()
    else:
        text = re.sub(r"^\[사용자 프로필:[^\]]*\]\s*", "", text).strip()
        text = re.sub(r"^\[자기소개서/이력서\]\s*", "", text).strip()

    return text[:MAX_COVERLETTER_CHARS].strip()


def _crawl_job_url(url: str) -> str:
    """채용공고 URL을 크롤링해 텍스트를 반환한다. 실패 시 빈 문자열."""
    try:
        from app.services.crawler.crawler_service import CrawlerService
        service = CrawlerService()
        result = service.crawl(url)
        # extracted_text는 {url: text} 딕셔너리
        texts = list(result.extracted_text.values())
        combined = "\n\n".join(t for t in texts if t.strip())
        return combined[:3000]  # 프롬프트 토큰 절약
    except Exception as e:
        logger.warning("[CoverLetterFeedback] job URL crawl failed: %s", e)
        return ""


def feedback_coverletter(
    message: str,
    company_name: str = "",
    company_contexts: list[dict[str, Any]] | None = None,
    job_url: str = "",
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    사용자 자기소개서를 분석해 상세 피드백을 생성한다.
    job_url이 제공되면 채용공고를 크롤링해 직무 요건을 프롬프트에 반영한다.
    반환: {"answer": str, "contexts": list}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    # 채용공고 크롤링
    job_description = ""
    if job_url:
        job_description = _crawl_job_url(job_url)
        logger.info("[CoverLetterFeedback] job_url=%s crawled=%d chars", job_url, len(job_description))

    # 채용공고 블록 구성
    jd_block = ""
    if job_description:
        jd_block = f"\n\n[채용공고 내용]\n{job_description}"

    # 회사 컨텍스트 블록 구성
    company_block = ""
    if company_name and company_contexts:
        doc_lines = [
            f"[문서{i + 1}] {ctx.get('content', '')[:MAX_COMPANY_CONTEXT_CHARS]}"
            for i, ctx in enumerate((company_contexts or [])[:MAX_COMPANY_CONTEXTS])
        ]
        company_block = f"\n\n[{company_name} 회사 정보 — 인재상·문화]\n" + "\n".join(doc_lines)

    # 상황에 따라 평가 섹션 선택
    if job_description:
        company_section = COMPANY_SECTION_WITH_JD
    elif company_name and company_contexts:
        company_section = COMPANY_SECTION_WITH_INFO
    else:
        company_section = COMPANY_SECTION_WITHOUT_INFO

    system_content = FEEDBACK_SYSTEM_PROMPT.replace("{company_section}", company_section)
    coverletter_body = _normalize_feedback_message(message)

    user_content = (
        f"{'지원 회사: ' + company_name if company_name else ''}"
        f"{jd_block}{company_block}\n\n"
        f"[자기소개서]\n{coverletter_body or (message or '').strip()}"
    ).strip()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content},
            ],
            max_tokens=1800,
            temperature=0.3,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "자기소개서 피드백을 생성할 수 없습니다."
    except Exception as e:
        logger.error("[CoverLetterFeedback] GPT call failed: %s", e)
        return {"answer": f"피드백 생성 중 오류: {e}", "contexts": []}

    used_contexts: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for ctx in (company_contexts or [])[:MAX_COMPANY_CONTEXTS]:
        url = ctx.get("sourceUrl", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            used_contexts.append({
                "source_type": "document",
                "sourceUrl": url,
                "content": ctx.get("content", ""),
            })

    logger.info("[CoverLetterFeedback] done. company=%s contexts=%d", company_name, len(used_contexts))
    return {"answer": answer, "contexts": used_contexts}

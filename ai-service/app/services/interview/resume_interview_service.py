from __future__ import annotations

import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

RESUME_INTERVIEW_SYSTEM_PROMPT = """너는 취업 준비생의 자기소개서를 분석해 면접 질문을 생성하는 전문 AI 코치야.

사용자 메시지에서 자기소개서 내용을 찾아 분석하고, 아래 형식으로 답변해:

## 자기소개서 기반 예상 면접 질문

### 1. 자기소개서 핵심 포인트 분석
자기소개서에서 강조된 경험·역량·가치관을 3~5개 항목으로 요약해.

### 2. 자소서 기반 예상 질문 (10개)
자기소개서 내용을 바탕으로 면접관이 실제로 물어볼 법한 질문을 만들어:
- **지원 동기·목표 (2개)**: 자소서에서 언급한 지원 동기를 파고드는 질문
- **경험·역량 검증 (4개)**: 자소서에 적힌 경험·프로젝트·성과를 구체적으로 검증하는 질문
- **가치관·태도 (2개)**: 자소서에서 드러난 가치관이나 성격을 확인하는 질문
- **약점·도전 (2개)**: 자소서의 빈 부분이나 약해 보이는 부분을 파고드는 질문

### 3. 각 질문별 답변 전략
각 질문에 대해 자소서 내용을 활용해 어떻게 답변하면 좋은지 핵심 포인트를 1~2문장으로 제시해.

### 4. 자소서 보완 제안
면접관이 추가로 물어볼 수 있는데 자소서에서 충분히 다루지 못한 부분이 있다면 지적해줘.

작성 원칙:
- 자소서에 실제로 언급된 내용만 기반으로 질문을 만들어. 없는 내용을 지어내지 마.
- 회사 정보가 제공된 경우 회사의 인재상·문화와 연결해.
- 면접관 입장에서 실제로 할 법한 날카로운 질문을 만들어.
- 한국어로 작성해."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def analyze_resume_for_interview(
    message: str,
    company_name: str = "",
    company_contexts: list[dict[str, Any]] | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    사용자 메시지에서 자기소개서를 추출·분석해 예상 면접 질문을 생성한다.
    반환: {"answer": str, "contexts": list}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    # 회사 컨텍스트 블록 구성
    company_block = ""
    if company_name and company_contexts:
        doc_lines = [
            f"[문서{i + 1}] {ctx.get('content', '')[:300]}"
            for i, ctx in enumerate((company_contexts or [])[:3])
        ]
        company_block = f"\n\n[{company_name} 회사 정보]\n" + "\n".join(doc_lines)

    user_content = (
        f"{'지원 회사: ' + company_name if company_name else ''}{company_block}\n\n"
        f"사용자 메시지:\n{message}"
    ).strip()

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": RESUME_INTERVIEW_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2500,
            temperature=0.4,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "예상 면접 질문을 생성할 수 없습니다."
    except Exception as e:
        logger.error("[ResumeInterview] GPT call failed: %s", e)
        return {"answer": f"면접 질문 생성 중 오류: {e}", "contexts": []}

    used_contexts: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for ctx in (company_contexts or [])[:3]:
        url = ctx.get("sourceUrl", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            used_contexts.append({
                "source_type": "document",
                "sourceUrl": url,
                "content": ctx.get("content", ""),
            })

    logger.info("[ResumeInterview] done. company=%s contexts=%d", company_name, len(used_contexts))
    return {"answer": answer, "contexts": used_contexts}

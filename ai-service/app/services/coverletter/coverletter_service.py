from __future__ import annotations

import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

COVERLETTER_CONSULT_PROMPT = """너는 취업 준비생의 자기소개서 작성을 도와주는 전문 AI 코치야.
사용자의 배경을 파악한 뒤 개인화된 자기소개서 초안을 작성해줘.

프로필 처리 규칙:
- 대화에 [사용자 프로필: ...] 태그가 있으면 해당 항목(경력, 직군, 역량 등)은 이미 파악된 것으로 간주하고 다시 묻지 마.
- 자소서/이력서 내용이 [자기소개서/이력서] 태그로 제공된 경우 경험·강점도 파악된 것으로 간주해.
- 태그가 없거나 특정 항목이 빠져 있으면 해당 항목을 질문해.

진행 방식:
1. 정보 수집 단계 (1-3턴): 한 번에 1-2가지만 질문해.
   - 반드시 파악: 지원 직무/포지션(프로필에 없으면), 경력(프로필에 없으면)
   - 추가로 파악: 가장 자신 있는 경험·프로젝트(이력서에 없으면), 특별히 강조하고 싶은 강점
2. 초안 작성: 충분한 정보가 모이면 아래 형식으로 초안 작성.

초안 형식:
## [회사명] 자기소개서 초안

### 작성 전 체크포인트
이 회사·직무에 지원할 때 반드시 반영해야 할 핵심 키워드 3가지 이내.

---

### 1. 지원 동기 (500자 내외)
### 2. 성장 과정 및 가치관 (500자 내외)
### 3. 직무 역량 및 경험 (700자 내외) — STAR 구조
### 4. 입사 후 포부 (400자 내외)

---

### 작성 팁

규칙:
- 사용자가 알려준 경험·직무를 실제로 반영해. 일반론적인 내용 금지.
- 회사 정보가 있으면 인재상·문화를 초안에 녹여 넣어.
- [ ] 괄호로 사용자가 직접 채울 부분 표시.
- 초안을 완성했으면 마지막 줄에 "[COVERLETTER_COMPLETE]"를 추가해.
- 초안 완성 후 사용자가 수정을 요청하면: 기존 대화 맥락(직무·경력·경험)을 그대로 유지하면서 요청한 부분만 수정해줘. 수정이 끝나면 다시 "[COVERLETTER_COMPLETE]"를 추가해.
- 한국어로 진행해."""


COVERLETTER_SYSTEM_PROMPT = """너는 취업 준비생의 자기소개서 작성을 도와주는 전문 AI 코치야.
제공된 회사 정보를 바탕으로 실제 지원에 쓸 수 있는 자기소개서 초안을 작성해줘.

다음 형식으로 작성해:

## [회사명] 자기소개서 초안

### 작성 전 체크포인트
이 회사에 지원할 때 반드시 반영해야 할 핵심 키워드·인재상을 3가지 이내로 정리해.

---

### 1. 지원 동기 (500자 내외)
회사의 비전·사업·문화와 자신의 목표를 연결하는 지원 동기를 작성해.
- 회사 고유의 특징을 구체적으로 언급할 것
- "~에 매력을 느꼈습니다" 같은 추상적 표현 지양

### 2. 성장 과정 및 가치관 (500자 내외)
지원 회사의 인재상에 맞는 경험과 가치관을 서술해.
- 구체적인 경험 사례 포함
- 회사가 중시하는 가치와 연결

### 3. 직무 역량 및 경험 (700자 내외)
지원 직무에 필요한 역량을 갖추게 된 과정을 STAR 구조로 작성해.
(Situation → Task → Action → Result)

### 4. 입사 후 포부 (400자 내외)
입사 후 3~5년 내 이루고 싶은 구체적인 목표를 작성해.
- 회사의 사업 방향과 연결할 것
- 개인 성장과 회사 기여를 함께 언급

---

### 작성 팁
이 회사 자소서에서 특히 주의해야 할 점을 2~3가지 제시해.

작성 원칙:
- 회사 공식 자료(홈페이지·채용공고)에 기반한 내용을 적극 활용해.
- [  ] 괄호 안에 지원자가 직접 채워야 할 부분을 표시해. 예) [본인의 전공 또는 경험 분야]
- 실제로 쓸 수 있는 수준의 구체적인 문장으로 작성해. 뼈대만 제시하지 마.
- 한국어로 작성해."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def conduct_coverletter_consult(
    messages: list[dict[str, str]],
    company_name: str = "",
    company_contexts: list[dict[str, Any]] | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """소크라틱 방식으로 자기소개서 작성 상담을 진행한다."""
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "is_complete": False}

    system_content = COVERLETTER_CONSULT_PROMPT
    if company_name:
        system_content += f"\n\n대상 회사: {company_name}"
    if company_contexts:
        snippets = "\n".join(
            f"- {ctx.get('content', '')[:200]}"
            for ctx in company_contexts[:3]
            if ctx.get("content")
        )
        if snippets:
            system_content += f"\n\n회사 정보 (자소서 작성에 활용):\n{snippets}"

    chat_messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    if not messages:
        chat_messages.append({"role": "user", "content": "자기소개서 작성을 도와줘."})
    else:
        chat_messages.extend(messages)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            max_tokens=2500,
            temperature=0.6,
        )
        answer = (response.choices[0].message.content or "").strip()
        is_complete = "[COVERLETTER_COMPLETE]" in answer
        answer = answer.replace("[COVERLETTER_COMPLETE]", "").strip()
        return {"answer": answer, "is_complete": is_complete}
    except Exception as e:
        logger.error("[CoverLetterConsult] GPT call failed: %s", e)
        return {"answer": f"상담 진행 중 오류가 발생했습니다: {e}", "is_complete": False}


def write_coverletter(
    company_name: str,
    job_role: str,
    contexts: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    회사 정보 기반 자기소개서 초안을 생성한다.
    반환: {"answer": str, "contexts": list}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    if contexts:
        doc_lines = [
            f"[문서{i + 1}] (출처: {ctx.get('sourceUrl', '')}) {ctx.get('content', '')[:500]}"
            for i, ctx in enumerate(contexts[:5])
        ]
        context_block = "[회사 홈페이지 문서]\n" + "\n\n".join(doc_lines)
    else:
        context_block = "(수집된 정보 없음 — 일반 지식으로 작성)"

    job_line = f"지원 직무: {job_role}\n" if job_role else ""
    user_content = (
        f"회사명: {company_name}\n"
        f"{job_line}"
        f"\n수집된 자료:\n{context_block}\n\n"
        f"위 자료를 바탕으로 '{company_name}' 자기소개서 초안을 작성해줘."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": COVERLETTER_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2500,
            temperature=0.6,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "자기소개서 초안을 생성할 수 없습니다."
    except Exception as e:
        logger.error("[CoverLetter] GPT call failed: %s", e)
        return {"answer": f"자기소개서 작성 중 오류: {e}", "contexts": []}

    used_contexts: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for ctx in contexts[:5]:
        url = ctx.get("sourceUrl", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            used_contexts.append({
                "source_type": "document",
                "sourceUrl": url,
                "content": ctx.get("content", ""),
            })

    logger.info("[CoverLetter] done. company=%s contexts=%d", company_name, len(used_contexts))
    return {"answer": answer, "contexts": used_contexts}

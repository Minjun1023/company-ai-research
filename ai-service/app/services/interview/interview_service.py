from __future__ import annotations

import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

INTERVIEW_PREP_CONSULT_PROMPT = """너는 취업 준비생의 면접을 도와주는 전문 AI 코치야.
사용자의 상황을 파악한 뒤 맞춤형 면접 준비 가이드를 제공해.

프로필 처리 규칙:
- 대화에 [사용자 프로필: ...] 태그가 있으면 해당 항목(경력, 직군, 역량 등)은 이미 파악된 것으로 간주하고 다시 묻지 마.
- [자기소개서/이력서] 태그로 자소서가 제공된 경우 경험·강점도 파악된 것으로 간주하고, 자소서 내용을 면접 질문 생성에 적극 반영해.
- 태그가 없거나 특정 항목이 빠져 있으면 해당 항목을 질문해.

진행 방식:
1. 정보 수집 단계 (1-3턴): 한 번에 1-2가지만 질문해.
   - 반드시 파악: 지원 직무(프로필에 없으면), 경력 수준(프로필에 없으면), 면접 단계(1차 실무/2차 임원/최종)
   - 추가로 파악: 특별히 걱정되는 부분, 준비가 잘 안 된 영역
2. 가이드 작성: 충분한 정보가 모이면 아래 형식으로 가이드 작성.

가이드 형식:
## [회사명] 맞춤 면접 준비 가이드

### 1. 이 면접에서 핵심 포인트
직무·경력·면접 단계에 맞는 핵심 어필 전략 3가지.

### 2. 예상 질문 (카테고리별)
- 지원 동기 (2개)
- 직무 역량 (2개)
- 조직 문화 적합성 (2개)
- 상황 대처 STAR (2개)
- 자소서 기반 질문 (자소서가 제공된 경우, 2개 추가): 자소서에 적힌 경험·프로젝트를 파고드는 날카로운 질문

### 3. 각 질문별 답변 전략
핵심 포인트 1-2문장씩.

### 4. 역질문 3개

### 5. 이 사람이 특히 주의할 점
수집한 사용자 정보 기반으로 개인화된 주의사항.

규칙:
- 경력 수준에 맞게 난이도와 초점을 조정해. 신입이면 잠재력, 경력이면 실적 중심.
- 면접 단계에 맞게 질문 유형을 조정해.
- 회사 정보가 있으면 인재상·문화를 반영해.
- 자소서가 제공된 경우 자소서에 실제 언급된 내용만 기반으로 질문을 만들어.
- 가이드를 완성했으면 마지막 줄에 "[INTERVIEW_PREP_COMPLETE]"를 추가해.
- 가이드 완성 후 사용자가 추가 질문이나 보완을 요청하면: 기존 맥락을 유지하면서 해당 부분만 답변하거나 보완해줘. 응답이 끝나면 다시 "[INTERVIEW_PREP_COMPLETE]"를 추가해.
- 한국어로 진행해."""


INTERVIEW_SYSTEM_PROMPT = """너는 취업 준비생의 면접을 도와주는 전문 AI 코치야.
제공된 회사 정보와 지원자의 자기소개서·프로필을 분석해 맞춤형 면접 준비 가이드를 작성해.

다음 형식으로 작성해:

## [회사명] 면접 준비 가이드

### 1. 회사 핵심 키워드
면접에서 반드시 언급해야 할 회사의 핵심 가치·비전·문화 키워드를 3~5개 추출해 각각 1~2문장으로 설명해.

### 2. 예상 면접 질문
카테고리별 예상 질문과 각 질문별 답변 전략을 함께 작성해:

#### 지원 동기 (2개)
각 질문 아래에 답변 전략 1~2문장.

#### 직무 역량 (2개)
각 질문 아래에 답변 전략 1~2문장.

#### 조직 문화 적합성 (2개)
각 질문 아래에 답변 전략 1~2문장.

#### 상황 대처 STAR (2개)
각 질문 아래에 STAR 형식 답변 전략.

#### 자기소개서 기반 질문 (자소서가 제공된 경우 2~3개)
자소서에 언급된 경험·프로젝트를 파고드는 날카로운 질문. 자소서 내용을 직접 인용해서 질문을 만들어. 각 질문 아래에 어떤 방향으로 답해야 하는지 전략 제시.

### 3. 면접관에게 할 역질문 (3개)
면접 말미에 할 수 있는 좋은 역질문 3개.

### 4. 이 지원자가 특히 주의할 점
제공된 프로필·자소서를 기반으로 개인화된 주의사항 3가지. 자소서가 없으면 일반적인 주의사항.

작성 원칙:
- 회사 공식 자료에 기반한 내용을 우선 활용해.
- 자소서가 제공된 경우 반드시 자소서에 실제 언급된 내용만 인용해서 질문을 만들어. 없는 내용을 지어내지 마.
- 구체적이고 실행 가능한 조언만 써. 추상적인 말은 피해.
- 경력 수준에 맞게 난이도 조정해. 신입이면 잠재력·학습 의지, 경력이면 실적·문제 해결 중심.
- 한국어로 작성해."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def conduct_interview_prep_consult(
    messages: list[dict[str, str]],
    company_name: str = "",
    company_contexts: list[dict[str, Any]] | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """소크라틱 방식으로 면접 준비 상담을 진행한다."""
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "is_complete": False}

    system_content = INTERVIEW_PREP_CONSULT_PROMPT
    if company_name:
        system_content += f"\n\n대상 회사: {company_name}"
    if company_contexts:
        snippets = "\n".join(
            f"- {ctx.get('content', '')[:200]}"
            for ctx in company_contexts[:3]
            if ctx.get("content")
        )
        if snippets:
            system_content += f"\n\n회사 정보 (면접 가이드에 활용):\n{snippets}"

    chat_messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    if not messages:
        chat_messages.append({"role": "user", "content": "면접 준비를 도와줘."})
    else:
        chat_messages.extend(messages)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            max_tokens=2000,
            temperature=0.4,
        )
        answer = (response.choices[0].message.content or "").strip()
        is_complete = "[INTERVIEW_PREP_COMPLETE]" in answer
        answer = answer.replace("[INTERVIEW_PREP_COMPLETE]", "").strip()
        return {"answer": answer, "is_complete": is_complete}
    except Exception as e:
        logger.error("[InterviewPrepConsult] GPT call failed: %s", e)
        return {"answer": f"상담 진행 중 오류가 발생했습니다: {e}", "is_complete": False}


def prepare_interview(
    company_name: str,
    dart_corp_code: str,
    contexts: list[dict[str, Any]],
    resume_text: str = "",
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    회사 면접 준비 가이드를 생성한다.
    resume_text가 제공되면 자소서 기반 예상 질문을 추가로 생성한다.
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

    resume_block = f"\n\n[지원자 자기소개서]\n{resume_text[:2000]}" if resume_text.strip() else ""

    user_content = (
        f"회사명: {company_name}\n\n"
        f"수집된 자료:\n{context_block}"
        f"{resume_block}\n\n"
        f"위 자료를 바탕으로 '{company_name}' 맞춤형 면접 준비 가이드를 작성해줘."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": INTERVIEW_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2000,
            temperature=0.4,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "면접 준비 가이드를 생성할 수 없습니다."
    except Exception as e:
        logger.error("[Interview] GPT call failed: %s", e)
        return {"answer": f"면접 준비 가이드 생성 중 오류: {e}", "contexts": []}

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

    logger.info("[Interview] done. contexts=%d", len(used_contexts))
    return {"answer": answer, "contexts": used_contexts}

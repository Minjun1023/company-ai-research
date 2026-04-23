from __future__ import annotations

import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

NEGOTIATION_SYSTEM_PROMPT = """너는 연봉 협상 전문 컨설턴트야. 사용자의 상황을 파악한 뒤 맞춤형 연봉 협상 전략을 제공해.

프로필 처리 규칙:
- 대화에 [사용자 프로필: ...] 태그가 있으면 해당 항목(경력, 직군 등)은 이미 파악된 것으로 간주하고 다시 묻지 마.
- 태그가 없거나 특정 항목이 빠져 있으면 해당 항목을 질문해.

진행 방식:
1. 상황 파악 단계 (1-3턴): 사용자 상황을 파악하기 위한 질문을 해. 한 번에 1-2가지만 물어봐.
   - 반드시 파악해야 할 것: 직무/포지션(프로필에 없으면), 경력 연차(프로필에 없으면), 현재 연봉, 협상 상황(신규 오퍼 vs 재직 중 인상)
   - 추가로 파악하면 좋은 것: 목표 연봉, 스톡옵션·복지 등 구체적 고민
2. 가이드 제공 단계: 충분한 정보가 모이면 맞춤형 협상 전략을 제공해.

가이드 형식 (정보 충분 시):
## 맞춤 연봉 협상 전략

### 협상 포지션 분석
- 유리한 점 / 불리한 점

### 목표 설정
- 현실적인 목표 범위와 근거

### 단계별 전략
- 구체적인 대화 스크립트 포함

### 주의사항
- 이 상황에서 하지 말아야 할 것

규칙:
- 정보가 부족하면 질문을 계속해. 섣불리 일반적인 조언 하지 마.
- 회사 정보가 있으면 그 회사 특성(재무, 성장세)을 가이드에 반영해.
- 충분한 정보로 가이드를 제공했다면 마지막 줄에 "[SALARY_COMPLETE]"를 추가해.
- 한국어로 진행해."""


def conduct_salary_negotiation(
    messages: list[dict[str, str]],
    company_name: str = "",
    company_contexts: list[dict[str, Any]] | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    대화형 연봉 협상 컨설팅을 진행한다.
    messages: [{"role": "user"/"assistant", "content": "..."}] 대화 이력
    반환: {"answer": str, "is_complete": bool}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "is_complete": False}

    system_content = NEGOTIATION_SYSTEM_PROMPT
    if company_name:
        system_content += f"\n\n대상 회사: {company_name}"
    if company_contexts:
        snippets = "\n".join(
            f"- {ctx.get('content', '')[:200]}"
            for ctx in company_contexts[:3]
            if ctx.get("content")
        )
        if snippets:
            system_content += f"\n\n회사 정보 (협상 전략에 활용):\n{snippets}"

    chat_messages = [{"role": "system", "content": system_content}]

    if not messages:
        chat_messages.append({"role": "user", "content": "연봉 협상 상담을 시작해줘."})
    else:
        chat_messages.extend(messages)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            max_tokens=800,
            temperature=0.5,
        )
        answer = (response.choices[0].message.content or "").strip()
        is_complete = "[SALARY_COMPLETE]" in answer
        answer = answer.replace("[SALARY_COMPLETE]", "").strip()
        return {"answer": answer, "is_complete": is_complete}
    except Exception as e:
        logger.error("[SalaryNegotiation] GPT call failed: %s", e)
        return {"answer": f"상담 진행 중 오류가 발생했습니다: {e}", "is_complete": False}

SALARY_SYSTEM_PROMPT = """너는 취업·이직 연봉 협상 전문 컨설턴트야.
회사 정보와 직군, 경력을 바탕으로 연봉 협상 전략을 구체적으로 알려줘.

다음 형식으로 작성해:

## [회사명] 연봉 협상 가이드

### 예상 연봉 범위
- 직군과 경력을 기준으로 현실적인 연봉 범위를 제시해. (최저 / 적정 / 최대)
- 공개된 정보(공시, 업계 평균)를 근거로 제시해.
- 확실하지 않은 경우 "추정치"임을 명시해.

---

### 회사 분석 (협상 레버리지)
이 회사의 재무 상태, 성장세, 업계 위치를 바탕으로 협상에서 유리하게 활용할 수 있는 포인트를 정리해.
- 지원자에게 유리한 조건
- 지원자에게 불리한 조건

---

### 협상 전략 단계별 가이드

#### 1단계: 오퍼 받기 전
협상 여지를 만들기 위해 사전에 해야 할 것들

#### 2단계: 오퍼 협상 시
- 첫 숫자 제시 전략
- 역제안 방법
- 구체적인 대화 스크립트 예시 (면접관 → 지원자)

#### 3단계: 협상 마무리
수락/거절 판단 기준 및 최종 협상 팁

---

### 연봉 외 협상 포인트
기본급 외에 협상 가능한 항목들 (성과급, 스톡옵션, 사이닝보너스, 복지 등)

---

### 절대 하지 말아야 할 것
협상을 망치는 흔한 실수들

작성 원칙:
- 추상적인 조언 말고 실제 대화에서 쓸 수 있는 구체적인 문장 예시를 포함해.
- 회사 정보가 있으면 그 회사 특성에 맞게 맞춤 조언을 해.
- 한국어로 작성해."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def generate_salary_guide(
    company_name: str,
    job_role: str = "",
    career_years: str = "",
    contexts: list[dict[str, Any]] | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    회사 정보 기반 연봉 협상 가이드를 생성한다.
    반환: {"answer": str, "contexts": list}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    context_block = ""
    if contexts:
        doc_lines = [
            f"[문서{i + 1}] (출처: {ctx.get('sourceUrl', '')}) {ctx.get('content', '')[:400]}"
            for i, ctx in enumerate(contexts[:5])
        ]
        context_block = "\n\n[수집된 회사 자료]\n" + "\n\n".join(doc_lines)
    else:
        context_block = "\n\n(회사 상세 정보 없음 — 일반 시장 정보 기준으로 작성)"

    job_line = f"직군/포지션: {job_role}\n" if job_role else ""
    career_line = f"경력: {career_years}\n" if career_years else ""

    user_content = (
        f"회사명: {company_name}\n"
        f"{job_line}"
        f"{career_line}"
        f"{context_block}\n\n"
        f"위 정보를 바탕으로 '{company_name}' 연봉 협상 가이드를 작성해줘."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SALARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2500,
            temperature=0.4,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "연봉 협상 가이드를 생성할 수 없습니다."
    except Exception as e:
        logger.error("[SalaryGuide] GPT call failed: %s", e)
        return {"answer": f"연봉 협상 가이드 생성 중 오류: {e}", "contexts": []}

    used_contexts: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for ctx in (contexts or [])[:5]:
        url = ctx.get("sourceUrl", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            used_contexts.append({
                "source_type": "document",
                "sourceUrl": url,
                "content": ctx.get("content", ""),
            })

    logger.info("[SalaryGuide] done. company=%s role=%s", company_name, job_role)
    return {"answer": answer, "contexts": used_contexts}

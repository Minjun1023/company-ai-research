from __future__ import annotations

import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

PRACTICE_SYSTEM_PROMPT = """너는 경험 많은 채용 면접관 역할을 맡은 AI야. 지원자가 스스로 생각을 정리하고 답변의 깊이를 발견하도록 돕는 소크라틱 방식으로 모의 면접을 진행해.

핵심 원칙:
- 답변에 즉각 피드백을 주지 마. 대신 꼬리 질문으로 더 깊이 파고들어.
- 지원자가 스스로 "왜 그렇게 생각했는지", "구체적으로 어떤 행동을 했는지"를 언어화하도록 유도해.
- 답변이 충분히 구체적이고 진정성 있다고 판단되면 다음 주제로 넘어가.

진행 방식:
1. 큰 주제 4개를 순서대로 다뤄: 자기소개 → 지원 동기 → 직무 역량 → 조직 적합성
2. 각 주제마다 첫 질문 후, 답변에 따라 1-2개의 꼬리 질문을 추가로 던져.
   - 답변이 추상적이면: "구체적으로 어떤 상황이었나요?", "그때 어떤 행동을 하셨나요?"
   - 답변이 결과 위주면: "그 과정에서 어떤 어려움이 있었나요?", "그 선택을 한 이유가 뭔가요?"
   - 답변이 충분히 구체적이면: 다음 주제로 자연스럽게 전환
3. 회사 정보가 제공된 경우, 지원 동기나 조직 적합성 주제에서 회사와 연결된 질문을 해.
4. 4개 주제를 모두 다룬 후 총평을 제공해.

규칙:
- 처음 시작할 때는 인사 없이 바로 "면접을 시작하겠습니다. [첫 질문]" 형태로 시작해.
- 한 번에 질문은 반드시 하나만 해.
- 총평 시작 시 반드시 "[총평]"이라고 명시해.
- 총평에는 강점, 개선 포인트, 실제 면접에서 더 잘 답변하기 위한 구체적인 조언을 포함해.
- 총평이 끝나면 반드시 마지막 줄에 "[INTERVIEW_COMPLETE]"를 추가해.
- 한국어로 진행해. 존댓말을 사용해."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def conduct_interview(
    messages: list[dict[str, str]],
    company_name: str = "",
    company_contexts: list[dict[str, Any]] | None = None,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """
    모의 면접을 진행한다.

    messages: [{"role": "user"/"assistant", "content": "..."}] 대화 이력
    반환: {"answer": str, "is_complete": bool}
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "is_complete": False}

    # 시스템 프롬프트에 회사 정보 추가
    system_content = PRACTICE_SYSTEM_PROMPT
    if company_name:
        system_content += f"\n\n대상 회사: {company_name}"
    if company_contexts:
        snippets = "\n".join(
            f"- {ctx.get('content', '')[:200]}"
            for ctx in company_contexts[:3]
            if ctx.get("content")
        )
        if snippets:
            system_content += f"\n\n회사 정보 (5번째 질문에 활용):\n{snippets}"

    chat_messages = [{"role": "system", "content": system_content}]

    # 첫 번째 호출(messages가 비어있으면) — 면접 시작 트리거
    if not messages:
        chat_messages.append({"role": "user", "content": "면접을 시작해줘."})
    else:
        chat_messages.extend(messages)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            max_tokens=800,
            temperature=0.4,
        )
        answer = (response.choices[0].message.content or "").strip()

        is_complete = "[INTERVIEW_COMPLETE]" in answer
        # 마커 제거
        answer = answer.replace("[INTERVIEW_COMPLETE]", "").strip()

        return {"answer": answer, "is_complete": is_complete}

    except Exception as e:
        logger.error("[InterviewPractice] GPT call failed: %s", e)
        return {"answer": f"면접 진행 중 오류가 발생했습니다: {e}", "is_complete": False}

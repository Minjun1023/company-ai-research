from __future__ import annotations

from typing import Any

from app.services.agent.agent_service import run_agent

def answer_question(
    question: str,
    prompt: str,
    contexts: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
    company_name: str = "",
    dart_corp_code: str = "",
) -> dict[str, Any]:
    """
    Tool-use 에이전트를 통해 답변을 생성한다.

    에이전트 흐름:
      GPT 판단 (어떤 도구가 필요한지)
          ↓
      도구 실행 (search_company_documents / get_dart_info / search_news)
          ↓
      결과 관찰 → 필요시 추가 도구 호출 (최대 5회)
          ↓
      최종 답변 생성
    """
    return run_agent(
        question=question,
        prompt=prompt,
        db_contexts=contexts,
        model=model,
        company_name=company_name,
        dart_corp_code=dart_corp_code,
    )
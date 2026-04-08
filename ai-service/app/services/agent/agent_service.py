from __future__ import annotations

import json as _json
import logging
import os
from typing import Any

from openai import OpenAI

from app.services.agent.tools import TOOL_SCHEMAS, run_tool
from app.services.graph.rag_graph import _source_contributed

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 5

AGENT_SYSTEM_PROMPT = """너는 취업 준비생을 위한 회사 정보 AI 어시스턴트야.

질문을 받으면 다음 도구들을 활용해 필요한 정보를 수집한 뒤 답변해:
- search_company_documents: 회사 홈페이지 크롤링 데이터 (소개, 문화, 채용 등)
- get_dart_info: DART 공시 데이터 (연봉, 재무, 직원수 등 수치)

도구 선택 원칙:
1. 질문에 필요한 도구만 호출해. 불필요한 도구는 쓰지 마.
2. 연봉·재무 수치 → get_dart_info 사용
3. 회사 소개·문화·채용 → search_company_documents 사용
4. 복합 질문이면 여러 도구를 순서대로 호출해도 돼.
5. 충분한 정보가 모이면 도구 없이 최종 답변을 생성해.

답변 원칙:
- 수집된 데이터를 근거로 구체적이고 실용적으로 답해.
- 단순히 요약하지 말고, 항목별로 나누어 상세하게 설명해. 예) 복지 → 항목별 복지 내용 열거, 연봉 → 직급/연차별 수치 제시.
- 수치·사례·제도명 등 구체적인 정보를 최대한 포함해.
- 답변이 길어지더라도 빠진 내용 없이 충분히 작성해.
- 연봉·재무 수치는 반드시 DART 출처가 있을 때만 언급해.
- 마크다운 형식(##, -, **굵게** 등)을 활용해 읽기 쉽게 구성해.
- 한국어로 친절하게 작성해."""


def _client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return None
    return OpenAI(api_key=api_key)


def run_agent(
    question: str,
    prompt: str,
    db_contexts: list[dict[str, Any]],
    model: str = "gpt-4o-mini",
    company_name: str = "",
    dart_corp_code: str = "",
) -> dict[str, Any]:
    """
    Tool-use ReAct 에이전트를 실행하고 {"answer": str, "contexts": list} 를 반환한다.

    흐름:
      GPT 판단 → 도구 선택 → 도구 실행 → 결과 관찰 → (반복) → 최종 답변
    """
    client = _client()
    if not client:
        return {"answer": "API 키가 설정되지 않았습니다.", "contexts": []}

    # 초기 메시지 구성
    user_msg = question
    if prompt and prompt.strip() and prompt.strip() != question.strip():
        user_msg = f"{prompt}\n\n질문: {question}"

    messages: list[dict] = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    accumulated_ctxs: list[dict[str, Any]] = []

    for iteration in range(MAX_ITERATIONS):
        logger.info("[Agent] iteration=%d", iteration + 1)

        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                max_tokens=3000,
                temperature=0.3,
            )
        except Exception as e:
            logger.error("[Agent] GPT call failed: %s", e)
            return {"answer": f"답변 생성 중 오류: {e}", "contexts": []}

        choice = response.choices[0]
        messages.append(choice.message)

        # 도구 호출 없음 → 최종 답변
        if choice.finish_reason != "tool_calls":
            answer = (choice.message.content or "").strip()
            used = _filter_used_contexts(answer, accumulated_ctxs)
            logger.info("[Agent] done. tools_called=%d used_contexts=%d",
                        iteration, len(used))
            return {"answer": answer, "contexts": used}

        # 도구 호출 실행
        for tool_call in choice.message.tool_calls:
            name = tool_call.function.name
            args = _json.loads(tool_call.function.arguments or "{}")

            logger.info("[Agent] tool=%s args=%s", name, args)
            result_text, ctxs = run_tool(
                tool_name=name,
                tool_args=args,
                db_contexts=db_contexts,
                company_name=company_name,
                dart_corp_code=dart_corp_code,
            )
            accumulated_ctxs.extend(ctxs)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result_text,
            })

    # 최대 반복 초과
    logger.warning("[Agent] max iterations reached")
    return {"answer": "정보를 충분히 수집하지 못해 답변을 생성할 수 없습니다.", "contexts": []}


def _filter_used_contexts(
    answer: str, contexts: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """키워드 매칭으로 답변에 실제로 기여한 출처만 반환한다."""
    answer_lower = answer.lower()
    seen_urls: set[str] = set()
    result = []
    for ctx in contexts:
        url = ctx.get("sourceUrl", "")
        if url in seen_urls:
            continue
        if _source_contributed(answer_lower, ctx.get("content", "")):
            seen_urls.add(url)
            result.append(ctx)
    return result

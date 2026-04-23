from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from app.core.config_loader import get_intent_patterns

VALID_INTENTS = {"crawl", "qa", "compare", "research", "interview", "interview_practice", "coverletter", "feedback", "salary"}

# config/intent_keywords.json 에서 패턴 로드 후 컴파일
_patterns = get_intent_patterns()

_CRAWL_KEYWORDS            = re.compile(_patterns.get("crawl", r"수집|크롤링"))
_COMPARE_KEYWORDS          = re.compile(_patterns.get("compare", r"비교|vs\b"))
_RESEARCH_KEYWORDS         = re.compile(_patterns.get("research", r"심층\s*분석|리서치"))
_INTERVIEW_PRACTICE_KEYWORDS = re.compile(_patterns.get("interview_practice", r"모의\s*면접"))
_INTERVIEW_KEYWORDS        = re.compile(_patterns.get("interview", r"면접"))
_COVERLETTER_KEYWORDS      = re.compile(_patterns.get("coverletter", r"자소서\s*써"))
_FEEDBACK_KEYWORDS         = re.compile(_patterns.get("feedback", r"자소서\s*피드백"))
_RESUME_KEYWORDS           = re.compile(_patterns.get("resume", r"자소서|자기소개서"))
_SALARY_KEYWORDS           = re.compile(_patterns.get("salary", r"연봉\s*협상|salary"))

SYSTEM_PROMPT = """사용자 메시지를 분석해 아래 JSON 형식으로만 반환해. 다른 설명 없이 JSON만.

반환 형식:
{"intent": "<의도>", "company_name": "<회사명 또는 null>", "company_names": ["<회사명1>", "<회사명2>"]}

의도 목록:
- "crawl"     : 회사 홈페이지를 수집/크롤링하고 싶을 때
                예) "토스 수집해줘", "카카오 크롤링해줘", "네이버 정보 가져와"
- "compare"   : 두 개 이상의 회사를 비교하고 싶을 때
                예) "카카오와 네이버 복지 비교해줘", "토스 vs 카카오 어때?", "삼성전자랑 SK하이닉스 연봉 차이"
- "research"  : 한 회사를 심층적으로 종합 분석/리서치하고 싶을 때
                예) "카카오 심층 분석해줘", "네이버 종합 리포트 만들어줘", "토스 딥리서치 해줘", "삼성전자 상세 분석"
- "interview" : 특정 회사 면접 준비, 예상 질문, 면접 전략을 원할 때. 자소서를 제공하며 면접 질문 생성을 원할 때도 포함.
                예) "카카오 면접 준비해줘", "네이버 예상 면접 질문 알려줘", "토스 인터뷰 팁", "삼성 면접 어떻게 준비해?",
                    "내 자소서야: [내용] 면접 질문 만들어줘", "이 자소서 보고 예상 질문 알려줘"
- "interview_practice": 실제 대화형 모의 면접 연습을 원할 때
                예) "카카오 모의 면접 해줘", "네이버 면접 연습하자", "토스 면접 봐줘", "삼성 실전 면접 해보자"
- "coverletter": 특정 회사 자기소개서 초안 작성을 원할 때
                예) "카카오 자소서 써줘", "네이버 자기소개서 초안 만들어줘", "토스 개발자 자소서 작성해줘", "삼성 지원동기 써줘"
- "feedback"  : 자기소개서를 직접 제공하며 피드백·첨삭을 원할 때 (메시지에 자소서 본문이 포함됨)
                예) "내 자소서 피드백해줘: [자소서 내용]", "이 자소서 첨삭해줘: [내용]", "자소서 봐줘: [내용]"
- "salary"    : 특정 회사 연봉 협상 가이드를 원할 때
                예) "카카오 연봉 협상 도와줘", "네이버 개발자 연봉 얼마야", "토스 오퍼 받았는데 네고 전략 알려줘"
- "qa"        : 그 외 모든 메시지 (단일 회사 특정 질문, 인사, 일반 대화 등)
                예) "카카오 복지 어때?", "안녕", "네이버 채용 알려줘"

company_name 규칙:
- "qa"/"crawl"/"research" intent: 메시지에서 언급된 회사명 하나만 추출, 없으면 null
- "compare" intent: company_name은 null로 설정
- 정식 회사명으로 정규화 (예: "배달의 민족" → "배달의민족", "baemin" → "배달의민족")

company_names 규칙:
- "compare" intent: 비교 대상 회사명 배열 (예: ["카카오", "네이버"])
- 그 외 intent: 빈 배열 []"""


def classify_intent(message: str) -> dict:
    """
    사용자 메시지의 intent 와 회사명 후보를 분류한다.

    OpenAI 사용이 가능하면 JSON 응답을 강제하고,
    실패하거나 키가 없으면 규칙 기반 fallback 으로 내려간다.
    """
    if not message or not message.strip():
        return {"intent": "qa", "company_name": None, "company_names": []}

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("CHANGE_ME"):
        return _rule_based_fallback(message)

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message.strip()},
            ],
            max_tokens=80,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        data = json.loads(raw)
        intent = data.get("intent", "qa")
        if intent not in VALID_INTENTS:
            intent = "qa"
        company_name = data.get("company_name") or None
        company_names = data.get("company_names") or []
        if not isinstance(company_names, list):
            company_names = []
        return {
            "intent": intent,
            "company_name": company_name,
            "company_names": [str(n) for n in company_names if n],
        }
    except Exception:
        return _rule_based_fallback(message)


def _rule_based_fallback(message: str) -> dict:
    """LLM 호출이 불가능할 때 최소한의 키워드 규칙으로 intent 를 추정한다."""
    if _COMPARE_KEYWORDS.search(message):
        return {"intent": "compare", "company_name": None, "company_names": []}
    if _INTERVIEW_PRACTICE_KEYWORDS.search(message):
        return {"intent": "interview_practice", "company_name": None, "company_names": []}
    if _RESEARCH_KEYWORDS.search(message):
        return {"intent": "research", "company_name": None, "company_names": []}
    if _SALARY_KEYWORDS.search(message):
        return {"intent": "salary", "company_name": None, "company_names": []}
    if _COVERLETTER_KEYWORDS.search(message):
        return {"intent": "coverletter", "company_name": None, "company_names": []}
    if _FEEDBACK_KEYWORDS.search(message):
        return {"intent": "feedback", "company_name": None, "company_names": []}
    if _RESUME_KEYWORDS.search(message):
        return {"intent": "interview", "company_name": None, "company_names": []}
    if _INTERVIEW_KEYWORDS.search(message):
        return {"intent": "interview", "company_name": None, "company_names": []}
    intent = "crawl" if _CRAWL_KEYWORDS.search(message) else "qa"
    return {"intent": intent, "company_name": None, "company_names": []}

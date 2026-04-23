from __future__ import annotations

import os
import re

import httpx

NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json"


def search_company_news(company_name: str, display: int = 5) -> list[dict]:
    """
    네이버 뉴스 API로 회사 관련 최신 뉴스를 검색한다.
    반환: [{title, description, link, pub_date}] 리스트
    """
    return search_news(company_name, display=display, strict_filter=True)


def search_news(query: str, display: int = 5, strict_filter: bool = False) -> list[dict]:
    """
    네이버 뉴스 API로 키워드 기반 최신 뉴스를 검색한다.
    strict_filter=True이면 제목에 query가 포함된 기사만 남긴다.
    반환: [{title, description, link, pub_date}] 리스트
    """
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return []

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                NAVER_NEWS_URL,
                params={"query": query, "display": display, "sort": "date"},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
            )
            response.raise_for_status()
            items = response.json().get("items", [])

        formatted = [_format_news(item) for item in items]
        if strict_filter:
            filtered = [n for n in formatted if query in n["title"]]
            return filtered if filtered else formatted[:1]
        return formatted
    except Exception:
        return []


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _format_news(item: dict) -> dict:
    return {
        "title": _strip_html(item.get("title", "")),
        "description": _strip_html(item.get("description", "")),
        "link": item.get("originallink") or item.get("link", ""),
        "pub_date": item.get("pubDate", ""),
    }

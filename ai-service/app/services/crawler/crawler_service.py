from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict
from urllib.parse import urljoin, urlparse
import logging
import re
import time

import threading

import httpx
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Browser, BrowserContext

log = logging.getLogger(__name__)

from app.services.embedding.chunking_service import chunk_text
from app.services.extractor.cleaner import clean_text
from app.services.extractor.content_extractor import extract_raw_text, extract_text_content

# ── Playwright 브라우저 — 스레드 로컬 싱글턴 ──────────────────
# FastAPI sync 엔드포인트는 스레드풀에서 실행되므로 전역 싱글턴을 공유하면
# greenlet이 다른 스레드에서 switch를 시도해 오류가 발생한다.
# threading.local()로 스레드별 인스턴스를 유지해 이를 방지한다.
_thread_local = threading.local()


def _get_browser() -> Browser:
    """현재 스레드의 Playwright Chromium 브라우저를 반환한다."""
    browser: Browser | None = getattr(_thread_local, "pw_browser", None)
    if browser and browser.is_connected():
        return browser
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True)
    _thread_local.pw_instance = pw
    _thread_local.pw_browser = browser
    return browser


def _fetch_html_playwright(url: str, timeout_ms: int = 15000) -> str:
    """Playwright 헤드리스 브라우저로 JS 렌더링된 HTML을 가져온다."""
    browser = _get_browser()
    context: BrowserContext = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        java_script_enabled=True,
    )
    page = context.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        # JS 렌더링 대기: networkidle 또는 최대 3초
        try:
            page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass
        html = page.content()
    finally:
        page.close()
        context.close()
    return html


# 크롤링에서 필요한 URL 입력/HTML 다운로드/링크 탐색 동작의 진입점.
# 동작:
# 1) URL 유효성 검사
# 2) 메인 페이지 HTML fetch
# 3) 내부 링크 탐색 + 유형 분류(about/careers/culture/blog)
# 4) 핵심 페이지 텍스트 추출
@dataclass
class CrawlResult:
    """단일 크롤링 실행의 요약 결과와 문서 적재 payload."""
    source_url: str
    links: List[str]
    page_type_map: Dict[str, List[str]]
    extracted_text: Dict[str, str]
    documents: List[Dict[str, object]]


class CrawlerService:
    """회사 홈페이지에서 핵심 링크를 골라 본문 텍스트와 청크를 추출한다."""
    TOPIC_KEYWORDS = {
        # "company" 단독 키워드 제거: /company/affiliates, /company/ir 등 무관 페이지까지 수집되는 문제 방지
        "about": ["about-us", "aboutus", "introduce", "overview", "회사소개", "기업소개"],
        "careers": ["careers", "career", "jobs", "recruit", "채용", "채용정보"],
        "culture": [
            "culture", "culture-and-values", "about-culture", "조직문화", "인사",
            "welfare", "benefit", "life", "복지", "구성원", "우리의삶",
        ],
        "tech_blog": ["blog", "tech", "engineering", "insight", "개발블로그", "기술블로그"],
    }
    # 크롤링에서 제외할 URL 패턴: 로그인/인증/동적 필터 등 본문 없는 페이지
    BLOCKED_URL_PATTERNS = (
        "/login", "login.do", "/logout", "/signin", "/signup",
        "/auth/", "/oauth", "/sso", "/forgot-password", "/reset-password",
        "/mem/", "/mypage/", "/myaccount/",
    )
    TARGET_CATEGORIES = ("about", "careers", "culture", "tech_blog")
    MAX_LINKS_PER_CATEGORY = 3
    CRAWL_TOTAL_TIMEOUT_SECONDS = 60
    MAX_TARGET_LINKS = 12
    MAX_DOCUMENT_TEXT_LENGTH = 3000
    MAX_RAW_TEXT_LENGTH = 3000
    NOISE_KEYWORDS = (
        # 웹 접근성 스킵 내비게이션
        "메뉴 바로가기",
        "본문 바로가기",
        "소개 본문",
        "섹션으로 이동",
        "맨 위로 이동",
        # 일반 UI 인터랙션
        "일주일 그만보기",
        "전체삭제",
        "전체 삭제",
        "공유하기",
        # 커머스/로그인 UI (기업 소개와 무관)
        "최근 본 제품",
        "조회기간",
        "검색 결과",
    )

    # URL이 https/http 형태가 아니면 수집 대상이 아니므로 조기에 실패시킨다.
    def validate_company_url(self, url: str) -> None:
        """크롤링 시작 전에 URL scheme 을 검증한다."""
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("URL must start with http or https")

    # HTML을 요청하고 텍스트 추출, 링크 추출까지 한 번에 수행한다.
    def crawl(self, url: str) -> CrawlResult:
        """메인 페이지와 관련 하위 페이지를 수집해 문서 저장용 구조로 반환한다."""
        self.validate_company_url(url)

        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "lxml")

        links = self.extract_internal_links(soup, url)

        # 2-hop 링크 발견: 메인 도메인과 다른 서브도메인(예: recruit.navercorp.com)이
        # 발견되면 해당 서브도메인 루트 페이지의 내부 링크도 수집해
        # /cnts/benefits 같은 하위 페이지를 찾는다.
        # - 최대 2개 서브도메인 루트만 탐색해 속도 영향 최소화
        # - 쿼리 파라미터가 있거나 동적 상세 페이지(숫자 ID 등)는 제외해 노이즈 차단
        main_netloc = urlparse(url).netloc
        subdomain_roots: set[str] = set()
        for link in list(links):
            parsed = urlparse(link)
            if parsed.netloc and parsed.netloc != main_netloc and parsed.path in {"", "/"}:
                subdomain_roots.add(link.rstrip("/"))
        for sub_root in list(subdomain_roots)[:2]:
            try:
                sub_html = self.fetch_html(sub_root)
                sub_soup = BeautifulSoup(sub_html, "lxml")
                sub_links = self.extract_internal_links(sub_soup, sub_root)
                # 쿼리 파라미터가 있는 동적 URL, 숫자 ID로 끝나는 상세 페이지는 제외
                filtered = {
                    lnk for lnk in sub_links
                    if not urlparse(lnk).query
                    and not re.search(r"/\d+$", urlparse(lnk).path)
                }
                links.update(filtered)
                log.info("[Crawler] 2-hop links from %s: +%d (filtered from %d)",
                         sub_root, len(filtered), len(sub_links))
            except Exception as e:
                log.warning("[Crawler] 2-hop fetch failed for %s: %s", sub_root, e)

        page_type_map = self.classify_links(links)
        extracted_text, documents = self.extract_target_texts(url, soup, page_type_map)

        return CrawlResult(
            source_url=url,
            links=list(links),
            page_type_map=page_type_map,
            extracted_text=extracted_text,
            documents=documents,
        )

    # 메인 URL HTML fetch (Playwright 우선, 실패 시 httpx 폴백)
    def fetch_html(self, url: str) -> str:
        """렌더링이 필요한 페이지는 Playwright, 실패 시 httpx 로 HTML을 가져온다."""
        try:
            html = _fetch_html_playwright(url)
            if html and len(html) > 500:
                return html
            log.info("[Crawler] Playwright returned short HTML (%d bytes), falling back to httpx: %s", len(html) if html else 0, url)
        except Exception as e:
            log.warning("[Crawler] Playwright failed for %s: %s — falling back to httpx", url, e)
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.text

    # 같은 도메인(서브도메인 포함) 내부 링크만 수집하여 탐색 범위를 제한한다.
    # recruit.navercorp.com 등 서브도메인에 복지/채용 정보가 있는 경우를 위해
    # 루트 도메인이 같으면 허용한다.
    def extract_internal_links(self, soup: BeautifulSoup, base_url: str) -> set[str]:
        """같은 루트 도메인 안의 링크만 추출해 크롤링 범위를 제한한다."""
        parsed_base = urlparse(base_url)
        base_root = self._root_domain(parsed_base.netloc)
        links: set[str] = {base_url}

        for anchor in soup.find_all("a", href=True):
            href = str(anchor.get("href")).strip()
            if href.startswith("mailto:") or href.startswith("tel:"):
                continue

            full = urljoin(base_url, href)
            parsed_full = urlparse(full)

            if parsed_full.scheme not in {"http", "https"}:
                continue

            if self._root_domain(parsed_full.netloc) != base_root:
                continue

            links.add(full.split("#")[0])

        return links

    @staticmethod
    def _root_domain(netloc: str) -> str:
        """'recruit.navercorp.com' → 'navercorp.com'"""
        parts = netloc.split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else netloc

    # 링크 문자열에 키워드 포함 여부로 주요 페이지 타입을 분류한다.
    # 도메인 이름("recruit" 등)이 잘못된 분류를 유발하지 않도록
    # 항상 경로(path)만으로 매칭하고, 도메인은 사용하지 않는다.
    # 예: recruit.navercorp.com/cnts/service → path=/cnts/service → 어떤 키워드도 없음 → other
    #     recruit.navercorp.com/cnts/benefits → path=/cnts/benefits → benefit 매칭 → culture
    def classify_links(self, links: set[str]) -> dict[str, list[str]]:
        """URL path 키워드로 링크를 about/careers/culture/tech_blog 등으로 분류한다."""
        classified = {
            "about": [],
            "careers": [],
            "culture": [],
            "tech_blog": [],
            "other": [],
        }

        _CAREERS_DOMAIN_KEYWORDS = ("recruit", "career", "jobs", "채용")

        for link in links:
            parsed = urlparse(link)
            path_lower = parsed.path.lower()
            domain_lower = parsed.netloc.lower()
            placed = False

            # 경로(path)로 카테고리 매칭 (우선순위 높음)
            for section, keywords in self.TOPIC_KEYWORDS.items():
                if any(kw in path_lower for kw in keywords):
                    classified[section].append(link)
                    placed = True
                    break

            # path 미매칭 시: 도메인에 채용 관련 키워드가 있으면 careers로 분류
            # 예) recruit.navercorp.com → domain에 "recruit" 포함 → careers
            if not placed and any(kw in domain_lower for kw in _CAREERS_DOMAIN_KEYWORDS):
                classified["careers"].append(link)
                placed = True

            if not placed:
                classified["other"].append(link)

        return classified

    # 핵심 페이지의 본문을 추출/정제하고 chunk 단위로 분해해 반환한다.
    def extract_target_texts(
        self,
        source_url: str,
        soup: BeautifulSoup,
        page_type_map: dict[str, list[str]],
    ) -> tuple[dict[str, str], list[dict[str, object]]]:
        """우선순위 링크에서 본문을 추출해 preview 텍스트와 저장용 document 목록을 만든다."""
        extracted: dict[str, str] = {}
        documents: list[dict[str, object]] = []
        ordered_links = self.get_ordered_target_links(page_type_map)

        deadline = time.monotonic() + self.CRAWL_TOTAL_TIMEOUT_SECONDS

        for link in ordered_links[: self.MAX_TARGET_LINKS]:
            if time.monotonic() > deadline:
                log.warning("Crawl total timeout reached after %ds. Collected %d documents so far.",
                            self.CRAWL_TOTAL_TIMEOUT_SECONDS, len(documents))
                break
            try:
                page_html = self.fetch_html(link)
                page_soup = BeautifulSoup(page_html, "lxml")
                raw_text = extract_raw_text(str(page_soup))
                page_source_text = extract_text_content(str(page_soup))
                cleaned_content = clean_text(page_source_text)
                cleaned_text = self.clean_and_deduplicate_text(cleaned_content)
                if not self._is_meaningful_text(cleaned_text):
                    cleaned_text = self.extract_fallback_text(page_soup)
                cleaned_text = cleaned_text[: self.MAX_DOCUMENT_TEXT_LENGTH]
                if not cleaned_text:
                    continue

                title = page_soup.find("title").get_text(" ", strip=True) if page_soup.find("title") else ""
                page_type = self.resolve_page_type(link, page_type_map)
                chunks = chunk_text(cleaned_text)

                extracted[link] = cleaned_text[:1200]
                documents.append(
                    {
                        "source_url": link,
                        "page_title": title,
                        "page_type": page_type,
                        "raw_text": raw_text[: self.MAX_RAW_TEXT_LENGTH],
                        "cleaned_text": cleaned_text,
                        "chunks": chunks,
                    }
                )
            except Exception as e:
                log.warning("Failed to extract text from url=%s: %s", link, e)
                extracted[link] = ""

        if not documents:
            title = soup.find("title").get_text(" ", strip=True) if soup.find("title") else "index"
            raw_text = extract_raw_text(str(soup))
            page_source_text = extract_text_content(str(soup))
            cleaned_content = clean_text(page_source_text)
            cleaned_text = self.clean_and_deduplicate_text(cleaned_content)
            if not self._is_meaningful_text(cleaned_text):
                cleaned_text = self.extract_fallback_text(soup, fallback_title=title)
            cleaned_text = cleaned_text[: self.MAX_DOCUMENT_TEXT_LENGTH]

            extracted[source_url] = cleaned_text[:1200]
            documents.append(
                {
                    "source_url": source_url,
                    "page_title": title,
                    "page_type": "about",
                    "raw_text": raw_text[: self.MAX_RAW_TEXT_LENGTH],
                    "cleaned_text": cleaned_text,
                    "chunks": chunk_text(cleaned_text),
                }
            )

        return extracted, documents

    # about/careers 등 우선순위 카테고리에서 품질 좋은 링크만 우선 수집한다.
    # 로그인/인증 등 본문 없는 페이지는 BLOCKED_URL_PATTERNS로 미리 제외한다.
    def get_ordered_target_links(self, page_type_map: dict[str, list[str]]) -> list[str]:
        """카테고리 우선순위와 차단 패턴을 적용해 실제 방문할 링크 목록을 만든다."""
        ordered_links: list[str] = []
        for category in self.TARGET_CATEGORIES:
            allowed = [
                lnk for lnk in page_type_map.get(category, [])
                if not any(pat in lnk.lower() for pat in self.BLOCKED_URL_PATTERNS)
            ]
            if len(allowed) < len(page_type_map.get(category, [])):
                blocked_count = len(page_type_map.get(category, [])) - len(allowed)
                log.info("[Crawler] blocked %d login/auth URLs from category=%s", blocked_count, category)
            ordered_links.extend(allowed[: self.MAX_LINKS_PER_CATEGORY])
        return list(dict.fromkeys(ordered_links))

    # 광고/팝업/공통 UI 텍스트를 제거해 문서 품질을 개선한다.
    def clean_and_deduplicate_text(self, text: str) -> str:
        """노이즈 문구를 제거하고 줄 단위 텍스트를 하나의 본문 문자열로 정리한다."""
        if not text:
            return ""

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        cleaned_lines: list[str] = []

        for line in lines:
            sanitized = line
            for noise in self.NOISE_KEYWORDS:
                sanitized = sanitized.replace(noise, " ")

            sanitized = re.sub(r"\s+", " ", sanitized).strip()
            if not sanitized:
                continue

            if re.search(r"[A-Za-z가-힣0-9]", sanitized):
                cleaned_lines.append(sanitized)

        merged = " ".join(cleaned_lines)
        return " ".join(merged.split())

    # 의미 없는 내비게이션 텍스트만 남는지 판별한다.
    # 실제 본문 단서(문장 종결/연결어/주요 명사)가 없으면 fallback 대상으로 간주한다.
    def _is_meaningful_text(self, text: str) -> bool:
        if not text or len(text.strip()) < 25:
            return False

        if not re.search(r"[가-힣]{2,}(니다|합니다|했다|됩니다|있습니다|한다|한다는|될|되며|했다|했다\\.)", text):
            # 모든 단어가 길이가 짧은 항목 중심이면 본문성이 낮은 텍스트일 가능성이 큼.
            tokens = [token for token in text.split() if len(token) >= 2]
            if len("".join(tokens)) < 80:
                return False

        noise_hit = sum(1 for word in self.NOISE_KEYWORDS if word in text)
        if noise_hit >= max(2, len(text.split()) // 4):
            return False

        return True

    # meta 태그/제목/헤더 정보를 이용해 최소한의 의미 텍스트를 복구한다.
    def extract_fallback_text(self, page_soup: BeautifulSoup, fallback_title: str | None = None) -> str:
        """본문 추출 실패 시 title, meta description, h1 로 최소 설명 텍스트를 복구한다."""
        candidates: list[str] = []

        if fallback_title:
            candidates.append(fallback_title)

        meta_descriptions = page_soup.select('meta[name="description"], meta[property="og:description"], meta[name="og:description"]')
        for meta in meta_descriptions:
            content = meta.get("content", "").strip() if meta else ""
            if content:
                candidates.append(content)

        h1 = page_soup.find("h1")
        if h1:
            candidates.append(h1.get_text(" ", strip=True))

        cleaned = self.clean_and_deduplicate_text(" ".join(candidates))
        return cleaned

    # 링크가 어떤 카테고리에서 수집됐는지 역으로 찾아 page_type으로 저장한다.
    def resolve_page_type(self, link: str, page_type_map: dict[str, list[str]]) -> str:
        """분류 결과를 역조회해 document.page_type 값을 결정한다."""
        for page_type, items in page_type_map.items():
            if link in items:
                return page_type
        return "other"

from __future__ import annotations

import os
import re
from urllib.parse import urlparse

import httpx

from app.core.config_loader import (
    get_excluded_domains,
)

_NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"
_NAVER_WEB_URL   = "https://openapi.naver.com/v1/search/webkr.json"

# config/excluded_domains.json 에서 로드
_EXCLUDED_DOMAINS: set[str] = get_excluded_domains()

# 하위 호환: 기존 _WEB_EXCLUDED_DOMAINS 이름 유지
_WEB_EXCLUDED_DOMAINS = _EXCLUDED_DOMAINS


def find_company_info(company_name: str) -> dict | None:
    """
    0단계: 주요 회사 직접 매핑 테이블 확인 (API 오류 방지)
    1단계: 네이버 업체 검색(local)으로 실제 회사인지 확인 + 회사명 정규화
    2단계: 공식 홈페이지 URL이 없으면 웹 검색(webkr)으로 URL만 보완
    반환: {"name": str, "url": str | None} 또는 None
    """
    client_id     = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            # ── 1단계: 업체 검색 ───────────────────────────────────
            local_resp = client.get(
                _NAVER_LOCAL_URL,
                params={"query": company_name, "display": 5},
                headers=headers,
            )
            local_resp.raise_for_status()
            local_items = local_resp.json().get("items", [])

            result = _pick_local_result(company_name, local_items)
            if result is None:
                return None  # 업체 검색에서 매칭 안 되면 미인식으로 처리

            # ── 2단계: URL 보완 (업체 검색에 link가 없는 경우) ───────
            if not result["url"]:
                web_resp = client.get(
                    _NAVER_WEB_URL,
                    params={"query": f"{result['name']} 공식 홈페이지", "display": 5},
                    headers=headers,
                )
                web_resp.raise_for_status()
                web_items = web_resp.json().get("items", [])
                result["url"] = _pick_web_url(result["name"], web_items)

    except Exception:
        return None

    return result  # {"name": str, "url": str | None, "category": str}


def _pick_local_result(company_name: str, items: list[dict]) -> dict | None:
    """
    업체 검색 결과에서 검색어와 가장 유사한 항목을 반환한다.
    - title에서 HTML 태그 제거 후 검색어 포함 여부로 매칭
    - URL은 local 검색 link를 신뢰하지 않고 항상 None 반환 → web 검색에서 보완
    - category 필드를 description으로 반환 (예: "IT서비스 > 소프트웨어")
    """
    query_clean = re.sub(r"\s+", "", company_name).lower()

    for item in items:
        raw_title = item.get("title", "")
        name = re.sub(r"<[^>]+>", "", raw_title).strip()
        name_clean = re.sub(r"\s+", "", name).lower()

        if query_clean in name_clean or name_clean in query_clean:
            # category: "IT서비스 > 소프트웨어" → "IT서비스" 앞부분만 사용
            raw_category = item.get("category", "")
            category = raw_category.split(">")[0].strip() if raw_category else ""
            return {"name": name, "url": None, "category": category}

    return None


def _pick_web_url(company_name: str, items: list[dict]) -> str | None:
    """
    웹 검색 결과에서 공식 홈페이지 URL만 추출한다.
    1순위: 도메인에 회사 영문명이 포함된 결과 (예: kakaocorp.com에 kakao 포함)
    2순위: 검색 결과 제목에 회사명이 포함된 첫 번째 비제외 결과
    """
    company_en = re.sub(r"[^a-z0-9]", "", company_name.lower())
    company_kr = re.sub(r"\s+", "", company_name.strip())

    # 1순위 후보 (도메인 매칭)와 2순위 후보 (제목 매칭) 분리
    title_matched: list[str] = []
    others: list[str] = []

    for item in items:
        link = item.get("link", "").strip()
        if not link:
            continue

        parsed = urlparse(link)
        domain = parsed.netloc.lower().replace("www.", "")

        if any(domain == ex or domain.endswith(f".{ex}") for ex in _WEB_EXCLUDED_DOMAINS):
            continue

        if domain.endswith(".go.kr") or domain.endswith(".or.kr"):
            continue

        root_url = _to_root_url(link)
        domain_clean = re.sub(r"[^a-z0-9]", "", domain)

        # 1순위: 도메인에 영문 회사명 포함 → 즉시 반환
        if company_en and company_en in domain_clean:
            return root_url

        # 2순위: 검색 결과 제목에 회사명(한글) 포함 여부로 분류
        raw_title = re.sub(r"<[^>]+>", "", item.get("title", ""))
        title_clean = re.sub(r"\s+", "", raw_title)
        if company_kr and company_kr in title_clean:
            title_matched.append(root_url)
        else:
            others.append(root_url)

    # 제목에 회사명이 포함된 결과 우선, 없으면 None (오귀인 방지)
    if title_matched:
        return title_matched[0]
    return None


def _to_root_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


# 법인형태 접미사 (주식회사, (주), 유한회사 등)
_LEGAL_FORM_RE = re.compile(
    r"(주식회사|㈜|\(주\)|유한회사|유한책임회사|사단법인|재단법인)\s*"
)


def discover_legal_name(brand_name: str) -> str | None:
    """
    브랜드명으로 네이버 웹 검색을 해서 DART 법인명을 자동 발견한다.
    예: "토스" → "비바리퍼블리카", "오늘의집" → "버킷플레이스"
    config에 수동 매핑을 추가하지 않아도 동작한다.
    """
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return None

    # DART 법인 목록 로드
    try:
        from app.services.jobs.dart_service import _load_corp_code_map, _API_KEY, _clean_dart_name
        api_key = _API_KEY()
        if not api_key or api_key.startswith("your_"):
            return None
        corp_map = _load_corp_code_map(api_key)
        if not corp_map:
            return None
    except Exception:
        return None

    # 정규화된 DART 법인명 → 원본명 역매핑
    dart_names: dict[str, str] = {}
    for raw_name in corp_map:
        clean = _clean_dart_name(raw_name).lower().replace(" ", "")
        dart_names[clean] = _clean_dart_name(raw_name)

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    # "토스 운영사" 같은 쿼리로 법인명이 포함된 검색 결과를 가져온다
    search_queries = [
        f"{brand_name} 운영사",
        f"{brand_name} 회사 법인명",
    ]

    for query in search_queries:
        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(
                    _NAVER_WEB_URL,
                    params={"query": query, "display": 10},
                    headers=headers,
                )
                resp.raise_for_status()
                items = resp.json().get("items", [])
        except Exception:
            continue

        # 검색 결과의 title + description 에서 법인명 후보 추출
        for item in items:
            raw_title = re.sub(r"<[^>]+>", "", item.get("title", ""))
            raw_desc = re.sub(r"<[^>]+>", "", item.get("description", ""))
            combined = f"{raw_title} {raw_desc}"

            # 패턴 1: "(주)XXX", "주식회사 XXX" 등 법인형태 뒤의 이름
            for m in re.finditer(r"(?:주식회사|㈜|\(주\))\s*([가-힣A-Za-z&]{2,15})", combined):
                candidate = m.group(1).strip()
                key = candidate.lower().replace(" ", "")
                if key in dart_names and key != brand_name.lower().replace(" ", ""):
                    return dart_names[key]

            # 패턴 2: "브랜드명(법인명)" 또는 "법인명(브랜드명)" 괄호 패턴
            brand_esc = re.escape(brand_name)
            # "토스(비바리퍼블리카)" 패턴
            for m in re.finditer(rf"{brand_esc}\s*[\(（]([가-힣A-Za-z&]{{2,15}})[\)）]", combined):
                candidate = m.group(1).strip()
                key = candidate.lower().replace(" ", "")
                if key in dart_names:
                    return dart_names[key]
            # "비바리퍼블리카(토스)" 패턴
            for m in re.finditer(rf"([가-힣A-Za-z&]{{2,15}})\s*[\(（]{brand_esc}[\)）]", combined):
                candidate = m.group(1).strip()
                key = candidate.lower().replace(" ", "")
                if key in dart_names:
                    return dart_names[key]

            # 패턴 3: 검색 결과 텍스트에서 DART 법인명과 일치하는 단어 탐색
            # "토스를 운영하는 비바리퍼블리카가..." 같은 문맥
            # 3글자 미만은 일반 단어와 겹칠 가능성이 높아 제외
            brand_norm = brand_name.lower().replace(" ", "")
            words = re.findall(r"[가-힣A-Za-z&]{3,15}", combined)
            for word in words:
                key = word.lower().replace(" ", "")
                if len(key) >= 3 and key in dart_names and key != brand_norm:
                    return dart_names[key]

        # 첫 번째 쿼리에서 찾았으면 두 번째 쿼리 생략
        # (위 for문에서 return하지 않았으면 continue)

    return None


# 하위 호환용 래퍼
def find_company_url(company_name: str) -> str | None:
    info = find_company_info(company_name)
    return info["url"] if info else None


# 제목에서 제거할 비회사 접미사 패턴 (채용공고·뉴스·주가·기업정보 사이트 등)
_NON_COMPANY_SUFFIX = re.compile(
    r"[\s|·\-]+("
    r"채용|공채|채용공고|채용정보|신입|경력|인턴|구인|구직|"
    r"뉴스|기사|보도|언론|주가|시세|IR|투자|실적|공시|배당|"
    r"리뷰|기업리뷰|후기|평가|커뮤니티|포럼|블로그|이벤트|프로모션|"
    r"공식홈페이지|홈페이지|공식사이트|대표전화|고객센터|고객지원|"
    r"공지|안내|소개|위키|나무위키|"
    r"기업정보|기업리뷰|연봉정보|면접후기|복지정보|기업문화|"
    r"법인정보|사업자정보|재무정보|기업개요"
    r").*$",
    re.IGNORECASE,
)

# "YYYY년" 이후 모든 내용 제거 (기업정보 사이트 패턴)
_YEAR_SUFFIX = re.compile(r"\s+\d{4}년.*$")

# " | " 이후 모든 내용 제거
_PIPE_SUFFIX = re.compile(r"\s*[|｜]\s*.*$")

# 지점·매장 등 위치 접미사 패턴
_LOCATION_SUFFIX = re.compile(
    r"\s+\S*(점|지점|센터|매장|사무소|사옥|본점|지사|지소|분점|영업소)$"
)


def get_seo_domain_ranking(query: str, limit: int = 15) -> dict[str, int]:
    """
    Naver 웹 검색으로 query에 대한 도메인 SEO 순위를 반환한다.
    뉴스·채용·SNS 도메인은 제외하고 공식 홈페이지 도메인만 집계한다.
    반환: {domain: rank} (낮을수록 상위 — 1부터 시작)
    """
    client_id     = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return {}

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                _NAVER_WEB_URL,
                params={"query": query, "display": limit},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
    except Exception:
        return {}

    domain_rank: dict[str, int] = {}
    rank = 1
    for item in items:
        link = item.get("link", "").strip()
        if not link:
            continue
        parsed = urlparse(link)
        domain = parsed.netloc.lower().replace("www.", "")
        if any(domain == ex or domain.endswith(f".{ex}") for ex in _EXCLUDED_DOMAINS):
            continue
        if domain.endswith(".go.kr") or domain.endswith(".or.kr"):
            continue
        if domain not in domain_rank:
            domain_rank[domain] = rank
            rank += 1

    return domain_rank


def search_company_names(query: str, limit: int = 8) -> list[str]:
    """
    Naver webkr.json 검색 결과에서 회사명 후보를 추출한다.
    DART API 키가 없을 때 자동완성 폴백으로 사용한다.
    """
    client_id     = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return []

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                _NAVER_WEB_URL,
                params={"query": query, "display": 20},
                headers=headers,
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
    except Exception:
        return []

    query_clean = re.sub(r"\s+", "", query).lower()
    seen: set[str] = set()
    results: list[str] = []

    for item in items:
        raw = re.sub(r"<[^>]+>", "", item.get("title", "")).strip()

        # " | " 이후 및 "YYYY년" 이후 제거 (기업정보 사이트 페이지 제목 정제)
        cleaned = _PIPE_SUFFIX.sub("", raw).strip()
        cleaned = _YEAR_SUFFIX.sub("", cleaned).strip()
        # 비회사 접미사·지점명 제거
        cleaned = _NON_COMPANY_SUFFIX.sub("", cleaned).strip()
        cleaned = _LOCATION_SUFFIX.sub("", cleaned).strip()

        if not cleaned or len(cleaned) < 2:
            continue

        # 검색어와 관련 없는 결과 제외
        cleaned_norm = re.sub(r"\s+", "", cleaned).lower()
        if query_clean not in cleaned_norm and cleaned_norm not in query_clean:
            continue

        key = cleaned_norm
        if key not in seen:
            seen.add(key)
            results.append(cleaned)

        if len(results) >= limit:
            break

    return results


def search_company_names_fallback(query: str, limit: int = 3) -> list[dict]:
    """
    Naver webkr.json 검색에서 실제 회사명 후보를 추출한다.
    name-contains 필터를 적용하지 않아 오타 입력 시 유사 회사명을 제안하는 데 사용한다.
    반환: [{"name": str, "description": str, "url": None}]
    """
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return []

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                _NAVER_WEB_URL,
                params={"query": f"{query} 회사", "display": 10},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
    except Exception:
        return []

    query_clean = re.sub(r"\s+", "", query).lower()
    seen: set[str] = set()
    results: list[dict] = []

    for item in items:
        raw = re.sub(r"<[^>]+>", "", item.get("title", "")).strip()

        # 선행 대괄호·소괄호·해시태그 블록 제거 (뉴스 출처·태그 표기 제거)
        cleaned = re.sub(r"^[\[(\uff08\u300a#][^\])\uff09\u300b]*[\])\uff09\u300b]?\s*", "", raw).strip()
        cleaned = _PIPE_SUFFIX.sub("", cleaned).strip()
        # " - " 이후 제거 (예: "#태크랩스 - 유니콘팩토리")
        cleaned = re.sub(r"\s+-\s+.*$", "", cleaned).strip()
        cleaned = _YEAR_SUFFIX.sub("", cleaned).strip()
        cleaned = _NON_COMPANY_SUFFIX.sub("", cleaned).strip()
        cleaned = _LOCATION_SUFFIX.sub("", cleaned).strip()
        # 쉼표 이후 제거 (뉴스 제목의 "회사명, 사건" 패턴)
        cleaned = re.sub(r"[,，].*$", "", cleaned).strip()

        if not cleaned or len(cleaned) < 2 or len(cleaned) > 20:
            continue

        cleaned_norm = re.sub(r"\s+", "", cleaned).lower()

        # 오타 유사도: 공통 자모 3글자 이상 (2글자는 접미사 공유로 오탐 多)
        common = sum(1 for ch in query_clean if ch in cleaned_norm)
        if common < 3:
            continue

        # 정확 일치 제외
        if cleaned_norm == query_clean:
            continue

        key = cleaned_norm
        if key not in seen:
            seen.add(key)
            link = item.get("link") or None
            if link:
                parsed = urlparse(link)
                domain = parsed.netloc.lower().replace("www.", "")
                if any(domain == ex or domain.endswith(f".{ex}") for ex in _EXCLUDED_DOMAINS):
                    link = None
                elif domain.endswith(".go.kr") or domain.endswith(".or.kr"):
                    link = None
                else:
                    # 도메인에 회사명(영문)이 포함된 경우만 공식 홈페이지로 인정
                    company_en = re.sub(r"[^a-z0-9]", "", cleaned.lower())
                    domain_clean = re.sub(r"[^a-z0-9]", "", domain)
                    if not company_en or company_en not in domain_clean:
                        link = None
            results.append({
                "name": cleaned,
                "description": "혹시 이 회사를 찾으셨나요?",
                "url": link,
            })

        if len(results) >= limit:
            break

    return results


def search_company_candidates(company_name: str) -> list[dict]:
    """
    회사명으로 후보 목록을 반환한다. 동명 이의어 disambiguation에 사용.
    0순위: DART 등록 법인 검색 (삼성전자·삼성물산 등 정확한 법인명)
    1순위: 네이버 업체 검색 (물리적 사업체)
    2순위: Wanted 회사 검색 (스타트업·IT 기업 보완)
    반환: [{"name": str, "description": str, "url": str | None}]
    """
    MAX_CANDIDATES = 10
    candidates: list[dict] = []
    seen: set[tuple] = set()
    seen_names: set[str] = set()  # name-only dedup across all sources

    query_norm = company_name.strip().lower().replace(" ", "")

    # ── 브랜드명 → 법인명 해석 (예: "토스" → "비바리퍼블리카") ──────
    # 1차: config 매핑 (dart_mappings.json)
    # 2차: 네이버 웹 검색으로 자동 발견 (config에 없는 브랜드도 처리)
    brand_legal_name: str | None = None
    try:
        from app.services.jobs.dart_service import _BRAND_TO_LEGAL_NAME, _normalize_lookup_key
        brand_legal_name = _BRAND_TO_LEGAL_NAME.get(company_name.strip())
        if not brand_legal_name:
            brand_legal_name = _BRAND_TO_LEGAL_NAME.get(_normalize_lookup_key(company_name))
    except Exception:
        pass

    # ── 0순위(DART): 법인명 검색 ───────────
    if len(candidates) < MAX_CANDIDATES:
        try:
            from app.services.jobs.dart_service import (
                search_companies_by_name as _dart_search,
                _expand_latin_segments,
            )
            dart_raw = _dart_search(company_name, limit=20)

            # DART 결과 없으면 법인명으로 재검색
            if not dart_raw and brand_legal_name:
                dart_raw = _dart_search(brand_legal_name, limit=20)
            # DART 결과 없고 config 매핑도 없으면 웹 검색으로 법인명 자동 발견
            elif not dart_raw and not brand_legal_name:
                discovered = discover_legal_name(company_name)
                if discovered:
                    brand_legal_name = discovered
                    dart_raw = _dart_search(discovered, limit=20)
            # DART 이름이 쿼리의 한글 전개형이면 원본 형태 사용
            # 예: 쿼리 "삼성SDS" → DART "삼성에스디에스" → 표시명 "삼성SDS"
            query_expanded = _expand_latin_segments(company_name.strip()).lower().replace(" ", "")
            legal_norm = brand_legal_name.lower().replace(" ", "") if brand_legal_name else ""
            dart_count = 0
            for r in dart_raw:
                if len(candidates) >= MAX_CANDIDATES:
                    break
                dart_original_name = r["name"]
                name = dart_original_name
                name_norm = name.lower().replace(" ", "")
                # DART 이름이 쿼리의 한글 전개형과 일치하면 원본 쿼리 사용
                # 예: 쿼리 "삼성SDS" → DART "삼성에스디에스" → 표시명 "삼성SDS"
                if name_norm == query_expanded and name_norm != query_norm:
                    name = company_name.strip()
                # 브랜드명으로 검색한 경우 법인명 대신 브랜드명 표시
                # 예: "토스" → DART "비바리퍼블리카" → 표시명 "토스"
                if brand_legal_name and name_norm == legal_norm:
                    name = company_name.strip()
                name_key = name.lower().replace(" ", "")
                key = (name_key, "dart")
                if name_key not in seen_names and key not in seen:
                    seen.add(key)
                    seen_names.add(name_key)
                    candidates.append({
                        "name": name,
                        "description": "",
                        "url": None,
                        "_source": "dart",
                        "_corp_code": r.get("corp_code", ""),
                        "_dart_name": dart_original_name,
                    })
                    dart_count += 1
                if dart_count >= MAX_CANDIDATES:
                    break
        except Exception:
            pass

    # ── DART 상장법인 캐시 로드 ──────────────────────────────────
    try:
        from app.services.jobs.dart_service import _LISTED_CORPS_CACHE as _dart_listed
    except ImportError:
        _dart_listed: set[str] = set()

    # ── SEO 순위 조회 (enrichment 이전에 실행 — Naver API 제한 회피) ──
    seo_ranks: dict[str, int] = {}
    if len(candidates) > 1:
        try:
            seo_ranks = get_seo_domain_ranking(company_name)
        except Exception:
            pass

    # DART 결과 중 URL/description 미비 항목 보완 (상장법인만 — 비상장은 필터 대상)
    # 1. DART hm_url (회사 공시 홈페이지)
    # 2. Naver 업체 검색 (hm_url 없을 때만 — API 절약)
    def _enrich_dart_candidate(c: dict) -> None:
        name = c["name"]
        dart_name = c.get("_dart_name", name)  # DART 원본 이름 (API 조회용)
        corp_code = c.get("_corp_code", "")

        # 1. DART hm_url (상장법인 공시 홈페이지)
        if not c.get("url") and corp_code:
            try:
                from app.services.jobs.dart_service import find_dart_homepage
                dart_url = find_dart_homepage(dart_name)
                if dart_url:
                    c["url"] = dart_url
            except Exception:
                pass

        # 3. Naver 업체 검색 (URL·description 둘 다 없을 때만)
        if not c.get("url") or not c.get("description"):
            # 브랜드명과 법인명 모두 시도 (예: "토스"와 "비바리퍼블리카")
            for search_name in dict.fromkeys([name, dart_name]):
                info = find_company_info(search_name)
                if info:
                    if not c.get("url") and info.get("url"):
                        c["url"] = info["url"]
                    if not c.get("description") and info.get("category"):
                        c["description"] = info["category"]
                if c.get("url") and c.get("description"):
                    break

    def _is_listed(c: dict) -> bool:
        """DART 상장법인 여부. 표시명·원본명 모두 확인."""
        return (c["name"] in _dart_listed
                or c.get("_dart_name", "") in _dart_listed)

    # 브랜드명 집합 (brand_to_legal 매핑 키 — 비상장이어도 enrichment 필요)
    try:
        from app.services.jobs.dart_service import _BRAND_TO_LEGAL_NAME as _brand_map
        _brand_names_lower: set[str] = {k.lower() for k in _brand_map.keys()}
    except Exception:
        _brand_names_lower = set()

    # 상장법인 + brand 매핑된 회사 enrichment (brand 매핑된 비상장은 URL 발견 가능성 높음)
    dart_to_enrich = [
        c for c in candidates
        if c.get("_source") == "dart" and (
            _is_listed(c) or c["name"].lower() in _brand_names_lower
        )
    ]
    if dart_to_enrich:
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed as _as_completed_dart
            with ThreadPoolExecutor(max_workers=min(len(dart_to_enrich), 5)) as ex:
                futs = {ex.submit(_enrich_dart_candidate, c): c for c in dart_to_enrich}
                for fut in _as_completed_dart(futs, timeout=8):
                    try:
                        fut.result()
                    except Exception:
                        pass
        except Exception:
            pass

    # URL을 찾지 못한 DART 비상장 소규모 법인 제거
    # 유지 조건: URL 있음 / DART 상장 법인 / brand 매핑된 회사(URL 조회됨)
    candidates = [
        c for c in candidates
        if c.get("_source") != "dart"
        or c.get("url")
        or _is_listed(c)
    ]

    # URL 없는 후보 제거 (노이즈 방지)
    candidates = [c for c in candidates if c.get("url")]

    # ── 폴백: 0개일 때 Naver 웹 검색으로 유사 회사명 제안 ────────
    if not candidates:
        try:
            fallback = search_company_names_fallback(company_name, limit=3)
            candidates.extend(fallback)
        except Exception:
            pass

    for c in candidates:
        c.pop("_source", None)
        c.pop("_corp_code", None)
        c.pop("_dart_name", None)

    # ── SEO 순위 기반 정렬 ────────────────────────────────────────
    def _root_domain(domain: str) -> str:
        """co.kr, or.kr 등 2단계 TLD를 고려한 루트 도메인 추출."""
        parts = domain.split(".")
        if len(parts) >= 3 and parts[-2] in ("co", "or", "go", "ac", "ne"):
            return ".".join(parts[-3:])
        return ".".join(parts[-2:]) if len(parts) >= 2 else domain

    def _candidate_sort_key(c: dict) -> tuple:
        url = c.get("url", "")
        if url and seo_ranks:
            parsed = urlparse(url)
            domain = parsed.netloc.lower().replace("www.", "")
            # 서브도메인 포함 최대한 매칭 (예: sec.samsung.com → samsung.com)
            seo_score = seo_ranks.get(domain, None)
            if seo_score is None:
                # 루트 도메인으로 재시도 (예: sem.samsung.co.kr → samsung.co.kr)
                root = _root_domain(domain)
                if root != domain:
                    seo_score = seo_ranks.get(root, None)
            seo_score = seo_score if seo_score is not None else 999
        elif url:
            seo_score = 500  # SEO 조회 실패 시 URL 있는 항목은 중간 점수
        else:
            seo_score = 999
        has_url = 0 if url else 1
        return (has_url, seo_score, len(c["name"]))

    candidates.sort(key=_candidate_sort_key)

    # SEO 매칭 후보가 있으면 미매칭 항목을 뒤로 정렬 (이미 sort_key에서 처리)
    # 추가로: SEO 매칭 후보가 충분하면 미매칭 제거하여 결과 정리
    if seo_ranks:
        def _seo_score_filter(c: dict) -> int:
            url = c.get("url", "")
            if not url:
                return 999
            parsed = urlparse(url)
            domain = parsed.netloc.lower().replace("www.", "")
            score = seo_ranks.get(domain, None)
            if score is None:
                root = _root_domain(domain)
                if root != domain:
                    score = seo_ranks.get(root, None)
            return score if score is not None else 999

        seo_matched = [c for c in candidates if _seo_score_filter(c) < 999]
        # SEO 매칭 후보만 유지 (관련 없는 동명 회사 제거)
        if seo_matched:
            candidates = seo_matched

    return candidates

"""
DART (금융감독원 전자공시) API 연동
- corpCode.xml ZIP으로 corp_code 조회 (캐시 적용)
- 기업 기본정보, 평균 연봉, 재무정보 통합 조회
"""
from __future__ import annotations

import html
import io
import logging
import os
import re
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from app.core.config_loader import (
    get_dart_brand_to_legal,
    get_dart_eng_prefix_map,
    get_dart_korean_to_latin,
)

logger = logging.getLogger(__name__)

_API_KEY = lambda: os.getenv("DART_API_KEY", "")
_BASE = "https://opendart.fss.or.kr/api"
_REPRT_CODE = "11011"  # 사업보고서


def _get_years(lookback: int = 4) -> list[str]:
    """현재 연도 기준으로 최근 N년 목록을 반환한다."""
    from datetime import date
    current = date.today().year
    return [str(current - i) for i in range(lookback)]

# corp_name → corp_code 인메모리 캐시 (프로세스 내)
_CORP_CODE_CACHE: dict[str, str] = {}
# 주권 상장 법인 집합 (stock_code 비어있지 않은 경우) — 중소 비상장 법인 필터링에 사용
_LISTED_CORPS_CACHE: set[str] = set()

_FINANCIAL_ACCOUNTS = {
    "매출액": "revenue",
    "영업이익": "operating_profit",
    "당기순이익": "net_income",
    "자산총계": "total_assets",
    "부채총계": "total_liabilities",
}


# ─── corp_code 조회 (ZIP 파일 파싱) ──────────────────────────────
def _load_corp_code_map(api_key: str) -> dict[str, str]:
    """DART corpCode.xml ZIP을 다운로드해 corp_name → corp_code 맵 반환.
    stock_code가 있는 주권 상장 법인은 _LISTED_CORPS_CACHE 에도 기록한다."""
    global _CORP_CODE_CACHE, _LISTED_CORPS_CACHE
    if _CORP_CODE_CACHE:
        return _CORP_CODE_CACHE

    try:
        res = requests.get(
            f"{_BASE}/corpCode.xml",
            params={"crtfc_key": api_key},
            timeout=15,
        )
        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            xml_content = z.read(z.namelist()[0]).decode("utf-8")

        # stock_code 포함 파싱 (상장 여부 판별)
        # XML 구조: corp_code → corp_name → corp_eng_name → stock_code
        # corp_eng_name 필드를 건너뛰고 stock_code를 추출한다.
        triples = re.findall(
            r"<corp_code>(\w+)</corp_code>\s*"
            r"<corp_name>([^<]+)</corp_name>\s*"
            r"<corp_eng_name>[^<]*</corp_eng_name>\s*"
            r"<stock_code>([^<]*)</stock_code>",
            xml_content,
        )
        if triples:
            _CORP_CODE_CACHE = {name.strip(): code for code, name, _ in triples}
            _LISTED_CORPS_CACHE = {
                name.strip() for code, name, stock in triples if stock.strip()
            }
        else:
            # stock_code 필드가 없는 구 버전 XML 폴백
            pairs = re.findall(
                r"<corp_code>(\w+)</corp_code>\s*<corp_name>([^<]+)</corp_name>",
                xml_content,
            )
            _CORP_CODE_CACHE = {name.strip(): code for code, name in pairs}
    except Exception as e:
        logger.error("[DART] Failed to load corp code map: %s", e)

    logger.info(
        "[DART] Loaded %d companies (%d listed) into corp_code cache",
        len(_CORP_CODE_CACHE),
        len(_LISTED_CORPS_CACHE),
    )
    return _CORP_CODE_CACHE


# config/dart_mappings.json 에서 로드 (코드 변경 없이 수정 가능)
_ENG_PREFIX_MAP: dict[str, str] = get_dart_eng_prefix_map()
_KOREAN_TO_DART_LATIN: dict[str, str] = get_dart_korean_to_latin()
_BRAND_TO_LEGAL_NAME: dict[str, str] = get_dart_brand_to_legal()


_LEGAL_PREFIXES = [
    "(주)", "㈜", "주식회사 ", "주식회사",
    "(유)", "(합)", "(유한)", "(합명)", "(합자)",
    "재단법인 ", "사단법인 ", "의료법인 ", "학교법인 ", "사회복지법인 ",
    "농업회사법인 ", "어업회사법인 ", "영농조합법인 ", "영어조합법인 ",
    "중소기업협동조합 ", "수산업협동조합 ",
]
_LEGAL_SUFFIXES = [
    " 주식회사", "주식회사", "(주)", "㈜",
    "(유)", "(합)", " 유한회사", " 합명회사", " 합자회사", " 유한책임회사",
    " 재단법인", " 사단법인", " 의료법인", " 학교법인", " 사회복지법인",
]

# DART 회사명에 포함될 수 있는 법인 형태 / DART 분류 접미사
_DART_CORP_TYPE_SUFFIX = re.compile(
    r"\s*(기타법인|유가증권|코스닥|코넥스|외감법인|해산법인|등록법인|비상장법인|"
    r"합명회사|합자회사|유한회사|유한책임회사|"
    r"농업회사법인|어업회사법인|산림조합|"
    r"투자회사|사모투자전문회사|기업인수목적회사|투자목적회사|"
    r"사회적협동조합|협동조합|중소기업협동조합|수산업협동조합|"
    r"영농조합법인|영어조합법인|"
    r"재단법인|사단법인|의료법인|학교법인|사회복지법인)$"
)

# "주시회사OOO" 같은 파싱 오류 교정
_MANGLED_PREFIX = re.compile(r"^(주[시식]회사|주식회 사)\s*")

_ENG_TO_KOR_LETTER = {
    "a": "에이",
    "b": "비",
    "c": "씨",
    "d": "디",
    "e": "이",
    "f": "에프",
    "g": "지",
    "h": "에이치",
    "i": "아이",
    "j": "제이",
    "k": "케이",
    "l": "엘",
    "m": "엠",
    "n": "엔",
    "o": "오",
    "p": "피",
    "q": "큐",
    "r": "알",
    "s": "에스",
    "t": "티",
    "u": "유",
    "v": "브이",
    "w": "더블유",
    "x": "엑스",
    "y": "와이",
    "z": "지",
}


def _strip_legal_form(name: str) -> str:
    """법인 형태 표기(접두·접미)를 제거한다."""
    # 파싱 오류 교정
    name = _MANGLED_PREFIX.sub("", name).strip()
    # 접두사 제거 (긴 것 우선 — 순서 중요)
    for prefix in _LEGAL_PREFIXES:
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
            break
    # 접미사 제거
    for suffix in _LEGAL_SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)].strip()
            break
    # 남은 앞뒤 괄호·공백 정리
    name = re.sub(r'^[\s\(\[\{]+|[\s\)\]\}]+$', '', name)
    return name


def _clean_dart_name(name: str) -> str:
    """DART 회사명에서 법인 형태 분류 접미사를 모두 제거한다."""
    name = html.unescape(name)
    name = _DART_CORP_TYPE_SUFFIX.sub("", name).strip()
    name = _strip_legal_form(name)
    return name


def _normalize_lookup_key(name: str) -> str:
    """회사명 비교를 위한 정규화 키를 생성한다."""
    cleaned = _clean_dart_name(name).lower()
    return re.sub(r"[^0-9a-z가-힣]+", "", cleaned)


def _expand_latin_segments(name: str) -> str:
    """문자열 내부의 영문 연속 구간을 한글 발음으로 확장한다. (예: SamsungSDS -> samsung에스디에스)"""
    name = name.replace("&", " 앤 ")

    def repl(match: re.Match[str]) -> str:
        token = match.group(0).lower()
        return "".join(_ENG_TO_KOR_LETTER.get(ch, ch) for ch in token)
    return re.sub(r"[A-Za-z]+", repl, name)


def _to_dart_name(company_name: str) -> str:
    """법인 형태 제거 후 영문 약어를 DART 한글 표기로 변환한다. (예: SK하이닉스 → 에스케이하이닉스)"""
    name = _strip_legal_form(company_name)
    for eng, kor in _ENG_PREFIX_MAP.items():
        if name.startswith(eng):
            return kor + name[len(eng):]
    return name


def _get_search_queries(company_name: str) -> list[str]:
    """검색에 사용할 쿼리 목록 반환 (한글, DART 한글 표기, DART 라틴 표기, 브랜드→법인명)."""
    dart_name = _to_dart_name(company_name)
    latin = _KOREAN_TO_DART_LATIN.get(company_name.strip(), "")
    expanded = _expand_latin_segments(company_name.strip())
    expanded_dart = _expand_latin_segments(dart_name)
    queries = [
        company_name.strip().lower(),
        dart_name.lower(),
        expanded.lower(),
        expanded_dart.lower(),
        _normalize_lookup_key(company_name),
        _normalize_lookup_key(dart_name),
        _normalize_lookup_key(expanded),
        _normalize_lookup_key(expanded_dart),
    ]
    if latin:
        queries.append(latin.lower())
        queries.append(_normalize_lookup_key(latin))
    # 브랜드명 → 법인명 매핑 (예: "토스" → "비바리퍼블리카")
    legal = _BRAND_TO_LEGAL_NAME.get(company_name.strip())
    if not legal:
        legal = _BRAND_TO_LEGAL_NAME.get(_normalize_lookup_key(company_name))
    if legal:
        queries.append(legal.lower())
        queries.append(_normalize_lookup_key(legal))
    return list(dict.fromkeys(q for q in queries if q))  # 중복 제거


def _find_corp_code(company_name: str, api_key: str, strict: bool = False) -> str | None:
    """회사명으로 corp_code 조회. 정확히 일치하는 것 우선, 없으면 포함 검색.
    strict=True 이면 정확 일치만 시도하고 부분 일치는 하지 않는다."""
    corp_map = _load_corp_code_map(api_key)
    if not corp_map:
        return None

    # 브랜드명 → 법인명 별칭 변환 (예: "토스" → "비바리퍼블리카")
    # 별칭 재귀 호출은 strict=True로 제한 — 부분 일치로 엉뚱한 회사가 잡히는 것을 방지
    legal_name = _BRAND_TO_LEGAL_NAME.get(company_name.strip())
    if not legal_name:
        legal_name = _BRAND_TO_LEGAL_NAME.get(_normalize_lookup_key(company_name))
    if legal_name:
        # 정규화 키가 동일하면 자기 자신 재귀를 유발하므로 alias 재귀를 건너뛴다.
        if _normalize_lookup_key(legal_name) != _normalize_lookup_key(company_name):
            result = _find_corp_code(legal_name, api_key, strict=True)
            if result:
                logger.info("[DART] Brand alias '%s' → '%s' (corp_code: %s)", company_name, legal_name, result)
                return result
            logger.warning("[DART] Brand alias '%s' → '%s' but no exact match in DART. Skipping.", company_name, legal_name)
            return None

    dart_name = _to_dart_name(company_name)
    query_clean = company_name.strip()
    queries = _get_search_queries(company_name)

    # 1) 원본 키로 정확 일치
    for name in [dart_name, query_clean]:
        if name in corp_map:
            return corp_map[name]

    # 2) 정제된 이름으로 정확 일치 ("네이버주식회사" → "네이버", "NAVER주식회사" → "naver")
    for name, code in corp_map.items():
        cleaned = _clean_dart_name(name).lower()
        cleaned_norm = _normalize_lookup_key(name)
        if any(cleaned == q for q in queries):
            return code
        if cleaned_norm and any(cleaned_norm == q for q in queries):
            return code

    if strict:
        return None

    # 3) 부분 일치: 정제된 이름 길이가 짧은 것 우선
    candidates = {
        code
        for name, code in corp_map.items()
        if any(q in name.lower() for q in queries)
    }
    best = min(
        ((name, code) for name, code in corp_map.items() if code in candidates),
        key=lambda x: len(_clean_dart_name(x[0])),
        default=None,
    )
    return best[1] if best else None


# ─── 기업 기본정보 ────────────────────────────────────────────────
def _get_corp_info(corp_code: str, api_key: str) -> dict:
    try:
        res = requests.get(
            f"{_BASE}/company.json",
            params={"crtfc_key": api_key, "corp_code": corp_code},
            timeout=5,
        )
        data = res.json()
        if data.get("status") != "000":
            return {}
        return {
            "ceo": data.get("ceo_nm", ""),
            "established": _format_date(data.get("est_dt", "")),
            "address": data.get("adres", ""),
            "homepage": data.get("hm_url", ""),
            "stock_code": data.get("stock_code", ""),
            "industry": data.get("induty", ""),
        }
    except Exception:
        return {}


# ─── 직원 현황 (평균 연봉) ────────────────────────────────────────
def _get_salary(corp_code: str, api_key: str) -> dict:
    """최근 사업보고서에서 평균 연봉, 직원 수, 평균 근속연수를 추출한다."""
    for year in _get_years():
        try:
            res = requests.get(
                f"{_BASE}/empSttus.json",
                params={
                    "crtfc_key": api_key,
                    "corp_code": corp_code,
                    "bsns_year": year,
                    "reprt_code": _REPRT_CODE,
                },
                timeout=5,
            )
            data = res.json()
            if data.get("status") != "000" or not data.get("list"):
                continue

            rows = data["list"]

            # 합계 행 우선 (fo_bbm이 "성별합계" 또는 "합계" 또는 "계")
            summary_rows = [
                r for r in rows
                if r.get("fo_bbm") in ("성별합계", "합계", "계")
            ]

            if not summary_rows:
                # 합계 행 없으면 남/여 분리 행만 있는 경우 — 이중 집계 방지를 위해
                # 성별 구분 행("남", "여", "M", "F")은 그대로 사용 (가중평균이므로 합산 무관)
                # 단, 이미 합산된 "전체" 행이 있으면 우선 사용
                total_rows = [r for r in rows if r.get("fo_bbm") in ("전체", "합계인원")]
                summary_rows = total_rows if total_rows else rows

            # 전체 직원 수 (sm 필드 합산)
            total_emp = sum(
                _parse_int(r.get("sm", "")) or 0 for r in summary_rows
            ) or None

            # 1인 평균 연봉: jan_salary_am 가중평균 (연간 급여액, 원 단위 → 만원)
            # DART jan_salary_am 필드는 1인 평균 급여액(연간, 원) — 이미 연봉이므로 ×12 불필요
            total_pay = 0
            total_weight = 0
            for r in summary_rows:
                salary = _parse_int(r.get("jan_salary_am"))
                emp = _parse_int(r.get("sm"))
                if salary and emp:
                    total_pay += salary * emp
                    total_weight += emp

            avg_salary_won = (total_pay // total_weight) if total_weight else None
            avg_salary_million = (avg_salary_won // 10_000) if avg_salary_won else None

            # 평균 근속연수 (avrg_cnwk_sdytrn 또는 avrg_cnwk_sdytrm)
            tenure_val = None
            for r in summary_rows:
                t = _parse_float(r.get("avrg_cnwk_sdytrn") or r.get("avrg_cnwk_sdytrm"))
                if t:
                    tenure_val = t
                    break

            if avg_salary_million or total_emp:
                return {
                    "year": year,
                    "total_employees": total_emp,
                    "avg_salary_million": avg_salary_million,
                    "avg_tenure_years": tenure_val,
                }
        except Exception:
            continue
    return {}


# ─── 재무정보 ─────────────────────────────────────────────────────
def _get_financials(corp_code: str, api_key: str) -> dict:
    """최근 연도 재무제표에서 핵심 계정만 골라 반환한다."""
    for year in _get_years():
        for fs_div in ["CFS", "OFS"]:
            try:
                res = requests.get(
                    f"{_BASE}/fnlttSinglAcntAll.json",
                    params={
                        "crtfc_key": api_key,
                        "corp_code": corp_code,
                        "bsns_year": year,
                        "reprt_code": _REPRT_CODE,
                        "fs_div": fs_div,
                    },
                    timeout=7,
                )
                data = res.json()
                if data.get("status") != "000" or not data.get("list"):
                    continue

                result: dict = {"year": year, "fs_type": "연결" if fs_div == "CFS" else "별도"}
                for item in data["list"]:
                    account = item.get("account_nm", "")
                    # 정확히 일치하거나, "(손실)" 등 괄호 접미어 포함 형태도 매칭
                    matched_key = _FINANCIAL_ACCOUNTS.get(account)
                    if not matched_key:
                        for k, v in _FINANCIAL_ACCOUNTS.items():
                            if account.startswith(k):
                                matched_key = v
                                break
                    if matched_key and matched_key not in result:
                        result[matched_key] = _parse_int(item.get("thstrm_amount"))

                if result.get("revenue") or result.get("operating_profit"):
                    return result
            except Exception:
                continue
    return {}


# ─── 통합 진입점 ──────────────────────────────────────────────────
def get_dart_company_info(company_name: str) -> dict:
    """회사명 기반으로 corp_code를 찾은 뒤 기업정보·직원현황·재무정보를 병렬 수집한다."""
    api_key = _API_KEY()
    if not api_key or api_key.startswith("your_"):
        logger.warning("[DART] API key not set or placeholder — skipping")
        return {}

    logger.info("[DART] Looking up corp_code for: %s", company_name)
    corp_code = _find_corp_code(company_name, api_key)
    if not corp_code:
        logger.warning("[DART] corp_code not found for: %s", company_name)
        return {}

    logger.info("[DART] Found corp_code=%s for %s", corp_code, company_name)

    corp_info: dict = {}
    salary: dict = {}
    financials: dict = {}

    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {
            ex.submit(_get_corp_info, corp_code, api_key): "info",
            ex.submit(_get_salary, corp_code, api_key): "salary",
            ex.submit(_get_financials, corp_code, api_key): "financials",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                result = future.result()
                if key == "info":
                    corp_info = result
                elif key == "salary":
                    salary = result
                else:
                    financials = result
            except Exception:
                pass

    return {
        "corp_code": corp_code,
        **corp_info,
        "salary": salary,
        "financials": financials,
        "source": "DART 전자공시",
    }


def _format_date(raw: str) -> str:
    """YYYYMMDD 문자열을 YYYY-MM-DD 형식으로 변환한다."""
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
    return raw


def _parse_int(value) -> int | None:
    """콤마가 포함된 숫자 문자열을 int로 변환하고, 빈 값은 None으로 처리한다."""
    if not value or str(value).strip() in ("-", ""):
        return None
    try:
        return int(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def format_salary(million: int) -> str:
    """만원 단위 연봉을 '약 X억 Y만원' 형태로 변환한다."""
    eok = million // 10000
    remainder = million % 10000
    if eok and remainder:
        return f"약 {eok}억 {remainder:,}만원"
    if eok:
        return f"약 {eok}억원"
    return f"{million:,}만원"


def _parse_float(value) -> float | None:
    """문자열/숫자 입력을 float으로 변환하고, 빈 값은 None으로 처리한다."""
    if not value or str(value).strip() in ("-", ""):
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def search_companies_by_name(query: str, limit: int = 8) -> list[dict]:
    """
    회사명 키워드로 DART 등록 법인을 검색해 반환한다.
    반환: [{"name": str, "corp_code": str}, ...]
    """
    api_key = _API_KEY()
    if not api_key or api_key.startswith("your_"):
        return []

    corp_map = _load_corp_code_map(api_key)
    if not corp_map:
        return []

    queries = _get_search_queries(query)  # [한글, dart한글, 라틴] 중복 제거 목록
    query_clean = query.strip().lower()
    dart_query = _to_dart_name(query).lower()

    # 정제된 이름 기준으로 매칭·정렬
    # _KOREAN_TO_DART_LATIN 매핑으로 "네이버" → "naver"도 검색해 "NAVER주식회사" 포함
    candidates: list[dict] = []
    for name, code in corp_map.items():
        name_lower = name.lower()
        if not any(q in name_lower for q in queries):
            continue
        clean_name = _clean_dart_name(name)
        if not clean_name or len(clean_name) < 2:
            continue
        candidates.append({"name": clean_name, "corp_code": code})

    # 정확 일치 → 시작 일치 → 포함 일치
    # 같은 그룹 내: 상장 법인 우선(listed_bonus=0), 비상장은 뒤(listed_bonus=1)
    # 상장 법인 내에서는 이름 짧은 순, 비상장은 이름 짧은 순
    def sort_key(item: dict) -> tuple:
        n = item["name"].lower()
        listed_bonus = 0 if item["name"] in _LISTED_CORPS_CACHE else 1
        if n == query_clean or n == dart_query or n in queries:
            return (0, listed_bonus, len(item["name"]))
        if any(n.startswith(q) for q in queries):
            return (1, listed_bonus, len(item["name"]))
        return (2, listed_bonus, len(item["name"]))

    candidates.sort(key=sort_key)

    # 중복 제거
    seen: set[str] = set()
    cleaned: list[dict] = []
    for item in candidates:
        if item["name"] not in seen:
            seen.add(item["name"])
            cleaned.append({"name": item["name"], "corp_code": item["corp_code"]})
        if len(cleaned) >= limit:
            break
    return cleaned


def find_dart_corp_code(company_name: str) -> str | None:
    """회사명으로 DART corp_code만 조회해 반환한다. 캐시 활용."""
    api_key = _API_KEY()
    if not api_key or api_key.startswith("your_"):
        return None
    return _find_corp_code(company_name, api_key)


def _normalize_homepage(url: str) -> str | None:
    """DART hm_url을 정규화한다. scheme 없으면 https 추가, 빈 값은 None 반환."""
    if not url or not url.strip():
        return None
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    # 최소한 도메인이 있어야 유효 (점 포함 여부 확인)
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if not parsed.netloc or "." not in parsed.netloc:
        return None
    return url


def find_dart_homepage(company_name: str) -> str | None:
    """
    DART company.json의 hm_url로 공식 홈페이지 URL을 조회한다.
    없거나 빈 값이면 None 반환.
    """
    api_key = _API_KEY()
    if not api_key or api_key.startswith("your_"):
        return None

    corp_code = _find_corp_code(company_name, api_key)
    if not corp_code:
        return None

    info = _get_corp_info(corp_code, api_key)
    return _normalize_homepage(info.get("homepage", ""))


def get_dart_company_info_by_code(corp_code: str) -> dict:
    """이미 확보한 corp_code로 DART 기업정보·직원현황·재무정보를 병렬 조회한다."""
    api_key = _API_KEY()
    if not api_key or api_key.startswith("your_"):
        logger.warning("[DART] API key not set or placeholder — skipping")
        return {}

    logger.info("[DART] Fetching company info by corp_code=%s", corp_code)

    corp_info: dict = {}
    salary: dict = {}
    financials: dict = {}

    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {
            ex.submit(_get_corp_info, corp_code, api_key): "info",
            ex.submit(_get_salary, corp_code, api_key): "salary",
            ex.submit(_get_financials, corp_code, api_key): "financials",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                result = future.result()
                if key == "info":
                    corp_info = result
                elif key == "salary":
                    salary = result
                else:
                    financials = result
            except Exception:
                pass

    return {
        "corp_code": corp_code,
        **corp_info,
        "salary": salary,
        "financials": financials,
        "source": "DART 전자공시",
    }

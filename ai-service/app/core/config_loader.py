"""
중앙 설정 로더. ai-service/config/*.json 파일에서 데이터를 읽어 반환한다.
코드 변경 없이 JSON 파일만 수정해 데이터를 업데이트할 수 있다.
캐시: 파일 mtime 기반으로 변경 시 자동 재로드.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_CONFIG_DIR = Path(__file__).parent.parent.parent / "config"

# filename → (mtime, parsed_dict)
_cache: dict[str, tuple[float, dict]] = {}


def _load(filename: str) -> dict:
    path = _CONFIG_DIR / filename
    if not path.exists():
        logger.warning("[config_loader] 설정 파일 없음: %s", path)
        return {}
    mtime = os.path.getmtime(path)
    cached = _cache.get(filename)
    if cached and cached[0] == mtime:
        return cached[1]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _cache[filename] = (mtime, data)
    logger.info("[config_loader] 설정 파일 로드: %s", filename)
    return data


def get_excluded_domains() -> set[str]:
    return set(_load("excluded_domains.json").get("domains", []))


def get_dart_eng_prefix_map() -> dict[str, str]:
    return _load("dart_mappings.json").get("eng_prefix_map", {})


def get_dart_korean_to_latin() -> dict[str, str]:
    return _load("dart_mappings.json").get("korean_to_dart_latin", {})


def get_dart_brand_to_legal() -> dict[str, str]:
    return _load("dart_mappings.json").get("brand_to_legal", {})


def get_intent_patterns() -> dict[str, str]:
    return _load("intent_keywords.json").get("patterns", {})

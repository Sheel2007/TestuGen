from __future__ import annotations
from typing import Any

import httpx

from .. import config
from .cache import cache

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _client


async def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    client = _get_client()
    resp = await client.get(f"{config.PLANETTERP_BASE}{path}", params=params)
    resp.raise_for_status()
    return resp.json()


async def get_professor(name: str) -> dict | None:
    cache_key = f"prof:{name}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _get("/professor", params={"name": name})
    except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException):
        return None

    cache.set(cache_key, data, config.CACHE_TTL_PROFESSORS)
    return data


async def get_professor_rating(name: str) -> float:
    prof = await get_professor(name)
    if prof and prof.get("average_rating"):
        return float(prof["average_rating"])
    return config.DEFAULT_PROFESSOR_RATING


async def get_course_avg_gpa(course_id: str) -> float:
    cache_key = f"gpa:{course_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _get("/course", params={"name": course_id})
        gpa = float(data.get("average_gpa") or config.DEFAULT_GPA)
    except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException, ValueError):
        gpa = config.DEFAULT_GPA

    cache.set(cache_key, gpa, config.CACHE_TTL_COURSES)
    return gpa

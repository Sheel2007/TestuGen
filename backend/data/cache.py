from __future__ import annotations
import time
from typing import Any


class TTLCache:
    def __init__(self, default_ttl: int = 3600):
        self._store: dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        t = ttl if ttl is not None else self._default_ttl
        self._store[key] = (value, time.time() + t)


cache = TTLCache()

from __future__ import annotations
import math

from .. import config

KNOWN_BUILDING_COORDS: dict[str, tuple[float, float]] = {
    "IRB": (38.9891607, -76.9364439),
    "ESJ": (38.9838, -76.9447),
    "AVW": (38.9909, -76.9365),
    "CSI": (38.9889, -76.9395),
    "MTH": (38.9845, -76.9374),
    "PHY": (38.9879, -76.9404),
    "CHM": (38.9870, -76.9401),
    "BIO": (38.9883, -76.9419),
    "TYD": (38.9857, -76.9445),
    "SQH": (38.9863, -76.9456),
    "HBK": (38.9846, -76.9397),
    "KEY": (38.9840, -76.9429),
    "MMH": (38.9839, -76.9385),
    "JMZ": (38.9916, -76.9446),
    "EGR": (38.9895, -76.9393),
    "ARM": (38.9861, -76.9417),
    "SKN": (38.9856, -76.9377),
    "SYM": (38.9841, -76.9356),
    "TAL": (38.9871, -76.9430),
    "PLS": (38.9909, -76.9425),
}

_building_cache: dict[str, tuple[float, float]] = {}


def set_building_coords(code: str, lat: float, lng: float) -> None:
    _building_cache[code] = (lat, lng)


def get_building_coords(code: str) -> tuple[float, float] | None:
    if code in _building_cache:
        return _building_cache[code]
    if code in KNOWN_BUILDING_COORDS:
        return KNOWN_BUILDING_COORDS[code]
    return None


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def walking_time_minutes(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dist = haversine(lat1, lng1, lat2, lng2) * config.PATH_MULTIPLIER
    return (dist / config.WALKING_SPEED_MPS) / 60.0

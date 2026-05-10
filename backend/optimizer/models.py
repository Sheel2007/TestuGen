from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Meeting:
    days: str
    start_time: int  # minutes from midnight
    end_time: int
    building: str
    room: str
    lat: float | None = None
    lng: float | None = None


@dataclass
class Section:
    section_id: str
    course_id: str
    instructors: list[str]
    meetings: list[Meeting]
    professor_rating: float = 3.0
    avg_gpa: float = 3.0
    total_seats: int = 0
    open_seats: int = 0


@dataclass
class VariableMapping:
    index: int
    course_id: str
    section_id: str


@dataclass
class ScheduleResult:
    sections: list[Section]
    total_score: float
    professor_score: float
    walking_score: float
    time_score: float
    solver: str
    bitstring: str = ""


@dataclass
class TimePreference:
    blocked_times: list[dict] = field(default_factory=list)
    lunch_window: tuple[str, str] | None = ("11:30", "13:00")
    no_early_morning: bool = True  # penalize before 9am
    no_evening: bool = False  # penalize after 5pm


@dataclass
class PriorityWeights:
    professor_rating: float = 0.4
    walking_distance: float = 0.3
    time_preference: float = 0.3

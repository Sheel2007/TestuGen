from typing import List, Optional
from pydantic import BaseModel


class BlockedSlot(BaseModel):
    day: str
    start: str
    end: str


class TimePreferenceInput(BaseModel):
    blocked_times: list[BlockedSlot] = []
    lunch_window: Optional[List[str]] = ["11:30", "13:00"]
    no_early_morning: bool = True
    no_evening: bool = False


class PriorityWeightsInput(BaseModel):
    professor_rating: float = 0.4
    walking_distance: float = 0.3
    time_preference: float = 0.3


class OptimizationRequest(BaseModel):
    course_ids: list[str]
    semester: str = "202508"
    preferences: TimePreferenceInput = TimePreferenceInput()
    weights: PriorityWeightsInput = PriorityWeightsInput()
    num_results: int = 5
    solver: str = "qaoa"


class MeetingOut(BaseModel):
    days: str
    start_time: int
    end_time: int
    building: str
    room: str


class SectionOut(BaseModel):
    section_id: str
    course_id: str
    instructors: list[str]
    meetings: list[MeetingOut]
    professor_rating: float
    avg_gpa: float
    total_seats: int
    open_seats: int


class ScheduleOut(BaseModel):
    sections: list[SectionOut]
    total_score: float
    professor_score: float
    walking_score: float
    time_score: float
    solver: str


class OptimizationResponse(BaseModel):
    schedules: list[ScheduleOut]
    num_variables: int
    solver_used: str

from __future__ import annotations
import itertools
from collections import defaultdict

import numpy as np

from .. import config
from .models import Section, Meeting, VariableMapping, TimePreference, PriorityWeights
from ..data.buildings import walking_time_minutes


def _parse_time(t: str) -> int:
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _days_overlap(days_a: str, days_b: str) -> bool:
    set_a = set(days_a.replace("Tu", "2").replace("Th", "4"))
    set_b = set(days_b.replace("Tu", "2").replace("Th", "4"))
    return bool(set_a & set_b)


def _meetings_conflict(ma: Meeting, mb: Meeting) -> bool:
    if not _days_overlap(ma.days, mb.days):
        return False
    return ma.start_time < mb.end_time and mb.start_time < ma.end_time


def sections_conflict(sec_a: Section, sec_b: Section) -> bool:
    for ma in sec_a.meetings:
        for mb in sec_b.meetings:
            if _meetings_conflict(ma, mb):
                return True
    return False


def _meeting_in_blocked(meeting: Meeting, blocked: dict) -> bool:
    blocked_day = blocked.get("day", "")
    if not _days_overlap(meeting.days, blocked_day):
        return False
    bs = _parse_time(blocked["start"])
    be = _parse_time(blocked["end"])
    return meeting.start_time < be and bs < meeting.end_time


def _compute_pairwise_walk(sec_a: Section, sec_b: Section) -> float:
    max_walk = 0.0
    for ma in sec_a.meetings:
        for mb in sec_b.meetings:
            if not _days_overlap(ma.days, mb.days):
                continue
            if ma.lat is None or mb.lat is None:
                continue
            gap_ok = (ma.end_time <= mb.start_time and mb.start_time - ma.end_time < 30) or \
                     (mb.end_time <= ma.start_time and ma.start_time - mb.end_time < 30)
            if not gap_ok:
                continue
            walk = walking_time_minutes(ma.lat, ma.lng, mb.lat, mb.lng)
            max_walk = max(max_walk, walk)
    return max_walk


def build_qubo_matrix(
    sections: list[Section],
    preferences: TimePreference,
    weights: PriorityWeights,
) -> tuple[np.ndarray, list[VariableMapping]]:
    N = len(sections)
    Q = np.zeros((N, N))
    variable_map = [VariableMapping(i, s.course_id, s.section_id) for i, s in enumerate(sections)]

    course_groups: dict[str, list[int]] = defaultdict(list)
    for i, s in enumerate(sections):
        course_groups[s.course_id].append(i)

    # 1. Assignment: exactly one section per course
    for indices in course_groups.values():
        for i in indices:
            Q[i, i] += -1 * config.LAMBDA_ASSIGN
        for a, b in itertools.combinations(indices, 2):
            lo, hi = min(a, b), max(a, b)
            Q[lo, hi] += 2 * config.LAMBDA_ASSIGN

    # 2. Overlap: penalize conflicting sections from different courses
    for i in range(N):
        for j in range(i + 1, N):
            if sections[i].course_id != sections[j].course_id:
                if sections_conflict(sections[i], sections[j]):
                    Q[i, j] += config.LAMBDA_OVERLAP

    # 3. Professor rating (maximize → negate for minimization)
    for i, s in enumerate(sections):
        normalized = s.professor_rating / 5.0
        Q[i, i] += -normalized * weights.professor_rating * 10

    # 4. Walking distance between sections of different courses
    for i in range(N):
        for j in range(i + 1, N):
            if sections[i].course_id != sections[j].course_id:
                walk = _compute_pairwise_walk(sections[i], sections[j])
                if walk > 0:
                    normalized = min(walk / 15.0, 1.0)
                    Q[i, j] += normalized * weights.walking_distance * 10

    # 5. Time preferences (diagonal penalties)
    for i, s in enumerate(sections):
        penalty = 0.0
        for meeting in s.meetings:
            for blocked in preferences.blocked_times:
                if _meeting_in_blocked(meeting, blocked):
                    penalty += 50.0

            if preferences.no_early_morning and meeting.start_time < 540:
                penalty += 2.0

            if preferences.no_evening and meeting.end_time > 1020:
                penalty += 2.0

            if preferences.lunch_window:
                ls = _parse_time(preferences.lunch_window[0])
                le = _parse_time(preferences.lunch_window[1])
                if meeting.start_time < le and ls < meeting.end_time:
                    penalty += 3.0

        Q[i, i] += penalty * weights.time_preference

    return Q, variable_map

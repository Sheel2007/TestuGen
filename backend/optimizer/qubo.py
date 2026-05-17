from __future__ import annotations
import itertools
from collections import defaultdict

import numpy as np

from .. import config
from .models import Section, Meeting, VariableMapping, TimePreference, PriorityWeights
# walking_time_minutes no longer needed — replaced with gap-based scoring


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


def _compute_pairwise_gaps(sec_a: Section, sec_b: Section) -> list[int]:
    """Return list of gap durations (minutes) between consecutive same-day meetings."""
    gaps = []
    for ma in sec_a.meetings:
        for mb in sec_b.meetings:
            if ma is mb:
                continue  # skip same meeting (when computing intra-section gaps)
            if not _days_overlap(ma.days, mb.days):
                continue
            if ma.end_time <= mb.start_time:
                gaps.append(mb.start_time - ma.end_time)
            elif mb.end_time <= ma.start_time:
                gaps.append(ma.start_time - mb.end_time)
    return gaps


def _compute_intra_section_gaps(section: Section) -> list[int]:
    """Return gaps between meetings within a single section (e.g., lecture + discussion)."""
    gaps = []
    meetings = section.meetings
    for i in range(len(meetings)):
        for j in range(i + 1, len(meetings)):
            ma, mb = meetings[i], meetings[j]
            if not _days_overlap(ma.days, mb.days):
                continue
            if ma.end_time <= mb.start_time:
                gaps.append(mb.start_time - ma.end_time)
            elif mb.end_time <= ma.start_time:
                gaps.append(ma.start_time - mb.end_time)
    return gaps


def _parse_days(days: str) -> list[str]:
    """Parse day string like 'MWF' or 'TuTh' into list of day codes."""
    result = []
    i = 0
    while i < len(days):
        if i + 1 < len(days) and days[i] == 'T' and days[i + 1] == 'u':
            result.append('Tu')
            i += 2
        elif i + 1 < len(days) and days[i] == 'T' and days[i + 1] == 'h':
            result.append('Th')
            i += 2
        else:
            result.append(days[i])
            i += 1
    return result


def _compute_consecutive_gaps(sections: list[Section]) -> list[int]:
    """Compute gaps only between actually consecutive meetings on each day."""
    # Collect all meetings grouped by day
    day_meetings: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for s in sections:
        for m in s.meetings:
            for day in _parse_days(m.days):
                day_meetings[day].append((m.start_time, m.end_time))

    gaps = []
    for day, meetings in day_meetings.items():
        # Sort by start time
        meetings.sort()
        for i in range(len(meetings) - 1):
            end_current = meetings[i][1]
            start_next = meetings[i + 1][0]
            if start_next > end_current:
                gaps.append(start_next - end_current)
    return gaps


def score_schedule(
    sections: list[Section],
    preferences: TimePreference,
    weights: PriorityWeights,
    professor_prefs: dict[str, str] | None = None,
) -> dict:
    """Compute normalized scores for a schedule. Higher = better.
    Returns dict with professor_score, gap_score, time_score, total_score.
    All scores on 0-100 scale.
    """
    if not sections:
        return {"professor_score": 0, "gap_score": 0, "time_score": 0, "total_score": 0,
                "avg_professor_rating": 0.0, "pref_match_count": 0, "pref_total_count": 0}

    # Raw average professor rating (0-5 scale, for display)
    avg_rating = sum(s.professor_rating for s in sections) / len(sections)

    # Professor score for ranking: rating component (0-60) + preference match component (0-40)
    # Pref match weighs more than raw ratings
    rating_component = (avg_rating / 5.0) * 60  # 0-60 points from ratings

    pref_match_count = 0
    pref_total_count = 0
    if professor_prefs:
        for s in sections:
            pref = professor_prefs.get(s.course_id)
            if pref:
                pref_total_count += 1
                if pref in s.instructors:
                    pref_match_count += 1

    if pref_total_count > 0:
        pref_component = (pref_match_count / pref_total_count) * 40  # 0-40 points from pref match
    else:
        pref_component = 40  # no prefs = full marks (don't penalize)

    prof_score = rating_component + pref_component

    # Gap score: how well gaps between CONSECUTIVE classes fit min/max preference
    # Group all meetings by day, sort by start time, measure only adjacent gaps
    all_gaps = _compute_consecutive_gaps(sections)

    if all_gaps and (preferences.min_gap is not None or preferences.max_gap is not None):
        violations = 0
        for gap in all_gaps:
            if preferences.min_gap is not None and gap < preferences.min_gap:
                violations += 1
            if preferences.max_gap is not None and gap > preferences.max_gap:
                violations += 1
        gap_score = max(0, 100 - (violations / len(all_gaps)) * 100)
    else:
        gap_score = 100.0  # no preference = perfect score

    # Time score: 100 = no conflicts with preferences, penalty per violation
    time_penalties = 0
    total_meetings = 0
    for s in sections:
        for meeting in s.meetings:
            total_meetings += 1
            for blocked in preferences.blocked_times:
                if _meeting_in_blocked(meeting, blocked):
                    time_penalties += 1

            if preferences.no_early_morning and meeting.start_time < 540:
                time_penalties += 1

            if preferences.no_evening and meeting.end_time > 1020:
                time_penalties += 1

            if preferences.lunch_window:
                ls = _parse_time(preferences.lunch_window[0])
                le = _parse_time(preferences.lunch_window[1])
                if meeting.start_time < le and ls < meeting.end_time:
                    time_penalties += 1

    time_score = max(0, 100 - (time_penalties / max(total_meetings, 1)) * 100)

    # Weighted total
    total = (
        prof_score * weights.professor_rating +
        gap_score * weights.gap_preference +
        time_score * weights.time_preference
    )
    weight_sum = weights.professor_rating + weights.gap_preference + weights.time_preference
    if weight_sum > 0:
        total /= weight_sum

    return {
        "professor_score": round(prof_score, 2),
        "gap_score": round(gap_score, 2),
        "time_score": round(time_score, 2),
        "total_score": round(total, 2),
        "avg_professor_rating": round(avg_rating, 2),
        "pref_match_count": pref_match_count,
        "pref_total_count": pref_total_count,
    }


def build_qubo_matrix(
    sections: list[Section],
    preferences: TimePreference,
    weights: PriorityWeights,
    professor_prefs: dict[str, str] | None = None,
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

    # 3b. Professor preference bonus — strongly prefer sections with requested professor
    if professor_prefs:
        LAMBDA_PROF_PREF = 30.0  # strong bonus, more important than raw rating
        for i, s in enumerate(sections):
            pref = professor_prefs.get(s.course_id)
            if pref:
                if pref in s.instructors:
                    Q[i, i] += -LAMBDA_PROF_PREF  # negative = reward (minimize)
                else:
                    Q[i, i] += LAMBDA_PROF_PREF * 0.3  # mild penalty for non-preferred

    # 4. Gap between classes penalty (moderate — influences but never overrides assignment)
    LAMBDA_GAP = 15.0  # must stay well below LAMBDA_ASSIGN to avoid dropping courses

    # 4a. Intra-section gaps (lecture + discussion within same section) — diagonal penalty
    for i, s in enumerate(sections):
        intra_gaps = _compute_intra_section_gaps(s)
        for gap in intra_gaps:
            violation = False
            if preferences.min_gap is not None and gap < preferences.min_gap:
                violation = True
            if preferences.max_gap is not None and gap > preferences.max_gap:
                violation = True
            if violation:
                Q[i, i] += LAMBDA_GAP

    # 4b. Inter-section gaps (between different courses) — off-diagonal penalty
    for i in range(N):
        for j in range(i + 1, N):
            if sections[i].course_id != sections[j].course_id:
                gaps = _compute_pairwise_gaps(sections[i], sections[j])
                for gap in gaps:
                    violation = False
                    if preferences.min_gap is not None and gap < preferences.min_gap:
                        violation = True
                    if preferences.max_gap is not None and gap > preferences.max_gap:
                        violation = True
                    if violation:
                        Q[i, j] += LAMBDA_GAP

    # 5. Time preferences (diagonal penalties)
    # These are SOFT constraints — penalties must stay well below LAMBDA_ASSIGN
    # so the solver never prefers dropping a course over violating a time preference.
    # Max total time penalty per section should be << 100 (LAMBDA_ASSIGN).
    for i, s in enumerate(sections):
        penalty = 0.0
        for meeting in s.meetings:
            for blocked in preferences.blocked_times:
                if _meeting_in_blocked(meeting, blocked):
                    penalty += 8.0  # manually blocked slots — moderate penalty

            if preferences.no_early_morning and meeting.start_time < 540:
                penalty += 2.0

            if preferences.no_evening and meeting.end_time > 1020:
                penalty += 2.0

            if preferences.lunch_window:
                ls = _parse_time(preferences.lunch_window[0])
                le = _parse_time(preferences.lunch_window[1])
                if meeting.start_time < le and ls < meeting.end_time:
                    penalty += 3.0  # lunch is soft — prefer to avoid but don't skip courses

        Q[i, i] += penalty * weights.time_preference

    # Sanitize: replace any inf/NaN with large finite penalty
    Q = np.nan_to_num(Q, nan=0.0, posinf=1e6, neginf=-1e6)

    return Q, variable_map

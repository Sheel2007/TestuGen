from __future__ import annotations
import itertools
from collections import defaultdict

import numpy as np

from .. import config
from .models import Section, VariableMapping, ScheduleResult
from .qubo import sections_conflict


def _evaluate(Q: np.ndarray, bitstring: list[int]) -> float:
    x = np.array(bitstring, dtype=float)
    return float(x @ Q @ x)


def _decode_schedule(
    bits: list[int],
    sections: list[Section],
    variable_map: list[VariableMapping],
) -> ScheduleResult | None:
    selected = [sections[i] for i, b in enumerate(bits) if b == 1]

    course_count: dict[str, int] = defaultdict(int)
    for s in selected:
        course_count[s.course_id] += 1
    for count in course_count.values():
        if count != 1:
            return None

    for a, b in itertools.combinations(selected, 2):
        if sections_conflict(a, b):
            return None

    prof_score = sum(s.professor_rating for s in selected) / max(len(selected), 1)
    bitstring_str = "".join(str(b) for b in bits)

    return ScheduleResult(
        sections=selected,
        total_score=0.0,
        professor_score=prof_score,
        walking_score=0.0,
        time_score=0.0,
        solver="classical",
        bitstring=bitstring_str,
    )


def brute_force_solve(
    Q: np.ndarray,
    sections: list[Section],
    variable_map: list[VariableMapping],
    course_ids: list[str],
    num_results: int = 5,
) -> list[ScheduleResult]:
    N = len(sections)
    if N > config.MAX_BRUTE_FORCE_VARS:
        return greedy_solve(sections, course_ids, num_results)

    results: list[tuple[float, list[int]]] = []

    for bits_int in range(2**N):
        bits = [(bits_int >> i) & 1 for i in range(N)]
        schedule = _decode_schedule(bits, sections, variable_map)
        if schedule is None:
            continue
        energy = _evaluate(Q, bits)
        results.append((energy, bits))

    results.sort(key=lambda x: x[0])

    schedules = []
    for energy, bits in results[:num_results]:
        sched = _decode_schedule(bits, sections, variable_map)
        if sched:
            sched.total_score = -energy
            schedules.append(sched)

    return schedules


def greedy_solve(
    sections: list[Section],
    course_ids: list[str],
    num_results: int = 5,
) -> list[ScheduleResult]:
    course_sections: dict[str, list[Section]] = defaultdict(list)
    for s in sections:
        if s.course_id in course_ids:
            course_sections[s.course_id].append(s)

    sorted_courses = sorted(course_ids, key=lambda c: len(course_sections.get(c, [])))

    results: list[ScheduleResult] = []

    def _backtrack(idx: int, chosen: list[Section]) -> None:
        if len(results) >= num_results * 3:
            return
        if idx == len(sorted_courses):
            if len(chosen) == len(sorted_courses):
                prof_score = sum(s.professor_rating for s in chosen) / len(chosen)
                results.append(ScheduleResult(
                    sections=list(chosen),
                    total_score=prof_score,
                    professor_score=prof_score,
                    walking_score=0.0,
                    time_score=0.0,
                    solver="classical",
                ))
            return

        cid = sorted_courses[idx]
        ranked = sorted(course_sections[cid], key=lambda s: -s.professor_rating)

        for sec in ranked:
            conflict = False
            for existing in chosen:
                if sections_conflict(sec, existing):
                    conflict = True
                    break
            if not conflict:
                chosen.append(sec)
                _backtrack(idx + 1, chosen)
                chosen.pop()

    _backtrack(0, [])
    results.sort(key=lambda r: -r.total_score)
    return results[:num_results]

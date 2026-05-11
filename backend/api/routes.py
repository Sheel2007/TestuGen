from __future__ import annotations
import asyncio
import logging

from fastapi import APIRouter, HTTPException

from ..data import umdio, planetterp
from ..data.cache import cache
from ..data.buildings import get_building_coords
from ..optimizer.models import Section, Meeting, TimePreference, PriorityWeights
from ..optimizer.qubo import build_qubo_matrix
from ..optimizer.qaoa import solve_qaoa
from ..optimizer.classical import brute_force_solve, greedy_solve
from .. import config
from .schemas import (
    OptimizationRequest,
    OptimizationResponse,
    ScheduleOut,
    SectionOut,
    MeetingOut,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def _parse_time_str(t: str) -> int:
    if not t:
        return 0
    parts = t.replace("am", "").replace("pm", "").replace("AM", "").replace("PM", "")
    clean = parts.strip()
    if ":" in clean:
        h, m = clean.split(":")
        hour = int(h)
        minute = int(m)
    else:
        hour = int(clean)
        minute = 0
    if ("pm" in t.lower() or "PM" in t) and hour < 12:
        hour += 12
    return hour * 60 + minute


@router.get("/courses/search")
async def search_courses(q: str = ""):
    """Fast course search using PlanetTerp search API."""
    if not q or len(q) < 2:
        return []

    cache_key = f"search:{q.upper()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = planetterp._get_client()
        resp = await client.get(
            f"{config.PLANETTERP_BASE}/search",
            params={"query": q, "limit": 30},
        )
        resp.raise_for_status()
        search_results = resp.json()
    except Exception:
        search_results = []

    # Filter to courses only, then fetch details in parallel
    course_names = [r["name"] for r in search_results if r.get("type") == "course"][:15]

    if not course_names:
        return []

    async def _get_course_detail(name: str) -> dict | None:
        detail_key = f"course_detail:{name}"
        cached_detail = cache.get(detail_key)
        if cached_detail is not None:
            return cached_detail
        try:
            client = planetterp._get_client()
            resp = await client.get(
                f"{config.PLANETTERP_BASE}/course",
                params={"name": name},
            )
            resp.raise_for_status()
            data = resp.json()
            result = {
                "course_id": f"{data.get('department', '')}{data.get('course_number', '')}",
                "name": data.get("title", name),
                "credits": str(data.get("credits", "?")),
                "dept_id": data.get("department", ""),
            }
            cache.set(detail_key, result, config.CACHE_TTL_COURSES)
            return result
        except Exception:
            return {"course_id": name, "name": name, "credits": "?", "dept_id": ""}

    tasks = [_get_course_detail(name) for name in course_names]
    details = await asyncio.gather(*tasks)
    courses = [d for d in details if d is not None]

    cache.set(cache_key, courses, 600)  # 10 min cache
    return courses


async def _fetch_jupiterp_seats(course_id: str) -> dict:
    """Fetch accurate seat data from Jupiterp API. Returns {sec_code: {open_seats, total_seats, waitlist}}."""
    cache_key = f"jupiterp_seats:{course_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = planetterp._get_client()
        resp = await client.get(
            f"{config.JUPITERP_BASE}/sections",
            params={"courseCodes": course_id},
        )
        resp.raise_for_status()
        sections = resp.json()
    except Exception as e:
        logger.warning(f"Jupiterp seat fetch failed for {course_id}: {e}")
        return {}

    result = {}
    for s in sections:
        sec_code = s.get("sec_code", "")
        result[sec_code] = {
            "open_seats": int(s.get("open_seats", 0) or 0),
            "total_seats": int(s.get("total_seats", 0) or 0),
            "waitlist": int(s.get("waitlist", 0) or 0),
        }

    cache.set(cache_key, result, 300)  # 5 min cache — seats change fast
    return result


@router.get("/courses/{course_id}/sections")
async def get_course_sections(course_id: str, semester: str = "202508"):
    try:
        raw_sections = await umdio.get_sections(course_id.upper(), semester)
    except Exception:
        raw_sections = []

    if not raw_sections:
        return []

    await umdio.get_all_buildings()

    # Collect unique professor names and course id for batch fetching
    prof_names = set()
    for sec in raw_sections:
        for instr in sec.get("instructors", []):
            prof_names.add(instr)

    # Fetch professor ratings, course GPA, AND accurate seat data from Jupiterp in parallel
    rating_tasks = {name: planetterp.get_professor_rating(name) for name in prof_names}
    gpa_task = planetterp.get_course_avg_gpa(course_id.upper())
    seats_task = _fetch_jupiterp_seats(course_id.upper())

    all_tasks = list(rating_tasks.values()) + [gpa_task, seats_task]
    all_results = await asyncio.gather(*all_tasks, return_exceptions=True)

    prof_ratings = {}
    for i, name in enumerate(rating_tasks.keys()):
        result = all_results[i]
        prof_ratings[name] = result if isinstance(result, float) else config.DEFAULT_PROFESSOR_RATING

    avg_gpa = all_results[-2] if isinstance(all_results[-2], float) else config.DEFAULT_GPA
    jupiterp_seats = all_results[-1] if isinstance(all_results[-1], dict) else {}

    results = []
    for sec in raw_sections:
        instructors = sec.get("instructors", [])
        rating = prof_ratings.get(instructors[0], config.DEFAULT_PROFESSOR_RATING) if instructors else config.DEFAULT_PROFESSOR_RATING

        meetings = []
        for m in sec.get("meetings", []):
            building = m.get("building", "")
            coords = get_building_coords(building)
            meetings.append({
                "days": m.get("days", ""),
                "start_time": _parse_time_str(m.get("start_time", "")),
                "end_time": _parse_time_str(m.get("end_time", "")),
                "building": building,
                "room": m.get("room", ""),
                "lat": coords[0] if coords else None,
                "lng": coords[1] if coords else None,
            })

        # Use Jupiterp seat data (accurate) if available, fall back to umd.io (stale)
        section_id = sec.get("section_id", "")
        # section_id format: "CMSC216-0101", sec_code is just "0101"
        sec_code = section_id.split("-")[-1] if "-" in section_id else section_id
        jp_seats = jupiterp_seats.get(sec_code, {})

        if jp_seats:
            open_seats = jp_seats["open_seats"]
            total_seats = jp_seats["total_seats"]
        else:
            open_seats = int(sec.get("open_seats", 0) or 0)
            total_seats = int(sec.get("seats", 0) or 0)

        results.append({
            "section_id": section_id,
            "course_id": course_id.upper(),
            "instructors": instructors,
            "meetings": meetings,
            "professor_rating": rating,
            "avg_gpa": avg_gpa,
            "total_seats": total_seats,
            "open_seats": open_seats,
        })

    return results


@router.get("/buildings")
async def get_buildings():
    return await umdio.get_all_buildings()


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize(request: OptimizationRequest):
    if not request.course_ids:
        raise HTTPException(status_code=400, detail="No courses provided")
    if len(request.course_ids) > 8:
        raise HTTPException(status_code=400, detail="Max 8 courses")

    try:
        await umdio.get_all_buildings()
    except Exception:
        logger.warning("Failed to fetch buildings, using fallback coords")

    # Fetch sections sequentially to avoid overwhelming umd.io
    failed_courses = []
    full_courses = []  # courses where ALL sections have 0 open seats
    sections: list[Section] = []

    for cid in request.course_ids:
        try:
            course_sections = await get_course_sections(cid, request.semester)
            if not course_sections:
                failed_courses.append(cid)
        except Exception as e:
            logger.error(f"Failed to fetch sections for {cid}: {e}")
            failed_courses.append(cid)
            course_sections = []

        # Filter out sections with no open seats
        open_sections = [s for s in course_sections if int(s.get("open_seats", 0) or 0) > 0]
        if course_sections and not open_sections:
            full_courses.append(cid)
            logger.info(f"All sections full for {cid}, skipping")

        for sec_data in open_sections:
            meetings = [
                Meeting(
                    days=m["days"],
                    start_time=m["start_time"],
                    end_time=m["end_time"],
                    building=m["building"],
                    room=m["room"],
                    lat=m.get("lat"),
                    lng=m.get("lng"),
                )
                for m in sec_data["meetings"]
            ]
            sections.append(Section(
                section_id=sec_data["section_id"],
                course_id=sec_data["course_id"],
                instructors=sec_data["instructors"],
                meetings=meetings,
                professor_rating=sec_data["professor_rating"],
                avg_gpa=sec_data["avg_gpa"],
                total_seats=sec_data.get("total_seats", 0),
                open_seats=sec_data.get("open_seats", 0),
            ))

    if not sections:
        msg = "No sections found."
        if failed_courses:
            msg += f" Failed to load: {', '.join(failed_courses)}."
        if full_courses:
            msg += f" All sections full: {', '.join(full_courses)}."
        msg += " The UMD API may be slow — try again."
        raise HTTPException(status_code=404, detail=msg)

    prefs = TimePreference(
        blocked_times=[bt.dict() for bt in request.preferences.blocked_times],
        lunch_window=tuple(request.preferences.lunch_window) if request.preferences.lunch_window else None,
        no_early_morning=request.preferences.no_early_morning,
        no_evening=request.preferences.no_evening,
    )
    weights = PriorityWeights(
        professor_rating=request.weights.professor_rating,
        walking_distance=request.weights.walking_distance,
        time_preference=request.weights.time_preference,
    )

    Q, variable_map = build_qubo_matrix(sections, prefs, weights)

    solver_used = request.solver
    schedules = []

    if request.solver in ("qaoa", "both"):
        qaoa_results = solve_qaoa(Q, sections, variable_map, request.course_ids, request.num_results)
        schedules.extend(qaoa_results)

    if request.solver in ("classical", "both"):
        if len(sections) <= config.MAX_BRUTE_FORCE_VARS:
            classical_results = brute_force_solve(Q, sections, variable_map, request.course_ids, request.num_results)
        else:
            classical_results = greedy_solve(sections, request.course_ids, request.num_results)
        schedules.extend(classical_results)

    if request.solver == "both" and schedules:
        # Guarantee mix: top results from each solver
        qaoa_scheds = sorted([s for s in schedules if s.solver == "qaoa"], key=lambda s: -s.total_score)
        classical_scheds = sorted([s for s in schedules if s.solver == "classical"], key=lambda s: -s.total_score)
        half = max(1, request.num_results // 2)
        schedules = classical_scheds[:half] + qaoa_scheds[:half]
        # Fill remaining slots from either
        remaining = request.num_results - len(schedules)
        if remaining > 0:
            used = {id(s) for s in schedules}
            extras = sorted([s for s in classical_scheds + qaoa_scheds if id(s) not in used], key=lambda s: -s.total_score)
            schedules.extend(extras[:remaining])
        schedules.sort(key=lambda s: -s.total_score)
    else:
        schedules.sort(key=lambda s: -s.total_score)
        schedules = schedules[:request.num_results]

    schedule_outputs = []
    for sched in schedules:
        section_outputs = []
        for s in sched.sections:
            meeting_outputs = [
                MeetingOut(
                    days=m.days,
                    start_time=m.start_time,
                    end_time=m.end_time,
                    building=m.building,
                    room=m.room,
                )
                for m in s.meetings
            ]
            section_outputs.append(SectionOut(
                section_id=s.section_id,
                course_id=s.course_id,
                instructors=s.instructors,
                meetings=meeting_outputs,
                professor_rating=s.professor_rating,
                avg_gpa=s.avg_gpa,
                total_seats=s.total_seats,
                open_seats=s.open_seats,
            ))
        schedule_outputs.append(ScheduleOut(
            sections=section_outputs,
            total_score=sched.total_score,
            professor_score=sched.professor_score,
            walking_score=sched.walking_score,
            time_score=sched.time_score,
            solver=sched.solver,
        ))

    warnings = []
    if full_courses:
        warnings.append(f"All sections full (excluded): {', '.join(full_courses)}")
    if failed_courses:
        warnings.append(f"Failed to load: {', '.join(failed_courses)}")

    return OptimizationResponse(
        schedules=schedule_outputs,
        num_variables=len(sections),
        solver_used=solver_used,
        warnings=warnings,
    )

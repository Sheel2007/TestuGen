import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .data import umdio

logger = logging.getLogger(__name__)

app = FastAPI(title="UMD Course Optimizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def warm_cache():
    """Pre-fetch buildings + popular course sections on startup.
    This runs in background so server starts immediately.
    """
    async def _warm():
        try:
            await umdio.get_all_buildings()
            logger.info("Cache warmed: buildings")
        except Exception:
            logger.warning("Failed to warm buildings cache")

        # Pre-fetch sections for popular CS/MATH courses
        popular = [
            "CMSC131", "CMSC132", "CMSC216", "CMSC250", "CMSC330", "CMSC351",
            "MATH140", "MATH141", "MATH240", "STAT400",
            "ENGL101", "COMM107",
        ]
        for course_id in popular:
            try:
                await umdio.get_sections(course_id, "202508")
                logger.info(f"Cache warmed: {course_id}")
            except Exception:
                logger.warning(f"Failed to warm cache for {course_id}")
            await asyncio.sleep(0.2)  # don't hammer umd.io

    asyncio.create_task(_warm())


@app.get("/health")
async def health():
    return {"status": "ok"}

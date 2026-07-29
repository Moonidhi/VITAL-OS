"""
VITAL-OS — Departments Router
FastAPI router exposing 8 endpoints for real-time hospital department telemetry,
equipment registries, load allocations, efficiency matrices, and event history.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from departments import get_department_engine

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("")
def get_all_departments():
    """
    Returns live metrics for all 7 hospital departments.
    """
    engine = get_department_engine()
    return engine.get_all_departments()


@router.get("/summary")
def get_departments_summary():
    """
    Returns aggregate KPI counts across all clinical and infrastructure departments.
    """
    engine = get_department_engine()
    return engine.get_summary()


@router.get("/energy-breakdown")
def get_energy_breakdown():
    """
    Returns current load, peak load, and allocated power breakdown per department.
    """
    engine = get_department_engine()
    return engine.get_energy_breakdown()


@router.get("/efficiency-matrix")
def get_efficiency_matrix():
    """
    Returns efficiency scores, allocation statuses, and load trends for all departments.
    """
    engine = get_department_engine()
    return engine.get_efficiency_matrix()


@router.get("/events")
def get_department_events(
    dept_id: Optional[str] = Query(None, description="Optional filter by department ID (DEPT-001)"),
    limit: int = Query(100, ge=1, le=500, description="Max events to return"),
):
    """
    Returns recent load spikes, drops, and department events.
    """
    engine = get_department_engine()
    return engine.get_events(dept_id=dept_id, limit=limit)


@router.get("/trends")
def get_all_department_trends(hours: int = Query(24, ge=1, le=96)):
    """
    Returns 24-hour rolling load trend data aggregated across all departments.
    """
    engine = get_department_engine()
    return engine.get_hourly_trend(hours=hours)


@router.get("/{dept_id}")
def get_department_by_id(dept_id: str):
    """
    Returns full details for a single department, including equipment list.
    """
    engine = get_department_engine()
    dept = engine.get_department(dept_id)
    if not dept:
        dept = engine.get_department_by_name(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department '{dept_id}' not found")
    return dept


@router.get("/{dept_id}/trend")
def get_single_department_trend(dept_id: str, hours: int = Query(24, ge=1, le=96)):
    """
    Returns 24-hour hourly load trend readings for a single department.
    """
    engine = get_department_engine()
    dept = engine.get_department(dept_id)
    if not dept:
        dept = engine.get_department_by_name(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department '{dept_id}' not found")
    return engine.get_hourly_trend(dept_id=dept["dept_id"], hours=hours)

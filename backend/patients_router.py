"""
VITAL-OS — Patients Router
FastAPI router providing 6 endpoints for patient management, summary stats,
department stats, energy allocations, recent events, and patient details.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from patients import get_patient_engine

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("")
def list_patients(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=200, description="Items per page"),
    search: str = Query("", description="Search term for name or ID"),
    department: str = Query("", description="Filter by department"),
    condition: str = Query("", description="Filter by condition"),
    status: str = Query("", description="Filter by status"),
):
    """
    Returns paginated patient records with optional text search and filtering.
    """
    engine = get_patient_engine()
    all_patients = engine.get_all_patients()

    # Filtering
    filtered = all_patients

    if search.strip():
        q = search.strip().lower()
        filtered = [
            p for p in filtered
            if q in p["name"].lower() or q in p["patient_id"].lower() or q in p["bed_number"].lower()
        ]

    if department.strip():
        d = department.strip().lower()
        filtered = [p for p in filtered if p["department"].lower() == d or d in p["department"].lower()]

    if condition.strip():
        c = condition.strip().lower()
        filtered = [p for p in filtered if p["condition"].lower() == c]

    if status.strip():
        st = status.strip().lower()
        filtered = [p for p in filtered if p["status"].lower() == st]

    total = len(filtered)
    pages = (total + limit - 1) // limit if total > 0 else 1
    page = min(page, pages) if pages > 0 else 1

    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paged_patients = filtered[start_idx:end_idx]

    return {
        "patients": paged_patients,
        "total": total,
        "page": page,
        "pages": pages,
    }


@router.get("/summary")
def get_patients_summary():
    """
    Returns high-level KPI counts for active patients, department breakdown, and life support.
    """
    engine = get_patient_engine()
    return engine.get_summary()


@router.get("/department-stats")
def get_department_stats():
    """
    Returns department distribution, condition breakdown, and energy priority tiers for charts.
    """
    engine = get_patient_engine()
    return engine.get_department_stats()


@router.get("/energy-summary")
def get_energy_summary():
    """
    Returns power allocation summary by priority tier.
    """
    engine = get_patient_engine()
    return engine.get_energy_summary()


@router.get("/events/recent")
def get_recent_events(limit: int = Query(50, ge=1, le=500)):
    """
    Returns recent patient condition changes, department transfers, and discharges.
    """
    engine = get_patient_engine()
    return engine.get_events(limit=limit)


@router.get("/{patient_id}")
def get_patient_by_id(patient_id: str):
    """
    Returns full details for a specific patient ID.
    """
    engine = get_patient_engine()
    patient = engine.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID '{patient_id}' not found")
    return patient

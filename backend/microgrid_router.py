"""
VITAL-OS — Microgrid Router
FastAPI router exposing 11 endpoints for real-time microgrid system status,
asset registries, telemetry, power flow topology, event logging, and carbon savings.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from microgrid import get_microgrid_engine

router = APIRouter(prefix="/microgrid", tags=["microgrid"])


@router.get("/status")
def get_microgrid_status():
    """
    Returns complete real-time system status snapshot.
    """
    engine = get_microgrid_engine()
    return engine.get_system_status()


@router.get("/summary")
def get_microgrid_summary():
    """
    Returns KPI counts and key metrics for dashboard header cards.
    """
    engine = get_microgrid_engine()
    return engine.get_summary()


@router.get("/assets")
def get_microgrid_assets():
    """
    Returns all 12 microgrid assets with live telemetry metrics.
    """
    engine = get_microgrid_engine()
    return engine.get_all_assets()


@router.get("/generation-breakdown")
def get_generation_breakdown():
    """
    Returns solar, wind, and grid power contributions for breakdown chart.
    """
    engine = get_microgrid_engine()
    return engine.get_generation_breakdown()


@router.get("/power-flow")
def get_power_flow():
    """
    Returns current live power flow topology (nodes, edges, and power values).
    """
    engine = get_microgrid_engine()
    return engine.get_power_flow()


@router.get("/hourly-trend")
def get_hourly_trend(hours: int = Query(24, ge=1, le=96)):
    """
    Returns 15-minute resolution power and SOC trend readings over the last N hours.
    """
    engine = get_microgrid_engine()
    return engine.get_hourly_trend(hours=hours)


@router.get("/weekly-trend")
def get_weekly_trend():
    """
    Returns 7-day historical energy generation and load summaries.
    """
    engine = get_microgrid_engine()
    return engine.get_weekly_trend()


@router.get("/events")
def get_microgrid_events(
    severity: Optional[str] = Query(None, description="Filter by severity: INFO, WARNING, CRITICAL"),
    limit: int = Query(50, ge=1, le=200, description="Max events to return"),
):
    """
    Returns recent microgrid events with optional severity filter.
    """
    engine = get_microgrid_engine()
    return engine.get_events(severity=severity, limit=limit)


@router.get("/carbon-savings")
def get_carbon_savings():
    """
    Returns daily and accumulated carbon emission reductions and cost savings.
    """
    engine = get_microgrid_engine()
    return engine.get_carbon_savings()


@router.get("/assets/{asset_id}")
def get_asset_by_id(asset_id: str):
    """
    Returns detailed metrics and status for a single microgrid asset.
    """
    engine = get_microgrid_engine()
    asset = engine.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found")
    return asset


@router.patch("/events/{event_id}/acknowledge")
def acknowledge_event(event_id: int):
    """
    Marks a microgrid event as acknowledged by the operator.
    """
    engine = get_microgrid_engine()
    success = engine.acknowledge_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Event ID {event_id} not found")
    return {"status": "success", "event_id": event_id, "acknowledged": True}

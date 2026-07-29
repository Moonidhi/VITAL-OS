"""
VITAL-OS — Virtual Intelligent Triage and Load Operating System
Backend foundation: FastAPI app, SQLite database setup, base models.

Run with:
    uvicorn main:app --reload --port 8000
"""

import csv
import io
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, text, func
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from pydantic import BaseModel

from simulation import MicrogridSimulator, INTERVALS_PER_DAY
from ai_model import get_or_train_model
from patients_router import router as patients_router
from patients import PatientEngine
patient_engine = PatientEngine(db_url="sqlite:///./vital_os.db")
from microgrid_router import router as microgrid_router
from microgrid import MicrogridEngine
microgrid_engine = MicrogridEngine(db_url="sqlite:///./vital_os.db")
from departments_router import router as departments_router
from departments import DepartmentEngine
dept_engine = DepartmentEngine(db_url="sqlite:///./vital_os.db")
from reports_router import router as reports_router





# ---------------------------------------------------------------------------
# Database setup (SQLite, single file, zero config)
# ---------------------------------------------------------------------------

DATABASE_URL = "sqlite:///./vital_os.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite + FastAPI
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    symptoms = Column(String, nullable=True)
    heart_rate = Column(Float, nullable=True)
    blood_pressure_systolic = Column(Float, nullable=True)
    blood_pressure_diastolic = Column(Float, nullable=True)
    oxygen_saturation = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    triage_score = Column(Float, nullable=True)      # filled in by ML model later
    triage_level = Column(String, nullable=True)      # e.g. "critical", "urgent", "stable"
    created_at = Column(DateTime, default=datetime.utcnow)


class SimulationHistory(Base):
    __tablename__ = "simulation_history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, index=True, nullable=False, unique=True)
    solar_kw = Column(Float, nullable=False)
    wind_kw = Column(Float, nullable=False)
    battery_soc_percent = Column(Float, nullable=False)
    battery_power_kw = Column(Float, nullable=False)
    total_load_kw = Column(Float, nullable=False)
    renewable_generation_kw = Column(Float, nullable=False)
    grid_import_kw = Column(Float, nullable=False)
    grid_export_kw = Column(Float, nullable=False)
    net_balance_kw = Column(Float, nullable=False)
    grid_status = Column(String, nullable=True)
    ai_prediction_kw = Column(Float, nullable=True)
    risk_level = Column(String, nullable=True)
    recommendation = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, index=True, nullable=False)
    severity = Column(String, index=True, nullable=False)       # INFO, WARNING, CRITICAL
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    source = Column(String, index=True, nullable=False)        # GRID, BATTERY, LOAD_FORECAST, RENEWABLE, SYSTEM
    status = Column(String, index=True, nullable=False, default="ACTIVE")  # ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_at = Column(String, nullable=True)
    resolved_at = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Create tables on startup if they don't already exist
Base.metadata.create_all(bind=engine)


def evaluate_and_create_alerts(db: Session, snapshot: dict):
    """
    Evaluates microgrid telemetry snapshot for alert conditions (Grid outages,
    low battery SOC, load surplus deficits, renewable coverage) and creates new
    ACTIVE alerts if no matching active/acknowledged alert currently exists.
    """
    if not snapshot:
        return

    ts = snapshot.get("timestamp", datetime.utcnow().isoformat())
    grid_status = snapshot.get("grid_status", "NORMAL")
    soc = float(snapshot.get("battery_soc_percent", 100.0))
    total_load = float(snapshot.get("total_load_kw", 0.0))
    solar = float(snapshot.get("solar_kw", 0.0))
    wind = float(snapshot.get("wind_kw", 0.0))
    ren_gen = float(snapshot.get("total_generation_kw", solar + wind))
    net_bal = float(snapshot.get("net_balance_kw", ren_gen - total_load))

    potential_alerts = []

    # 1. Grid Outage Condition
    if grid_status == "OUTAGE":
        potential_alerts.append({
            "severity": "CRITICAL",
            "title": "Grid Power Outage Detected",
            "message": "Utility grid power outage detected. Hospital operating on microgrid and battery reserves.",
            "source": "GRID",
        })

    # 2. Battery SOC Conditions
    if soc < 20.0:
        potential_alerts.append({
            "severity": "CRITICAL",
            "title": "Critical Battery Reserve",
            "message": f"Battery State of Charge is critically low at {soc:.1f}%. Immediate load shedding recommended.",
            "source": "BATTERY",
        })
    elif soc < 35.0:
        potential_alerts.append({
            "severity": "WARNING",
            "title": "Low Battery Reserve",
            "message": f"Battery State of Charge is low at {soc:.1f}%. Monitor battery usage closely.",
            "source": "BATTERY",
        })

    # 3. Power Generation Deficit / Surplus Deficit
    if net_bal < -50.0:
        potential_alerts.append({
            "severity": "WARNING",
            "title": "Microgrid Power Generation Deficit",
            "message": f"Hospital load ({total_load:.1f} kW) exceeds renewable generation ({ren_gen:.1f} kW) by {abs(net_bal):.1f} kW.",
            "source": "LOAD_FORECAST",
        })

    # 4. Low Renewable Energy Coverage
    if total_load > 0 and (ren_gen / total_load) < 0.30:
        coverage_pct = (ren_gen / total_load) * 100.0
        potential_alerts.append({
            "severity": "WARNING",
            "title": "Low Renewable Energy Coverage",
            "message": f"Renewable energy sources are currently providing only {coverage_pct:.1f}% of hospital power demand.",
            "source": "RENEWABLE",
        })

    # 5. Active Equipment Failure Events Engine
    active_events = snapshot.get("active_events", [])
    for event_name in active_events:
        if event_name == "Chiller Failure":
            potential_alerts.append({
                "severity": "WARNING",
                "title": "Hospital Chiller Unit Failure",
                "message": "Chiller failure detected in HVAC subsystem; secondary cooling units active (+35 kW load surge).",
                "source": "SYSTEM",
            })
        elif event_name == "Oxygen Concentrator Failure":
            potential_alerts.append({
                "severity": "CRITICAL",
                "title": "Oxygen Concentrator Fault",
                "message": "Primary oxygen concentrator failure detected; switching to auxiliary life-support power.",
                "source": "SYSTEM",
            })
        elif event_name == "HVAC Overload":
            potential_alerts.append({
                "severity": "WARNING",
                "title": "HVAC System Thermal Overload",
                "message": "Extreme cooling demand causing HVAC system thermal overload (+35 kW load bump).",
                "source": "SYSTEM",
            })
        elif event_name == "Solar Inverter Failure":
            potential_alerts.append({
                "severity": "WARNING",
                "title": "Solar PV Inverter Fault",
                "message": "Solar PV inverter trip detected; solar generation throttled to 20% capacity.",
                "source": "RENEWABLE",
            })
        elif event_name == "Battery Thermal Throttling":
            potential_alerts.append({
                "severity": "WARNING",
                "title": "Battery BESS Thermal Throttling",
                "message": "BESS high temperature warning; battery discharge power capped at 50%.",
                "source": "BATTERY",
            })
        elif event_name == "Wind Turbine Maintenance":
            potential_alerts.append({
                "severity": "INFO",
                "title": "Wind Turbine Safety Maintenance",
                "message": "Wind turbine offline for scheduled safety maintenance.",
                "source": "RENEWABLE",
            })
        elif event_name == "Emergency Surgery Surge":
            potential_alerts.append({
                "severity": "INFO",
                "title": "Emergency Surgery Surge",
                "message": "Unscheduled emergency surgery in progress; OT and ICU clinical power draw elevated.",
                "source": "LOAD_FORECAST",
            })

    # Deduplication and insertion
    for item in potential_alerts:
        existing = db.query(Alert).filter(
            Alert.source == item["source"],
            Alert.title == item["title"],
            Alert.status.in_(["ACTIVE", "ACKNOWLEDGED"])
        ).first()

        if not existing:
            new_alert = Alert(
                timestamp=ts,
                severity=item["severity"],
                title=item["title"],
                message=item["message"],
                source=item["source"],
                status="ACTIVE",
            )
            db.add(new_alert)

    db.commit()


def save_snapshots_to_db(db: Session, snapshots: list[dict]):
    """
    Persists a list of simulation snapshot dictionaries into the SQLite database.
    Skips snapshots whose timestamps already exist in the simulation_history table.
    Also triggers alert evaluation for each snapshot.
    """
    if not snapshots:
        return

    timestamps = [s["timestamp"] for s in snapshots]
    existing = set(
        res[0] for res in db.query(SimulationHistory.timestamp).filter(
            SimulationHistory.timestamp.in_(timestamps)
        ).all()
    )

    new_records = []
    for s in snapshots:
        evaluate_and_create_alerts(db, s)

        ts = s["timestamp"]
        if ts in existing:
            continue
        existing.add(ts)

        solar = float(s.get("solar_kw", 0.0))
        wind = float(s.get("wind_kw", 0.0))
        ren_gen = float(s.get("total_generation_kw", solar + wind))

        rec = SimulationHistory(
            timestamp=ts,
            solar_kw=solar,
            wind_kw=wind,
            battery_soc_percent=float(s.get("battery_soc_percent", 0.0)),
            battery_power_kw=float(s.get("battery_power_kw", 0.0)),
            total_load_kw=float(s.get("total_load_kw", 0.0)),
            renewable_generation_kw=ren_gen,
            grid_import_kw=float(s.get("grid_import_kw", 0.0)),
            grid_export_kw=float(s.get("grid_export_kw", 0.0)),
            net_balance_kw=float(s.get("net_balance_kw", 0.0)),
            grid_status=s.get("grid_status", "NORMAL"),
            ai_prediction_kw=s.get("ai_prediction_kw"),
            risk_level=s.get("risk_level"),
            recommendation=s.get("recommendation"),
        )
        new_records.append(rec)

    if new_records:
        db.add_all(new_records)
        db.commit()


# ---------------------------------------------------------------------------
# Pydantic schemas (request/response shapes)
# ---------------------------------------------------------------------------

class PatientCreate(BaseModel):
    name: str
    age: Optional[int] = None
    symptoms: Optional[str] = None
    heart_rate: Optional[float] = None
    blood_pressure_systolic: Optional[float] = None
    blood_pressure_diastolic: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    temperature: Optional[float] = None


class PatientResponse(PatientCreate):
    id: int
    triage_score: Optional[float] = None
    triage_level: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="VITAL-OS API",
    description="Virtual Intelligent Triage and Load Operating System — backend",
    version="0.1.0",
)

# CORS: allow the local Vite dev server to talk to this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients_router)
app.include_router(microgrid_router)
app.include_router(departments_router)
app.include_router(reports_router)



# ---------------------------------------------------------------------------
# Simulation engine (single shared instance, created at startup)
# ---------------------------------------------------------------------------

simulator = MicrogridSimulator(
    start_time=datetime.now().replace(
        minute=(datetime.now().minute // 15) * 15, second=0, microsecond=0
    ),
    random_seed=42,
)


@app.get("/")
def root():
    return {"status": "ok", "service": "VITAL-OS API"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Simple health check — also confirms DB connectivity."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "ok", "database": db_status}


# ---------------------------------------------------------------------------
# Minimal patient endpoints (foundation only — triage logic comes later)
# ---------------------------------------------------------------------------

@app.post("/patients", response_model=PatientResponse)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    db_patient = Patient(**patient.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


@app.get("/patients", response_model=list[PatientResponse])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).order_by(Patient.created_at.desc()).all()


@app.get("/patients/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


# ---------------------------------------------------------------------------
# Simulation endpoints
# ---------------------------------------------------------------------------

@app.get("/simulation/current")
def get_current_simulation_snapshot(db: Session = Depends(get_db)):
    """
    Return the latest simulation snapshot.

    If the simulator hasn't taken any steps yet, advance it by one
    interval first so there's always a snapshot to return.
    Automatically persists snapshot to database.
    """
    if not simulator.history:
        snapshot = simulator.step()
        patient_engine.simulate_step(snapshot.to_dict())
        microgrid_engine.simulate_step(snapshot.to_dict())
        dept_engine.simulate_step(snapshot.to_dict())

    # Save all accumulated history to DB to ensure completeness
    all_snapshots = [s.to_dict() for s in simulator.history]
    save_snapshots_to_db(db, all_snapshots)

    latest = simulator.history[-1]
    return latest.to_dict()


@app.get("/simulation/run")
def run_simulation(intervals: int = INTERVALS_PER_DAY, db: Session = Depends(get_db)):
    """
    Advance the simulator by `intervals` steps (default: 96, i.e. one full day),
    automatically save to database, and return every snapshot produced as JSON.
    """
    if intervals <= 0:
        raise HTTPException(status_code=400, detail="intervals must be a positive integer")

    df = simulator.run(intervals=intervals)
    records = df.to_dict(orient="records")

    save_snapshots_to_db(db, records)
    return records


@app.get("/simulation/day-summary")
def get_simulation_day_summary(db: Session = Depends(get_db)):
    """
    Summarize the simulator's accumulated history:
    total solar/wind generation, total hospital load, battery SOC range,
    and the number of grid outage intervals observed.
    """
    if not simulator.history:
        raise HTTPException(
            status_code=400,
            detail="No simulation data yet. Call /simulation/run or /simulation/current first.",
        )

    df = simulator.history_to_dataframe()

    return {
        "intervals_recorded": len(df),
        "total_solar_kwh": round(df["solar_kw"].sum() / 4, 2),
        "total_wind_kwh": round(df["wind_kw"].sum() / 4, 2),
        "total_hospital_load_kwh": round(df["total_load_kw"].sum() / 4, 2),
        "battery_soc_min_percent": round(df["battery_soc_percent"].min(), 2),
        "battery_soc_max_percent": round(df["battery_soc_percent"].max(), 2),
        "outage_intervals": int((df["grid_status"] == "OUTAGE").sum()),
    }


@app.get("/simulation/history")
def get_simulation_history(
    from_time: Optional[str] = Query(None, description="Start ISO timestamp (inclusive)"),
    to_time: Optional[str] = Query(None, description="End ISO timestamp (inclusive)"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """
    Query historical simulation telemetry from the database with optional filtering and limit.
    """
    query = db.query(SimulationHistory)

    if from_time:
        try:
            datetime.fromisoformat(from_time.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'from_time' ISO format.")
        query = query.filter(SimulationHistory.timestamp >= from_time)

    if to_time:
        try:
            datetime.fromisoformat(to_time.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'to_time' ISO format.")
        query = query.filter(SimulationHistory.timestamp <= to_time)

    records = query.order_by(SimulationHistory.timestamp.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "timestamp": r.timestamp,
            "solar_kw": r.solar_kw,
            "wind_kw": r.wind_kw,
            "battery_soc_percent": r.battery_soc_percent,
            "battery_power_kw": r.battery_power_kw,
            "total_load_kw": r.total_load_kw,
            "renewable_generation_kw": r.renewable_generation_kw,
            "grid_import_kw": r.grid_import_kw,
            "grid_export_kw": r.grid_export_kw,
            "net_balance_kw": r.net_balance_kw,
            "grid_status": r.grid_status,
            "ai_prediction_kw": r.ai_prediction_kw,
            "risk_level": r.risk_level,
            "recommendation": r.recommendation,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@app.get("/simulation/export")
def export_simulation_csv(
    from_time: Optional[str] = Query(None, description="Start ISO timestamp"),
    to_time: Optional[str] = Query(None, description="End ISO timestamp"),
    limit: int = Query(1000, ge=1, le=5000, description="Max records to export"),
    db: Session = Depends(get_db),
):
    """
    Export historical simulation telemetry as a CSV download.
    """
    query = db.query(SimulationHistory)

    if from_time:
        try:
            datetime.fromisoformat(from_time.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'from_time' ISO format.")
        query = query.filter(SimulationHistory.timestamp >= from_time)

    if to_time:
        try:
            datetime.fromisoformat(to_time.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'to_time' ISO format.")
        query = query.filter(SimulationHistory.timestamp <= to_time)

    records = query.order_by(SimulationHistory.timestamp.asc()).limit(limit).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "timestamp",
        "solar_kw",
        "wind_kw",
        "battery_soc_percent",
        "battery_power_kw",
        "total_load_kw",
        "renewable_generation_kw",
        "grid_import_kw",
        "grid_export_kw",
        "net_balance_kw",
        "grid_status",
        "ai_prediction_kw",
        "risk_level",
        "recommendation",
    ])

    for r in records:
        writer.writerow([
            r.timestamp,
            r.solar_kw,
            r.wind_kw,
            r.battery_soc_percent,
            r.battery_power_kw,
            r.total_load_kw,
            r.renewable_generation_kw,
            r.grid_import_kw,
            r.grid_export_kw,
            r.net_balance_kw,
            r.grid_status,
            r.ai_prediction_kw if r.ai_prediction_kw is not None else "",
            r.risk_level or "",
            r.recommendation or "",
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="simulation_history.csv"'},
    )


@app.get("/simulation/stats")
def get_simulation_stats(db: Session = Depends(get_db)):
    """
    Return summary statistics over historical simulation database records.
    """
    total_records = db.query(func.count(SimulationHistory.id)).scalar() or 0
    if total_records == 0:
        return {
            "total_records": 0,
            "oldest_record": None,
            "newest_record": None,
            "avg_hospital_load_kw": None,
            "avg_renewable_generation_kw": None,
            "avg_battery_soc_percent": None,
        }

    oldest = db.query(func.min(SimulationHistory.timestamp)).scalar()
    newest = db.query(func.max(SimulationHistory.timestamp)).scalar()
    avg_load = db.query(func.avg(SimulationHistory.total_load_kw)).scalar()
    avg_ren = db.query(func.avg(SimulationHistory.renewable_generation_kw)).scalar()
    avg_soc = db.query(func.avg(SimulationHistory.battery_soc_percent)).scalar()

    return {
        "total_records": total_records,
        "oldest_record": oldest,
        "newest_record": newest,
        "avg_hospital_load_kw": round(avg_load, 2) if avg_load is not None else None,
        "avg_renewable_generation_kw": round(avg_ren, 2) if avg_ren is not None else None,
        "avg_battery_soc_percent": round(avg_soc, 2) if avg_soc is not None else None,
    }


# ---------------------------------------------------------------------------
# AI prediction endpoints (Milestone 4)
# ---------------------------------------------------------------------------

@app.get("/ai/predict")
def ai_predict():
    """
    Train (or return cached) the load forecasting model and predict
    hospital load for the next 15-minute interval.

    Returns 503 if the simulator does not yet have enough history.
    """
    try:
        model = get_or_train_model(simulator)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    snapshot = simulator.history[-1].to_dict()
    return model.predict(snapshot)


@app.get("/ai/status")
def ai_status():
    """
    Return the current state of the AI model — useful for debugging
    and for showing model health on the dashboard.

    Always returns a valid JSON response; 'trained: false' if the
    simulator has not yet generated enough data to train on.
    """
    if len(simulator.history) < 10:
        return {
            "trained": False,
            "training_samples": 0,
            "rmse": None,
            "model": "GradientBoostingRegressor",
            "last_trained": None,
        }

    try:
        model = get_or_train_model(simulator)
    except ValueError:
        return {
            "trained": False,
            "training_samples": 0,
            "rmse": None,
            "model": "GradientBoostingRegressor",
            "last_trained": None,
        }

    return {
        "trained": model.trained,
        "training_samples": model.training_samples,
        "train_rmse": round(model.train_rmse, 4),
        "val_rmse": round(model.val_rmse, 4),
        "test_rmse": round(model.test_rmse, 4),
        "rmse": round(model.rmse, 4),
        "model": model.model_name,
        "last_trained": model.last_trained,
        "feature_importance": model.feature_importance,
        "top_feature": model.top_feature,
        "training_data_source": model.training_data_source,
        "is_pretrained": model.is_pretrained,
    }


# ---------------------------------------------------------------------------
# Alert Management Endpoints
# ---------------------------------------------------------------------------

@app.get("/alerts")
def get_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: INFO, WARNING, CRITICAL"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, ACKNOWLEDGED, RESOLVED"),
    from_time: Optional[str] = Query(None, description="Start ISO timestamp"),
    to_time: Optional[str] = Query(None, description="End ISO timestamp"),
    limit: int = Query(100, ge=1, le=1000, description="Max alerts to return"),
    db: Session = Depends(get_db),
):
    """
    Query alerts with optional filtering by severity, status, and date range.
    """
    query = db.query(Alert)

    if severity:
        query = query.filter(Alert.severity == severity.upper())

    if status:
        query = query.filter(Alert.status == status.upper())

    if from_time:
        try:
            datetime.fromisoformat(from_time.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'from_time' ISO format.")
        query = query.filter(Alert.timestamp >= from_time)

    if to_time:
        try:
            datetime.fromisoformat(to_time.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'to_time' ISO format.")
        query = query.filter(Alert.timestamp <= to_time)

    records = query.order_by(Alert.id.desc()).limit(limit).all()

    return [
        {
            "id": a.id,
            "timestamp": a.timestamp,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "source": a.source,
            "status": a.status,
            "acknowledged_at": a.acknowledged_at,
            "resolved_at": a.resolved_at,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in records
    ]


@app.get("/alerts/stats")
def get_alert_stats(db: Session = Depends(get_db)):
    """
    Return summary statistics for alert management dashboard.
    """
    total = db.query(func.count(Alert.id)).scalar() or 0
    active = db.query(func.count(Alert.id)).filter(Alert.status == "ACTIVE").scalar() or 0
    acknowledged = db.query(func.count(Alert.id)).filter(Alert.status == "ACKNOWLEDGED").scalar() or 0
    resolved = db.query(func.count(Alert.id)).filter(Alert.status == "RESOLVED").scalar() or 0
    critical = db.query(func.count(Alert.id)).filter(
        Alert.severity == "CRITICAL",
        Alert.status.in_(["ACTIVE", "ACKNOWLEDGED"])
    ).scalar() or 0

    return {
        "total_alerts": total,
        "active_alerts": active,
        "acknowledged_alerts": acknowledged,
        "resolved_alerts": resolved,
        "critical_alerts": critical,
    }


@app.get("/alerts/{alert_id}")
def get_alert_by_id(alert_id: int, db: Session = Depends(get_db)):
    """
    Fetch a single alert by ID.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {
        "id": alert.id,
        "timestamp": alert.timestamp,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "source": alert.source,
        "status": alert.status,
        "acknowledged_at": alert.acknowledged_at,
        "resolved_at": alert.resolved_at,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


@app.patch("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Acknowledge an active alert.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "timestamp": alert.timestamp,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "source": alert.source,
        "status": alert.status,
        "acknowledged_at": alert.acknowledged_at,
        "resolved_at": alert.resolved_at,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


@app.patch("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Resolve an active or acknowledged alert.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "RESOLVED"
    alert.resolved_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "timestamp": alert.timestamp,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "source": alert.source,
        "status": alert.status,
        "acknowledged_at": alert.acknowledged_at,
        "resolved_at": alert.resolved_at,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }

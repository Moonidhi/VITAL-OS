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


# Create tables on startup if they don't already exist
Base.metadata.create_all(bind=engine)


def save_snapshots_to_db(db: Session, snapshots: list[dict]):
    """
    Persists a list of simulation snapshot dictionaries into the SQLite database.
    Skips snapshots whose timestamps already exist in the simulation_history table.
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
        simulator.step()

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
        "rmse": round(model.rmse, 4),
        "model": model.model_name,
        "last_trained": model.last_trained,
    }

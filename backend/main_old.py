"""
VITAL-OS — Virtual Intelligent Triage and Load Operating System
Backend foundation: FastAPI app, SQLite database setup, base models.

Run with:
    uvicorn main:app --reload --port 8000
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from pydantic import BaseModel

from simulation import MicrogridSimulator, INTERVALS_PER_DAY


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
# Models (minimal placeholder schema — extend in later steps)
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


# Create tables on startup if they don't already exist
Base.metadata.create_all(bind=engine)


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
# Simulation endpoints (Milestone 3)
# ---------------------------------------------------------------------------

@app.get("/simulation/current")
def get_current_simulation_snapshot():
    """
    Return the latest simulation snapshot.

    If the simulator hasn't taken any steps yet, advance it by one
    interval first so there's always a snapshot to return.
    """
    if not simulator.history:
        simulator.step()
    latest = simulator.history[-1]
    return latest.to_dict()


@app.get("/simulation/run")
def run_simulation(intervals: int = INTERVALS_PER_DAY):
    """
    Advance the simulator by `intervals` steps (default: 96, i.e. one full day)
    and return every snapshot produced as JSON.
    """
    if intervals <= 0:
        raise HTTPException(status_code=400, detail="intervals must be a positive integer")

    df = simulator.run(intervals=intervals)
    return df.to_dict(orient="records")


@app.get("/simulation/day-summary")
def get_simulation_day_summary():
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
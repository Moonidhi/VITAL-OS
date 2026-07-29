"""
VITAL-OS — Department Management Engine
Manages 7 hospital departments (Clinical & Infrastructure), tracks live load metrics,
rolling energy history, equipment registries, event detection, and load allocations.
"""

import random
import sqlite3
from collections import deque
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any

_global_department_engine = None


def get_department_engine(db_url: str = "sqlite:///./vital_os.db") -> "DepartmentEngine":
    global _global_department_engine
    if _global_department_engine is None:
        _global_department_engine = DepartmentEngine(db_url=db_url)
    return _global_department_engine


DEPARTMENTS_CONFIG = [
    {
        "dept_id": "DEPT-001",
        "name": "ICU",
        "code": "ICU",
        "category": "Clinical",
        "head_doctor": "Dr. Rajesh Sharma",
        "total_beds": 28,
        "occupied_beds": 23,
        "floor": "Floor 2 — North Wing",
        "established_year": 2005,
        "contact_ext": "2401",
        "status": "Operational",
        "uptime": 99.8,
        "equipment": [
            {"name": "Ventilators", "count": 12, "watts": 150, "status": "Active"},
            {"name": "Patient Monitors", "count": 28, "watts": 45, "status": "Active"},
            {"name": "Infusion Pumps", "count": 40, "watts": 30, "status": "Active"},
            {"name": "Defibrillators", "count": 4, "watts": 100, "status": "Standby"},
            {"name": "Dialysis Machines", "count": 3, "watts": 750, "status": "Active"},
        ]
    },
    {
        "dept_id": "DEPT-002",
        "name": "Operation Theatre",
        "code": "OT",
        "category": "Clinical",
        "head_doctor": "Dr. Priya Patel",
        "total_beds": 6,
        "occupied_beds": 4,
        "floor": "Floor 3 — East Wing",
        "established_year": 2005,
        "contact_ext": "2402",
        "status": "Operational",
        "uptime": 99.9,
        "equipment": [
            {"name": "Anaesthesia Machines", "count": 6, "watts": 350, "status": "Active"},
            {"name": "Surgical Lights", "count": 12, "watts": 200, "status": "Active"},
            {"name": "Electrosurgical Units", "count": 6, "watts": 400, "status": "Active"},
            {"name": "Patient Monitors", "count": 6, "watts": 45, "status": "Active"},
            {"name": "Suction Machines", "count": 8, "watts": 90, "status": "Active"},
        ]
    },
    {
        "dept_id": "DEPT-003",
        "name": "Emergency Department",
        "code": "ED",
        "category": "Clinical",
        "head_doctor": "Dr. Vikram Gupta",
        "total_beds": 20,
        "occupied_beds": 15,
        "floor": "Ground Floor — West Entrance",
        "established_year": 2000,
        "contact_ext": "2403",
        "status": "Operational",
        "uptime": 99.7,
        "equipment": [
            {"name": "Crash Carts", "count": 4, "watts": 50, "status": "Standby"},
            {"name": "Patient Monitors", "count": 20, "watts": 45, "status": "Active"},
            {"name": "Portable Ventilators", "count": 6, "watts": 120, "status": "Active"},
            {"name": "X-Ray Units", "count": 2, "watts": 1200, "status": "Standby"},
            {"name": "ECG Machines", "count": 8, "watts": 60, "status": "Active"},
        ]
    },
    {
        "dept_id": "DEPT-004",
        "name": "Oxygen Plant",
        "code": "OP",
        "category": "Clinical",
        "head_doctor": "Dr. Sunita Reddy",
        "total_beds": 0,
        "occupied_beds": 0,
        "floor": "Basement B1 — Utility Zone",
        "established_year": 2012,
        "contact_ext": "2404",
        "status": "Operational",
        "uptime": 99.5,
        "equipment": [
            {"name": "Oxygen Concentrators", "count": 8, "watts": 300, "status": "Active"},
            {"name": "Compressors", "count": 4, "watts": 2200, "status": "Active"},
            {"name": "Storage Cylinders", "count": 20, "watts": 0, "status": "Active"},
            {"name": "Pressure Regulators", "count": 12, "watts": 15, "status": "Active"},
        ]
    },
    {
        "dept_id": "DEPT-005",
        "name": "General Ward",
        "code": "GW",
        "category": "Clinical",
        "head_doctor": "Dr. Suresh Kumar",
        "total_beds": 80,
        "occupied_beds": 65,
        "floor": "Floor 4 — South Wing",
        "established_year": 1998,
        "contact_ext": "2405",
        "status": "Operational",
        "uptime": 99.2,
        "equipment": [
            {"name": "Patient Beds", "count": 80, "watts": 10, "status": "Active"},
            {"name": "Nurse Call Systems", "count": 80, "watts": 5, "status": "Active"},
            {"name": "IV Stands", "count": 60, "watts": 0, "status": "Active"},
            {"name": "Portable Monitors", "count": 15, "watts": 30, "status": "Active"},
        ]
    },
    {
        "dept_id": "DEPT-006",
        "name": "HVAC",
        "code": "HV",
        "category": "Infrastructure",
        "head_doctor": "Eng. Amit Verma",
        "total_beds": 0,
        "occupied_beds": 0,
        "floor": "Rooftop & Mechanical Rooms",
        "established_year": 2000,
        "contact_ext": "2406",
        "status": "Operational",
        "uptime": 98.4,
        "equipment": [
            {"name": "Chillers", "count": 3, "watts": 15000, "status": "Active"},
            {"name": "AHUs", "count": 12, "watts": 1500, "status": "Active"},
            {"name": "FCUs", "count": 48, "watts": 200, "status": "Active"},
            {"name": "Cooling Towers", "count": 2, "watts": 4000, "status": "Active"},
            {"name": "Pumps", "count": 8, "watts": 2200, "status": "Active"},
        ]
    },
    {
        "dept_id": "DEPT-007",
        "name": "Lighting",
        "code": "LT",
        "category": "Infrastructure",
        "head_doctor": "Eng. Deepak Rao",
        "total_beds": 0,
        "occupied_beds": 0,
        "floor": "Facility Wide",
        "established_year": 1995,
        "contact_ext": "2407",
        "status": "Operational",
        "uptime": 98.9,
        "equipment": [
            {"name": "LED Panels", "count": 320, "watts": 40, "status": "Active"},
            {"name": "Emergency Lights", "count": 45, "watts": 15, "status": "Standby"},
            {"name": "OT Lights", "count": 18, "watts": 150, "status": "Active"},
            {"name": "UV Sanitizers", "count": 6, "watts": 100, "status": "Standby"},
        ]
    },
]


class DepartmentEngine:
    def __init__(self, db_url: str = "sqlite:///./vital_os.db"):
        global _global_department_engine
        _global_department_engine = self

        if db_url.startswith("sqlite:///"):
            self.db_path = db_url.replace("sqlite:///", "")
        else:
            self.db_path = db_url

        self._init_db()

        self.step_count = 0
        self.departments: Dict[str, Dict[str, Any]] = {}
        self.load_histories: Dict[str, deque] = {}

        self._init_departments()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dept_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dept_id TEXT,
                    dept_name TEXT,
                    timestamp TEXT,
                    event_type TEXT,
                    severity TEXT,
                    message TEXT,
                    load_kw REAL,
                    threshold_kw REAL
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dept_hourly (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    dept_id TEXT,
                    dept_name TEXT,
                    avg_load_kw REAL,
                    peak_load_kw REAL,
                    allocated_kw REAL,
                    efficiency_score REAL
                );
            """)
            conn.commit()
        finally:
            conn.close()

    def _init_departments(self):
        now = datetime.now()
        rng = random.Random(42)

        for cfg in DEPARTMENTS_CONFIG:
            did = cfg["dept_id"]
            self.load_histories[did] = deque(maxlen=96)

            maint_due = (now + timedelta(days=rng.randint(30, 120))).strftime("%Y-%m-%d")
            incidents = rng.randint(0, 3) if cfg["category"] == "Clinical" else rng.randint(0, 5)

            # Compute equipment estimated total power
            tot_equip_watts = sum(item["count"] * item["watts"] for item in cfg["equipment"])
            tot_equip_kw = round(tot_equip_watts / 1000.0, 2)

            self.departments[did] = {
                "dept_id": did,
                "name": cfg["name"],
                "code": cfg["code"],
                "category": cfg["category"],
                "head_doctor": cfg["head_doctor"],
                "total_beds": cfg["total_beds"],
                "occupied_beds": cfg["occupied_beds"],
                "floor": cfg["floor"],
                "established_year": cfg["established_year"],
                "contact_ext": cfg["contact_ext"],
                "status": cfg["status"],
                "uptime_percent": cfg["uptime"],
                "incidents_last_7d": incidents,
                "maintenance_due_date": maint_due,
                "equipment": cfg["equipment"],
                "equipment_total_power_kw": tot_equip_kw,

                # Live metrics (updated per step)
                "current_load_kw": 0.0,
                "peak_load_kw": 0.0,
                "avg_load_kw": 0.0,
                "load_trend": "stable",
                "efficiency_score": 85.0,
                "energy_rank": 1,
                "allocation_status": "Protected",
                "allocated_pct": 100.0,
                "allocated_kw": 0.0,
                "savings_kw": 0.0,
            }

            # Seed 24h rolling load history
            self._seed_department_history(did)

    def _seed_department_history(self, dept_id: str):
        dept = self.departments[dept_id]
        code = dept["code"]

        base_loads = {
            "ICU": 25.0,
            "OT": 35.0,
            "ED": 18.0,
            "OP": 12.0,
            "GW": 15.0,
            "HV": 40.0,
            "LT": 10.0,
        }
        base = base_loads.get(code, 20.0)

        for i in range(96):
            val = round(max(2.0, base + random.uniform(-4.0, 6.0)), 2)
            self.load_histories[dept_id].append(val)

        # Initial metrics from seeded history
        hist = list(self.load_histories[dept_id])
        dept["current_load_kw"] = hist[-1]
        dept["peak_load_kw"] = round(max(hist), 2)
        dept["avg_load_kw"] = round(sum(hist) / len(hist), 2)

    def _extract_load_from_snapshot(self, snapshot: Dict[str, Any], dept_name: str, code: str) -> float:
        name_key = dept_name.lower().replace(" ", "_")
        code_key = code.lower()

        keys_to_try = [
            f"load_{name_key}",
            f"load_{code_key}",
            f"load_{dept_name}",
            f"load_{code}",
        ]

        for k in keys_to_try:
            if k in snapshot:
                return float(snapshot[k])

        # Default fallback reasonable estimates if snapshot missing exact key
        defaults = {"ICU": 26.5, "OT": 38.0, "ED": 19.2, "OP": 14.0, "GW": 16.5, "HV": 42.0, "LT": 11.0}
        return defaults.get(code, 20.0)

    def simulate_step(self, snapshot_dict: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        snapshot = snapshot_dict or {}
        self.step_count += 1
        now_str = snapshot.get("timestamp") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        risk_level = snapshot.get("risk_level", "LOW")

        events = []

        # 1. Update loads and rolling history
        for did, dept in self.departments.items():
            code = dept["code"]
            curr_load = self._extract_load_from_snapshot(snapshot, dept["name"], code)
            dept["current_load_kw"] = round(curr_load, 2)

            hist = self.load_histories[did]
            hist.append(curr_load)

            # Recompute Peak & Avg over last 96 intervals
            hist_list = list(hist)
            dept["peak_load_kw"] = round(max(hist_list), 2)
            dept["avg_load_kw"] = round(sum(hist_list) / len(hist_list), 2)

            # Compute load trend (last 4 vs previous 4)
            if len(hist_list) >= 8:
                recent_avg = sum(hist_list[-4:]) / 4.0
                prev_avg = sum(hist_list[-8:-4]) / 4.0
                if recent_avg > prev_avg * 1.02:
                    dept["load_trend"] = "rising"
                elif recent_avg < prev_avg * 0.98:
                    dept["load_trend"] = "falling"
                else:
                    dept["load_trend"] = "stable"
            else:
                dept["load_trend"] = "stable"

            # Compute Efficiency Score (0-100)
            peak = dept["peak_load_kw"]
            if dept["category"] == "Clinical":
                eff = (curr_load / peak * 100.0) if peak > 0 else 85.0
            else:
                # Inverted efficiency for HVAC/Lighting (lower peak load ratio is more efficient)
                eff = 100.0 - ((curr_load / peak * 50.0) if peak > 0 else 20.0)
            dept["efficiency_score"] = round(min(100.0, max(10.0, eff)), 1)

            # Compute Allocation Status & Allocated kW based on risk_level
            if dept["category"] == "Clinical" or dept["code"] in ("ICU", "OT", "OP", "ED"):
                alloc_status = "Protected"
                alloc_pct = 100.0
            else:
                if risk_level == "HIGH":
                    alloc_status = "Limited"
                    alloc_pct = 50.0
                elif risk_level == "CRITICAL":
                    alloc_status = "Shed"
                    alloc_pct = 20.0
                elif risk_level == "MEDIUM":
                    alloc_status = "Reduced"
                    alloc_pct = 80.0
                else:
                    alloc_status = "Protected"
                    alloc_pct = 100.0

            dept["allocation_status"] = alloc_status
            dept["allocated_pct"] = alloc_pct
            dept["allocated_kw"] = round(curr_load * (alloc_pct / 100.0), 2)
            dept["savings_kw"] = round(max(0.0, curr_load - dept["allocated_kw"]), 2)

            # Detect Events
            avg = dept["avg_load_kw"]
            if avg > 0:
                # Load Spike > 1.15x avg
                if curr_load > 1.15 * avg:
                    events.append({
                        "dept_id": did,
                        "dept_name": dept["name"],
                        "timestamp": now_str,
                        "event_type": "LOAD_SPIKE",
                        "severity": "WARNING",
                        "message": f"Load spike detected in {dept['name']}: {curr_load:.1f} kW exceeds 24h average ({avg:.1f} kW).",
                        "load_kw": round(curr_load, 2),
                        "threshold_kw": round(avg * 1.15, 2),
                    })

                # Clinical Load Drop < 0.70x avg
                if curr_load < 0.70 * avg and dept["category"] == "Clinical":
                    events.append({
                        "dept_id": did,
                        "dept_name": dept["name"],
                        "timestamp": now_str,
                        "event_type": "CLINICAL_LOAD_DROP",
                        "severity": "CRITICAL",
                        "message": f"Unexpected clinical power drop in {dept['name']}: {curr_load:.1f} kW vs 24h avg ({avg:.1f} kW).",
                        "load_kw": round(curr_load, 2),
                        "threshold_kw": round(avg * 0.70, 2),
                    })

        # Re-rank Energy Ranks (1 to 7 by current_load_kw desc)
        sorted_depts = sorted(self.departments.values(), key=lambda d: d["current_load_kw"], reverse=True)
        for rank, d in enumerate(sorted_depts, start=1):
            self.departments[d["dept_id"]]["energy_rank"] = rank

        # Write events to DB
        self._write_events_to_db(events)

        # Write hourly summary snapshot every 4 steps
        if self.step_count % 4 == 0:
            self._write_hourly_summary(now_str)

        return events

    def _write_events_to_db(self, events: List[Dict[str, Any]]):
        if not events:
            return
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            for ev in events:
                cursor.execute("""
                    INSERT INTO dept_events (dept_id, dept_name, timestamp, event_type, severity, message, load_kw, threshold_kw)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    ev["dept_id"],
                    ev["dept_name"],
                    ev["timestamp"],
                    ev["event_type"],
                    ev["severity"],
                    ev["message"],
                    ev["load_kw"],
                    ev["threshold_kw"]
                ))
            conn.commit()
        finally:
            conn.close()

    def _write_hourly_summary(self, timestamp_str: str):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            for did, d in self.departments.items():
                cursor.execute("""
                    INSERT INTO dept_hourly (timestamp, dept_id, dept_name, avg_load_kw, peak_load_kw, allocated_kw, efficiency_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    timestamp_str,
                    did,
                    d["name"],
                    d["avg_load_kw"],
                    d["peak_load_kw"],
                    d["allocated_kw"],
                    d["efficiency_score"]
                ))
            conn.commit()
        finally:
            conn.close()

    # Public Interface Methods

    def get_all_departments(self) -> List[Dict[str, Any]]:
        return list(self.departments.values())

    def get_department(self, dept_id: str) -> Optional[Dict[str, Any]]:
        return self.departments.get(dept_id)

    def get_department_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        q = name.strip().lower()
        for d in self.departments.values():
            if d["name"].lower() == q or d["code"].lower() == q:
                return d
        return None

    def get_summary(self) -> Dict[str, Any]:
        all_depts = list(self.departments.values())
        tot_depts = len(all_depts)
        op_count = sum(1 for d in all_depts if d["status"] == "Operational")
        maint_count = sum(1 for d in all_depts if d["status"] == "Maintenance")
        total_beds = sum(d["total_beds"] for d in all_depts)
        occupied_beds = sum(d["occupied_beds"] for d in all_depts)
        critical_depts = sum(1 for d in all_depts if d["efficiency_score"] < 70.0 or d["load_trend"] == "rising")

        return {
            "total_departments": tot_depts,
            "operational_departments": op_count,
            "maintenance_departments": maint_count,
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "occupancy_rate_pct": round((occupied_beds / total_beds * 100.0), 1) if total_beds > 0 else 0.0,
            "critical_load_departments": critical_depts,
            "total_current_load_kw": round(sum(d["current_load_kw"] for d in all_depts), 2),
            "total_allocated_kw": round(sum(d["allocated_kw"] for d in all_depts), 2),
        }

    def get_events(self, dept_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if dept_id:
                cursor.execute("""
                    SELECT id, dept_id, dept_name, timestamp, event_type, severity, message, load_kw, threshold_kw
                    FROM dept_events
                    WHERE dept_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                """, (dept_id, limit))
            else:
                cursor.execute("""
                    SELECT id, dept_id, dept_name, timestamp, event_type, severity, message, load_kw, threshold_kw
                    FROM dept_events
                    ORDER BY id DESC
                    LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_hourly_trend(self, dept_id: Optional[str] = None, hours: int = 24) -> List[Dict[str, Any]]:
        count = min(hours * 4, 96)
        if dept_id and dept_id in self.load_histories:
            hist = list(self.load_histories[dept_id])[-count:]
            return [{"time": f"T-{len(hist)-i}", "load_kw": val} for i, val in enumerate(hist)]

        # Aggregate all departments
        result = []
        for i in range(count):
            entry = {"interval": i + 1}
            for did, d in self.departments.items():
                hist = list(self.load_histories[did])
                if i < len(hist):
                    entry[d["code"]] = hist[i]
            result.append(entry)
        return result

    def get_energy_breakdown(self) -> Dict[str, Any]:
        all_depts = list(self.departments.values())
        breakdown = []
        for d in all_depts:
            breakdown.append({
                "dept_id": d["dept_id"],
                "dept_name": d["name"],
                "code": d["code"],
                "current_load_kw": d["current_load_kw"],
                "peak_load_kw": d["peak_load_kw"],
                "allocated_kw": d["allocated_kw"],
                "savings_kw": d["savings_kw"],
            })
        return {"departments": breakdown}

    def get_efficiency_matrix(self) -> List[Dict[str, Any]]:
        return [
            {
                "dept_id": d["dept_id"],
                "name": d["name"],
                "code": d["code"],
                "category": d["category"],
                "efficiency_score": d["efficiency_score"],
                "allocation_status": d["allocation_status"],
                "load_trend": d["load_trend"],
            }
            for d in self.departments.values()
        ]


if __name__ == "__main__":
    engine = DepartmentEngine(db_url="sqlite:///./vital_os.db")
    print("=== DEPARTMENT ENGINE SMOKE TEST ===")
    print("Total Departments:", len(engine.get_all_departments()))
    print("Initial Summary:", engine.get_summary())

    print("\nRunning simulate_step() 10 times:")
    for i in range(1, 11):
        snap = {
            "timestamp": f"2026-07-29 15:{i:02d}:00",
            "load_icu": round(25.0 + random.uniform(-3, 8), 1),
            "load_operation_theatre": round(35.0 + random.uniform(-5, 12), 1),
            "load_emergency_department": round(18.0 + random.uniform(-2, 5), 1),
            "load_oxygen_plant": round(12.0 + random.uniform(-1, 3), 1),
            "load_general_ward": round(15.0 + random.uniform(-2, 4), 1),
            "load_hvac": round(40.0 + random.uniform(-8, 15), 1),
            "load_lighting": round(10.0 + random.uniform(-1, 2), 1),
            "risk_level": "MEDIUM" if i % 3 == 0 else "LOW",
        }
        evs = engine.simulate_step(snap)
        print(f"Step {i}: {len(evs)} events fired.")
        for e in evs:
            print(f"  [{e['severity']}] {e['dept_name']}: {e['message']}")

    print("\nFinal Department Breakdown:")
    for d in engine.get_all_departments():
        print(f"  {d['code']} ({d['name']}): Load={d['current_load_kw']} kW, Peak={d['peak_load_kw']} kW, Rank=#{d['energy_rank']}, Trend={d['load_trend']}")

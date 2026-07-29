"""
VITAL-OS — Patient Management Engine
Synthetic patient generator, clinical triage scorer, equipment power mapping,
and step simulation module.
"""

import random
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any

DEVICE_CATALOGUE = {
    "Ventilator": {"watts": 150, "priority": "Critical"},
    "Oxygen_Concentrator": {"watts": 300, "priority": "Critical"},
    "Cardiac_Monitor": {"watts": 45, "priority": "High"},
    "Infusion_Pump": {"watts": 30, "priority": "High"},
    "Dialysis_Machine": {"watts": 750, "priority": "Critical"},
    "Feeding_Pump": {"watts": 25, "priority": "Medium"},
    "Suction_Machine": {"watts": 90, "priority": "High"},
    "Warming_Blanket": {"watts": 200, "priority": "Medium"},
}

INDIAN_FIRST_NAMES = [
    "Aarav", "Ananya", "Rajesh", "Priya", "Sunita", "Vikram", "Meena", "Amit",
    "Rahul", "Pooja", "Suresh", "Anita", "Deepak", "Kavita", "Rohan", "Swati",
    "Arjun", "Neha", "Sanjay", "Ritu", "Vijay", "Aisha", "Karan", "Divya",
    "Manoj", "Shweta", "Alok", "Nisha", "Gaurav", "Priti", "Aditya", "Tara"
]

INDIAN_LAST_NAMES = [
    "Sharma", "Patel", "Kumar", "Verma", "Devi", "Singh", "Gupta", "Shah",
    "Joshi", "Reddy", "Nair", "Rao", "Mishra", "Malhotra", "Sen", "Kapoor",
    "Bhatia", "Agarwal", "Saxena", "Deshmukh", "Pillai", "Choudhury", "Bose", "Mehta"
]

DOCTOR_POOL = [
    "Dr. Rajesh Sharma", "Dr. Priya Patel", "Dr. Suresh Kumar",
    "Dr. Ananya Iyer", "Dr. Vikram Gupta", "Dr. Sunita Reddy",
    "Dr. Amit Verma", "Dr. Meena Joshi", "Dr. Rahul Nair",
    "Dr. Pooja Shah", "Dr. Deepak Rao", "Dr. Kavita Mishra",
    "Dr. Rohan Malhotra", "Dr. Swati Sen", "Dr. Arjun Kapoor",
    "Dr. Neha Bhatia", "Dr. Sanjay Agarwal", "Dr. Ritu Saxena"
]

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]
DEPARTMENTS = ["ICU", "Operation_Theatre", "Emergency_Department", "General_Ward", "Oxygen_Plant_Dependent"]

_global_engine_instance = None


def get_patient_engine(db_url: str = "sqlite:///./vital_os.db") -> "PatientEngine":
    global _global_engine_instance
    if _global_engine_instance is None:
        _global_engine_instance = PatientEngine(db_url=db_url)
    return _global_engine_instance


class PatientEngine:
    def __init__(self, db_url: str = "sqlite:///./vital_os.db"):
        global _global_engine_instance
        _global_engine_instance = self

        # Extract file path from sqlite URL
        if db_url.startswith("sqlite:///"):
            self.db_path = db_url.replace("sqlite:///", "")
        else:
            self.db_path = db_url

        self._init_db()

        # Seed random for deterministic patient generation
        random.seed(99)
        self.rng = random.Random(99)
        self.next_patient_number = 1
        self.patients: Dict[str, Dict[str, Any]] = {}

        self._generate_initial_patients()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT,
                    timestamp TEXT,
                    event_type TEXT,
                    from_condition TEXT,
                    to_condition TEXT,
                    department TEXT,
                    details TEXT
                );
            """)
            conn.commit()
        finally:
            conn.close()

    def _assign_devices(self, department: str, condition: str) -> List[str]:
        devices = []
        if department == "ICU":
            if condition == "Critical":
                devices.extend(["Ventilator", "Cardiac_Monitor", "Infusion_Pump"])
                if self.rng.random() < 0.70:
                    devices.append("Oxygen_Concentrator")
                if self.rng.random() < 0.20:
                    devices.append("Dialysis_Machine")
            elif condition == "Serious":
                devices.extend(["Cardiac_Monitor", "Infusion_Pump"])
                if self.rng.random() < 0.40:
                    devices.append("Ventilator")
            else:
                devices.append("Cardiac_Monitor")
                if self.rng.random() < 0.30:
                    devices.append("Infusion_Pump")
        elif department == "Operation_Theatre":
            devices.extend(["Ventilator", "Cardiac_Monitor", "Infusion_Pump", "Suction_Machine"])
            if condition == "Critical" or self.rng.random() < 0.30:
                devices.append("Warming_Blanket")
        elif department == "Emergency_Department":
            if condition == "Critical":
                devices.extend(["Ventilator", "Oxygen_Concentrator", "Cardiac_Monitor"])
                if self.rng.random() < 0.50:
                    devices.append("Infusion_Pump")
            elif condition == "Serious":
                devices.extend(["Cardiac_Monitor", "Infusion_Pump"])
                if self.rng.random() < 0.50:
                    devices.append("Oxygen_Concentrator")
            else:
                devices.append("Cardiac_Monitor")
        elif department == "General_Ward":
            if self.rng.random() < 0.40:
                devices.append("Infusion_Pump")
            if self.rng.random() < 0.25:
                devices.append("Cardiac_Monitor")
            if condition == "Serious" and self.rng.random() < 0.30:
                devices.append("Feeding_Pump")
        elif department == "Oxygen_Plant_Dependent":
            devices.append("Oxygen_Concentrator")
            if self.rng.random() < 0.60:
                devices.append("Cardiac_Monitor")
            if condition == "Critical":
                devices.append("Ventilator")
        else:
            if condition == "Critical":
                devices.extend(["Ventilator", "Cardiac_Monitor"])
            elif condition == "Serious":
                devices.append("Cardiac_Monitor")

        # Return unique list preserving order
        return list(dict.fromkeys(devices))

    def _compute_ai_score(self, condition: str, department: str, devices: List[str]) -> tuple:
        base_map = {"Critical": 70, "Serious": 40, "Stable": 15}
        base = base_map.get(condition, 15)

        dept_map = {
            "ICU": 20,
            "Operation_Theatre": 15,
            "OT": 15,
            "Emergency_Department": 12,
            "ED": 12,
            "Oxygen_Plant_Dependent": 8,
            "Oxygen_Plant": 8,
            "General_Ward": 0,
            "General": 0,
        }
        dept = dept_map.get(department, 0)
        dev_score = min(15, len(devices) * 4)
        score = float(min(100, base + dept + dev_score))

        if score >= 90:
            risk_label = "Critical/Highest Power Priority"
            energy_priority = "Critical"
            backup_status = "Protected"
        elif score >= 70:
            risk_label = "High/Protected Load"
            energy_priority = "High"
            backup_status = "Protected"
        elif score >= 40:
            risk_label = "Medium/Reduced Under Stress"
            energy_priority = "Medium"
            backup_status = "Reduced"
        else:
            risk_label = "Low/Sheddable Load"
            energy_priority = "Low"
            backup_status = "Sheddable"

        return score, risk_label, energy_priority, backup_status

    def _compute_power(self, devices: List[str], score: float, snapshot_dict: Optional[Dict] = None) -> tuple:
        allocated_watts = sum(DEVICE_CATALOGUE[d]["watts"] for d in devices if d in DEVICE_CATALOGUE)
        allocated_kw = round(allocated_watts / 1000.0, 3)

        if score >= 70:
            backup_status = "Protected"
        elif score >= 40:
            backup_status = "Reduced"
        else:
            backup_status = "Sheddable"

        if snapshot_dict:
            grid_status = snapshot_dict.get("grid_status", "NORMAL")
            solar_kw = float(snapshot_dict.get("solar_kw", 0.0))
            if grid_status == "OUTAGE":
                power_source = "Battery+Grid"
            elif solar_kw > 50.0:
                power_source = "Grid+Solar"
            else:
                power_source = "Grid"
        else:
            power_source = "Grid"

        return allocated_kw, backup_status, power_source

    def _generate_single_patient(
        self,
        dept_override: Optional[str] = None,
        cond_override: Optional[str] = None,
        snapshot_dict: Optional[Dict] = None
    ) -> Dict[str, Any]:
        pid = f"PT-{self.next_patient_number:04d}"
        self.next_patient_number += 1

        name = f"{self.rng.choice(INDIAN_FIRST_NAMES)} {self.rng.choice(INDIAN_LAST_NAMES)}"

        # Age distribution: 15% under 18, 45% 18-55, 40% over 55
        age_r = self.rng.random()
        if age_r < 0.15:
            age = self.rng.randint(1, 17)
        elif age_r < 0.60:
            age = self.rng.randint(18, 55)
        else:
            age = self.rng.randint(56, 88)

        gender = self.rng.choice(["Male", "Female"])

        if cond_override:
            condition = cond_override
        else:
            cond_r = self.rng.random()
            if cond_r < 0.55:
                condition = "Stable"
            elif cond_r < 0.85:
                condition = "Serious"
            else:
                condition = "Critical"

        if dept_override:
            department = dept_override
        else:
            # Weighted distribution for realistic department allocation
            dept_r = self.rng.random()
            if dept_r < 0.12:
                department = "ICU"
            elif dept_r < 0.22:
                department = "Operation_Theatre"
            elif dept_r < 0.32:
                department = "Emergency_Department"
            elif dept_r < 0.88:
                department = "General_Ward"
            else:
                department = "Oxygen_Plant_Dependent"

        dept_code_map = {
            "ICU": "ICU",
            "Operation_Theatre": "OT",
            "Emergency_Department": "ED",
            "General_Ward": "GW",
            "Oxygen_Plant_Dependent": "OP"
        }
        code = dept_code_map.get(department, "GEN")
        bed_num = self.rng.randint(1, 99)
        bed_number = f"BED-{code}-{bed_num:02d}"

        days_ago = self.rng.randint(1, 45)
        hours_ago = self.rng.randint(0, 23)
        admission_dt = datetime.now() - timedelta(days=days_ago, hours=hours_ago)
        admission_date = admission_dt.strftime("%Y-%m-%d %H:%M:%S")

        blood_group = self.rng.choice(BLOOD_GROUPS)
        doctor = self.rng.choice(DOCTOR_POOL)

        if department == "Operation_Theatre":
            status = self.rng.choice(["Surgery", "Recovery"])
        else:
            status = "Admitted"

        devices = self._assign_devices(department, condition)
        ai_score, risk_label, energy_priority, backup_status = self._compute_ai_score(condition, department, devices)
        allocated_kw, backup_status, power_source = self._compute_power(devices, ai_score, snapshot_dict)

        patient = {
            "patient_id": pid,
            "name": name,
            "age": age,
            "gender": gender,
            "department": department,
            "bed_number": bed_number,
            "admission_date": admission_date,
            "blood_group": blood_group,
            "doctor": doctor,
            "condition": condition,
            "status": status,
            "energy_priority": energy_priority,
            "life_support": devices,
            "ai_score": ai_score,
            "allocated_kw": allocated_kw,
            "backup_status": backup_status,
            "power_source": power_source,
            "risk_label": risk_label,
        }
        return patient

    def _generate_initial_patients(self):
        total_patients = self.rng.randint(180, 240)

        # Enforce ICU (18-28) and ED (12-20) hard constraints
        icu_count = self.rng.randint(20, 26)
        ed_count = self.rng.randint(14, 18)
        ot_count = self.rng.randint(12, 18)
        op_count = self.rng.randint(15, 22)
        gw_count = total_patients - (icu_count + ed_count + ot_count + op_count)

        dept_plan = (
            ["ICU"] * icu_count +
            ["Emergency_Department"] * ed_count +
            ["Operation_Theatre"] * ot_count +
            ["Oxygen_Plant_Dependent"] * op_count +
            ["General_Ward"] * gw_count
        )
        self.rng.shuffle(dept_plan)

        for dept in dept_plan:
            p = self._generate_single_patient(dept_override=dept)
            self.patients[p["patient_id"]] = p

        self._enforce_department_constraints()

    def _enforce_department_constraints(self, snapshot_dict: Optional[Dict] = None) -> List[Dict]:
        events = []
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        icu_patients = [p for p in self.patients.values() if p["department"] == "ICU"]
        ed_patients = [p for p in self.patients.values() if p["department"] == "Emergency_Department"]

        # ICU hard constraint: 18 - 28 patients
        if len(icu_patients) < 18:
            candidates = [p for p in self.patients.values() if p["department"] in ("Emergency_Department", "General_Ward") and p["condition"] in ("Critical", "Serious")]
            needed = 18 - len(icu_patients)
            for p in candidates[:needed]:
                old_dept = p["department"]
                p["department"] = "ICU"
                p["bed_number"] = f"BED-ICU-{self.rng.randint(1, 99):02d}"
                p["life_support"] = self._assign_devices(p["department"], p["condition"])
                p["ai_score"], p["risk_label"], p["energy_priority"], p["backup_status"] = self._compute_ai_score(p["condition"], p["department"], p["life_support"])
                p["allocated_kw"], p["backup_status"], p["power_source"] = self._compute_power(p["life_support"], p["ai_score"], snapshot_dict)
                events.append({
                    "patient_id": p["patient_id"],
                    "timestamp": now_str,
                    "event_type": "DEPARTMENT_TRANSFER",
                    "from_condition": p["condition"],
                    "to_condition": p["condition"],
                    "department": "ICU",
                    "details": f"Transferred from {old_dept} to ICU to maintain minimum capacity"
                })
        elif len(icu_patients) > 28:
            candidates = [p for p in icu_patients if p["condition"] == "Stable"]
            excess = len(icu_patients) - 28
            for p in candidates[:excess]:
                old_dept = p["department"]
                p["department"] = "General_Ward"
                p["bed_number"] = f"BED-GW-{self.rng.randint(1, 99):02d}"
                p["life_support"] = self._assign_devices(p["department"], p["condition"])
                p["ai_score"], p["risk_label"], p["energy_priority"], p["backup_status"] = self._compute_ai_score(p["condition"], p["department"], p["life_support"])
                p["allocated_kw"], p["backup_status"], p["power_source"] = self._compute_power(p["life_support"], p["ai_score"], snapshot_dict)
                events.append({
                    "patient_id": p["patient_id"],
                    "timestamp": now_str,
                    "event_type": "DEPARTMENT_TRANSFER",
                    "from_condition": p["condition"],
                    "to_condition": p["condition"],
                    "department": "General_Ward",
                    "details": f"Transferred from ICU to General Ward to maintain max capacity"
                })

        # ED hard constraint: 12 - 20 patients
        if len(ed_patients) < 12:
            candidates = [p for p in self.patients.values() if p["department"] == "General_Ward"]
            needed = 12 - len(ed_patients)
            for p in candidates[:needed]:
                old_dept = p["department"]
                p["department"] = "Emergency_Department"
                p["bed_number"] = f"BED-ED-{self.rng.randint(1, 99):02d}"
                p["life_support"] = self._assign_devices(p["department"], p["condition"])
                p["ai_score"], p["risk_label"], p["energy_priority"], p["backup_status"] = self._compute_ai_score(p["condition"], p["department"], p["life_support"])
                p["allocated_kw"], p["backup_status"], p["power_source"] = self._compute_power(p["life_support"], p["ai_score"], snapshot_dict)
                events.append({
                    "patient_id": p["patient_id"],
                    "timestamp": now_str,
                    "event_type": "DEPARTMENT_TRANSFER",
                    "from_condition": p["condition"],
                    "to_condition": p["condition"],
                    "department": "Emergency_Department",
                    "details": f"Transferred from General Ward to ED to maintain minimum capacity"
                })
        elif len(ed_patients) > 20:
            candidates = [p for p in ed_patients if p["condition"] == "Stable"]
            excess = len(ed_patients) - 20
            for p in candidates[:excess]:
                old_dept = p["department"]
                p["department"] = "General_Ward"
                p["bed_number"] = f"BED-GW-{self.rng.randint(1, 99):02d}"
                p["life_support"] = self._assign_devices(p["department"], p["condition"])
                p["ai_score"], p["risk_label"], p["energy_priority"], p["backup_status"] = self._compute_ai_score(p["condition"], p["department"], p["life_support"])
                p["allocated_kw"], p["backup_status"], p["power_source"] = self._compute_power(p["life_support"], p["ai_score"], snapshot_dict)
                events.append({
                    "patient_id": p["patient_id"],
                    "timestamp": now_str,
                    "event_type": "DEPARTMENT_TRANSFER",
                    "from_condition": p["condition"],
                    "to_condition": p["condition"],
                    "department": "General_Ward",
                    "details": f"Transferred from ED to General Ward to maintain max capacity"
                })

        return events

    def _write_events_to_db(self, events: List[Dict]):
        if not events:
            return
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            for ev in events:
                cursor.execute("""
                    INSERT INTO patient_events (patient_id, timestamp, event_type, from_condition, to_condition, department, details)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    ev["patient_id"],
                    ev["timestamp"],
                    ev["event_type"],
                    ev.get("from_condition", ""),
                    ev.get("to_condition", ""),
                    ev.get("department", ""),
                    ev.get("details", "")
                ))
            conn.commit()
        finally:
            conn.close()

    def _insert_alert_if_exists(self, patient: Dict[str, Any], timestamp_str: str):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            # Check if alerts table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alerts';")
            if cursor.fetchone():
                title = f"Critical Patient Deterioration: {patient['name']}"
                message = f"Patient {patient['name']} ({patient['patient_id']}) in {patient['department']} deteriorated to Critical condition."
                cursor.execute("""
                    INSERT INTO alerts (timestamp, severity, title, message, source, status, created_at)
                    VALUES (?, 'CRITICAL', ?, ?, 'PATIENT_TRIAGE', 'ACTIVE', CURRENT_TIMESTAMP)
                """, (timestamp_str, title, message))
                conn.commit()
        except Exception:
            pass
        finally:
            conn.close()

    def simulate_step(self, snapshot_dict: Optional[Dict] = None) -> List[Dict]:
        """
        Runs one step of simulation:
        - 2% Stable -> Serious, 1% Serious -> Critical, 3% Critical -> Serious, 4% Serious -> Stable
        - 1.5% any patient discharged (immediately replaced)
        - Enforces ICU (18-28) and ED (12-20) hard constraints
        - Recomputes score / priority / power
        - Writes all events to SQLite patient_events table
        - On Critical deterioration -> insert row into alerts table if exists
        """
        snapshot_dict = snapshot_dict or {}
        events: List[Dict] = []
        now_str = snapshot_dict.get("timestamp") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        current_pids = list(self.patients.keys())
        for pid in current_pids:
            if pid not in self.patients:
                continue
            patient = self.patients[pid]
            old_cond = patient["condition"]
            old_dept = patient["department"]

            # 1. Discharge probability 1.5%
            if self.rng.random() < 0.015:
                events.append({
                    "patient_id": pid,
                    "timestamp": now_str,
                    "event_type": "DISCHARGE",
                    "from_condition": old_cond,
                    "to_condition": "Discharged",
                    "department": old_dept,
                    "details": f"Patient {patient['name']} discharged and replaced"
                })
                # Immediately replace with new patient
                new_p = self._generate_single_patient(dept_override=old_dept, snapshot_dict=snapshot_dict)
                self.patients[pid] = new_p
                continue

            # 2. Condition transitions
            new_cond = old_cond
            r = self.rng.random()
            if old_cond == "Stable":
                if r < 0.02:
                    new_cond = "Serious"
            elif old_cond == "Serious":
                if r < 0.01:
                    new_cond = "Critical"
                elif r < 0.05:  # 0.01 + 0.04
                    new_cond = "Stable"
            elif old_cond == "Critical":
                if r < 0.03:
                    new_cond = "Serious"

            if new_cond != old_cond:
                patient["condition"] = new_cond
                events.append({
                    "patient_id": pid,
                    "timestamp": now_str,
                    "event_type": "CONDITION_CHANGE",
                    "from_condition": old_cond,
                    "to_condition": new_cond,
                    "department": patient["department"],
                    "details": f"Condition transitioned from {old_cond} to {new_cond}"
                })

                if new_cond == "Critical" and old_cond in ("Stable", "Serious"):
                    self._insert_alert_if_exists(patient, now_str)

            # Recompute device, score & power for updated patient
            patient["life_support"] = self._assign_devices(patient["department"], patient["condition"])
            patient["ai_score"], patient["risk_label"], patient["energy_priority"], patient["backup_status"] = self._compute_ai_score(
                patient["condition"], patient["department"], patient["life_support"]
            )
            patient["allocated_kw"], patient["backup_status"], patient["power_source"] = self._compute_power(
                patient["life_support"], patient["ai_score"], snapshot_dict
            )

        # Enforce department hard constraints
        constraint_events = self._enforce_department_constraints(snapshot_dict)
        events.extend(constraint_events)

        # Write events to DB
        self._write_events_to_db(events)
        return events

    def get_all_patients(self) -> List[Dict[str, Any]]:
        # Update power_source on read if needed and return list
        return list(self.patients.values())

    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        return self.patients.get(patient_id)

    def get_summary(self) -> Dict[str, Any]:
        all_pts = list(self.patients.values())
        total_active = len(all_pts)
        icu_count = sum(1 for p in all_pts if p["department"] == "ICU")
        emergency_count = sum(1 for p in all_pts if p["department"] == "Emergency_Department")
        general_ward_count = sum(1 for p in all_pts if p["department"] == "General_Ward")
        in_surgery_count = sum(1 for p in all_pts if p["status"] == "Surgery" or p["department"] == "Operation_Theatre")
        life_support_count = sum(1 for p in all_pts if len(p.get("life_support", [])) > 0)

        critical_count = sum(1 for p in all_pts if p["condition"] == "Critical")
        serious_count = sum(1 for p in all_pts if p["condition"] == "Serious")
        stable_count = sum(1 for p in all_pts if p["condition"] == "Stable")

        return {
            "total_active": total_active,
            "icu_count": icu_count,
            "emergency_count": emergency_count,
            "general_ward_count": general_ward_count,
            "in_surgery_count": in_surgery_count,
            "life_support_count": life_support_count,
            "critical_count": critical_count,
            "serious_count": serious_count,
            "stable_count": stable_count,
        }

    def get_department_stats(self) -> Dict[str, Any]:
        all_pts = list(self.patients.values())

        dept_counts = {
            "ICU": 0,
            "Operation_Theatre": 0,
            "Emergency_Department": 0,
            "General_Ward": 0,
            "Oxygen_Plant_Dependent": 0,
        }
        cond_counts = {"Critical": 0, "Serious": 0, "Stable": 0}
        priority_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}

        for p in all_pts:
            d = p.get("department", "General_Ward")
            if d in dept_counts:
                dept_counts[d] += 1
            c = p.get("condition", "Stable")
            if c in cond_counts:
                cond_counts[c] += 1
            pr = p.get("energy_priority", "Low")
            if pr in priority_counts:
                priority_counts[pr] += 1

        return {
            "departments": [{"name": k, "count": v} for k, v in dept_counts.items()],
            "conditions": [{"name": k, "count": v} for k, v in cond_counts.items()],
            "energy_priorities": [{"name": k, "count": v} for k, v in priority_counts.items()],
        }

    def get_energy_summary(self) -> Dict[str, Any]:
        all_pts = list(self.patients.values())
        tier_kw = {"Critical": 0.0, "High": 0.0, "Medium": 0.0, "Low": 0.0}
        tier_pts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}

        for p in all_pts:
            tier = p.get("energy_priority", "Low")
            kw = float(p.get("allocated_kw", 0.0))
            if tier in tier_kw:
                tier_kw[tier] += kw
                tier_pts[tier] += 1

        total_kw = sum(tier_kw.values())

        return {
            "total_allocated_kw": round(total_kw, 3),
            "critical_kw": round(tier_kw["Critical"], 3),
            "high_kw": round(tier_kw["High"], 3),
            "medium_kw": round(tier_kw["Medium"], 3),
            "low_kw": round(tier_kw["Low"], 3),
            "by_tier": {
                tier: {
                    "kw": round(tier_kw[tier], 3),
                    "patients": tier_pts[tier],
                }
                for tier in ["Critical", "High", "Medium", "Low"]
            }
        }

    def get_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, patient_id, timestamp, event_type, from_condition, to_condition, department, details
                FROM patient_events
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()


if __name__ == "__main__":
    engine = PatientEngine(db_url="sqlite:///./vital_os.db")
    print("=== PATIENT ENGINE SMOKE TEST ===")
    summary = engine.get_summary()
    print("Initial Summary:", summary)
    print("Total Patients:", len(engine.get_all_patients()))

    print("\nRunning simulate_step() 5 times:")
    for i in range(1, 6):
        events = engine.simulate_step({"timestamp": f"2026-07-29 15:0{i}:00", "grid_status": "NORMAL", "solar_kw": 60.0})
        print(f"Step {i} generated {len(events)} events.")

    recent_events = engine.get_events(limit=10)
    print(f"\nRecent Events (last {len(recent_events)}):")
    for ev in recent_events:
        print(f"  [{ev['timestamp']}] {ev['patient_id']} - {ev['event_type']} ({ev['from_condition']} -> {ev['to_condition']})")

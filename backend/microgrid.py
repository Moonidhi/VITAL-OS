"""
VITAL-OS — Microgrid Management Engine
Manages 12 physical microgrid assets, computes live telemetry metrics,
tracks rolling energy history, logs events, and calculates carbon/financial savings.
"""

import random
import sqlite3
from collections import deque
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any

_global_microgrid_engine = None


def get_microgrid_engine(db_url: str = "sqlite:///./vital_os.db") -> "MicrogridEngine":
    global _global_microgrid_engine
    if _global_microgrid_engine is None:
        _global_microgrid_engine = MicrogridEngine(db_url=db_url)
    return _global_microgrid_engine


INITIAL_ASSETS = [
    {
        "asset_id": "ASSET-001",
        "name": "Solar Array Alpha",
        "type": "solar",
        "capacity_kw": 75.0,
        "location": "Rooftop Block A",
        "installed_year": 2020,
        "manufacturer": "SunPower",
        "model_number": "SPR-MAX3-400",
        "status": "Online",
        "last_maintenance_days_ago": 45,
        "next_maintenance_days": 45,
        "base_health": 98.5,
    },
    {
        "asset_id": "ASSET-002",
        "name": "Solar Array Beta",
        "type": "solar",
        "capacity_kw": 75.0,
        "location": "Rooftop Block B",
        "installed_year": 2021,
        "manufacturer": "Canadian Solar",
        "model_number": "CS6K-300MS",
        "status": "Online",
        "last_maintenance_days_ago": 60,
        "next_maintenance_days": 30,
        "base_health": 97.0,
    },
    {
        "asset_id": "ASSET-003",
        "name": "Wind Turbine 1",
        "type": "wind",
        "capacity_kw": 30.0,
        "location": "North Perimeter",
        "installed_year": 2019,
        "manufacturer": "Vestas",
        "model_number": "V15-30kW",
        "status": "Online",
        "last_maintenance_days_ago": 30,
        "next_maintenance_days": 60,
        "base_health": 95.5,
    },
    {
        "asset_id": "ASSET-004",
        "name": "Wind Turbine 2",
        "type": "wind",
        "capacity_kw": 30.0,
        "location": "South Perimeter",
        "installed_year": 2019,
        "manufacturer": "Vestas",
        "model_number": "V15-30kW",
        "status": "Online",
        "last_maintenance_days_ago": 90,
        "next_maintenance_days": 15,
        "base_health": 94.0,
    },
    {
        "asset_id": "ASSET-005",
        "name": "Battery Bank A",
        "type": "battery",
        "capacity_kw": 200.0,
        "location": "Basement B1",
        "installed_year": 2022,
        "manufacturer": "Tesla Energy",
        "model_number": "Megapack-200",
        "status": "Online",
        "last_maintenance_days_ago": 20,
        "next_maintenance_days": 70,
        "base_health": 99.0,
    },
    {
        "asset_id": "ASSET-006",
        "name": "Battery Bank B",
        "type": "battery",
        "capacity_kw": 200.0,
        "location": "Basement B2",
        "installed_year": 2022,
        "manufacturer": "Tesla Energy",
        "model_number": "Megapack-200",
        "status": "Online",
        "last_maintenance_days_ago": 25,
        "next_maintenance_days": 65,
        "base_health": 98.8,
    },
    {
        "asset_id": "ASSET-007",
        "name": "Main Grid Tie",
        "type": "grid",
        "capacity_kw": 500.0,
        "location": "Substation",
        "installed_year": 2018,
        "manufacturer": "Siemens",
        "model_number": "3WL-GridTie-500",
        "status": "Online",
        "last_maintenance_days_ago": 100,
        "next_maintenance_days": 10,
        "base_health": 96.2,
    },
    {
        "asset_id": "ASSET-008",
        "name": "Inverter Array A",
        "type": "inverter",
        "capacity_kw": 100.0,
        "location": "Electrical Room A",
        "installed_year": 2020,
        "manufacturer": "SMA Solar",
        "model_number": "SunnyBoy-100",
        "status": "Online",
        "last_maintenance_days_ago": 15,
        "next_maintenance_days": 75,
        "base_health": 97.8,
    },
    {
        "asset_id": "ASSET-009",
        "name": "Inverter Array B",
        "type": "inverter",
        "capacity_kw": 100.0,
        "location": "Electrical Room B",
        "installed_year": 2021,
        "manufacturer": "ABB",
        "model_number": "PVS-100-TL",
        "status": "Online",
        "last_maintenance_days_ago": 40,
        "next_maintenance_days": 50,
        "base_health": 96.5,
    },
    {
        "asset_id": "ASSET-010",
        "name": "Step-up Transformer",
        "type": "transformer",
        "capacity_kw": 500.0,
        "location": "Substation",
        "installed_year": 2018,
        "manufacturer": "Schneider Electric",
        "model_number": "Trihal-500kVA",
        "status": "Online",
        "last_maintenance_days_ago": 110,
        "next_maintenance_days": 20,
        "base_health": 95.0,
    },
    {
        "asset_id": "ASSET-011",
        "name": "Energy Meter Main",
        "type": "meter",
        "capacity_kw": 0.0,
        "location": "Main Switchboard",
        "installed_year": 2020,
        "manufacturer": "Schneider Electric",
        "model_number": "PM8000",
        "status": "Online",
        "last_maintenance_days_ago": 150,
        "next_maintenance_days": 30,
        "base_health": 99.5,
    },
    {
        "asset_id": "ASSET-012",
        "name": "Energy Meter Solar",
        "type": "meter",
        "capacity_kw": 0.0,
        "location": "Solar Combiner Box",
        "installed_year": 2020,
        "manufacturer": "Janitza",
        "model_number": "UMG96RM",
        "status": "Online",
        "last_maintenance_days_ago": 140,
        "next_maintenance_days": 40,
        "base_health": 99.2,
    },
]


class MicrogridEngine:
    def __init__(self, db_url: str = "sqlite:///./vital_os.db"):
        global _global_microgrid_engine
        _global_microgrid_engine = self

        if db_url.startswith("sqlite:///"):
            self.db_path = db_url.replace("sqlite:///", "")
        else:
            self.db_path = db_url

        self._init_db()

        self.step_count = 0
        self.operating_hours = 0.0
        self.prev_solar_kw = None
        self.prev_grid_status = "NORMAL"
        self.deficit_counter = 0

        # System Rolling Deques
        self.history_15min = deque(maxlen=96)
        self.history_hourly = deque(maxlen=168)

        # Asset State Store
        self.assets: Dict[str, Dict[str, Any]] = {}
        self._init_assets()

        # System Metrics Store
        self.system_metrics: Dict[str, Any] = {
            "total_solar_kw": 0.0,
            "total_wind_kw": 0.0,
            "total_generation_kw": 0.0,
            "total_load_kw": 0.0,
            "battery_soc_percent": 85.0,
            "battery_action": "idle",
            "battery_power_kw": 0.0,
            "battery_health_pct": 98.5,
            "battery_cycle_count": 412,
            "grid_status": "NORMAL",
            "grid_import_kw": 0.0,
            "grid_export_kw": 0.0,
            "net_balance_kw": 0.0,
            "renewable_fraction_pct": 0.0,
            "self_sufficiency_pct": 0.0,
            "daily_generation_kwh": 0.0,
            "carbon_saved_kg": 0.0,
            "cost_saved_inr": 0.0,
            "peak_solar_today_kw": 0.0,
            "peak_wind_today_kw": 0.0,
            "cloud_state": "Clear",
            "season": "Summer",
        }

        # Initialize with synthetic initial snapshot step
        self._seed_initial_history()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS microgrid_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    asset_id TEXT,
                    asset_name TEXT,
                    event_type TEXT,
                    severity TEXT,
                    message TEXT,
                    value REAL,
                    threshold REAL,
                    acknowledged INTEGER DEFAULT 0
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS microgrid_hourly (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    solar_kw REAL,
                    wind_kw REAL,
                    total_gen_kw REAL,
                    total_load_kw REAL,
                    battery_soc REAL,
                    grid_import_kw REAL,
                    grid_export_kw REAL,
                    renewable_fraction REAL,
                    net_balance_kw REAL,
                    cost_saved_inr REAL,
                    carbon_saved_kg REAL
                );
            """)
            conn.commit()
        finally:
            conn.close()

    def _init_assets(self):
        now = datetime.now()
        for meta in INITIAL_ASSETS:
            aid = meta["asset_id"]
            last_maint_date = (now - timedelta(days=meta["last_maintenance_days_ago"])).strftime("%Y-%m-%d")
            next_maint_date = (now + timedelta(days=meta["next_maintenance_days"])).strftime("%Y-%m-%d")

            self.assets[aid] = {
                "asset_id": aid,
                "name": meta["name"],
                "type": meta["type"],
                "capacity_kw": meta["capacity_kw"],
                "location": meta["location"],
                "installed_year": meta["installed_year"],
                "manufacturer": meta["manufacturer"],
                "model_number": meta["model_number"],
                "status": meta["status"],
                "last_maintenance": last_maint_date,
                "next_maintenance": next_maint_date,
                "health_score": meta["base_health"],
                # Live dynamic fields
                "current_output_kw": 0.0,
                "output_percent": 0.0,
                "daily_generation_kwh": 0.0,
                "efficiency_percent": 96.0,
                "temperature_c": 35.0,
                "alert_count": 0,
            }

    def _seed_initial_history(self):
        now = datetime.now()
        for i in range(96, 0, -1):
            ts = (now - timedelta(minutes=15 * i)).strftime("%H:%M")
            mock_solar = max(0.0, 120.0 * float(random.uniform(0.6, 1.0))) if 6 <= (i % 24) <= 18 else 0.0
            mock_wind = round(random.uniform(5.0, 25.0), 1)
            mock_gen = mock_solar + mock_wind
            mock_load = round(random.uniform(80.0, 140.0), 1)
            self.history_15min.append({
                "time": ts,
                "solar_kw": mock_solar,
                "wind_kw": mock_wind,
                "total_gen_kw": mock_gen,
                "total_load_kw": mock_load,
                "battery_soc": round(random.uniform(50.0, 90.0), 1),
                "grid_import_kw": max(0.0, mock_load - mock_gen),
                "grid_export_kw": max(0.0, mock_gen - mock_load),
                "net_balance_kw": mock_gen - mock_load,
            })

    def _update_asset_metrics(self, snapshot: Dict[str, Any]):
        solar_kw = float(snapshot.get("solar_kw", 0.0))
        wind_kw = float(snapshot.get("wind_kw", 0.0))
        total_gen_kw = float(snapshot.get("total_generation_kw", solar_kw + wind_kw))
        total_load_kw = float(snapshot.get("total_load_kw", 100.0))
        battery_power_kw = float(snapshot.get("battery_power_kw", 0.0))
        grid_import_kw = float(snapshot.get("grid_import_kw", 0.0))
        grid_export_kw = float(snapshot.get("grid_export_kw", 0.0))

        # Hourly degradation step
        self.operating_hours += 0.25

        for aid, asset in self.assets.items():
            atype = asset["type"]
            cap = asset["capacity_kw"]

            # Compute output kW
            if aid == "ASSET-001":  # Solar Alpha
                out_kw = round(solar_kw * 0.5, 2)
            elif aid == "ASSET-002":  # Solar Beta
                out_kw = round(solar_kw * 0.5, 2)
            elif aid == "ASSET-003":  # Wind 1
                out_kw = round(wind_kw * 0.5, 2)
            elif aid == "ASSET-004":  # Wind 2
                out_kw = round(wind_kw * 0.5, 2)
            elif aid == "ASSET-005":  # Battery A
                out_kw = round(abs(battery_power_kw) * 0.5, 2)
            elif aid == "ASSET-006":  # Battery B
                out_kw = round(abs(battery_power_kw) * 0.5, 2)
            elif aid == "ASSET-007":  # Main Grid Tie
                out_kw = round(abs(grid_import_kw - grid_export_kw), 2)
            elif aid == "ASSET-008":  # Inverter A
                out_kw = round(total_gen_kw * 0.5 * 0.96, 2)
            elif aid == "ASSET-009":  # Inverter B
                out_kw = round(total_gen_kw * 0.5 * 0.96, 2)
            elif aid == "ASSET-010":  # Step-up Transformer
                out_kw = round(total_load_kw * 0.99, 2)
            elif aid == "ASSET-011":  # Energy Meter Main
                out_kw = round(total_load_kw, 2)
            elif aid == "ASSET-012":  # Energy Meter Solar
                out_kw = round(solar_kw, 2)
            else:
                out_kw = 0.0

            asset["current_output_kw"] = out_kw
            out_pct = round((out_kw / cap * 100.0), 1) if cap > 0 else 0.0
            asset["output_percent"] = min(100.0, max(0.0, out_pct))

            # Accumulate daily generation kWh
            if out_kw > 0:
                asset["daily_generation_kwh"] = round(asset["daily_generation_kwh"] + (out_kw / 4.0), 2)

            # Efficiency
            if atype == "inverter":
                asset["efficiency_percent"] = round(96.5 + random.uniform(-0.5, 0.5), 1)
            elif atype == "transformer":
                asset["efficiency_percent"] = 99.0
            elif atype == "meter":
                asset["efficiency_percent"] = 99.8
            elif atype == "grid":
                asset["efficiency_percent"] = 98.5
            else:
                asset["efficiency_percent"] = round(min(100.0, 94.0 + (asset["output_percent"] * 0.05)), 1)

            # Temperature
            if atype in ("solar", "inverter"):
                temp = 35.0 + (asset["output_percent"] / 100.0) * 20.0 + random.gauss(0, 1.5)
            elif atype == "battery":
                temp = 25.0 + (abs(battery_power_kw) / 100.0) * 15.0 + random.gauss(0, 1.0)
            elif atype == "wind":
                temp = 28.0 + random.gauss(0, 2.0)
            else:
                temp = 30.0 + (asset["output_percent"] / 100.0) * 12.0 + random.gauss(0, 1.0)
            asset["temperature_c"] = round(min(80.0, max(20.0, temp)), 1)

            # Health degradation: 0.001 per hour
            degrade = 0.00025  # per 15-min interval
            asset["health_score"] = round(max(50.0, asset["health_score"] - degrade), 2)

            # Alert count query
            asset["alert_count"] = self._get_unacknowledged_asset_alerts(aid)

    def _get_unacknowledged_asset_alerts(self, asset_id: str) -> int:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM microgrid_events WHERE asset_id = ? AND acknowledged = 0",
                (asset_id,)
            )
            res = cursor.fetchone()
            return res[0] if res else 0
        except Exception:
            return 0
        finally:
            conn.close()

    def simulate_step(self, snapshot_dict: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        snapshot = snapshot_dict or {}
        self.step_count += 1
        now_str = snapshot.get("timestamp") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        solar_kw = float(snapshot.get("solar_kw", 0.0))
        wind_kw = float(snapshot.get("wind_kw", 0.0))
        tot_gen = float(snapshot.get("total_generation_kw", solar_kw + wind_kw))
        tot_load = float(snapshot.get("total_load_kw", 100.0))
        soc = float(snapshot.get("battery_soc_percent", 85.0))
        bat_action = snapshot.get("battery_action", "idle")
        bat_power = float(snapshot.get("battery_power_kw", 0.0))
        grid_status = snapshot.get("grid_status", "NORMAL")
        grid_import = float(snapshot.get("grid_import_kw", 0.0))
        grid_export = float(snapshot.get("grid_export_kw", 0.0))
        net_bal = float(snapshot.get("net_balance_kw", tot_gen - tot_load))

        # Update System Metrics
        ren_frac = min(100.0, max(0.0, (tot_gen / tot_load * 100.0))) if tot_load > 0 else 100.0
        self_suff = min(100.0, max(0.0, ((tot_load - grid_import) / tot_load * 100.0))) if tot_load > 0 else 100.0

        current_daily_gen = self.system_metrics["daily_generation_kwh"] + (tot_gen / 4.0)
        carbon_saved = round(current_daily_gen * 0.82, 2)
        cost_saved = round(current_daily_gen * 8.0, 2)

        self.system_metrics.update({
            "total_solar_kw": round(solar_kw, 2),
            "total_wind_kw": round(wind_kw, 2),
            "total_generation_kw": round(tot_gen, 2),
            "total_load_kw": round(tot_load, 2),
            "battery_soc_percent": round(soc, 1),
            "battery_action": bat_action,
            "battery_power_kw": round(bat_power, 2),
            "battery_health_pct": float(snapshot.get("battery_health_pct", 98.5)),
            "battery_cycle_count": int(snapshot.get("battery_cycle_count", 412)),
            "grid_status": grid_status,
            "grid_import_kw": round(grid_import, 2),
            "grid_export_kw": round(grid_export, 2),
            "net_balance_kw": round(net_bal, 2),
            "renewable_fraction_pct": round(ren_frac, 1),
            "self_sufficiency_pct": round(self_suff, 1),
            "daily_generation_kwh": round(current_daily_gen, 2),
            "carbon_saved_kg": carbon_saved,
            "cost_saved_inr": cost_saved,
            "peak_solar_today_kw": round(max(self.system_metrics["peak_solar_today_kw"], solar_kw), 2),
            "peak_wind_today_kw": round(max(self.system_metrics["peak_wind_today_kw"], wind_kw), 2),
            "cloud_state": snapshot.get("cloud_state", "Clear"),
            "season": snapshot.get("season", "Summer"),
        })

        # Update per-asset live metrics
        self._update_asset_metrics(snapshot)

        # Update rolling 15min history
        time_label = datetime.now().strftime("%H:%M")
        self.history_15min.append({
            "time": time_label,
            "solar_kw": solar_kw,
            "wind_kw": wind_kw,
            "total_gen_kw": tot_gen,
            "total_load_kw": tot_load,
            "battery_soc": soc,
            "grid_import_kw": grid_import,
            "grid_export_kw": grid_export,
            "net_balance_kw": net_bal,
        })

        # Event Detection Engine
        events = []

        # 1. Solar output drop > 30%
        if self.prev_solar_kw is not None and self.prev_solar_kw > 15.0:
            drop_pct = (self.prev_solar_kw - solar_kw) / self.prev_solar_kw * 100.0
            if drop_pct > 30.0:
                events.append({
                    "timestamp": now_str,
                    "asset_id": "ASSET-001",
                    "asset_name": "Solar Array Alpha",
                    "event_type": "SOLAR_DROP",
                    "severity": "WARNING",
                    "message": f"Solar generation drop of {drop_pct:.1f}% detected in single interval.",
                    "value": round(solar_kw, 2),
                    "threshold": round(self.prev_solar_kw * 0.7, 2),
                })
        self.prev_solar_kw = solar_kw

        # 2. Battery SOC thresholds
        if soc < 20.0:
            events.append({
                "timestamp": now_str,
                "asset_id": "ASSET-005",
                "asset_name": "Battery Bank A",
                "event_type": "BATTERY_CRITICAL",
                "severity": "CRITICAL",
                "message": f"Battery State of Charge is critically low at {soc:.1f}%.",
                "value": round(soc, 1),
                "threshold": 20.0,
            })
        elif soc > 95.0:
            events.append({
                "timestamp": now_str,
                "asset_id": "ASSET-005",
                "asset_name": "Battery Bank A",
                "event_type": "BATTERY_FULL",
                "severity": "INFO",
                "message": f"Battery Bank is fully charged at {soc:.1f}%.",
                "value": round(soc, 1),
                "threshold": 95.0,
            })

        # 3. Grid status transitions
        if grid_status != self.prev_grid_status:
            if grid_status == "OUTAGE":
                events.append({
                    "timestamp": now_str,
                    "asset_id": "ASSET-007",
                    "asset_name": "Main Grid Tie",
                    "event_type": "GRID_OUTAGE",
                    "severity": "CRITICAL",
                    "message": "Main Utility Grid outage detected. Microgrid island mode activated.",
                    "value": 0.0,
                    "threshold": 1.0,
                })
            elif self.prev_grid_status == "OUTAGE" and grid_status in ("NORMAL", "RESTORED"):
                events.append({
                    "timestamp": now_str,
                    "asset_id": "ASSET-007",
                    "asset_name": "Main Grid Tie",
                    "event_type": "GRID_RESTORED",
                    "severity": "INFO",
                    "message": "Main Utility Grid power restored. Re-synchronizing microgrid to grid tie.",
                    "value": 1.0,
                    "threshold": 1.0,
                })
        self.prev_grid_status = grid_status

        # 4. High renewable coverage
        if ren_frac >= 80.0:
            events.append({
                "timestamp": now_str,
                "asset_id": "ASSET-011",
                "asset_name": "Energy Meter Main",
                "event_type": "HIGH_RENEWABLE",
                "severity": "INFO",
                "message": f"High renewable energy coverage achieved: {ren_frac:.1f}% of hospital load.",
                "value": round(ren_frac, 1),
                "threshold": 80.0,
            })

        # 5. Sustained deficit (4 steps)
        if net_bal < 0:
            self.deficit_counter += 1
            if self.deficit_counter == 4:
                events.append({
                    "timestamp": now_str,
                    "asset_id": "ASSET-011",
                    "asset_name": "Energy Meter Main",
                    "event_type": "SUSTAINED_DEFICIT",
                    "severity": "WARNING",
                    "message": "Sustained microgrid generation deficit for 4 consecutive intervals.",
                    "value": round(net_bal, 2),
                    "threshold": 0.0,
                })
        else:
            self.deficit_counter = 0

        # 6. Asset Over-temperature warnings
        for aid, asset in self.assets.items():
            t = asset["temperature_c"]
            limit = 65.0 if asset["type"] in ("solar", "inverter") else 45.0 if asset["type"] == "battery" else 60.0
            if t > limit:
                events.append({
                    "timestamp": now_str,
                    "asset_id": aid,
                    "asset_name": asset["name"],
                    "event_type": "HIGH_TEMPERATURE",
                    "severity": "WARNING",
                    "message": f"{asset['name']} operating above normal temperature threshold ({t:.1f}°C > {limit}°C).",
                    "value": round(t, 1),
                    "threshold": limit,
                })

        # Write events to DB
        self._write_events_to_db(events)

        # Write hourly summary every 4 steps
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
                    INSERT INTO microgrid_events (timestamp, asset_id, asset_name, event_type, severity, message, value, threshold, acknowledged)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    ev["timestamp"],
                    ev["asset_id"],
                    ev["asset_name"],
                    ev["event_type"],
                    ev["severity"],
                    ev["message"],
                    ev["value"],
                    ev["threshold"]
                ))

                # Insert CRITICAL events into main alerts table if exists
                if ev["severity"] == "CRITICAL":
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alerts';")
                    if cursor.fetchone():
                        cursor.execute("""
                            INSERT INTO alerts (timestamp, severity, title, message, source, status, created_at)
                            VALUES (?, 'CRITICAL', ?, ?, 'MICROGRID', 'ACTIVE', CURRENT_TIMESTAMP)
                        """, (ev["timestamp"], f"Microgrid Fault: {ev['asset_name']}", ev["message"]))

            conn.commit()
        finally:
            conn.close()

    def _write_hourly_summary(self, timestamp_str: str):
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            m = self.system_metrics
            cursor.execute("""
                INSERT INTO microgrid_hourly (
                    timestamp, solar_kw, wind_kw, total_gen_kw, total_load_kw,
                    battery_soc, grid_import_kw, grid_export_kw, renewable_fraction,
                    net_balance_kw, cost_saved_inr, carbon_saved_kg
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                timestamp_str,
                m["total_solar_kw"],
                m["total_wind_kw"],
                m["total_generation_kw"],
                m["total_load_kw"],
                m["battery_soc_percent"],
                m["grid_import_kw"],
                m["grid_export_kw"],
                m["renewable_fraction_pct"],
                m["net_balance_kw"],
                m["cost_saved_inr"],
                m["carbon_saved_kg"]
            ))
            conn.commit()

            # Append to hourly deque
            self.history_hourly.append({
                "timestamp": timestamp_str,
                "solar_kw": m["total_solar_kw"],
                "wind_kw": m["total_wind_kw"],
                "total_gen_kw": m["total_generation_kw"],
                "total_load_kw": m["total_load_kw"],
                "battery_soc": m["battery_soc_percent"],
                "grid_import_kw": m["grid_import_kw"],
                "grid_export_kw": m["grid_export_kw"],
                "renewable_fraction": m["renewable_fraction_pct"],
                "net_balance_kw": m["net_balance_kw"],
                "cost_saved_inr": m["cost_saved_inr"],
                "carbon_saved_kg": m["carbon_saved_kg"],
            })
        finally:
            conn.close()

    # Public Interface Methods

    def get_all_assets(self) -> List[Dict[str, Any]]:
        return list(self.assets.values())

    def get_asset(self, asset_id: str) -> Optional[Dict[str, Any]]:
        return self.assets.get(asset_id)

    def get_system_status(self) -> Dict[str, Any]:
        return self.system_metrics

    def get_summary(self) -> Dict[str, Any]:
        assets_list = list(self.assets.values())
        online_count = sum(1 for a in assets_list if a["status"] == "Online")
        degraded_count = sum(1 for a in assets_list if a["status"] == "Degraded")
        offline_count = sum(1 for a in assets_list if a["status"] == "Offline")

        m = self.system_metrics
        return {
            "total_assets": len(assets_list),
            "online_assets": online_count,
            "degraded_assets": degraded_count,
            "offline_assets": offline_count,
            "total_generation_kw": m["total_generation_kw"],
            "total_solar_kw": m["total_solar_kw"],
            "total_wind_kw": m["total_wind_kw"],
            "total_load_kw": m["total_load_kw"],
            "net_balance_kw": m["net_balance_kw"],
            "battery_soc_percent": m["battery_soc_percent"],
            "renewable_fraction_pct": m["renewable_fraction_pct"],
            "self_sufficiency_pct": m["self_sufficiency_pct"],
            "cost_saved_today_inr": m["cost_saved_inr"],
            "carbon_saved_today_kg": m["carbon_saved_kg"],
        }

    def get_events(self, severity: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if severity:
                cursor.execute("""
                    SELECT id, timestamp, asset_id, asset_name, event_type, severity, message, value, threshold, acknowledged
                    FROM microgrid_events
                    WHERE severity = ?
                    ORDER BY id DESC
                    LIMIT ?
                """, (severity.upper(), limit))
            else:
                cursor.execute("""
                    SELECT id, timestamp, asset_id, asset_name, event_type, severity, message, value, threshold, acknowledged
                    FROM microgrid_events
                    ORDER BY id DESC
                    LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_hourly_trend(self, hours: int = 24) -> List[Dict[str, Any]]:
        return list(self.history_15min)[-hours:]

    def get_weekly_trend(self) -> List[Dict[str, Any]]:
        # Aggregate 7 daily summaries
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly = []
        for i, day in enumerate(days):
            gen = round(120.0 + (i * 12.0) + random.uniform(-10, 15), 1)
            load = round(110.0 + (i * 8.0) + random.uniform(-5, 10), 1)
            grid = max(0.0, round(load - gen + random.uniform(5, 15), 1))
            weekly.append({
                "day": day,
                "generation_kwh": gen,
                "load_kwh": load,
                "grid_import_kwh": grid,
            })
        return weekly

    def get_generation_breakdown(self) -> Dict[str, Any]:
        m = self.system_metrics
        solar = m["total_solar_kw"]
        wind = m["total_wind_kw"]
        grid = max(0.0, m["grid_import_kw"])
        tot = solar + wind + grid
        if tot == 0:
            tot = 1.0

        return {
            "solar_kw": solar,
            "wind_kw": wind,
            "grid_import_kw": grid,
            "solar_pct": round((solar / tot) * 100.0, 1),
            "wind_pct": round((wind / tot) * 100.0, 1),
            "grid_pct": round((grid / tot) * 100.0, 1),
            "total_today_kwh": m["daily_generation_kwh"],
        }

    def get_power_flow(self) -> Dict[str, Any]:
        m = self.system_metrics
        solar_a = round(m["total_solar_kw"] * 0.5, 2)
        solar_b = round(m["total_solar_kw"] * 0.5, 2)
        wind_1 = round(m["total_wind_kw"] * 0.5, 2)
        wind_2 = round(m["total_wind_kw"] * 0.5, 2)
        inv_a = round((solar_a + wind_1) * 0.96, 2)
        inv_b = round((solar_b + wind_2) * 0.96, 2)

        return {
            "nodes": [
                {"id": "solar_a", "label": "Solar Array A", "kw": solar_a, "type": "solar"},
                {"id": "solar_b", "label": "Solar Array B", "kw": solar_b, "type": "solar"},
                {"id": "wind_1", "label": "Wind Turbine 1", "kw": wind_1, "type": "wind"},
                {"id": "wind_2", "label": "Wind Turbine 2", "kw": wind_2, "type": "wind"},
                {"id": "inv_a", "label": "Inverter Array A", "kw": inv_a, "type": "inverter"},
                {"id": "inv_b", "label": "Inverter Array B", "kw": inv_b, "type": "inverter"},
                {"id": "bus", "label": "Main AC Bus", "kw": m["total_generation_kw"], "type": "bus"},
                {"id": "battery", "label": "BESS Storage", "kw": m["battery_power_kw"], "soc": m["battery_soc_percent"], "type": "battery"},
                {"id": "grid", "label": "Main Grid Tie", "kw": m["grid_import_kw"] if m["grid_import_kw"] > 0 else -m["grid_export_kw"], "status": m["grid_status"], "type": "grid"},
                {"id": "hospital", "label": "Hospital Clinical Load", "kw": m["total_load_kw"], "type": "load"},
            ],
            "edges": [
                {"from": "solar_a", "to": "inv_a", "kw": solar_a},
                {"from": "wind_1", "to": "inv_a", "kw": wind_1},
                {"from": "solar_b", "to": "inv_b", "kw": solar_b},
                {"from": "wind_2", "to": "inv_b", "kw": wind_2},
                {"from": "inv_a", "to": "bus", "kw": inv_a},
                {"from": "inv_b", "to": "bus", "kw": inv_b},
                {"from": "bus", "to": "hospital", "kw": m["total_load_kw"]},
                {"from": "bus", "to": "battery", "kw": m["battery_power_kw"]},
                {"from": "grid", "to": "bus", "kw": m["grid_import_kw"]},
            ]
        }

    def get_carbon_savings(self) -> Dict[str, Any]:
        m = self.system_metrics
        today_co2 = m["carbon_saved_kg"]
        today_inr = m["cost_saved_inr"]
        week_co2 = round(today_co2 * 6.5, 2)
        week_inr = round(today_inr * 6.8, 2)
        month_inr = round(today_inr * 28.5, 2)
        trees = round(today_co2 / 21.7, 1)  # 1 tree absorbs ~21.7 kg CO2/year
        cars = round(today_co2 / 12.0, 1)   # avg car emits ~12 kg CO2/day

        return {
            "today_co2_kg": today_co2,
            "today_inr": today_inr,
            "week_co2_kg": week_co2,
            "week_inr": week_inr,
            "month_inr_projected": month_inr,
            "equivalent_trees": trees,
            "equivalent_car_days": cars,
        }

    def acknowledge_event(self, event_id: int) -> bool:
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE microgrid_events SET acknowledged = 1 WHERE id = ?", (event_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()


if __name__ == "__main__":
    engine = MicrogridEngine(db_url="sqlite:///./vital_os.db")
    print("=== MICROGRID ENGINE SMOKE TEST ===")
    print("Asset Count:", len(engine.get_all_assets()))
    print("Initial Summary:", engine.get_summary())

    print("\nRunning simulate_step() 20 times:")
    for i in range(1, 21):
        # Vary solar from 0 to 150 kW
        solar_val = max(0.0, 150.0 * (1.0 if 5 <= i <= 15 else 0.2))
        snap = {
            "timestamp": f"2026-07-29 15:{i:02d}:00",
            "solar_kw": solar_val,
            "wind_kw": round(random.uniform(10, 30), 2),
            "total_generation_kw": solar_val + 20.0,
            "total_load_kw": 110.0,
            "battery_soc_percent": round(80.0 - i * 0.5, 1),
            "grid_status": "OUTAGE" if i == 12 else "NORMAL",
            "grid_import_kw": 0.0 if i == 12 else 15.0,
            "grid_export_kw": 0.0,
        }
        evs = engine.simulate_step(snap)
        if evs:
            print(f"  Step {i} generated {len(evs)} events:")
            for e in evs:
                print(f"    [{e['severity']}] {e['asset_name']}: {e['message']}")

    print("\nFinal System Status:", engine.get_system_status())
    print("\nCarbon & Savings Summary:", engine.get_carbon_savings())

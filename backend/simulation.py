"""
VITAL-OS — Renewable Energy Simulation Engine
Milestone 5: Realistic Synthetic Data Engine.

Models solar generation, wind generation, battery storage system,
hospital department power loads, grid status, and equipment failure events
advancing in 15-minute timesteps driven by dataset_manager profiles.
"""

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict

import numpy as np
import pandas as pd

from dataset_manager import get_dataset_manager


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INTERVAL_MINUTES = 15
INTERVALS_PER_DAY = (24 * 60) // INTERVAL_MINUTES  # 96


# ---------------------------------------------------------------------------
# Solar Power Model (Data-Driven)
# ---------------------------------------------------------------------------

class SolarArray:
    """
    Models a rooftop solar PV array driven by historical solar irradiance datasets (GHI W/m²).
    Captures sunrise/sunset, cloud cover, and seasonal daylight shifts naturally.
    """

    def __init__(
        self,
        peak_capacity_kw: float = 150.0,
    ):
        self.peak_capacity_kw = peak_capacity_kw

    def generate(self, timestamp: datetime, solar_inverter_mult: float = 1.0) -> float:
        """Return solar output in kW for the given timestamp using local irradiance data."""
        solar_info = get_dataset_manager().get_solar_irradiance(timestamp)
        ghi = solar_info["ghi_w_m2"]

        if ghi <= 0.0:
            return 0.0

        # Convert GHI (W/m², where 1000 W/m² = STC peak rating) to power output (kW)
        # Apply random sensor jitter + inverter health multiplier
        sensor_noise = random.uniform(0.97, 1.03)
        output_kw = (ghi / 1000.0) * self.peak_capacity_kw * solar_inverter_mult * sensor_noise

        return round(max(0.0, output_kw), 2)


# ---------------------------------------------------------------------------
# Wind Power Model
# ---------------------------------------------------------------------------

class WindTurbine:
    """
    Models a hospital-site wind turbine with a mean-reverting wind speed random walk
    and cubic power curve.
    """

    def __init__(
        self,
        rated_capacity_kw: float = 60.0,
        cut_in_speed: float = 3.0,    # m/s
        rated_speed: float = 12.0,    # m/s
        cut_out_speed: float = 25.0,  # m/s
        baseline_wind_speed: float = 7.0,
    ):
        self.rated_capacity_kw = rated_capacity_kw
        self.cut_in_speed = cut_in_speed
        self.rated_speed = rated_speed
        self.cut_out_speed = cut_out_speed
        self.baseline_wind_speed = baseline_wind_speed
        self._wind_speed = baseline_wind_speed

    def _step_wind_speed(self, hour_of_day: float):
        diurnal_bias = 1.5 * math.sin((hour_of_day - 6) / 24 * 2 * math.pi)
        target = self.baseline_wind_speed + diurnal_bias
        reversion = (target - self._wind_speed) * 0.15
        gust = random.gauss(0, 1.0)
        self._wind_speed = max(0.0, self._wind_speed + reversion + gust)

    def _power_curve(self, speed: float) -> float:
        if speed < self.cut_in_speed or speed >= self.cut_out_speed:
            return 0.0
        if speed >= self.rated_speed:
            return self.rated_capacity_kw
        fraction = ((speed - self.cut_in_speed) / (self.rated_speed - self.cut_in_speed)) ** 3
        return self.rated_capacity_kw * fraction

    def generate(self, timestamp: datetime, wind_mult: float = 1.0) -> float:
        hour_of_day = timestamp.hour + timestamp.minute / 60.0
        self._step_wind_speed(hour_of_day)
        output_kw = self._power_curve(self._wind_speed) * wind_mult
        return round(max(0.0, output_kw), 2)

    @property
    def current_wind_speed(self) -> float:
        return round(self._wind_speed, 2)


# ---------------------------------------------------------------------------
# Battery Storage System
# ---------------------------------------------------------------------------

class BatterySystem:
    """
    Models a Lithium-ion BESS with round-trip efficiency and SoC management.
    """

    def __init__(
        self,
        capacity_kwh: float = 300.0,
        max_power_kw: float = 75.0,
        initial_soc_percent: float = 50.0,
        min_soc_percent: float = 10.0,
        max_soc_percent: float = 95.0,
        charge_efficiency: float = 0.95,
        discharge_efficiency: float = 0.95,
    ):
        self.capacity_kwh = capacity_kwh
        self.max_power_kw = max_power_kw
        self.min_soc_percent = min_soc_percent
        self.max_soc_percent = max_soc_percent
        self.charge_efficiency = charge_efficiency
        self.discharge_efficiency = discharge_efficiency

        self.soc_kwh = (initial_soc_percent / 100.0) * capacity_kwh
        self.soc_kwh = max(self.min_kwh, min(self.max_kwh, self.soc_kwh))

    @property
    def min_kwh(self) -> float:
        return (self.min_soc_percent / 100.0) * self.capacity_kwh

    @property
    def max_kwh(self) -> float:
        return (self.max_soc_percent / 100.0) * self.capacity_kwh

    @property
    def soc_percent(self) -> float:
        return round((self.soc_kwh / self.capacity_kwh) * 100.0, 2)

    def step(self, net_surplus_kw: float, power_limit_mult: float = 1.0) -> dict:
        effective_max_power = self.max_power_kw * power_limit_mult
        max_energy_per_interval_kwh = effective_max_power * (INTERVAL_MINUTES / 60.0)
        result = {"action": "idle", "power_kw": 0.0, "soc_percent": self.soc_percent, "grid_import_kw": 0.0, "grid_export_kw": 0.0}

        if net_surplus_kw > 0:
            room_kwh = self.max_kwh - self.soc_kwh
            if room_kwh <= 0.001:
                result["grid_export_kw"] = round(net_surplus_kw, 2)
                return result

            max_charge_from_power_kwh = max_energy_per_interval_kwh * self.charge_efficiency
            energy_to_store_kwh = min(room_kwh, max_charge_from_power_kwh)
            ac_power_used_kw = energy_to_store_kwh / (self.charge_efficiency * (INTERVAL_MINUTES / 60.0))
            ac_power_used_kw = min(net_surplus_kw, ac_power_used_kw)

            actual_stored_kwh = ac_power_used_kw * self.charge_efficiency * (INTERVAL_MINUTES / 60.0)
            self.soc_kwh = min(self.max_kwh, self.soc_kwh + actual_stored_kwh)
            unused_surplus_kw = net_surplus_kw - ac_power_used_kw

            result.update({
                "action": "charging",
                "power_kw": round(ac_power_used_kw, 2),
                "soc_percent": round(self.soc_percent, 2),
                "grid_export_kw": round(max(0.0, unused_surplus_kw), 2),
            })
        elif net_surplus_kw < 0:
            shortfall_kw = abs(net_surplus_kw)
            available_kwh = self.soc_kwh - self.min_kwh
            if available_kwh <= 0.001:
                result["grid_import_kw"] = round(shortfall_kw, 2)
                return result

            max_dc_discharge_kwh = max_energy_per_interval_kwh
            ac_energy_needed_kwh = shortfall_kw * (INTERVAL_MINUTES / 60.0)
            dc_energy_needed_kwh = ac_energy_needed_kwh / self.discharge_efficiency

            dc_energy_drawn_kwh = min(available_kwh, max_dc_discharge_kwh, dc_energy_needed_kwh)
            self.soc_kwh = max(self.min_kwh, self.soc_kwh - dc_energy_drawn_kwh)

            ac_power_delivered_kw = (dc_energy_drawn_kwh * self.discharge_efficiency) / (INTERVAL_MINUTES / 60.0)
            unmet_shortfall_kw = shortfall_kw - ac_power_delivered_kw

            result.update({
                "action": "discharging" if ac_power_delivered_kw > 0 else "idle",
                "power_kw": round(ac_power_delivered_kw, 2),
                "soc_percent": round(self.soc_percent, 2),
                "grid_import_kw": round(max(0.0, unmet_shortfall_kw), 2),
            })

        return result


# ---------------------------------------------------------------------------
# Hospital Load Model (Data-Driven)
# ---------------------------------------------------------------------------

class HospitalLoad:
    """
    Models department-level hospital electricity consumption driven by local
    DOE-aligned hospital profiles and department weighting factors.
    """

    DEPARTMENTS = [
        "ICU",
        "Operation_Theatre",
        "Emergency_Department",
        "Oxygen_Plant",
        "General_Ward",
        "HVAC",
        "Lighting",
    ]

    def __init__(self):
        self._base_profiles = {
            "ICU": dict(base_kw=45.0, variation_kw=5.0, noise_kw=1.0),
            "Operation_Theatre": dict(base_kw=35.0, variation_kw=20.0, noise_kw=1.5),
            "Emergency_Department": dict(base_kw=30.0, variation_kw=12.0, noise_kw=1.5),
            "Oxygen_Plant": dict(base_kw=25.0, variation_kw=3.0, noise_kw=0.8),
            "General_Ward": dict(base_kw=20.0, variation_kw=8.0, noise_kw=1.0),
            "HVAC": dict(base_kw=40.0, variation_kw=25.0, noise_kw=2.0),
            "Lighting": dict(base_kw=10.0, variation_kw=12.0, noise_kw=0.8),
        }

    def step(self, timestamp: datetime, failure_adjustments: Optional[dict] = None) -> dict:
        """Return current kW draw per department and total for timestamp."""
        load_info = get_dataset_manager().get_hospital_load_profile(timestamp)
        mult = load_info["load_multiplier"]
        hvac_f = load_info["hvac_factor"]
        ot_f = load_info["ot_factor"]
        ed_f = load_info["ed_factor"]
        icu_f = load_info["icu_factor"]

        adjustments = failure_adjustments or {}
        loads = {}

        for dept, profile in self._base_profiles.items():
            base = profile["base_kw"]
            var = profile["variation_kw"]
            noise = random.gauss(0, profile["noise_kw"])

            if dept == "HVAC":
                dept_load = (base + var * hvac_f) * mult + noise
            elif dept == "Operation_Theatre":
                dept_load = (base + var * ot_f) * mult + noise
            elif dept == "Emergency_Department":
                dept_load = (base + var * ed_f) * mult + noise
            elif dept == "ICU":
                dept_load = (base * icu_f) + (var * 0.3) + noise
            else:
                dept_load = (base + var * 0.5) * mult + noise

            # Add equipment failure load adjustment if active
            if dept in adjustments:
                dept_load += adjustments[dept]

            loads[dept] = round(max(0.0, dept_load), 2)

        loads["Total"] = round(sum(loads.values()), 2)
        return loads


# ---------------------------------------------------------------------------
# Grid Status Model
# ---------------------------------------------------------------------------

class GridStatus:
    """Models utility grid connection status: NORMAL, OUTAGE, RESTORED."""

    NORMAL = "NORMAL"
    OUTAGE = "OUTAGE"
    RESTORED = "RESTORED"

    def __init__(
        self,
        outage_probability_per_interval: float = 0.003,
        min_outage_intervals: int = 2,
        max_outage_intervals: int = 16,
    ):
        self.status = self.NORMAL
        self.outage_probability_per_interval = outage_probability_per_interval
        self.min_outage_intervals = min_outage_intervals
        self.max_outage_intervals = max_outage_intervals
        self._intervals_remaining_in_outage = 0
        self._was_in_outage_last_step = False

    def step(self) -> str:
        if self.status == self.OUTAGE:
            self._intervals_remaining_in_outage -= 1
            self._was_in_outage_last_step = True
            if self._intervals_remaining_in_outage <= 0:
                self.status = self.RESTORED
            return self.status

        if self._was_in_outage_last_step:
            self.status = self.NORMAL
            self._was_in_outage_last_step = False
            return self.status

        if random.random() < self.outage_probability_per_interval:
            self.status = self.OUTAGE
            self._intervals_remaining_in_outage = random.randint(
                self.min_outage_intervals, self.max_outage_intervals
            )
            return self.status

        self.status = self.NORMAL
        return self.status


# ---------------------------------------------------------------------------
# Equipment Failure Events Engine
# ---------------------------------------------------------------------------

class EquipmentFailureEngine:
    """
    Models operational events (Chiller Failure, Oxygen Concentrator Failure,
    HVAC Overload, Solar Inverter Failure, Battery Thermal Throttling,
    Wind Turbine Maintenance, Emergency Surgery Surge).
    """

    def __init__(self, failure_probability_per_interval: float = 0.004):
        self.failure_probability = failure_probability_per_interval
        self.active_events: Dict[str, int] = {}

    def step(self) -> dict:
        # Decrement remaining intervals for active events
        to_remove = []
        for name in list(self.active_events.keys()):
            self.active_events[name] -= 1
            if self.active_events[name] <= 0:
                to_remove.append(name)
        for name in to_remove:
            del self.active_events[name]

        # Trigger new events
        if random.random() < self.failure_probability:
            events_pool = [
                ("Chiller Failure", 16),
                ("Oxygen Concentrator Failure", 12),
                ("HVAC Overload", 8),
                ("Solar Inverter Failure", 24),
                ("Battery Thermal Throttling", 16),
                ("Wind Turbine Maintenance", 24),
                ("Emergency Surgery Surge", 8),
            ]
            chosen_name, duration = random.choice(events_pool)
            if chosen_name not in self.active_events:
                self.active_events[chosen_name] = duration

        # Compute impacts
        solar_mult = 0.2 if "Solar Inverter Failure" in self.active_events else 1.0
        wind_mult = 0.0 if "Wind Turbine Maintenance" in self.active_events else 1.0
        battery_power_mult = 0.5 if "Battery Thermal Throttling" in self.active_events else 1.0

        dept_adjustments = {}
        if "Chiller Failure" in self.active_events or "HVAC Overload" in self.active_events:
            dept_adjustments["HVAC"] = dept_adjustments.get("HVAC", 0.0) + 35.0
        if "Oxygen Concentrator Failure" in self.active_events:
            dept_adjustments["Oxygen_Plant"] = dept_adjustments.get("Oxygen_Plant", 0.0) + 15.0
        if "Emergency Surgery Surge" in self.active_events:
            dept_adjustments["Operation_Theatre"] = dept_adjustments.get("Operation_Theatre", 0.0) + 25.0
            dept_adjustments["ICU"] = dept_adjustments.get("ICU", 0.0) + 15.0

        return {
            "active_events": list(self.active_events.keys()),
            "solar_mult": solar_mult,
            "wind_mult": wind_mult,
            "battery_power_mult": battery_power_mult,
            "dept_adjustments": dept_adjustments,
        }


# ---------------------------------------------------------------------------
# Microgrid Simulator
# ---------------------------------------------------------------------------

@dataclass
class SimulationSnapshot:
    """One 15-minute timestep's full simulation state."""
    timestamp: datetime
    solar_kw: float
    wind_kw: float
    wind_speed_ms: float
    total_generation_kw: float
    department_loads: dict
    total_load_kw: float
    battery_soc_percent: float
    battery_action: str
    battery_power_kw: float
    grid_status: str
    grid_import_kw: float
    grid_export_kw: float
    season: str = "Summer"
    active_events: list = field(default_factory=list)
    net_balance_kw: float = field(init=False)

    def __post_init__(self):
        self.net_balance_kw = round(self.total_generation_kw - self.total_load_kw, 2)

    def to_dict(self) -> dict:
        d = {
            "timestamp": self.timestamp.isoformat(),
            "solar_kw": self.solar_kw,
            "wind_kw": self.wind_kw,
            "wind_speed_ms": self.wind_speed_ms,
            "total_generation_kw": self.total_generation_kw,
            "total_load_kw": self.total_load_kw,
            "battery_soc_percent": self.battery_soc_percent,
            "battery_action": self.battery_action,
            "battery_power_kw": self.battery_power_kw,
            "grid_status": self.grid_status,
            "grid_import_kw": self.grid_import_kw,
            "grid_export_kw": self.grid_export_kw,
            "net_balance_kw": self.net_balance_kw,
            "season": self.season,
            "active_events": self.active_events,
        }
        d.update({f"load_{k}": v for k, v in self.department_loads.items()})
        return d


class MicrogridSimulator:
    """
    Top-level data-driven simulator orchestrating solar, wind, battery, load,
    grid, and equipment failure events.
    """

    def __init__(
        self,
        start_time: Optional[datetime] = None,
        solar: Optional[SolarArray] = None,
        wind: Optional[WindTurbine] = None,
        battery: Optional[BatterySystem] = None,
        load: Optional[HospitalLoad] = None,
        grid: Optional[GridStatus] = None,
        random_seed: Optional[int] = None,
    ):
        if random_seed is not None:
            random.seed(random_seed)
            np.random.seed(random_seed)

        self.current_time = start_time or datetime.now().replace(
            minute=(datetime.now().minute // 15) * 15, second=0, microsecond=0
        )

        self.solar = solar or SolarArray()
        self.wind = wind or WindTurbine()
        self.battery = battery or BatterySystem()
        self.load = load or HospitalLoad()
        self.grid = grid or GridStatus()
        self.equipment_engine = EquipmentFailureEngine()

        self.history: List[SimulationSnapshot] = []

    def step(self) -> SimulationSnapshot:
        """Advance simulation by one 15-minute interval and return snapshot."""
        # 1. Failure events engine
        failure_info = self.equipment_engine.step()

        # 2. Solar & Wind generation
        solar_kw = self.solar.generate(self.current_time, failure_info["solar_mult"])
        wind_kw = self.wind.generate(self.current_time, failure_info["wind_mult"])
        total_generation_kw = round(solar_kw + wind_kw, 2)

        # 3. Hospital loads
        dept_loads = self.load.step(self.current_time, failure_info["dept_adjustments"])
        total_load_kw = dept_loads["Total"]

        # 4. Grid status
        grid_status = self.grid.step()

        # 5. Battery storage management
        net_surplus_kw = total_generation_kw - total_load_kw
        battery_result = self.battery.step(net_surplus_kw, failure_info["battery_power_mult"])

        # 6. Grid import / export
        if grid_status == GridStatus.OUTAGE:
            grid_import_kw = 0.0
            grid_export_kw = 0.0
        else:
            grid_import_kw = battery_result["grid_import_kw"]
            grid_export_kw = battery_result["grid_export_kw"]

        # Determine season info
        solar_info = get_dataset_manager().get_solar_irradiance(self.current_time)
        season = solar_info.get("season", "Summer")

        snapshot = SimulationSnapshot(
            timestamp=self.current_time,
            solar_kw=solar_kw,
            wind_kw=wind_kw,
            wind_speed_ms=self.wind.current_wind_speed,
            total_generation_kw=total_generation_kw,
            department_loads={k: v for k, v in dept_loads.items() if k != "Total"},
            total_load_kw=total_load_kw,
            battery_soc_percent=battery_result["soc_percent"],
            battery_action=battery_result["action"],
            battery_power_kw=battery_result["power_kw"],
            grid_status=grid_status,
            grid_import_kw=grid_import_kw,
            grid_export_kw=grid_export_kw,
            season=season,
            active_events=failure_info["active_events"],
        )

        self.history.append(snapshot)
        self.current_time += timedelta(minutes=INTERVAL_MINUTES)
        return snapshot

    def run(self, intervals: int = INTERVALS_PER_DAY) -> pd.DataFrame:
        """Run the simulation forward `intervals` steps and return results as a DataFrame."""
        for _ in range(intervals):
            self.step()
        return self.history_to_dataframe()

    def history_to_dataframe(self) -> pd.DataFrame:
        if not self.history:
            return pd.DataFrame()
        return pd.DataFrame([s.to_dict() for s in self.history])

    def reset_history(self):
        self.history = []
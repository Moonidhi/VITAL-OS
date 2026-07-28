"""
VITAL-OS — Renewable Energy Simulation Engine
Milestone 2: Hospital microgrid simulator.

Models solar generation, wind generation, a battery storage system,
department-level hospital load, and grid status — advancing in
15-minute timesteps. Pure simulation logic, no FastAPI/DB coupling.

Dependencies: numpy, pandas, datetime, random, math
"""

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INTERVAL_MINUTES = 15
INTERVALS_PER_DAY = (24 * 60) // INTERVAL_MINUTES  # 96


# ---------------------------------------------------------------------------
# Solar Power Model
# ---------------------------------------------------------------------------

class SolarArray:
    """
    Models a rooftop solar PV array.

    Output follows a bell-shaped curve between sunrise and sunset
    (zero at night), modulated by random cloud cover events that
    cause realistic dips and recoveries rather than pure noise.
    """

    def __init__(
        self,
        peak_capacity_kw: float = 150.0,
        sunrise_hour: float = 6.0,
        sunset_hour: float = 18.5,
    ):
        self.peak_capacity_kw = peak_capacity_kw
        self.sunrise_hour = sunrise_hour
        self.sunset_hour = sunset_hour

        # Cloud cover is a slowly-varying value in [0, 1] (0 = clear, 1 = fully overcast).
        # We evolve it with a random walk so cover doesn't jump erratically
        # between consecutive 15-min steps.
        self._cloud_cover = random.uniform(0.0, 0.3)

    def _daylight_fraction(self, hour_of_day: float) -> float:
        """Bell-shaped output curve across the daylight window, 0 outside it."""
        if hour_of_day <= self.sunrise_hour or hour_of_day >= self.sunset_hour:
            return 0.0
        day_length = self.sunset_hour - self.sunrise_hour
        # Map daylight window to 0..pi so sin() gives a smooth rise/peak/fall
        x = (hour_of_day - self.sunrise_hour) / day_length * math.pi
        return math.sin(x)  # 0 at edges, 1 at solar noon

    def _step_cloud_cover(self):
        """Evolve cloud cover with a bounded random walk (realistic drift)."""
        drift = random.uniform(-0.08, 0.08)
        self._cloud_cover = min(1.0, max(0.0, self._cloud_cover + drift))
        # Occasionally a cloud bank rolls in/out abruptly
        if random.random() < 0.05:
            self._cloud_cover = min(1.0, max(0.0, self._cloud_cover + random.uniform(-0.4, 0.4)))

    def generate(self, timestamp: datetime) -> float:
        """Return solar output in kW for the given timestamp."""
        self._step_cloud_cover()

        hour_of_day = timestamp.hour + timestamp.minute / 60.0
        base_fraction = self._daylight_fraction(hour_of_day)

        if base_fraction <= 0.0:
            return 0.0

        # Cloud cover attenuates output; clouds never fully zero out diffuse light.
        cloud_attenuation = 1.0 - (self._cloud_cover * 0.75)

        # Small instantaneous sensor noise on top of the smooth curve
        noise = random.uniform(0.97, 1.03)

        output_kw = self.peak_capacity_kw * base_fraction * cloud_attenuation * noise
        return round(max(0.0, output_kw), 2)


# ---------------------------------------------------------------------------
# Wind Power Model
# ---------------------------------------------------------------------------

class WindTurbine:
    """
    Models a small hospital-site wind turbine.

    Wind speed is simulated as a mean-reverting random walk (so gusts
    settle back toward a baseline), then converted to power output via
    a simplified turbine power curve: cubic ramp-up between cut-in and
    rated speed, flat rated output, cutout above safety threshold.
    """

    def __init__(
        self,
        rated_capacity_kw: float = 60.0,
        cut_in_speed: float = 3.0,   # m/s, below this: no generation
        rated_speed: float = 12.0,   # m/s, at/above this: full rated output
        cut_out_speed: float = 25.0,  # m/s, above this: turbine shuts down for safety
        baseline_wind_speed: float = 7.0,
    ):
        self.rated_capacity_kw = rated_capacity_kw
        self.cut_in_speed = cut_in_speed
        self.rated_speed = rated_speed
        self.cut_out_speed = cut_out_speed
        self.baseline_wind_speed = baseline_wind_speed
        self._wind_speed = baseline_wind_speed

    def _step_wind_speed(self, hour_of_day: float):
        """Mean-reverting random walk with a mild diurnal pattern (windier afternoons)."""
        diurnal_bias = 1.5 * math.sin((hour_of_day - 6) / 24 * 2 * math.pi)
        target = self.baseline_wind_speed + diurnal_bias

        reversion = (target - self._wind_speed) * 0.15
        gust = random.gauss(0, 1.0)  # gaussian gust noise

        self._wind_speed = max(0.0, self._wind_speed + reversion + gust)

    def _power_curve(self, speed: float) -> float:
        if speed < self.cut_in_speed or speed >= self.cut_out_speed:
            return 0.0
        if speed >= self.rated_speed:
            return self.rated_capacity_kw
        # Cubic ramp between cut-in and rated speed (typical turbine power curve shape)
        fraction = ((speed - self.cut_in_speed) / (self.rated_speed - self.cut_in_speed)) ** 3
        return self.rated_capacity_kw * fraction

    def generate(self, timestamp: datetime) -> float:
        """Return wind output in kW for the given timestamp."""
        hour_of_day = timestamp.hour + timestamp.minute / 60.0
        self._step_wind_speed(hour_of_day)
        output_kw = self._power_curve(self._wind_speed)
        return round(max(0.0, output_kw), 2)

    @property
    def current_wind_speed(self) -> float:
        return round(self._wind_speed, 2)


# ---------------------------------------------------------------------------
# Battery Storage System
# ---------------------------------------------------------------------------

class BatterySystem:
    """
    Models a hospital battery energy storage system (BESS).

    Tracks state of charge (SOC %) and charges from surplus renewable
    generation or discharges to cover shortfalls, respecting capacity
    limits, max charge/discharge power, and round-trip efficiency.
    """

    def __init__(
        self,
        capacity_kwh: float = 400.0,
        initial_soc_percent: float = 60.0,
        max_charge_kw: float = 100.0,
        max_discharge_kw: float = 100.0,
        round_trip_efficiency: float = 0.92,
        min_soc_percent: float = 10.0,   # reserve floor, protects battery health
        max_soc_percent: float = 100.0,
    ):
        self.capacity_kwh = capacity_kwh
        self.soc_percent = initial_soc_percent
        self.max_charge_kw = max_charge_kw
        self.max_discharge_kw = max_discharge_kw
        self.round_trip_efficiency = round_trip_efficiency
        self.min_soc_percent = min_soc_percent
        self.max_soc_percent = max_soc_percent

    @property
    def energy_stored_kwh(self) -> float:
        return self.capacity_kwh * (self.soc_percent / 100.0)

    def _interval_hours(self) -> float:
        return INTERVAL_MINUTES / 60.0

    def step(self, net_surplus_kw: float) -> dict:
        """
        Apply one simulation interval's worth of charge/discharge.

        net_surplus_kw > 0  -> excess renewable generation available to charge battery
        net_surplus_kw < 0  -> generation shortfall, battery discharges to help cover it

        Returns a dict describing what the battery actually did, since
        physical limits (capacity, power rating, reserve floor) may mean
        the battery can't fully absorb/cover the requested amount. The
        leftover (uncharged surplus or unmet shortfall) is the caller's
        responsibility to route to/from the grid.
        """
        hours = self._interval_hours()
        result = {
            "action": "idle",
            "power_kw": 0.0,
            "soc_percent": self.soc_percent,
            "grid_export_kw": 0.0,     # surplus that couldn't be stored
            "grid_import_kw": 0.0,     # shortfall the battery couldn't cover
        }

        if net_surplus_kw > 0:
            # Charging: limited by charger power rating and remaining headroom
            charge_power_kw = min(net_surplus_kw, self.max_charge_kw)
            headroom_kwh = (self.max_soc_percent - self.soc_percent) / 100.0 * self.capacity_kwh
            max_chargeable_kw = headroom_kwh / hours if hours > 0 else 0.0
            actual_charge_kw = min(charge_power_kw, max_chargeable_kw)

            # Efficiency loss happens going into storage
            energy_into_battery_kwh = actual_charge_kw * hours * math.sqrt(self.round_trip_efficiency)
            self.soc_percent += (energy_into_battery_kwh / self.capacity_kwh) * 100.0
            self.soc_percent = min(self.max_soc_percent, self.soc_percent)

            leftover_surplus_kw = max(0.0, net_surplus_kw - actual_charge_kw)

            result.update({
                "action": "charging" if actual_charge_kw > 0 else "idle",
                "power_kw": round(actual_charge_kw, 2),
                "soc_percent": round(self.soc_percent, 2),
                "grid_export_kw": round(leftover_surplus_kw, 2),
            })

        elif net_surplus_kw < 0:
            shortfall_kw = -net_surplus_kw
            discharge_power_kw = min(shortfall_kw, self.max_discharge_kw)
            available_kwh = (self.soc_percent - self.min_soc_percent) / 100.0 * self.capacity_kwh
            max_dischargeable_kw = max(0.0, available_kwh / hours) if hours > 0 else 0.0
            actual_discharge_kw = min(discharge_power_kw, max_dischargeable_kw)

            # Efficiency loss happens coming out of storage
            energy_drawn_from_battery_kwh = actual_discharge_kw * hours / math.sqrt(self.round_trip_efficiency)
            self.soc_percent -= (energy_drawn_from_battery_kwh / self.capacity_kwh) * 100.0
            self.soc_percent = max(self.min_soc_percent, self.soc_percent)

            unmet_shortfall_kw = max(0.0, shortfall_kw - actual_discharge_kw)

            result.update({
                "action": "discharging" if actual_discharge_kw > 0 else "idle",
                "power_kw": round(actual_discharge_kw, 2),
                "soc_percent": round(self.soc_percent, 2),
                "grid_import_kw": round(unmet_shortfall_kw, 2),
            })

        return result


# ---------------------------------------------------------------------------
# Hospital Load Model
# ---------------------------------------------------------------------------

class HospitalLoad:
    """
    Models power consumption (kW) across hospital departments.

    Each department has a base load plus a realistic daily pattern and
    random fluctuation. Critical departments (ICU, OT, ED, Oxygen Plant)
    stay relatively stable (life-safety loads run near-constant), while
    General Ward, HVAC, and Lighting vary more with time of day.
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
        # (base_kw, daily_variation_kw, noise_kw) per department
        self._profiles = {
            "ICU": dict(base_kw=45.0, variation_kw=5.0, noise_kw=1.5),
            "Operation_Theatre": dict(base_kw=35.0, variation_kw=15.0, noise_kw=2.0),
            "Emergency_Department": dict(base_kw=30.0, variation_kw=10.0, noise_kw=2.0),
            "Oxygen_Plant": dict(base_kw=25.0, variation_kw=3.0, noise_kw=1.0),
            "General_Ward": dict(base_kw=20.0, variation_kw=8.0, noise_kw=1.5),
            "HVAC": dict(base_kw=40.0, variation_kw=20.0, noise_kw=3.0),
            "Lighting": dict(base_kw=10.0, variation_kw=12.0, noise_kw=1.0),
        }

    def _daily_pattern(self, dept: str, hour_of_day: float) -> float:
        """
        Returns a multiplier-like additive component in [0, 1] representing
        how "busy"/active a department's variable load is at this hour.
        Different departments peak at different times of day.
        """
        if dept == "Operation_Theatre":
            # Elective surgeries cluster in daytime hours, quiet at night
            return max(0.0, math.sin((hour_of_day - 7) / 14 * math.pi)) if 7 <= hour_of_day <= 21 else 0.05

        if dept == "Emergency_Department":
            # ED has a baseline plus an evening/night bump (common real-world pattern)
            evening_bump = 0.6 * math.exp(-((hour_of_day - 20) ** 2) / 10)
            midday_bump = 0.3 * math.exp(-((hour_of_day - 13) ** 2) / 10)
            return min(1.0, 0.3 + evening_bump + midday_bump)

        if dept == "General_Ward":
            # Visiting hours / daytime activity raises ward load
            return max(0.2, math.sin((hour_of_day - 8) / 14 * math.pi)) if 8 <= hour_of_day <= 20 else 0.2

        if dept == "HVAC":
            # Cooling load peaks in the afternoon heat
            return max(0.15, math.sin((hour_of_day - 6) / 16 * math.pi))

        if dept == "Lighting":
            # On during dark hours, low during daylight
            if hour_of_day <= 6 or hour_of_day >= 18:
                return 1.0
            elif 6 < hour_of_day < 8 or 16 < hour_of_day < 18:
                return 0.5
            else:
                return 0.1

        # ICU and Oxygen Plant: near-constant life-safety loads
        return 0.5

    def step(self, timestamp: datetime) -> dict:
        """Return current kW draw per department, plus total, for this timestamp."""
        hour_of_day = timestamp.hour + timestamp.minute / 60.0
        loads = {}

        for dept, profile in self._profiles.items():
            pattern_factor = self._daily_pattern(dept, hour_of_day)
            variable_component = profile["variation_kw"] * pattern_factor
            noise = random.gauss(0, profile["noise_kw"])

            load_kw = profile["base_kw"] + variable_component + noise
            loads[dept] = round(max(0.0, load_kw), 2)

        loads["Total"] = round(sum(loads.values()), 2)
        return loads


# ---------------------------------------------------------------------------
# Grid Status Model
# ---------------------------------------------------------------------------

class GridStatus:
    """
    Models utility grid connection status: NORMAL, OUTAGE, RESTORED.

    Outages are randomly triggered (low probability per interval) and
    last a random number of intervals. RESTORED is a one-interval
    transitional state right after an outage ends, before returning
    to NORMAL — useful for the frontend/AI layer to detect "just came back".
    """

    NORMAL = "NORMAL"
    OUTAGE = "OUTAGE"
    RESTORED = "RESTORED"

    def __init__(
        self,
        outage_probability_per_interval: float = 0.003,  # ~0.3% chance per 15 min
        min_outage_intervals: int = 2,    # 30 min
        max_outage_intervals: int = 16,   # 4 hours
    ):
        self.status = self.NORMAL
        self.outage_probability_per_interval = outage_probability_per_interval
        self.min_outage_intervals = min_outage_intervals
        self.max_outage_intervals = max_outage_intervals
        self._intervals_remaining_in_outage = 0
        self._was_in_outage_last_step = False

    def step(self) -> str:
        """Advance grid status by one interval and return the current status."""
        if self.status == self.OUTAGE:
            self._intervals_remaining_in_outage -= 1
            self._was_in_outage_last_step = True
            if self._intervals_remaining_in_outage <= 0:
                self.status = self.RESTORED
            return self.status

        if self._was_in_outage_last_step:
            # We were RESTORED last step; settle back to NORMAL now
            self.status = self.NORMAL
            self._was_in_outage_last_step = False
            return self.status

        # Normal operation: small random chance a new outage begins
        if random.random() < self.outage_probability_per_interval:
            self.status = self.OUTAGE
            self._intervals_remaining_in_outage = random.randint(
                self.min_outage_intervals, self.max_outage_intervals
            )
            return self.status

        self.status = self.NORMAL
        return self.status


# ---------------------------------------------------------------------------
# Microgrid Simulator (orchestrates all subsystems)
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
    net_balance_kw: float = field(init=False)

    def __post_init__(self):
        # Positive = surplus generation, negative = deficit covered by grid/battery shortfall
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
        }
        d.update({f"load_{k}": v for k, v in self.department_loads.items()})
        return d


class MicrogridSimulator:
    """
    Top-level simulator tying together solar, wind, battery, hospital load,
    and grid status into a single advancing timeline.

    Usage:
        sim = MicrogridSimulator(start_time=datetime(2026, 6, 30, 0, 0))
        snapshot = sim.step()              # advance one 15-min interval
        df = sim.run(intervals=96)         # run a full day, get a DataFrame
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

        self.history: list[SimulationSnapshot] = []

    def step(self) -> SimulationSnapshot:
        """Advance the simulation by one 15-minute interval and return the snapshot."""
        solar_kw = self.solar.generate(self.current_time)
        wind_kw = self.wind.generate(self.current_time)
        total_generation_kw = round(solar_kw + wind_kw, 2)

        dept_loads = self.load.step(self.current_time)
        total_load_kw = dept_loads["Total"]

        grid_status = self.grid.step()

        net_surplus_kw = total_generation_kw - total_load_kw
        battery_result = self.battery.step(net_surplus_kw)

        # Determine actual grid import/export after battery has done what it can.
        # During an OUTAGE, the grid cannot supply or absorb power at all —
        # any unmet shortfall becomes a load-shed risk, any unstored surplus is wasted.
        if grid_status == GridStatus.OUTAGE:
            grid_import_kw = 0.0
            grid_export_kw = 0.0
        else:
            grid_import_kw = battery_result["grid_import_kw"]
            grid_export_kw = battery_result["grid_export_kw"]

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
        """Convert accumulated history into a pandas DataFrame (one row per interval)."""
        if not self.history:
            return pd.DataFrame()
        return pd.DataFrame([s.to_dict() for s in self.history])

    def reset_history(self):
        """Clear accumulated history without resetting subsystem state (SOC, wind, etc.)."""
        self.history = []


# ---------------------------------------------------------------------------
# Manual smoke test (only runs when this file is executed directly)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    sim = MicrogridSimulator(
        start_time=datetime(2026, 6, 30, 0, 0),
        random_seed=42,
    )
    df = sim.run(intervals=INTERVALS_PER_DAY)  # simulate one full day

    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 200)

    print(df[[
        "timestamp", "solar_kw", "wind_kw", "total_generation_kw",
        "total_load_kw", "battery_soc_percent", "battery_action",
        "grid_status", "net_balance_kw"
    ]].iloc[::8])  # print every 2 hours for a readable preview

    print("\nDay summary:")
    print(f"  Total solar generation: {df['solar_kw'].sum() / 4:.1f} kWh")
    print(f"  Total wind generation:  {df['wind_kw'].sum() / 4:.1f} kWh")
    print(f"  Total hospital load:    {df['total_load_kw'].sum() / 4:.1f} kWh")
    print(f"  Battery SOC range:      {df['battery_soc_percent'].min():.1f}% - {df['battery_soc_percent'].max():.1f}%")
    print(f"  Outage intervals:       {(df['grid_status'] == 'OUTAGE').sum()} / {len(df)}")
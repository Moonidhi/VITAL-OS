"""
VITAL-OS — Dataset Manager Module
Milestone 5: Realistic Synthetic Data Engine.

Loads, caches, and interpolates historical solar irradiance and hospital
load profile datasets stored locally in backend/data/. Zero network dependencies.
"""

from datetime import datetime
import os
import csv
import math
from typing import Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


class DatasetManager:
    """
    Manages local telemetry datasets for solar irradiance and hospital electrical demand profiles.
    Caches data in memory for sub-millisecond retrieval during simulation steps.
    """

    _instance: Optional['DatasetManager'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatasetManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self.solar_data: Dict[tuple, dict] = {}
        self.load_data: Dict[tuple, dict] = {}

        self._load_solar_csv()
        self._load_hospital_load_csv()

    def _load_solar_csv(self):
        csv_path = os.path.join(DATA_DIR, "solar_irradiance.csv")
        if not os.path.exists(csv_path):
            print(f"[DatasetManager] Warning: {csv_path} not found. Using synthetic fallback.")
            return

        try:
            with open(csv_path, "r", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    key = (
                        int(row["month"]),
                        int(row["day"]),
                        int(row["hour"]),
                        int(row["minute"]),
                    )
                    self.solar_data[key] = {
                        "ghi_w_m2": float(row["ghi_w_m2"]),
                        "cloud_cover": float(row["cloud_cover"]),
                        "season": row["season"],
                    }
            print(f"[DatasetManager] Loaded {len(self.solar_data)} solar irradiance intervals.")
        except Exception as e:
            print(f"[DatasetManager] Error reading solar CSV: {e}")

    def _load_hospital_load_csv(self):
        csv_path = os.path.join(DATA_DIR, "hospital_load_profile.csv")
        if not os.path.exists(csv_path):
            print(f"[DatasetManager] Warning: {csv_path} not found. Using synthetic fallback.")
            return

        try:
            with open(csv_path, "r", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    key = (
                        int(row["month"]),
                        int(row["day"]),
                        int(row["hour"]),
                        int(row["minute"]),
                    )
                    self.load_data[key] = {
                        "load_multiplier": float(row["load_multiplier"]),
                        "icu_factor": float(row["icu_factor"]),
                        "ot_factor": float(row["ot_factor"]),
                        "ed_factor": float(row["ed_factor"]),
                        "hvac_factor": float(row["hvac_factor"]),
                        "is_weekend": bool(int(row["is_weekend"])),
                        "season": row["season"],
                    }
            print(f"[DatasetManager] Loaded {len(self.load_data)} hospital load intervals.")
        except Exception as e:
            print(f"[DatasetManager] Error reading hospital load CSV: {e}")

    def get_solar_irradiance(self, ts: datetime) -> Dict[str, Any]:
        """
        Retrieves solar irradiance (GHI W/m²), cloud cover, and season for given timestamp.
        Falls back gracefully to astronomical curve if key is missing.
        """
        m, d, h, min_val = ts.month, ts.day, ts.hour, (ts.minute // 15) * 15
        key = (m, d, h, min_val)

        if key in self.solar_data:
            return self.solar_data[key]

        # Fallback physics calculation
        hour_float = h + min_val / 60.0
        if 6.0 <= hour_float <= 18.0:
            ghi = 800.0 * math.sin((hour_float - 6.0) / 12.0 * math.pi)
        else:
            ghi = 0.0

        return {
            "ghi_w_m2": round(max(0.0, ghi), 2),
            "cloud_cover": 0.2,
            "season": "Summer" if m in (5, 6, 7, 8) else "Winter",
        }

    def get_hospital_load_profile(self, ts: datetime) -> Dict[str, Any]:
        """
        Retrieves hospital electrical demand multipliers and department factors for timestamp.
        """
        m, d, h, min_val = ts.month, ts.day, ts.hour, (ts.minute // 15) * 15
        key = (m, d, h, min_val)

        if key in self.load_data:
            return self.load_data[key]

        # Fallback profile
        hour_float = h + min_val / 60.0
        is_weekend = ts.weekday() in (5, 6)
        mult = 1.2 if 9 <= hour_float <= 17 and not is_weekend else 0.85

        return {
            "load_multiplier": mult,
            "icu_factor": 1.0,
            "ot_factor": 0.8 if 8 <= hour_float <= 16 and not is_weekend else 0.1,
            "ed_factor": 0.6,
            "hvac_factor": 1.0,
            "is_weekend": is_weekend,
            "season": "Summer" if m in (5, 6, 7, 8) else "Winter",
        }


# Singleton accessor
def get_dataset_manager() -> DatasetManager:
    return DatasetManager()

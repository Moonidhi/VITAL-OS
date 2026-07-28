"""
VITAL-OS — AI Prediction Layer
Milestone 4: Hospital load forecasting (15-minute ahead prediction).

Provides:
  - TriageModel         : wraps GradientBoostingRegressor, trains on simulator
                          history, predicts next-interval hospital load.
  - get_or_train_model  : lazy singleton with auto-retrain when history grows
                          by >= RETRAIN_THRESHOLD new intervals.

No FastAPI, no DB, no simulation logic lives here.
Dependencies: numpy, pandas, scikit-learn, datetime
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error

# ---------------------------------------------------------------------------
# Tuneable constants
# ---------------------------------------------------------------------------

MIN_TRAINING_ROWS = 10       # refuse to train on fewer rows than this
RETRAIN_THRESHOLD = 50       # retrain when history has grown by this many intervals
FEATURES = [
    "solar_kw",
    "wind_kw",
    "battery_soc_percent",
    "total_load_kw",
    "hour_of_day",           # engineered from timestamp
]
TARGET = "total_load_kw"     # what we're predicting (1 interval ahead)


# ---------------------------------------------------------------------------
# TriageModel
# ---------------------------------------------------------------------------

class TriageModel:
    """
    Wraps a GradientBoostingRegressor trained to predict hospital load
    one 15-minute interval (i.e. 15 minutes) into the future.

    Attributes exposed for /ai/status:
        trained          : bool
        training_samples : int
        rmse             : float  (training RMSE in kW)
        model_name       : str
        last_trained     : str    (ISO-8601 UTC timestamp)
    """

    model_name = "GradientBoostingRegressor"

    def __init__(self):
        self._model: Optional[GradientBoostingRegressor] = None
        self.trained: bool = False
        self.training_samples: int = 0
        self.rmse: float = 0.0
        self.last_trained: str = ""
        self._mean_train_load: float = 1.0   # used for confidence normalisation

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, df: pd.DataFrame) -> None:
        """
        Fit the model on simulator history.

        Feature engineering:
          - All numeric columns (solar_kw etc.) are used as-is.
          - hour_of_day is extracted from the 'timestamp' column as a
            float (e.g. 13.25 = 13:15) so the model learns daily patterns.

        Target construction:
          - y[i] = total_load_kw[i+1]  (next interval's load)
          - This means we drop the last row from X and the first row from y.
        """
        if len(df) < MIN_TRAINING_ROWS:
            raise ValueError(
                f"Need at least {MIN_TRAINING_ROWS} simulation intervals to train. "
                f"Got {len(df)}. Call /simulation/run first."
            )

        df = df.copy()

        # Feature engineering — extract hour_of_day from timestamp string/datetime
        df["hour_of_day"] = pd.to_datetime(df["timestamp"]).dt.hour + \
                             pd.to_datetime(df["timestamp"]).dt.minute / 60.0

        # Build X (all rows except the last) and y (load shifted 1 step ahead)
        X = df[FEATURES].iloc[:-1].values.astype(float)
        y = df[TARGET].shift(-1).iloc[:-1].values.astype(float)

        # Guard: drop any remaining NaNs (edge case if timestamp parse fails)
        mask = ~(np.isnan(X).any(axis=1) | np.isnan(y))
        X, y = X[mask], y[mask]

        if len(X) < MIN_TRAINING_ROWS:
            raise ValueError(
                f"After feature engineering only {len(X)} clean rows remain. "
                "Run more simulation intervals."
            )

        self._model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.10,
            max_depth=3,
            random_state=42,
            subsample=0.8,      # mild regularisation, prevents overfit on small data
        )
        self._model.fit(X, y)

        # Store diagnostics
        y_pred_train = self._model.predict(X)
        self.rmse = float(np.sqrt(mean_squared_error(y, y_pred_train)))
        self._mean_train_load = float(np.mean(y)) if np.mean(y) > 0 else 1.0
        self.training_samples = len(X)
        self.trained = True
        self.last_trained = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(self, snapshot: dict) -> dict:
        """
        Predict hospital load for the next 15-minute interval and return
        a structured response with confidence, risk level, and a
        human-readable recommendation.

        Args:
            snapshot: dict in the same shape as /simulation/current returns.

        Returns:
            {
                "predicted_load": float,    # kW
                "confidence":     float,    # 0–100 %
                "recommendation": str,
                "risk_level":     "LOW" | "MEDIUM" | "HIGH"
            }
        """
        if not self.trained or self._model is None:
            raise RuntimeError("Model has not been trained yet.")

        # ── Feature vector ──────────────────────────────────────────────
        ts = snapshot.get("timestamp", datetime.utcnow().isoformat())
        dt = datetime.fromisoformat(ts.replace("Z", ""))
        hour_of_day = dt.hour + dt.minute / 60.0

        X_live = np.array([[
            float(snapshot.get("solar_kw", 0.0)),
            float(snapshot.get("wind_kw", 0.0)),
            float(snapshot.get("battery_soc_percent", 50.0)),
            float(snapshot.get("total_load_kw", 0.0)),
            hour_of_day,
        ]])

        predicted_load = float(self._model.predict(X_live)[0])
        predicted_load = max(0.0, round(predicted_load, 2))

        # ── Confidence ──────────────────────────────────────────────────
        # Lower RMSE relative to average load → higher confidence.
        # Capped at 95 % (no model is certain); floored at 50 %.
        confidence_raw = (1.0 - self.rmse / self._mean_train_load) * 100.0
        confidence = round(min(95.0, max(50.0, confidence_raw)), 1)

        # ── Risk level ──────────────────────────────────────────────────
        total_generation = float(snapshot.get("total_generation_kw", 0.0))
        battery_soc = float(snapshot.get("battery_soc_percent", 50.0))
        grid_status = snapshot.get("grid_status", "NORMAL")

        # What fraction of the predicted load can generation cover?
        coverage = (total_generation / predicted_load) if predicted_load > 0 else 1.0

        if coverage >= 0.80 and grid_status != "OUTAGE" and battery_soc >= 20.0:
            risk_level = "LOW"
        elif coverage >= 0.50 or (battery_soc >= 30.0 and grid_status != "OUTAGE"):
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # ── Recommendation ──────────────────────────────────────────────
        recommendation = _build_recommendation(
            predicted_load=predicted_load,
            current_load=float(snapshot.get("total_load_kw", 0.0)),
            total_generation=total_generation,
            battery_soc=battery_soc,
            grid_status=grid_status,
            risk_level=risk_level,
        )

        return {
            "predicted_load": predicted_load,
            "confidence": confidence,
            "recommendation": recommendation,
            "risk_level": risk_level,
        }


# ---------------------------------------------------------------------------
# Recommendation engine
# ---------------------------------------------------------------------------

def _build_recommendation(
    predicted_load: float,
    current_load: float,
    total_generation: float,
    battery_soc: float,
    grid_status: str,
    risk_level: str,
) -> str:
    """
    Produce one concise, actionable sentence for the dashboard.

    Combines risk level, battery SOC, grid status, and load trend
    to give hospital operations staff something to act on —
    not just a label.
    """
    load_delta = predicted_load - current_load
    load_trend = "rising" if load_delta > 2.0 else ("easing" if load_delta < -2.0 else "stable")
    soc_str = f"battery at {battery_soc:.0f}%"

    if grid_status == "OUTAGE":
        if battery_soc < 25.0:
            return (
                f"CRITICAL — grid outage with {soc_str} and load {load_trend}. "
                "Shed non-essential loads immediately (HVAC, lighting)."
            )
        return (
            f"Grid outage active — {soc_str}, load {load_trend} "
            f"({predicted_load:.1f} kW predicted). Monitor battery closely."
        )

    if risk_level == "HIGH":
        if battery_soc < 30.0:
            return (
                f"High load risk — {soc_str} is critically low and generation "
                f"covers only {(total_generation/predicted_load*100):.0f}% of "
                f"predicted demand ({predicted_load:.1f} kW). Reduce HVAC and lighting now."
            )
        return (
            f"High load predicted ({predicted_load:.1f} kW) — generation deficit likely. "
            f"{soc_str.capitalize()}, prepare to draw from grid."
        )

    if risk_level == "MEDIUM":
        if load_trend == "rising":
            return (
                f"Load {load_trend} toward {predicted_load:.1f} kW — "
                f"generation partially covers demand. {soc_str.capitalize()}, "
                "consider pre-charging battery if solar allows."
            )
        return (
            f"Moderate load expected ({predicted_load:.1f} kW, {load_trend}). "
            f"{soc_str.capitalize()} — system is balanced, no action required."
        )

    # LOW risk
    if load_trend == "easing" and battery_soc < 80.0:
        return (
            f"Load {load_trend} to {predicted_load:.1f} kW — good opportunity to "
            f"charge battery (currently {battery_soc:.0f}%) from renewable surplus."
        )
    return (
        f"System healthy — load {load_trend} at {predicted_load:.1f} kW, "
        f"{soc_str}, generation adequate. No action required."
    )


# ---------------------------------------------------------------------------
# Lazy singleton with auto-retrain
# ---------------------------------------------------------------------------

_model: Optional[TriageModel] = None
_trained_at_size: int = 0


def get_or_train_model(simulator) -> TriageModel:
    """
    Return the cached TriageModel, training it on first call or retraining
    automatically when the simulator history has grown by >= RETRAIN_THRESHOLD
    new intervals since the last training run.

    Args:
        simulator: a MicrogridSimulator instance (from simulation.py).

    Raises:
        ValueError: if the simulator has fewer than MIN_TRAINING_ROWS intervals.
    """
    global _model, _trained_at_size

    current_size = len(simulator.history)

    # Need enough data to train at all
    if current_size < MIN_TRAINING_ROWS:
        raise ValueError(
            f"Simulator has only {current_size} interval(s) of history. "
            f"Need at least {MIN_TRAINING_ROWS}. "
            "Call GET /simulation/run to generate data first."
        )

    # Train from scratch on first call
    if _model is None:
        _model = TriageModel()
        _model.train(simulator.history_to_dataframe())
        _trained_at_size = current_size
        return _model

    # Auto-retrain if history has grown significantly
    intervals_since_last_train = current_size - _trained_at_size
    if intervals_since_last_train >= RETRAIN_THRESHOLD:
        _model.train(simulator.history_to_dataframe())
        _trained_at_size = current_size

    return _model

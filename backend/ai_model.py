"""
VITAL-OS — AI Prediction Layer
Milestone 4: Hospital load forecasting (15-minute ahead prediction).

Provides:
  - TriageModel         : wraps GradientBoostingRegressor, trains on dataset/simulator
                          history, predicts next-interval hospital load.
  - get_or_train_model  : lazy singleton returning pre-trained year-long model cached
                          at .sim_cache/trained_model.pkl or auto-retraining on live history.

Dependencies: numpy, pandas, scikit-learn, joblib, datetime
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error

# ---------------------------------------------------------------------------
# Tuneable constants
# ---------------------------------------------------------------------------

MIN_TRAINING_ROWS = 10       # refuse to train on fewer rows than this
RETRAIN_THRESHOLD = 50       # retrain when live history has grown by this many intervals
FEATURES = [
    "solar_kw",
    "wind_kw",
    "battery_soc_percent",
    "total_load_kw",
    "hour_of_day",           # engineered from timestamp
]
TARGET = "total_load_kw"     # what we're predicting (1 interval ahead)

_CACHE_DIR = ".sim_cache"
_MODEL_CACHE_PATH = os.path.join(_CACHE_DIR, "trained_model.pkl")
_PARQUET_PATH = os.path.join(_CACHE_DIR, "training_data.parquet")


# ---------------------------------------------------------------------------
# TriageModel
# ---------------------------------------------------------------------------

class TriageModel:
    """
    Wraps a GradientBoostingRegressor trained to predict hospital load
    one 15-minute interval into the future.

    Attributes exposed for /ai/status:
        trained               : bool
        training_samples      : int
        rmse                  : float  (test RMSE in kW)
        train_rmse            : float  (train RMSE in kW)
        val_rmse              : float  (validation RMSE in kW)
        test_rmse             : float  (test RMSE in kW)
        model_name            : str
        last_trained          : str    (ISO-8601 UTC timestamp)
        feature_importance    : dict   (feature_name -> score)
        top_feature           : str    (name of most important feature)
        training_data_source  : str    ("generated_35040" | "live_history")
        is_pretrained         : bool
    """

    model_name = "GradientBoostingRegressor"

    def __init__(self):
        self._model: Optional[GradientBoostingRegressor] = None
        self.trained: bool = False
        self.training_samples: int = 0
        self.rmse: float = 0.0
        self.train_rmse: float = 0.0
        self.val_rmse: float = 0.0
        self.test_rmse: float = 0.0
        self.last_trained: str = ""
        self.feature_importance: dict = {}
        self.top_feature: str = ""
        self.training_data_source: str = "generated_35040"
        self.is_pretrained: bool = False
        self._mean_train_load: float = 1.0   # used for confidence normalisation

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, df: pd.DataFrame, source: str = "generated_35040") -> None:
        """
        Fit the model on simulation or generated history.

        Feature engineering:
          - hour_of_day is extracted from 'timestamp' as float (e.g. 13.25 = 13:15).

        Target construction:
          - y[i] = total_load_kw[i+1]  (next interval's load)

        Train / Validation / Test split:
          - Train: first 70% (rows 0–24,527 for 35,040 rows)
          - Validation: next 15% (rows 24,528–29,783)
          - Test: final 15% (rows 29,784–35,039)
        """
        if len(df) < MIN_TRAINING_ROWS:
            raise ValueError(
                f"Need at least {MIN_TRAINING_ROWS} simulation intervals to train. "
                f"Got {len(df)}."
            )

        df = df.copy()

        # Feature engineering — extract hour_of_day from timestamp
        df["hour_of_day"] = pd.to_datetime(df["timestamp"]).dt.hour + \
                             pd.to_datetime(df["timestamp"]).dt.minute / 60.0

        # Split data chronologically into Train (70%), Validation (15%), Test (15%)
        n = len(df)
        if n >= 35040:
            train_df = df.iloc[0:24528]
            val_df = df.iloc[24528:29784]
            test_df = df.iloc[29784:35040]
        else:
            n_train = int(n * 0.7)
            n_val = int(n * 0.85)
            train_df = df.iloc[0:n_train]
            val_df = df.iloc[n_train:n_val]
            test_df = df.iloc[n_val:]

        def _extract_xy(d_chunk: pd.DataFrame):
            if len(d_chunk) < 2:
                return np.empty((0, len(FEATURES))), np.empty((0,))
            X_c = d_chunk[FEATURES].iloc[:-1].values.astype(float)
            y_c = d_chunk[TARGET].shift(-1).iloc[:-1].values.astype(float)
            mask_c = ~(np.isnan(X_c).any(axis=1) | np.isnan(y_c))
            return X_c[mask_c], y_c[mask_c]

        X_train, y_train = _extract_xy(train_df)
        X_val, y_val = _extract_xy(val_df)
        X_test, y_test = _extract_xy(test_df)

        # Fallback if train slice is empty or too small (for small live history)
        if len(X_train) < MIN_TRAINING_ROWS:
            X_full = df[FEATURES].iloc[:-1].values.astype(float)
            y_full = df[TARGET].shift(-1).iloc[:-1].values.astype(float)
            mask_full = ~(np.isnan(X_full).any(axis=1) | np.isnan(y_full))
            X_train, y_train = X_full[mask_full], y_full[mask_full]
            X_val, y_val = X_train, y_train
            X_test, y_test = X_train, y_train

        if len(X_train) < MIN_TRAINING_ROWS:
            raise ValueError(
                f"After feature engineering only {len(X_train)} clean rows remain. "
                "Run more simulation intervals."
            )

        self._model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.10,
            max_depth=3,
            random_state=42,
            subsample=0.8,
        )
        self._model.fit(X_train, y_train)

        # Store diagnostics across Train / Validation / Test sets
        y_pred_train = self._model.predict(X_train)
        self.train_rmse = float(np.sqrt(mean_squared_error(y_train, y_pred_train)))

        if len(X_val) > 0:
            y_pred_val = self._model.predict(X_val)
            self.val_rmse = float(np.sqrt(mean_squared_error(y_val, y_pred_val)))
        else:
            self.val_rmse = self.train_rmse

        if len(X_test) > 0:
            y_pred_test = self._model.predict(X_test)
            self.test_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
        else:
            self.test_rmse = self.train_rmse

        # Existing self.rmse equals self.test_rmse for backward compatibility
        self.rmse = self.test_rmse

        self._mean_train_load = float(np.mean(y_train)) if len(y_train) > 0 and np.mean(y_train) > 0 else 1.0
        self.training_samples = len(df)
        self.trained = True
        self.last_trained = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        self.training_data_source = source

        # Feature importance extraction
        importances = self._model.feature_importances_
        self.feature_importance = {
            feat: round(float(imp), 4)
            for feat, imp in zip(FEATURES, importances)
        }
        top_idx = int(np.argmax(importances))
        self.top_feature = FEATURES[top_idx]

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
        confidence_raw = (1.0 - self.rmse / self._mean_train_load) * 100.0
        confidence = round(min(95.0, max(50.0, confidence_raw)), 1)

        # ── Risk level ──────────────────────────────────────────────────
        total_generation = float(snapshot.get("total_generation_kw", 0.0))
        battery_soc = float(snapshot.get("battery_soc_percent", 50.0))
        grid_status = snapshot.get("grid_status", "NORMAL")

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
            top_feature=self.top_feature,
            train_rmse=self.train_rmse,
            test_rmse=self.test_rmse,
            season=snapshot.get("season", ""),
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
    top_feature: str = "",
    train_rmse: float = 0.0,
    test_rmse: float = 0.0,
    season: str = "",
) -> str:
    """
    Produce one concise, actionable sentence for the dashboard.

    Combines risk level, battery SOC, grid status, top feature driver,
    seasonal insights, and generalization caveats.
    """
    load_delta = predicted_load - current_load
    load_trend = "rising" if load_delta > 2.0 else ("easing" if load_delta < -2.0 else "stable")
    soc_str = f"battery at {battery_soc:.0f}%"

    if grid_status == "OUTAGE":
        if battery_soc < 25.0:
            base_rec = (
                f"CRITICAL — grid outage with {soc_str} and load {load_trend}. "
                "Shed non-essential loads immediately (HVAC, lighting)."
            )
        else:
            base_rec = (
                f"Grid outage active — {soc_str}, load {load_trend} "
                f"({predicted_load:.1f} kW predicted). Monitor battery closely."
            )
    elif risk_level == "HIGH":
        if battery_soc < 30.0:
            base_rec = (
                f"High load risk — {soc_str} is critically low and generation "
                f"covers only {(total_generation/predicted_load*100):.0f}% of "
                f"predicted demand ({predicted_load:.1f} kW). Reduce HVAC and lighting now."
            )
        else:
            base_rec = (
                f"High load predicted ({predicted_load:.1f} kW) — generation deficit likely. "
                f"{soc_str.capitalize()}, prepare to draw from grid."
            )
    elif risk_level == "MEDIUM":
        if load_trend == "rising":
            base_rec = (
                f"Load {load_trend} toward {predicted_load:.1f} kW — "
                f"generation partially covers demand. {soc_str.capitalize()}, "
                "consider pre-charging battery if solar allows."
            )
        else:
            base_rec = (
                f"Moderate load expected ({predicted_load:.1f} kW, {load_trend}). "
                f"{soc_str.capitalize()} — system is balanced, no action required."
            )
    else:  # LOW risk
        if load_trend == "easing" and battery_soc < 80.0:
            base_rec = (
                f"Load {load_trend} to {predicted_load:.1f} kW — good opportunity to "
                f"charge battery (currently {battery_soc:.0f}%) from renewable surplus."
            )
        else:
            base_rec = (
                f"System healthy — load {load_trend} at {predicted_load:.1f} kW, "
                f"{soc_str}, generation adequate. No action required."
            )

    extra_notes = []

    # Signal driving prediction
    if top_feature:
        feature_labels = {
            "solar_kw": "Solar generation is the primary load driver right now.",
            "wind_kw": "Wind generation is the primary load driver right now.",
            "battery_soc_percent": "Battery SOC is the primary load driver right now.",
            "total_load_kw": "Total demand is the primary load driver right now.",
            "hour_of_day": "Time-of-day pattern is the primary load driver right now.",
        }
        extra_notes.append(feature_labels.get(top_feature, f"{top_feature} is the primary load driver right now."))

    # Season tailoring
    if season:
        season_lower = season.lower()
        if "summer" in season_lower:
            extra_notes.append("Summer season — monitor HVAC load surge risk.")
        elif "winter" in season_lower:
            extra_notes.append("Winter season — reduced solar generation expected.")

    # Train vs Test RMSE gap caveat
    if train_rmse > 0 and test_rmse > train_rmse * 1.5:
        extra_notes.append("Prediction confidence reduced — model may be generalising outside training distribution.")

    if extra_notes:
        return f"{base_rec} {' '.join(extra_notes)}"
    return base_rec


# ---------------------------------------------------------------------------
# Lazy singleton with persistent cache and auto-retrain
# ---------------------------------------------------------------------------

_model: Optional[TriageModel] = None
_trained_at_size: int = 0


def get_or_train_model(simulator) -> TriageModel:
    """
    Return the pre-trained year-long TriageModel or train a new one.

    Workflow:
      1. Check if model is already in memory.
      2. If not, check if pre-trained model cache exists (.sim_cache/trained_model.pkl).
      3. If no model cache, check if .sim_cache/training_data.parquet exists.
      4. If no parquet exists, generate 35,040 intervals on a temp MicrogridSimulator.
      5. Save parquet & train model & save model cache.
      6. If year-long generation/training fails, gracefully fall back to live simulator history.
    """
    global _model, _trained_at_size

    current_size = len(simulator.history)

    # 1. Return in-memory model if already present
    if _model is not None:
        if getattr(_model, "is_pretrained", False):
            return _model
        intervals_since_last_train = current_size - _trained_at_size
        if intervals_since_last_train >= RETRAIN_THRESHOLD:
            if current_size >= MIN_TRAINING_ROWS:
                _model.train(simulator.history_to_dataframe(), source="live_history")
                _trained_at_size = current_size
        return _model

    # 2. Check if pre-trained model cache exists on disk
    if os.path.exists(_MODEL_CACHE_PATH) and os.path.exists(_PARQUET_PATH):
        try:
            print(f"[AI] Loading cached model from {_MODEL_CACHE_PATH}")
            _model = joblib.load(_MODEL_CACHE_PATH)
            _model.is_pretrained = True
            _trained_at_size = current_size
            return _model
        except Exception as e:
            print(f"[AI] Warning: Failed to load cached model: {e}")

    # 3. Generate or load training data and fit model
    try:
        if os.path.exists(_PARQUET_PATH):
            df = pd.read_parquet(_PARQUET_PATH)
        else:
            print("[AI] Generating 35,040 training intervals... (this runs once, ~30 seconds)")
            from simulation import MicrogridSimulator
            temp_sim = MicrogridSimulator(
                start_time=datetime(2024, 1, 1, 0, 0),
                random_seed=0,
            )
            df = temp_sim.run(intervals=35040)
            temp_sim.reset_history()

            os.makedirs(_CACHE_DIR, exist_ok=True)
            df.to_parquet(_PARQUET_PATH)

        model = TriageModel()
        model.train(df, source="generated_35040")
        model.is_pretrained = True

        os.makedirs(_CACHE_DIR, exist_ok=True)
        joblib.dump(model, _MODEL_CACHE_PATH)

        _model = model
        _trained_at_size = current_size
        return _model

    except Exception as e:
        print(f"[AI] Warning: Year-long synthetic data generation/training failed: {e}. Falling back to live history.")
        if current_size < MIN_TRAINING_ROWS:
            raise ValueError(
                f"Simulator has only {current_size} interval(s) of history. "
                f"Need at least {MIN_TRAINING_ROWS}. "
                "Call GET /simulation/run to generate data first."
            )
        model = TriageModel()
        model.train(simulator.history_to_dataframe(), source="live_history")
        model.is_pretrained = False
        _model = model
        _trained_at_size = current_size
        return _model


# ---------------------------------------------------------------------------
# Standalone Smoke Test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from simulation import MicrogridSimulator

    print("--- Running AI Model Smoke Test ---")
    live_sim = MicrogridSimulator(random_seed=42)
    live_sim.run(intervals=20)
    assert len(live_sim.history) == 20, f"Expected 20 history items, got {len(live_sim.history)}"

    model = get_or_train_model(live_sim)
    print(f"Model Name            : {model.model_name}")
    print(f"Trained               : {model.trained}")
    print(f"Is Pretrained         : {model.is_pretrained}")
    print(f"Training Samples      : {model.training_samples}")
    print(f"Training Data Source  : {model.training_data_source}")
    print(f"Train RMSE            : {model.train_rmse:.4f}")
    print(f"Val RMSE              : {model.val_rmse:.4f}")
    print(f"Test RMSE             : {model.test_rmse:.4f}")
    print(f"RMSE (Test)           : {model.rmse:.4f}")
    print(f"Feature Importance    : {model.feature_importance}")
    print(f"Top Feature           : {model.top_feature}")
    print(f"Last Trained          : {model.last_trained}")

    last_snapshot = live_sim.history[-1].to_dict()
    pred_result = model.predict(last_snapshot)
    print("\nPredict Result:")
    for k, v in pred_result.items():
        print(f"  {k}: {v}")

    print(f"\nLive sim history length: {len(live_sim.history)} (expected 20)")
    assert len(live_sim.history) == 20, "Live simulator history was contaminated!"
    print("Smoke test PASSED successfully!")

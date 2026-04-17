"""ML inference service for the SmartMedCare multi-task health model.

The TorchScript model (`multitask_health_model.pt`) is loaded lazily on the first
call. Feature order and StandardScaler constants are copied from
`data-jobs/inference.py` so that the backend container has no runtime dependency
on the `data-jobs/` directory beyond the model file itself.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# Feature order — must match training exactly (20 features).
FEATURE_COLS: list[str] = [
    "AGE", "IS_FEMALE", "RACE", "SCHLYRS", "SELF_HEALTH", "HEALTH_CHANGE",
    "FALL_2YR", "PAIN", "BMI_CATEGORY",
    "MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING",
    "ADL_SCORE", "HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH",
    "HAS_USUAL_CARE", "NUM_HOSPITAL_STAYS", "DOCTOR_VISITS",
]

_SCALER_MEAN_RAW: list[float] = [
    68.38963671748297, 0.5885501135257866, 1.9885663314952968,
    13.020434641582874, 2.9536166072007783, 2.464239377229971,
    1.0, 1.0, 0.0,
    2.9851605578981513, 2.1680992539734025, 0.34755108660395717,
    14.50064871878041, 3.6688290626013624, 0.9667531625040545,
    0.7157800843334414, 0.0005676289328576062, 0.6173370094064223,
    4.261028219266948, 0.8134933506325008,
]

_SCALER_SCALE_RAW: list[float] = [
    10.596140933847213, 0.49209641067027743, 1.9304604566851178,
    3.254688607194585, 1.037000711249164, 1.9472701345104326,
    1.0, 1.0, 1.0,
    0.9487467356032484, 0.5043220791608497, 2.3337417671997707,
    10.963097488980512, 3.4594811582340563, 0.17928046545138068,
    0.4510420769784709, 0.0238182016586515, 0.48603706260279894,
    1.5915858407065682, 1.43868730900172,
]


_MODEL = None
_MODEL_LOCK = threading.Lock()
_NP = None
_TORCH = None
_SCALER_MEAN = None
_SCALER_SCALE = None


def _model_path() -> str:
    return os.environ.get("ML_MODEL_PATH", "/app/models/multitask_health_model.pt")


def _ensure_loaded() -> None:
    """Lazy-load torch, numpy, and the TorchScript model (thread-safe, singleton)."""
    global _MODEL, _NP, _TORCH, _SCALER_MEAN, _SCALER_SCALE

    if _MODEL is not None:
        return

    with _MODEL_LOCK:
        if _MODEL is not None:
            return

        import numpy as np  # type: ignore
        import torch  # type: ignore

        _NP = np
        _TORCH = torch
        _SCALER_MEAN = np.array(_SCALER_MEAN_RAW, dtype=np.float64)
        _SCALER_SCALE = np.array(_SCALER_SCALE_RAW, dtype=np.float64)

        path = _model_path()
        logger.info("Loading TorchScript model from %s", path)
        model = torch.jit.load(path, map_location="cpu")
        model.eval()
        _MODEL = model


def _scale(x):
    return (x - _SCALER_MEAN) / _SCALER_SCALE


def _result_row(hr_prob: float, fu_prob: float, hs_value: float) -> dict:
    return {
        "high_risk_prob": round(hr_prob, 4),
        "high_risk": hr_prob >= 0.5,
        "followup_prob": round(fu_prob, 4),
        "followup_needed": fu_prob >= 0.5,
        "health_score": round(max(0.0, min(100.0, hs_value)), 1),
    }


def predict(features: dict) -> dict:
    """Run inference on a single record. Missing feature keys default to 0."""
    _ensure_loaded()
    np = _NP
    torch = _TORCH

    x = np.array(
        [[float(features.get(col, 0.0) or 0.0) for col in FEATURE_COLS]],
        dtype=np.float64,
    )
    x_scaled = _scale(x).astype(np.float32)
    x_tensor = torch.tensor(x_scaled)

    with torch.no_grad():
        hr_logit, fu_logit, hs_score = _MODEL(x_tensor)

    return _result_row(
        float(torch.sigmoid(hr_logit).item()),
        float(torch.sigmoid(fu_logit).item()),
        float(hs_score.item()),
    )


def predict_batch(records: list[dict]) -> list[dict]:
    """Run inference on a batch of records."""
    if not records:
        return []
    _ensure_loaded()
    np = _NP
    torch = _TORCH

    n = len(records)
    x = np.zeros((n, len(FEATURE_COLS)), dtype=np.float64)
    for i, rec in enumerate(records):
        for j, col in enumerate(FEATURE_COLS):
            x[i, j] = float(rec.get(col, 0.0) or 0.0)

    x_scaled = _scale(x).astype(np.float32)
    x_tensor = torch.tensor(x_scaled)

    with torch.no_grad():
        hr_logits, fu_logits, hs_scores = _MODEL(x_tensor)

    hr_probs = torch.sigmoid(hr_logits).numpy()
    fu_probs = torch.sigmoid(fu_logits).numpy()
    hs_values = hs_scores.numpy()

    return [
        _result_row(float(hr_probs[i]), float(fu_probs[i]), float(hs_values[i]))
        for i in range(n)
    ]


def model_loaded() -> bool:
    return _MODEL is not None


def model_path() -> str:
    return _model_path()

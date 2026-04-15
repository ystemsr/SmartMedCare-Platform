"""
SmartMedCare Multi-Task Model — Inference Examples

This script demonstrates all use cases for the multi-task health model:
  1. High-risk elderly classification
  2. Priority follow-up prediction
  3. Health status score estimation

Note: Chronic disease risk level was removed due to data leakage.

Requirements:
    pip install torch numpy

Usage:
    python data-jobs/inference.py
"""

from pathlib import Path

import numpy as np
import torch

# ---------------------------------------------------------------------------
# Embedded constants (extracted from training artifacts, no joblib needed)
# ---------------------------------------------------------------------------

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "multitask_health_model.pt"

# Feature column order — must match training exactly (20 features, no chronic disease columns)
FEATURE_COLS = [
    "AGE", "IS_FEMALE", "RACE", "SCHLYRS", "SELF_HEALTH", "HEALTH_CHANGE",
    "FALL_2YR", "PAIN", "BMI_CATEGORY",
    "MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING",
    "ADL_SCORE", "HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH",
    "HAS_USUAL_CARE", "NUM_HOSPITAL_STAYS", "DOCTOR_VISITS",
]

# StandardScaler parameters (mean_ and scale_ from training fit)
_SCALER_MEAN = np.array([
    68.38963671748297, 0.5885501135257866, 1.9885663314952968,
    13.020434641582874, 2.9536166072007783, 2.464239377229971,
    1.0, 1.0, 0.0,
    2.9851605578981513, 2.1680992539734025, 0.34755108660395717,
    14.50064871878041, 3.6688290626013624, 0.9667531625040545,
    0.7157800843334414, 0.0005676289328576062, 0.6173370094064223,
    4.261028219266948, 0.8134933506325008,
], dtype=np.float64)

_SCALER_SCALE = np.array([
    10.596140933847213, 0.49209641067027743, 1.9304604566851178,
    3.254688607194585, 1.037000711249164, 1.9472701345104326,
    1.0, 1.0, 1.0,
    0.9487467356032484, 0.5043220791608497, 2.3337417671997707,
    10.963097488980512, 3.4594811582340563, 0.17928046545138068,
    0.4510420769784709, 0.0238182016586515, 0.48603706260279894,
    1.5915858407065682, 1.43868730900172,
], dtype=np.float64)

# Load TorchScript model (inference-only, no checkpoint)
MODEL = torch.jit.load(str(MODEL_PATH), map_location="cpu")
MODEL.eval()


# ---------------------------------------------------------------------------
# Scaler (replaces sklearn StandardScaler, zero external dependencies)
# ---------------------------------------------------------------------------


def _scale(x: np.ndarray) -> np.ndarray:
    """Apply StandardScaler transform: (x - mean) / scale."""
    return (x - _SCALER_MEAN) / _SCALER_SCALE


# ---------------------------------------------------------------------------
# Core inference functions
# ---------------------------------------------------------------------------


def predict(features: dict[str, float]) -> dict:
    """Run inference on a single elderly record.

    Args:
        features: A dict mapping feature names to values.
            Required keys (20 features):
                AGE, IS_FEMALE, RACE, SCHLYRS, SELF_HEALTH, HEALTH_CHANGE,
                FALL_2YR, PAIN, BMI_CATEGORY,
                MEMORY_RATING, MEMORY_CHANGE, SERIAL7_SCORE, DATE_NAMING,
                ADL_SCORE, HOSPITAL_STAY, NURSING_HOME, HOME_HEALTH,
                HAS_USUAL_CARE, NUM_HOSPITAL_STAYS, DOCTOR_VISITS

            Missing keys default to 0.

    Returns:
        dict with keys:
            high_risk_prob:    float, probability of being high-risk (0-1)
            high_risk:         bool,  True if high-risk (threshold 0.5)
            followup_prob:     float, probability of needing priority follow-up (0-1)
            followup_needed:   bool,  True if priority follow-up recommended
            health_score:      float, predicted health status score (0-100)
    """
    # Build feature vector in the correct column order
    x = np.array(
        [[features.get(col, 0.0) for col in FEATURE_COLS]], dtype=np.float64
    )

    # Scale and convert
    x_scaled = _scale(x).astype(np.float32)
    x_tensor = torch.tensor(x_scaled)

    # Forward pass
    with torch.no_grad():
        hr_logit, fu_logit, hs_score = MODEL(x_tensor)

    hr_prob = torch.sigmoid(hr_logit).item()
    fu_prob = torch.sigmoid(fu_logit).item()
    hs_value = float(hs_score.item())

    return {
        "high_risk_prob": round(hr_prob, 4),
        "high_risk": hr_prob >= 0.5,
        "followup_prob": round(fu_prob, 4),
        "followup_needed": fu_prob >= 0.5,
        "health_score": round(max(0.0, min(100.0, hs_value)), 1),
    }


def predict_batch(records: list[dict[str, float]]) -> list[dict]:
    """Run inference on a batch of elderly records.

    Args:
        records: List of feature dicts (same format as predict()).

    Returns:
        List of result dicts (same format as predict()).
    """
    n = len(records)
    x = np.zeros((n, len(FEATURE_COLS)), dtype=np.float64)
    for i, rec in enumerate(records):
        for j, col in enumerate(FEATURE_COLS):
            x[i, j] = rec.get(col, 0.0)

    x_scaled = _scale(x).astype(np.float32)
    x_tensor = torch.tensor(x_scaled)

    with torch.no_grad():
        hr_logits, fu_logits, hs_scores = MODEL(x_tensor)

    hr_probs = torch.sigmoid(hr_logits).numpy()
    fu_probs = torch.sigmoid(fu_logits).numpy()
    hs_values = hs_scores.numpy()

    results = []
    for i in range(n):
        results.append({
            "high_risk_prob": round(float(hr_probs[i]), 4),
            "high_risk": bool(hr_probs[i] >= 0.5),
            "followup_prob": round(float(fu_probs[i]), 4),
            "followup_needed": bool(fu_probs[i] >= 0.5),
            "health_score": round(max(0.0, min(100.0, float(hs_values[i]))), 1),
        })
    return results


# ---------------------------------------------------------------------------
# Example use cases
# ---------------------------------------------------------------------------


def main():
    print("=" * 60)
    print("SmartMedCare Multi-Task Model — Inference Examples")
    print("=" * 60)

    # ----------------------------------------------------------------
    # Case 1: Healthy elderly person
    # ----------------------------------------------------------------
    print("\n--- Case 1: Relatively healthy 65-year-old female ---")
    result = predict({
        "AGE": 65,
        "IS_FEMALE": 1,
        "RACE": 1,
        "SCHLYRS": 14,
        "SELF_HEALTH": 2,        # very good
        "HEALTH_CHANGE": 3,      # same as before
        "FALL_2YR": 0,
        "PAIN": 0,
        "BMI_CATEGORY": 2,
        "MEMORY_RATING": 2,      # good
        "MEMORY_CHANGE": 3,      # same
        "SERIAL7_SCORE": 4,
        "DATE_NAMING": 4,
        "ADL_SCORE": 0,          # no functional limitations
        "HOSPITAL_STAY": 0,
        "NURSING_HOME": 0,
        "HOME_HEALTH": 0,
        "HAS_USUAL_CARE": 1,
        "NUM_HOSPITAL_STAYS": 0,
        "DOCTOR_VISITS": 4,
    })
    _print_result(result)

    # ----------------------------------------------------------------
    # Case 2: High-risk elderly with multiple health issues
    # ----------------------------------------------------------------
    print("\n--- Case 2: High-risk 82-year-old male, poor health ---")
    result = predict({
        "AGE": 82,
        "IS_FEMALE": 0,
        "RACE": 1,
        "SCHLYRS": 10,
        "SELF_HEALTH": 4,        # fair
        "HEALTH_CHANGE": 5,      # worse
        "FALL_2YR": 1,
        "PAIN": 1,
        "BMI_CATEGORY": 3,
        "MEMORY_RATING": 4,      # fair
        "MEMORY_CHANGE": 5,      # worse
        "SERIAL7_SCORE": 2,
        "DATE_NAMING": 2,
        "ADL_SCORE": 4,          # difficulty with 4 ADL activities
        "HOSPITAL_STAY": 1,
        "NURSING_HOME": 0,
        "HOME_HEALTH": 1,
        "HAS_USUAL_CARE": 1,
        "NUM_HOSPITAL_STAYS": 3,
        "DOCTOR_VISITS": 12,
    })
    _print_result(result)

    # ----------------------------------------------------------------
    # Case 3: Moderate risk, cognitive decline
    # ----------------------------------------------------------------
    print("\n--- Case 3: 74-year-old female, cognitive decline ---")
    result = predict({
        "AGE": 74,
        "IS_FEMALE": 1,
        "RACE": 2,
        "SCHLYRS": 12,
        "SELF_HEALTH": 3,        # good
        "HEALTH_CHANGE": 5,      # worse
        "FALL_2YR": 0,
        "PAIN": 1,
        "BMI_CATEGORY": 2,
        "MEMORY_RATING": 4,      # fair
        "MEMORY_CHANGE": 5,      # worse
        "SERIAL7_SCORE": 1,
        "DATE_NAMING": 1,
        "ADL_SCORE": 2,
        "HOSPITAL_STAY": 0,
        "NURSING_HOME": 0,
        "HOME_HEALTH": 0,
        "HAS_USUAL_CARE": 1,
        "NUM_HOSPITAL_STAYS": 0,
        "DOCTOR_VISITS": 6,
    })
    _print_result(result)

    # ----------------------------------------------------------------
    # Case 4: Post-hospitalization follow-up scenario
    # ----------------------------------------------------------------
    print("\n--- Case 4: 70-year-old, recently hospitalized, needs follow-up ---")
    result = predict({
        "AGE": 70,
        "IS_FEMALE": 0,
        "RACE": 1,
        "SCHLYRS": 16,
        "SELF_HEALTH": 3,
        "HEALTH_CHANGE": 5,      # worse
        "FALL_2YR": 1,           # recent fall
        "PAIN": 1,
        "BMI_CATEGORY": 2,
        "MEMORY_RATING": 2,
        "MEMORY_CHANGE": 3,
        "SERIAL7_SCORE": 5,
        "DATE_NAMING": 4,
        "ADL_SCORE": 1,
        "HOSPITAL_STAY": 1,      # recently hospitalized
        "NURSING_HOME": 0,
        "HOME_HEALTH": 1,
        "HAS_USUAL_CARE": 1,
        "NUM_HOSPITAL_STAYS": 2,
        "DOCTOR_VISITS": 8,
    })
    _print_result(result)

    # ----------------------------------------------------------------
    # Case 5: Batch inference — process multiple records at once
    # ----------------------------------------------------------------
    print("\n--- Case 5: Batch inference (3 records) ---")
    batch = [
        {"AGE": 60, "IS_FEMALE": 1, "SELF_HEALTH": 1, "ADL_SCORE": 0},
        {"AGE": 78, "IS_FEMALE": 0, "SELF_HEALTH": 4, "ADL_SCORE": 3,
         "HOSPITAL_STAY": 1, "FALL_2YR": 1},
        {"AGE": 90, "IS_FEMALE": 1, "SELF_HEALTH": 5, "ADL_SCORE": 8,
         "NURSING_HOME": 1, "MEMORY_RATING": 5},
    ]
    results = predict_batch(batch)
    for i, r in enumerate(results):
        print(f"\n  Record {i + 1}:")
        _print_result(r, indent=4)

    # ----------------------------------------------------------------
    # Case 6: Minimal input (only age and sex known)
    # ----------------------------------------------------------------
    print("\n--- Case 6: Minimal input — only age and sex known ---")
    result = predict({"AGE": 72, "IS_FEMALE": 0})
    _print_result(result)
    print("  (Note: missing features default to 0; predictions are less reliable)")

    print("\n" + "=" * 60)
    print("All inference examples completed successfully.")
    print("=" * 60)


def _print_result(result: dict, indent: int = 2):
    pad = " " * indent
    print(f"{pad}High-risk:       {'YES' if result['high_risk'] else 'NO'} "
          f"(probability: {result['high_risk_prob']:.2%})")
    print(f"{pad}Follow-up:       {'NEEDED' if result['followup_needed'] else 'not needed'} "
          f"(probability: {result['followup_prob']:.2%})")
    print(f"{pad}Health score:    {result['health_score']:.1f} / 100")


if __name__ == "__main__":
    main()
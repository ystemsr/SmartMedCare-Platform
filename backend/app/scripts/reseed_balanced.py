"""Reseed elder feature_inputs so batch_predict yields a balanced distribution.

The multi-task model's two output heads correlate tightly — feeding it the
synthetic inputs from `seed_ai_assessments.py` makes everyone land in
`高风险`. Demo mode bypassed the model, but the moment big-data
batch_predict runs it re-scores from `feature_inputs` via the model and
collapses the demo distribution.

This script inverts the problem: for each of the 4 UI chips we brute-force
sample feature vectors, run them through `ml_inference.predict()`, and keep
those that hit the target chip. The winning vectors are then written back
onto each elder's latest assessment so subsequent batch runs produce the
same balanced spread.

Target UI chips (matches ElderListPage.tsx):
    正常          = high_risk=false AND score >= 70
    关注          = high_risk=false AND score < 70
    高风险        = high_risk=true  AND score >= 40
    极高风险      = high_risk=true  AND score < 40

Usage (inside the backend container):
    python -m app.scripts.reseed_balanced
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import desc, select

from app.core.database import AsyncSessionLocal
from app.models.assessment import Assessment
from app.models.elder import Elder
from app.repositories.bigdata import PredictionResultRepository
from app.services import ml_inference

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s"
)
logger = logging.getLogger("reseed_balanced")


# Match the catalog: we only sample the 17 doctor/elder keys. AGE, IS_FEMALE
# and BMI_CATEGORY vary per elder and are filled in per row at reseed time.
_SAMPLE_KEYS = [
    "RACE", "SCHLYRS",
    "SELF_HEALTH", "HEALTH_CHANGE",
    "FALL_2YR", "PAIN",
    "MEMORY_RATING", "MEMORY_CHANGE",
    "SERIAL7_SCORE", "DATE_NAMING", "ADL_SCORE",
    "HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH",
    "HAS_USUAL_CARE", "NUM_HOSPITAL_STAYS", "DOCTOR_VISITS",
]


def _bucket_for(high_risk: bool, score: float) -> str:
    if high_risk:
        return "critical" if score < 40 else "high"
    return "low" if score >= 70 else "medium"


def _random_features(rng: random.Random) -> dict:
    """Broad random sample across the catalog ranges.

    Not uniform by design — tilts utilization/ADL toward realistic elder
    distributions so we find hits for every bucket in a reasonable number
    of trials.
    """
    return {
        "RACE": rng.choice([1, 1, 1, 2, 3]),
        "SCHLYRS": rng.choice([0, 3, 6, 9, 12, 12, 16]),
        "SELF_HEALTH": rng.randint(1, 5),
        "HEALTH_CHANGE": rng.randint(1, 5),
        "FALL_2YR": rng.choice([0, 0, 1]),
        "PAIN": rng.choice([0, 0, 1, 1]),
        "MEMORY_RATING": rng.randint(1, 5),
        "MEMORY_CHANGE": rng.randint(1, 3),
        "SERIAL7_SCORE": rng.randint(0, 5),
        "DATE_NAMING": rng.randint(0, 4),
        "ADL_SCORE": rng.randint(0, 6),
        "HOSPITAL_STAY": rng.choice([0, 0, 1]),
        "NURSING_HOME": rng.choice([0, 0, 0, 1]),
        "HOME_HEALTH": rng.choice([0, 0, 0, 1]),
        "HAS_USUAL_CARE": rng.choice([0, 1, 1]),
        "NUM_HOSPITAL_STAYS": rng.choice([0, 0, 0, 1, 1, 2, 3, 4, 5, 8]),
        "DOCTOR_VISITS": rng.choice([0, 1, 2, 3, 5, 8, 12, 18]),
    }


def _make_full(
    doctor_inputs: dict, age: int, is_female: int, bmi_category: int
) -> dict:
    """Full 20-feature vector given sampled doctor/elder inputs + auto."""
    out = dict(doctor_inputs)
    out["AGE"] = age
    out["IS_FEMALE"] = is_female
    out["BMI_CATEGORY"] = bmi_category
    return out


def _find_bucket_vectors(
    target: str,
    age: int,
    is_female: int,
    bmi_category: int,
    count: int,
    max_trials: int = 4000,
    seed: int = 0,
) -> list[dict]:
    """Return up to `count` feature vectors hitting the target UI chip."""
    rng = random.Random(seed)
    hits: list[dict] = []
    for _ in range(max_trials):
        doctor = _random_features(rng)
        features = _make_full(doctor, age, is_female, bmi_category)
        pred = ml_inference.predict(features)
        if _bucket_for(pred["high_risk"], pred["health_score"]) == target:
            hits.append(features)
            if len(hits) >= count:
                break
    return hits


# Fallback order: if the primary bucket is unreachable after the full trial
# budget, try the next bucket "up". Very old elders with adverse BMI are
# effectively locked out of `low`/`medium` by the model's age prior — this
# ladder at least keeps their data updated instead of leaving stale rows.
_FALLBACK_ORDER: dict[str, list[str]] = {
    "low": ["low", "medium", "high"],
    "medium": ["medium", "low", "high"],
    "high": ["high", "medium", "critical"],
    "critical": ["critical", "high"],
}


def _find_with_fallback(
    preferred: str,
    age: int,
    is_female: int,
    bmi_category: int,
    seed: int,
    budget_per_try: int = 8000,
) -> tuple[str, Optional[dict]]:
    """Try the preferred bucket first; on failure walk the fallback ladder."""
    for bucket in _FALLBACK_ORDER[preferred]:
        vectors = _find_bucket_vectors(
            bucket, age, is_female, bmi_category,
            count=1, max_trials=budget_per_try, seed=seed + hash(bucket) % 997,
        )
        if vectors:
            return bucket, vectors[0]
    return preferred, None


# Desired distribution across 32 elders. Sums to 32.
TARGETS = [
    ("low", 10),       # 正常
    ("medium", 8),     # 关注
    ("high", 10),      # 高风险
    ("critical", 4),   # 极高风险
]


def _bmi_category_for_elder(height_cm, weight_kg) -> int:
    """Mirror feature_catalog._compute_bmi_category but accept plain floats."""
    if not height_cm or not weight_kg or height_cm <= 0:
        return 1  # assume "normal" if missing
    h_m = float(height_cm) / 100.0
    bmi = float(weight_kg) / (h_m * h_m)
    if bmi < 18.5:
        return -1
    if bmi < 24:
        return 0
    if bmi < 28:
        return 1
    return 2


async def _elder_profile(db, elder: Elder) -> tuple[int, int, int]:
    from app.models.health_archive import HealthRecord
    from datetime import date

    # AGE
    today = date.today()
    if elder.birth_date:
        age = today.year - elder.birth_date.year - (
            (today.month, today.day) < (elder.birth_date.month, elder.birth_date.day)
        )
    else:
        age = 78
    # IS_FEMALE
    gender = (elder.gender or "").lower()
    is_female = 1 if gender in ("female", "f", "woman", "女") else 0
    # BMI_CATEGORY from latest health record
    hr = (
        await db.execute(
            select(HealthRecord)
            .where(
                HealthRecord.elder_id == elder.id,
                HealthRecord.deleted_at.is_(None),
            )
            .order_by(desc(HealthRecord.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if hr is not None and hr.height_cm and hr.weight_kg:
        bmi = _bmi_category_for_elder(float(hr.height_cm), float(hr.weight_kg))
    else:
        bmi = 1
    return age, is_female, bmi


async def run() -> None:
    async with AsyncSessionLocal() as db:
        elders = (
            await db.execute(
                select(Elder).where(Elder.deleted_at.is_(None)).order_by(Elder.id)
            )
        ).scalars().all()

    logger.info("Reseeding %d elders for a balanced UI chip distribution", len(elders))

    # Build a (bucket, elder) assignment list.
    assignments: list[tuple[str, Elder]] = []
    idx = 0
    for bucket, n in TARGETS:
        for _ in range(n):
            if idx < len(elders):
                assignments.append((bucket, elders[idx]))
                idx += 1
    # Remaining elders get the most relaxed bucket (high) so we never skip.
    while idx < len(elders):
        assignments.append(("high", elders[idx]))
        idx += 1

    # Shuffle so buckets aren't alphabetical by elder id (prettier demo).
    random.Random(42).shuffle(assignments)

    updated = 0
    for bucket, elder in assignments:
        async with AsyncSessionLocal() as db:
            age, is_female, bmi = await _elder_profile(db, elder)

            actual_bucket, features = _find_with_fallback(
                bucket, age, is_female, bmi, seed=elder.id * 31,
            )
            if features is None:
                logger.warning(
                    "elder_id=%s: could not find any vector (target=%s); skipping",
                    elder.id, bucket,
                )
                continue
            if actual_bucket != bucket:
                logger.info(
                    "elder_id=%s: target=%s unreachable, fell back to %s",
                    elder.id, bucket, actual_bucket,
                )

            # Re-run inference on the chosen vector so we persist the exact
            # prediction the model will emit during future batch runs.
            pred = ml_inference.predict(features)
            score = int(round(pred["health_score"]))

            # Update the elder's latest assessment: overwrite feature_inputs
            # + refresh the score/risk_level/summary/suggestions so the two
            # views (assessment list + elder list) stay consistent.
            latest = (
                await db.execute(
                    select(Assessment)
                    .where(
                        Assessment.elder_id == elder.id,
                        Assessment.deleted_at.is_(None),
                    )
                    .order_by(desc(Assessment.created_at))
                    .limit(1)
                )
            ).scalar_one_or_none()

            if latest is None:
                # Shouldn't happen — every elder should have one by now —
                # but log and move on.
                logger.warning("elder_id=%s has no assessment; skipping", elder.id)
                continue

            latest.feature_inputs = features
            latest.score = score
            # risk_level from score bucket (matches AssessmentService._score_to_risk_level)
            if pred["health_score"] >= 80:
                latest.risk_level = "low"
            elif pred["health_score"] >= 60:
                latest.risk_level = "medium"
            elif pred["health_score"] >= 40:
                latest.risk_level = "high"
            else:
                latest.risk_level = "critical"
            latest.summary = (
                f"综合健康评分 {pred['health_score']:.1f}；"
                f"高风险概率 {pred['high_risk_prob'] * 100:.1f}%；"
                f"随访概率 {pred['followup_prob'] * 100:.1f}%"
            )

            # Mirror to prediction_results so the elder list updates.
            pr_row = await PredictionResultRepository.upsert_latest(
                db,
                elder.id,
                {
                    "high_risk_prob": pred["high_risk_prob"],
                    "high_risk": pred["high_risk"],
                    "followup_prob": pred["followup_prob"],
                    "followup_needed": pred["followup_needed"],
                    "health_score": pred["health_score"],
                    "predicted_at": datetime.now(timezone.utc),
                },
            )
            latest.prediction_result_id = pr_row.id

            await db.commit()
            updated += 1
            logger.info(
                "elder_id=%s bucket=%s score=%s hr=%s",
                elder.id, bucket, score, pred["high_risk"],
            )

    logger.info("Reseed complete. updated=%s", updated)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()

"""Seed AI assessments (with full 20-feature inputs) for every existing elder.

Two modes:

- Default (ML mode): calls AssessmentService.create_assessment so each elder
  gets a real ML-inference-driven score. Use this when the seed data should
  reflect what the model actually produces.

- --demo: bypasses the ML model and writes (assessment, prediction_results)
  pairs directly, distributed across the four UI chips (正常 / 关注 /
  高风险 / 极高风险). Use this when you want demo data that demonstrates the
  full range of risk buckets — the trained model's two output heads
  correlate too tightly for the "关注" chip (high_risk=false AND score<70)
  to appear naturally.

Idempotent by default: skips elders whose most recent `comprehensive`
assessment already has `feature_inputs` populated. Pass --force to regenerate.

Usage (inside the backend container):
    python -m app.scripts.seed_ai_assessments [--force] [--demo] [--limit N]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import random
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.assessment import Assessment
from app.models.elder import Elder
from app.schemas.assessment import AssessmentCreate
from app.services.assessment import AssessmentService, _score_to_risk_level

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
)
logger = logging.getLogger("seed_ai_assessments")


def _age_from(birth: Optional[date]) -> int:
    if birth is None:
        return 75
    today = date.today()
    return today.year - birth.year - (
        (today.month, today.day) < (birth.month, birth.day)
    )


def _clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# Target distribution across the 4 risk buckets, summing to 1.0.
# The seed picks one bucket per elder deterministically via elder_id, then
# samples values from that bucket's profile so we cover the full range
# instead of everyone ending up frail.
_BUCKETS = [
    ("low", 0.30),       # 低风险 — healthy baseline, no hospital use
    ("medium", 0.35),    # 中风险 — mild issues
    ("high", 0.25),      # 高风险 — multiple issues, frequent care
    ("critical", 0.10),  # 极高风险 — dependent, recent hospitalization
]


def _pick_bucket(elder_id: int) -> str:
    """Deterministic bucket assignment; permutes via elder_id so re-runs
    produce the same bucket per elder and the overall mix matches _BUCKETS."""
    rng = random.Random(f"bucket:{elder_id}")
    r = rng.random()
    cum = 0.0
    for name, weight in _BUCKETS:
        cum += weight
        if r < cum:
            return name
    return _BUCKETS[-1][0]


def _realistic_features(elder_id: int, age: int, is_female: Optional[int]) -> dict:
    """17-item doctor+elder payload drawn from a target risk bucket.

    The service auto-fills AGE / IS_FEMALE / BMI_CATEGORY from the elder
    profile + latest health record, so those are intentionally omitted.
    """
    bucket = _pick_bucket(elder_id)
    rng = random.Random(elder_id)

    # Per-bucket profile constants — crafted so the ML model sees clearly
    # different input distributions, producing scores across 0–100 and mixed
    # high_risk outcomes. Values are ranges; specific draws jitter within them.
    if bucket == "low":
        self_health = rng.randint(1, 2)
        health_change = rng.randint(1, 2)
        fall_2yr = 0 if rng.random() < 0.9 else 1
        pain = 0 if rng.random() < 0.75 else 1
        memory_rating = rng.randint(1, 2)
        memory_change = rng.randint(1, 2)
        serial7 = rng.randint(4, 5)
        date_naming = rng.randint(3, 4)
        adl = rng.randint(5, 6)
        hospital_stay = 0
        num_hospital_stays = 0
        nursing_home = 0
        home_health = 0 if rng.random() < 0.9 else 1
        doctor_visits = rng.randint(1, 4)
    elif bucket == "medium":
        self_health = rng.randint(2, 3)
        health_change = rng.randint(2, 3)
        fall_2yr = 1 if rng.random() < 0.25 else 0
        pain = 1 if rng.random() < 0.45 else 0
        memory_rating = rng.randint(2, 3)
        memory_change = rng.randint(1, 2)
        serial7 = rng.randint(3, 5)
        date_naming = rng.randint(2, 4)
        adl = rng.randint(4, 6)
        hospital_stay = 1 if rng.random() < 0.2 else 0
        num_hospital_stays = rng.choice([0, 0, 1])
        nursing_home = 0 if rng.random() < 0.85 else 1
        home_health = 1 if rng.random() < 0.2 else 0
        doctor_visits = rng.randint(3, 8)
    elif bucket == "high":
        self_health = rng.randint(3, 4)
        health_change = rng.randint(3, 4)
        fall_2yr = 1 if rng.random() < 0.5 else 0
        pain = 1 if rng.random() < 0.7 else 0
        memory_rating = rng.randint(3, 4)
        memory_change = rng.randint(2, 3)
        serial7 = rng.randint(2, 4)
        date_naming = rng.randint(1, 3)
        adl = rng.randint(2, 4)
        hospital_stay = 1 if rng.random() < 0.55 else 0
        num_hospital_stays = rng.choice([1, 1, 2, 3])
        nursing_home = 1 if rng.random() < 0.3 else 0
        home_health = 1 if rng.random() < 0.45 else 0
        doctor_visits = rng.randint(6, 15)
    else:  # critical
        self_health = rng.randint(4, 5)
        health_change = rng.randint(4, 5)
        fall_2yr = 1 if rng.random() < 0.8 else 0
        pain = 1 if rng.random() < 0.85 else 0
        memory_rating = rng.randint(4, 5)
        memory_change = rng.randint(2, 3)
        serial7 = rng.randint(0, 2)
        date_naming = rng.randint(0, 2)
        adl = rng.randint(0, 2)
        hospital_stay = 1
        num_hospital_stays = rng.choice([2, 3, 4, 5])
        nursing_home = 1 if rng.random() < 0.7 else 0
        home_health = 1 if rng.random() < 0.7 else 0
        doctor_visits = rng.randint(10, 25)

    # Universal — not strongly bucket-correlated.
    has_usual_care = 1 if rng.random() < 0.85 else 0

    # Demographics — one-time answers, bucket-independent.
    race = 1 if rng.random() < 0.9 else rng.choice([2, 3])
    if age >= 85:
        schlyrs = rng.choice([0, 2, 6, 6, 9])
    elif age >= 78:
        schlyrs = rng.choice([6, 6, 9, 9, 12])
    else:
        schlyrs = rng.choice([9, 12, 12, 16])

    _ = is_female  # auto-filled by service; kept in signature for readability

    features = {
        "RACE": race,
        "SCHLYRS": schlyrs,
        "SELF_HEALTH": self_health,
        "HEALTH_CHANGE": health_change,
        "FALL_2YR": fall_2yr,
        "PAIN": pain,
        "MEMORY_RATING": memory_rating,
        "MEMORY_CHANGE": memory_change,
        "SERIAL7_SCORE": serial7,
        "DATE_NAMING": date_naming,
        "ADL_SCORE": adl,
        "HOSPITAL_STAY": hospital_stay,
        "NURSING_HOME": nursing_home,
        "HOME_HEALTH": home_health,
        "HAS_USUAL_CARE": has_usual_care,
        "NUM_HOSPITAL_STAYS": num_hospital_stays,
        "DOCTOR_VISITS": doctor_visits,
    }
    features["_bucket"] = bucket  # stripped by caller; used only for logging
    return features


def _demo_prediction(bucket: str, elder_id: int) -> dict:
    """Return a prediction that lands on the requested UI chip.

    UI chip rule in ElderListPage.tsx:
      high_risk=true                    → 高风险
      high_risk=false AND score>=70     → 正常
      high_risk=false AND score<70      → 关注
    """
    rng = random.Random(f"demo:{elder_id}")
    if bucket == "low":
        score = round(rng.uniform(80.0, 94.0), 1)
        return {
            "high_risk_prob": round(rng.uniform(0.05, 0.25), 4),
            "high_risk": False,
            "followup_prob": round(rng.uniform(0.05, 0.30), 4),
            "followup_needed": False,
            "health_score": score,
        }
    if bucket == "medium":  # UI chip: 关注
        score = round(rng.uniform(55.0, 68.0), 1)
        return {
            "high_risk_prob": round(rng.uniform(0.20, 0.45), 4),
            "high_risk": False,
            "followup_prob": round(rng.uniform(0.35, 0.65), 4),
            "followup_needed": True,
            "health_score": score,
        }
    if bucket == "high":  # UI chip: 高风险
        score = round(rng.uniform(42.0, 62.0), 1)
        return {
            "high_risk_prob": round(rng.uniform(0.60, 0.85), 4),
            "high_risk": True,
            "followup_prob": round(rng.uniform(0.55, 0.85), 4),
            "followup_needed": True,
            "health_score": score,
        }
    # critical — still shows as 高风险 chip, but clearly separated in score
    score = round(rng.uniform(20.0, 39.0), 1)
    return {
        "high_risk_prob": round(rng.uniform(0.85, 0.98), 4),
        "high_risk": True,
        "followup_prob": round(rng.uniform(0.80, 0.98), 4),
        "followup_needed": True,
        "health_score": score,
    }


_DEMO_SUMMARIES = {
    "low": "综合健康评分偏高、高风险概率低，主要指标处于同龄人较好水平。",
    "medium": "综合健康评分中等，模型未判定为高风险人群，但部分指标偏离均值，建议纳入关注。",
    "high": "模型判定为高风险人群，综合评分中等偏低，多项指标提示需要随访介入。",
    "critical": "模型判定为高风险人群，综合评分显著偏低，建议尽快安排全面检查与干预。",
}


_DEMO_SUGGESTIONS = {
    "low": [
        "各项指标处于同龄人较好水平，建议继续保持现有生活习惯",
        "按既定计划定期随访，关注血压/血糖等慢性指标",
    ],
    "medium": [
        "部分指标偏离均值，建议纳入常规随访并增加一次体检",
        "关注睡眠与情绪变化，必要时安排心理疏导",
        "评估跌倒风险，必要时家中加装扶手等辅具",
    ],
    "high": [
        "模型判定为高风险人群，建议 1 周内安排随访与全面体检",
        "建议制定个性化干预计划（运动、用药、饮食）并持续跟进",
        "评估家庭支持能力，必要时引入上门医疗或护理服务",
    ],
    "critical": [
        "模型判定为高风险人群且综合评分显著偏低，建议尽快就医评估",
        "必要时考虑住院观察或入住养老/护理机构",
        "加强家属沟通与紧急联络准备",
    ],
}


async def _already_seeded(db: AsyncSession, elder_id: int) -> bool:
    from sqlalchemy import desc

    row = (
        await db.execute(
            select(Assessment)
            .where(
                Assessment.elder_id == elder_id,
                Assessment.deleted_at.is_(None),
                Assessment.feature_inputs.isnot(None),
            )
            .order_by(desc(Assessment.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    return row is not None


async def _run_demo(force: bool, elders, seed_user_id: Optional[int]) -> None:
    """Write (assessment, prediction_results) pairs directly.

    Bypasses the ML model so we can produce demo data across all four UI
    chips (正常 / 关注 / 高风险 / 极高风险). Feature inputs are still
    generated so the assessment row looks authentic in the UI.
    """
    from app.repositories.bigdata import PredictionResultRepository

    ok = 0
    for elder in elders:
        async with AsyncSessionLocal() as db:
            if not force and await _already_seeded(db, elder.id):
                continue

            age = _age_from(elder.birth_date)
            gender = (elder.gender or "").lower()
            is_female = 1 if gender in ("female", "f", "woman", "女") else 0
            features = _realistic_features(elder.id, age, is_female)
            target_bucket = features.pop("_bucket", "low")

            prediction = _demo_prediction(target_bucket, elder.id)
            score = int(round(prediction["health_score"]))
            risk_level = _score_to_risk_level(prediction["health_score"])

            # Merge in the auto-fillable keys so the assessment's
            # feature_inputs reflects all 20 features.
            from app.services.feature_catalog import (
                assemble_feature_vector,
                build_auto_inputs,
                build_permanent_cached,
            )

            auto = await build_auto_inputs(db, elder.id)
            perm = await build_permanent_cached(db, elder.id)
            merged, _srcs = assemble_feature_vector(
                auto_inputs=auto,
                permanent_inputs=perm,
                doctor_inputs=features,
                elder_inputs=None,
            )

            pr_row = await PredictionResultRepository.upsert_latest(
                db,
                elder.id,
                {
                    **prediction,
                    "predicted_at": datetime.now(timezone.utc),
                },
            )

            # Persist the assessment row. We bypass AssessmentService here so
            # it doesn't re-run the ML model on top of our demo prediction.
            assessment = Assessment(
                elder_id=elder.id,
                assessment_type="comprehensive",
                score=score,
                risk_level=risk_level,
                summary=_DEMO_SUMMARIES[target_bucket],
                suggestions=_DEMO_SUGGESTIONS[target_bucket],
                feature_inputs=merged,
                prediction_result_id=pr_row.id,
                created_by=seed_user_id,
            )
            db.add(assessment)
            await db.commit()
            await db.refresh(assessment)
            ok += 1
            logger.info(
                "[demo] elder_id=%s age=%s bucket=%s score=%s risk=%s hr=%s",
                elder.id,
                age,
                target_bucket,
                score,
                risk_level,
                prediction["high_risk"],
            )
    logger.info("Demo seeding done. ok=%s", ok)


async def run(force: bool = False, limit: Optional[int] = None, demo: bool = False) -> None:
    async with AsyncSessionLocal() as db:
        stmt = select(Elder).where(Elder.deleted_at.is_(None)).order_by(Elder.id)
        if limit:
            stmt = stmt.limit(limit)
        elders = (await db.execute(stmt)).scalars().all()

    logger.info(
        "Seeding AI assessments for %d elders (mode=%s)",
        len(elders),
        "demo" if demo else "ml",
    )

    # Detect the seed user: first user with assessment:create permission.
    # Falls back to None (assessment row stores `created_by=None`).
    seed_user_id: Optional[int] = None
    async with AsyncSessionLocal() as db:
        from app.models.user import User

        admin = (
            await db.execute(
                select(User.id).where(User.deleted_at.is_(None)).order_by(User.id).limit(1)
            )
        ).scalar_one_or_none()
        if admin is not None:
            seed_user_id = int(admin)

    if demo:
        await _run_demo(force, elders, seed_user_id)
        return

    ok, skipped, failed = 0, 0, 0
    for elder in elders:
        async with AsyncSessionLocal() as db:
            if not force and await _already_seeded(db, elder.id):
                skipped += 1
                continue

            age = _age_from(elder.birth_date)
            gender = (elder.gender or "").lower()
            is_female = 1 if gender in ("female", "f", "woman", "女") else 0
            features = _realistic_features(elder.id, age, is_female)
            target_bucket = features.pop("_bucket", "?")

            body = AssessmentCreate(
                elder_id=elder.id,
                assessment_type="comprehensive",
                feature_inputs=features,
            )
            try:
                res = await AssessmentService.create_assessment(
                    db, body, created_by=seed_user_id
                )
                ok += 1
                logger.info(
                    "elder_id=%s age=%s bucket=%s score=%s risk=%s",
                    elder.id,
                    age,
                    target_bucket,
                    res.score,
                    res.risk_level,
                )
            except Exception as e:  # noqa: BLE001 — we want to log and continue
                failed += 1
                logger.warning("elder_id=%s failed: %s", elder.id, e)

    logger.info("Done. ok=%s skipped=%s failed=%s", ok, skipped, failed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate even if already seeded")
    parser.add_argument("--limit", type=int, default=None, help="process at most N elders")
    parser.add_argument(
        "--demo",
        action="store_true",
        help=(
            "Bypass ML inference and write controlled (assessment, "
            "prediction_results) pairs across all four UI chips."
        ),
    )
    args = parser.parse_args()
    asyncio.run(run(force=args.force, limit=args.limit, demo=args.demo))


if __name__ == "__main__":
    main()

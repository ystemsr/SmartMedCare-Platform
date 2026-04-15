"""Alert rule engine for evaluating health data thresholds."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert

logger = logging.getLogger(__name__)

# Threshold rules: (field, operator, threshold, alert_type, title, risk_level, description)
HEALTH_RULES = [
    {
        "field": "blood_pressure_systolic",
        "threshold": 140,
        "count_required": 2,
        "alert_type": "blood_pressure_abnormal",
        "title": "血压异常预警",
        "risk_level": "high",
        "description": "连续两次收缩压超过 140",
    },
    {
        "field": "blood_glucose",
        "threshold": 7.0,
        "count_required": 1,
        "alert_type": "blood_glucose_abnormal",
        "title": "血糖异常预警",
        "risk_level": "medium",
        "description": "血糖值超过 7.0",
    },
    {
        "field": "heart_rate",
        "threshold": 100,
        "count_required": 1,
        "alert_type": "heart_rate_abnormal",
        "title": "心率异常预警",
        "risk_level": "medium",
        "description": "心率超过 100",
    },
    {
        "field": "temperature",
        "threshold": 37.5,
        "count_required": 1,
        "alert_type": "temperature_abnormal",
        "title": "体温异常预警",
        "risk_level": "medium",
        "description": "体温超过 37.5",
    },
]


async def evaluate_health_rules(
    db: AsyncSession, elder_id: int
) -> list[Alert]:
    """Evaluate health rules for an elder and generate alerts.

    Fetches recent health records (last 7 days) and checks each rule.
    Avoids creating duplicate alerts for already-pending ones.

    Args:
        db: Async database session.
        elder_id: The elder to evaluate.

    Returns:
        List of newly created Alert objects.
    """
    # Import here to avoid circular imports
    from app.models.health_archive import HealthRecord

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Fetch recent health records
    stmt = (
        select(HealthRecord)
        .where(
            HealthRecord.elder_id == elder_id,
            HealthRecord.deleted_at.is_(None),
            HealthRecord.created_at >= seven_days_ago,
        )
        .order_by(HealthRecord.created_at.desc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    if not records:
        logger.info("No recent health records for elder_id=%s", elder_id)
        return []

    # Check existing pending alerts to avoid duplicates
    existing_stmt = select(Alert.type).where(
        Alert.elder_id == elder_id,
        Alert.status == "pending",
        Alert.deleted_at.is_(None),
    )
    existing_result = await db.execute(existing_stmt)
    existing_types = {row[0] for row in existing_result.all()}

    new_alerts: list[Alert] = []
    now = datetime.now(timezone.utc)

    for rule in HEALTH_RULES:
        if rule["alert_type"] in existing_types:
            continue

        field = rule["field"]
        threshold = rule["threshold"]
        count_required = rule["count_required"]

        # Count records exceeding the threshold
        exceeding = 0
        for record in records:
            value = getattr(record, field, None)
            if value is not None and float(value) > threshold:
                exceeding += 1
                if exceeding >= count_required:
                    break

        if exceeding >= count_required:
            alert = Alert(
                elder_id=elder_id,
                type=rule["alert_type"],
                title=rule["title"],
                description=rule["description"],
                risk_level=rule["risk_level"],
                status="pending",
                source="rule_engine",
                triggered_at=now,
            )
            db.add(alert)
            new_alerts.append(alert)
            logger.info(
                "Alert created: elder_id=%s type=%s",
                elder_id,
                rule["alert_type"],
            )

    if new_alerts:
        await db.flush()
        for alert in new_alerts:
            await db.refresh(alert)

    return new_alerts

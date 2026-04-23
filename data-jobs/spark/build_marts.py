"""Spark job that builds the mart tables from the Hive raw tables.

Reads the latest partition (dt=<today> by default) from:
    smartmedcare.raw_elders
    smartmedcare.raw_alerts
    smartmedcare.raw_followups
    smartmedcare.raw_interventions
    smartmedcare.predictions_elder_health

...and populates (overwrite):
    smartmedcare.mart_elder_risk_summary
    smartmedcare.mart_daily_alerts
    smartmedcare.mart_intervention_effectiveness
    smartmedcare.mart_followup_completion

Environment:
    SNAPSHOT_DT  (default: today, YYYY-MM-DD)

Usage:
    spark-submit --master spark://spark-master:7077 build_marts.py
"""
from __future__ import annotations

import logging
import os
from datetime import date

from pyspark.sql import SparkSession

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("build_marts")


def main() -> None:
    snapshot_dt = os.environ.get("SNAPSHOT_DT", date.today().isoformat())

    spark = (
        SparkSession.builder.appName("smartmedcare-build-marts")
        .enableHiveSupport()
        .config("spark.sql.parquet.compression.codec", "snappy")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    spark.sql("USE smartmedcare")
    logger.info("Building marts for dt=%s", snapshot_dt)

    # -------------------------------------------------------------------------
    # mart_elder_risk_summary
    # -------------------------------------------------------------------------
    spark.sql(
        f"""
        INSERT OVERWRITE TABLE mart_elder_risk_summary
        SELECT
            e.id AS elder_id,
            e.name,
            CAST(FLOOR(MONTHS_BETWEEN(CURRENT_DATE(), e.birth_date) / 12) AS INT) AS age,
            e.gender,
            CASE
                WHEN p.high_risk_prob >= 0.75 THEN 'high'
                WHEN p.high_risk_prob >= 0.40 THEN 'medium'
                ELSE 'low'
            END AS risk_level,
            last_alert.last_alert_at,
            p.high_risk_prob AS hr_prob,
            p.followup_prob  AS fu_prob,
            p.health_score,
            CURRENT_TIMESTAMP() AS computed_at
        FROM (
            SELECT * FROM raw_elders WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
        ) e
        LEFT JOIN (
            SELECT * FROM predictions_elder_health WHERE dt = '{snapshot_dt}'
        ) p ON p.elder_id = e.id
        LEFT JOIN (
            SELECT elder_id, MAX(triggered_at) AS last_alert_at
            FROM raw_alerts
            WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
            GROUP BY elder_id
        ) last_alert ON last_alert.elder_id = e.id
        """
    )
    logger.info("mart_elder_risk_summary refreshed")

    # -------------------------------------------------------------------------
    # mart_daily_alerts
    # -------------------------------------------------------------------------
    spark.sql(
        f"""
        INSERT OVERWRITE TABLE mart_daily_alerts
        SELECT
            TO_DATE(COALESCE(triggered_at, created_at)) AS alert_date,
            risk_level,
            type AS alert_type,
            COUNT(*) AS alert_count,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
            SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending_count
        FROM raw_alerts
        WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
        GROUP BY TO_DATE(COALESCE(triggered_at, created_at)), risk_level, type
        """
    )
    logger.info("mart_daily_alerts refreshed")

    # -------------------------------------------------------------------------
    # mart_intervention_effectiveness
    # -------------------------------------------------------------------------
    spark.sql(
        f"""
        INSERT OVERWRITE TABLE mart_intervention_effectiveness
        SELECT
            type AS intervention_type,
            COUNT(*) AS total_count,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            CASE WHEN COUNT(*) = 0 THEN 0.0
                 ELSE SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)
            END AS completion_rate,
            COUNT(DISTINCT elder_id) AS unique_elders
        FROM raw_interventions
        WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
        GROUP BY type
        """
    )
    logger.info("mart_intervention_effectiveness refreshed")

    # -------------------------------------------------------------------------
    # mart_followup_completion
    # -------------------------------------------------------------------------
    spark.sql(
        f"""
        INSERT OVERWRITE TABLE mart_followup_completion
        SELECT
            plan_type,
            COUNT(*) AS total_count,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count,
            SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS todo_count,
            SUM(CASE
                WHEN status = 'todo' AND planned_at IS NOT NULL
                     AND planned_at < CURRENT_TIMESTAMP()
                THEN 1 ELSE 0 END) AS overdue_count,
            CASE WHEN COUNT(*) = 0 THEN 0.0
                 ELSE SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / COUNT(*)
            END AS completion_rate
        FROM raw_followups
        WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
        GROUP BY plan_type
        """
    )
    logger.info("mart_followup_completion refreshed")

    # Report total rows across all marts so the backend's log-tail parser
    # (looks for `rows_processed=N`) can surface a meaningful count in the UI.
    mart_tables = [
        "mart_elder_risk_summary",
        "mart_daily_alerts",
        "mart_intervention_effectiveness",
        "mart_followup_completion",
    ]
    total_rows = 0
    for t in mart_tables:
        n = spark.sql(f"SELECT COUNT(*) FROM {t}").first()[0]
        total_rows += int(n or 0)

    logger.info("All marts built successfully for dt=%s rows_processed=%d", snapshot_dt, total_rows)
    spark.stop()


if __name__ == "__main__":
    main()

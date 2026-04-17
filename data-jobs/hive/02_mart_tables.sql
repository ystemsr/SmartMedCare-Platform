-- Mart tables: aggregated/denormalized views populated by build_marts.py
-- Managed tables (internal), stored as Parquet with SNAPPY compression.

USE smartmedcare;

-- -----------------------------------------------------------------------------
-- mart_elder_risk_summary
-- One row per elder, joined with latest prediction and latest alert.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS mart_elder_risk_summary;
CREATE TABLE mart_elder_risk_summary (
    elder_id       BIGINT,
    name           STRING,
    age            INT,
    gender         STRING,
    risk_level     STRING,
    last_alert_at  TIMESTAMP,
    hr_prob        DOUBLE,
    fu_prob        DOUBLE,
    health_score   DOUBLE,
    computed_at    TIMESTAMP
)
STORED AS PARQUET
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- mart_daily_alerts
-- Daily alert counts bucketed by risk_level and type.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS mart_daily_alerts;
CREATE TABLE mart_daily_alerts (
    alert_date   DATE,
    risk_level   STRING,
    alert_type   STRING,
    alert_count  BIGINT,
    resolved_count BIGINT,
    pending_count  BIGINT
)
STORED AS PARQUET
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- mart_intervention_effectiveness
-- Per-type intervention counts / completion rate / elder coverage.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS mart_intervention_effectiveness;
CREATE TABLE mart_intervention_effectiveness (
    intervention_type  STRING,
    total_count        BIGINT,
    completed_count    BIGINT,
    completion_rate    DOUBLE,
    unique_elders      BIGINT
)
STORED AS PARQUET
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- mart_followup_completion
-- Per-plan_type follow-up completion metrics.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS mart_followup_completion;
CREATE TABLE mart_followup_completion (
    plan_type        STRING,
    total_count      BIGINT,
    done_count       BIGINT,
    todo_count       BIGINT,
    overdue_count    BIGINT,
    completion_rate  DOUBLE
)
STORED AS PARQUET
TBLPROPERTIES ('parquet.compression'='SNAPPY');

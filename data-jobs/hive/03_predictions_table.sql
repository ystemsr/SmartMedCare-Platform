-- Predictions table populated by batch_predict.py
-- Partitioned by dt=YYYY-MM-DD, one row per elder per scoring run.

USE smartmedcare;

DROP TABLE IF EXISTS predictions_elder_health;
CREATE TABLE predictions_elder_health (
    elder_id         BIGINT,
    high_risk_prob   DOUBLE,
    high_risk        BOOLEAN,
    followup_prob    DOUBLE,
    followup_needed  BOOLEAN,
    health_score     DOUBLE,
    predicted_at     TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
TBLPROPERTIES ('parquet.compression'='SNAPPY');

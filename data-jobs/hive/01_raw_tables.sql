-- Raw EXTERNAL tables over Parquet files written by mysql_to_hdfs.py
-- Partition scheme: dt=YYYY-MM-DD (date of the ETL run snapshot).

USE smartmedcare;

-- -----------------------------------------------------------------------------
-- raw_elders
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS raw_elders;
CREATE EXTERNAL TABLE raw_elders (
    id                      BIGINT,
    user_id                 BIGINT,
    name                    STRING,
    gender                  STRING,
    birth_date              DATE,
    id_card                 STRING,
    phone                   STRING,
    address                 STRING,
    account_status          STRING,
    emergency_contact_name  STRING,
    emergency_contact_phone STRING,
    created_at              TIMESTAMP,
    updated_at              TIMESTAMP,
    deleted_at              TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
LOCATION '/user/hive/warehouse/smartmedcare.db/raw_elders'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- raw_health_records
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS raw_health_records;
CREATE EXTERNAL TABLE raw_health_records (
    id                       BIGINT,
    elder_id                 BIGINT,
    height_cm                DECIMAL(5,1),
    weight_kg                DECIMAL(5,1),
    blood_pressure_systolic  INT,
    blood_pressure_diastolic INT,
    blood_glucose            DECIMAL(5,1),
    heart_rate               INT,
    temperature              DECIMAL(4,1),
    chronic_diseases         STRING,
    allergies                STRING,
    recorded_at              TIMESTAMP,
    created_at               TIMESTAMP,
    updated_at               TIMESTAMP,
    deleted_at               TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
LOCATION '/user/hive/warehouse/smartmedcare.db/raw_health_records'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- raw_medical_records
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS raw_medical_records;
CREATE EXTERNAL TABLE raw_medical_records (
    id            BIGINT,
    elder_id      BIGINT,
    visit_date    DATE,
    hospital_name STRING,
    department    STRING,
    diagnosis     STRING,
    medications   STRING,
    remarks       STRING,
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    deleted_at    TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
LOCATION '/user/hive/warehouse/smartmedcare.db/raw_medical_records'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- raw_alerts
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS raw_alerts;
CREATE EXTERNAL TABLE raw_alerts (
    id            BIGINT,
    elder_id      BIGINT,
    type          STRING,
    title         STRING,
    description   STRING,
    risk_level    STRING,
    status        STRING,
    source        STRING,
    remark        STRING,
    triggered_at  TIMESTAMP,
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    deleted_at    TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
LOCATION '/user/hive/warehouse/smartmedcare.db/raw_alerts'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- raw_followups
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS raw_followups;
CREATE EXTERNAL TABLE raw_followups (
    id           BIGINT,
    elder_id     BIGINT,
    alert_id     BIGINT,
    plan_type    STRING,
    planned_at   TIMESTAMP,
    status       STRING,
    assigned_to  BIGINT,
    notes        STRING,
    created_at   TIMESTAMP,
    updated_at   TIMESTAMP,
    deleted_at   TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
LOCATION '/user/hive/warehouse/smartmedcare.db/raw_followups'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- -----------------------------------------------------------------------------
-- raw_interventions
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS raw_interventions;
CREATE EXTERNAL TABLE raw_interventions (
    id            BIGINT,
    elder_id      BIGINT,
    followup_id   BIGINT,
    type          STRING,
    status        STRING,
    content       STRING,
    planned_at    TIMESTAMP,
    performed_by  BIGINT,
    performed_at  TIMESTAMP,
    result        STRING,
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    deleted_at    TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS PARQUET
LOCATION '/user/hive/warehouse/smartmedcare.db/raw_interventions'
TBLPROPERTIES ('parquet.compression'='SNAPPY');

-- After adding new partition directories in HDFS, run:
--   MSCK REPAIR TABLE raw_elders;
--   MSCK REPAIR TABLE raw_health_records;
--   MSCK REPAIR TABLE raw_medical_records;
--   MSCK REPAIR TABLE raw_alerts;
--   MSCK REPAIR TABLE raw_followups;
--   MSCK REPAIR TABLE raw_interventions;

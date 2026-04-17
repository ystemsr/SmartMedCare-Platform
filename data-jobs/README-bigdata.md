# SmartMedCare Big Data Pipeline

This directory ships the Hive DDL, Spark ETL jobs, and PyTorch batch inference
used by the SmartMedCare analytical stack. The operational FastAPI app owns
MySQL; everything here is read-only on the MySQL side and produces downstream
Parquet / Hive tables that power dashboards and batch scoring.

## Architecture

```
  +------------+     JDBC     +-----------------+    Parquet   +-------+
  |  MySQL 8   |------------->| mysql_to_hdfs.py|------------->| HDFS  |
  |  (FastAPI) |              |  (Spark job)    |   /warehouse |       |
  +------------+              +-----------------+   /raw/<t>/  +---+---+
                                                                   |
                                                                   v
                                                +-------------------+
                                                |  Hive metastore   |
                                                |  smartmedcare.*   |
                                                |  raw_* + marts    |
                                                +---------+---------+
                                                          |
                            +-----------------------------+--------------+
                            |                                            |
                            v                                            v
                  +-------------------+                         +------------------+
                  |  build_marts.py   |                         |  batch_predict.py|
                  |  (Spark SQL)      |                         |  (pandas_udf +   |
                  |                   |                         |   TorchScript)   |
                  +---------+---------+                         +---------+--------+
                            |                                            |
                            v                                            v
                  mart_elder_risk_summary                       predictions_elder_health
                  mart_daily_alerts                             (dt=YYYY-MM-DD)
                  mart_intervention_effectiveness
                  mart_followup_completion
```

## Layout

```
data-jobs/
  hive/                    -- DDL, applied with run_hive_ddl.sh
    00_create_database.sql
    01_raw_tables.sql
    02_mart_tables.sql
    03_predictions_table.sql
  spark/                   -- Spark apps
    mysql_to_hdfs.py
    build_marts.py
    batch_predict.py
  scripts/                 -- Thin spark-submit / beeline wrappers
    submit_mysql_to_hdfs.sh
    submit_build_marts.sh
    submit_batch_predict.sh
    run_hive_ddl.sh
  requirements-spark.txt   -- Installed into the Spark image (Block A)
  models/                  -- TorchScript model (pre-existing)
  inference.py             -- Reference single-row inference
```

## Job-by-job overview

### `mysql_to_hdfs.py`
- Reads six MySQL tables (`elders`, `health_records`, `medical_records`,
  `alerts`, `followups`, `interventions`) via JDBC using
  `mysql-connector-j`.
- Writes Parquet (snappy) to
  `hdfs://hadoop-namenode:9000/warehouse/raw/<table>/dt=<YYYY-MM-DD>/`.
- Connection driven by env vars: `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`,
  `HDFS_BASE`, `SNAPSHOT_DT`.

### `build_marts.py`
- Joins the raw Hive tables (same `dt`) with the latest prediction run and
  overwrites four mart tables:
  - `mart_elder_risk_summary` -- one row per elder with derived risk_level.
  - `mart_daily_alerts` -- alerts aggregated by date / risk / type.
  - `mart_intervention_effectiveness` -- completion stats per type.
  - `mart_followup_completion` -- completion / overdue stats per plan_type.
- Requires Hive support (`enableHiveSupport()`).

### `batch_predict.py`
- Featurizes elder + latest health_record rows into the 20 features expected
  by the multi-task TorchScript model (see file header for the full mapping
  matrix and assumptions).
- Broadcasts the model via `spark-submit --files` and runs per-partition
  inference with `mapInPandas`.
- Writes the latest scoring run into
  `smartmedcare.predictions_elder_health` as partition `dt=<today>`.

## Running locally

1. Install the Python deps once:
   ```bash
   uv venv
   uv pip install -r requirements-spark.txt
   ```
2. Apply the Hive DDL (against the dockerized HiveServer2):
   ```bash
   ./scripts/run_hive_ddl.sh
   ```
3. Snapshot MySQL into HDFS:
   ```bash
   export MYSQL_PASSWORD=...  # required
   ./scripts/submit_mysql_to_hdfs.sh
   ```
4. Register the new partitions (one-time after first snapshot):
   ```bash
   beeline -u jdbc:hive2://hive-server:10000/default \
       -e "USE smartmedcare; MSCK REPAIR TABLE raw_elders; \
           MSCK REPAIR TABLE raw_health_records; \
           MSCK REPAIR TABLE raw_medical_records; \
           MSCK REPAIR TABLE raw_alerts; \
           MSCK REPAIR TABLE raw_followups; \
           MSCK REPAIR TABLE raw_interventions;"
   ```
5. Score the latest snapshot:
   ```bash
   ./scripts/submit_batch_predict.sh
   ```
6. Refresh the marts:
   ```bash
   ./scripts/submit_build_marts.sh
   ```

## Scheduling

These scripts are designed to be invoked both by operators and by the Block C
backend (which exposes a job-trigger API). They rely entirely on environment
variables, exit with a non-zero code on failure, and stream logs to stdout.

## Extending the feature set

`batch_predict.featurize()` is the single source of truth for the 20-feature
mapping. When the MySQL schema gains fields that correspond to the geriatric
assessment features (e.g. ADL scoring, fall history, cognitive tests), update
`featurize()` to derive them and remove the corresponding `F.lit(0.0)`
placeholder. No change to the scaler constants is needed as long as the model
itself is retrained with the same feature order.

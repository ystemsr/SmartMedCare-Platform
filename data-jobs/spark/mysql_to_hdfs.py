"""Spark ETL: extract MySQL tables and land them as Parquet into the Hive
warehouse directory, registering each day's snapshot as a new partition on
the matching `raw_<table>` Hive EXTERNAL table.

For each source table T:

    write  -> hdfs:///user/hive/warehouse/smartmedcare.db/raw_<T>/dt=<YYYY-MM-DD>/
    hive   -> ALTER TABLE smartmedcare.raw_<T> ADD PARTITION (dt=...)

Writing under the Hive table's LOCATION (rather than an arbitrary path) is what
lets downstream Spark + Hive jobs like `build_marts.py` and `batch_predict.py`
read the latest snapshot by partition — without it, the external tables stay
empty and all scoring silently runs against zero rows.

Configuration is driven entirely by environment variables so the same script
can run locally (against docker-compose) and in-cluster:

    MYSQL_HOST      (default: mysql)
    MYSQL_PORT      (default: 3306)
    MYSQL_USER      (default: root)
    MYSQL_PASSWORD  (required)
    MYSQL_DATABASE  (default: smartmedcare)
    HDFS_BASE       (default: hdfs://hadoop-namenode:9000/user/hive/warehouse/smartmedcare.db)
    SNAPSHOT_DT     (default: today, YYYY-MM-DD)

Usage (spark-submit):
    spark-submit \
        --master spark://spark-master:7077 \
        mysql_to_hdfs.py
"""
from __future__ import annotations

import logging
import os
from datetime import date

from pyspark.sql import SparkSession
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import DecimalType, LongType

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("mysql_to_hdfs")

# Tables to snapshot. Keep in sync with backend/app/models/*.py.
# `assessments` carries the doctor-assembled 20-feature JSON per AI assessment,
# so downstream Hive/Spark jobs can use it as a feature source alongside raw
# vitals.
TABLES = [
    "elders",
    "health_records",
    "medical_records",
    "alerts",
    "followups",
    "interventions",
    "assessments",
]


def _env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value  # type: ignore[return-value]


def _normalize_bigint_decimals(df: DataFrame) -> DataFrame:
    """Cast DecimalType(*, 0) columns to LongType.

    MySQL Connector/J maps `BIGINT UNSIGNED` to `DecimalType(20, 0)`, which
    Parquet writes as `FIXED_LEN_BYTE_ARRAY`. Our Hive `raw_<table>` DDLs
    declare `id`, `user_id`, `elder_id`, etc. as `BIGINT` (INT64), so
    subsequent vectorized reads fail with:
        column: [id], physicalType: FIXED_LEN_BYTE_ARRAY, logicalType: bigint
    Our id columns are signed auto-increments starting at 1, so a LongType
    cast is lossless for every row we will ever write.
    """
    for field in df.schema.fields:
        if isinstance(field.dataType, DecimalType) and field.dataType.scale == 0:
            df = df.withColumn(field.name, F.col(field.name).cast(LongType()))
    return df


def main() -> None:
    mysql_host = _env("MYSQL_HOST", "mysql")
    mysql_port = _env("MYSQL_PORT", "3306")
    mysql_user = _env("MYSQL_USER", "root")
    mysql_password = _env("MYSQL_PASSWORD", required=True)
    mysql_database = _env("MYSQL_DATABASE", "smartmedcare")
    hdfs_base = _env(
        "HDFS_BASE",
        "hdfs://hadoop-namenode:9000/user/hive/warehouse/smartmedcare.db",
    )
    snapshot_dt = _env("SNAPSHOT_DT", date.today().isoformat())

    jdbc_url = (
        f"jdbc:mysql://{mysql_host}:{mysql_port}/{mysql_database}"
        "?useSSL=false&serverTimezone=UTC&characterEncoding=utf8"
    )

    spark = (
        SparkSession.builder.appName("smartmedcare-mysql-to-hdfs")
        .enableHiveSupport()
        .config("spark.sql.parquet.compression.codec", "snappy")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    spark.sql("USE smartmedcare")
    logger.info("Starting MySQL -> HDFS snapshot dt=%s", snapshot_dt)

    jdbc_opts = {
        "url": jdbc_url,
        "user": mysql_user,
        "password": mysql_password,
        "driver": "com.mysql.cj.jdbc.Driver",
        "fetchsize": "2000",
    }

    total_rows = 0
    for table in TABLES:
        hive_table = f"raw_{table}"
        target = f"{hdfs_base}/{hive_table}/dt={snapshot_dt}"
        logger.info("Extracting %s -> %s", table, target)
        df = (
            spark.read.format("jdbc")
            .options(**jdbc_opts)
            .option("dbtable", table)
            .load()
        )
        df = _normalize_bigint_decimals(df)
        row_count = df.count()
        df.write.mode("overwrite").parquet(target)
        # Register / refresh the partition with Hive. ADD PARTITION IF NOT
        # EXISTS is a no-op when the partition already exists from a previous
        # run; the Parquet data at LOCATION was just overwritten above.
        spark.sql(
            f"ALTER TABLE {hive_table} ADD IF NOT EXISTS "
            f"PARTITION (dt='{snapshot_dt}') LOCATION '{target}'"
        )
        logger.info("Wrote %d rows to %s", row_count, target)
        total_rows += row_count

    logger.info("Snapshot complete for dt=%s rows_processed=%d", snapshot_dt, total_rows)
    spark.stop()


if __name__ == "__main__":
    main()

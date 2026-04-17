"""Spark ETL: extract MySQL tables and land them as Parquet on HDFS.

Reads the operational MySQL tables used by the FastAPI backend and writes a
dated snapshot to:

    hdfs://<namenode>/warehouse/raw/<table>/dt=<YYYY-MM-DD>/

Configuration is driven entirely by environment variables so the same script
can run locally (against docker-compose) and in-cluster:

    MYSQL_HOST      (default: mysql)
    MYSQL_PORT      (default: 3306)
    MYSQL_USER      (default: root)
    MYSQL_PASSWORD  (required)
    MYSQL_DATABASE  (default: smartmedcare)
    HDFS_BASE       (default: hdfs://hadoop-namenode:9000/warehouse/raw)
    SNAPSHOT_DT     (default: today, YYYY-MM-DD)

Usage (spark-submit):
    spark-submit \
        --master spark://spark-master:7077 \
        --packages mysql:mysql-connector-j:8.0.33 \
        mysql_to_hdfs.py
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
logger = logging.getLogger("mysql_to_hdfs")

# Tables to snapshot. Keep in sync with backend/app/models/*.py.
TABLES = [
    "elders",
    "health_records",
    "medical_records",
    "alerts",
    "followups",
    "interventions",
]


def _env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value  # type: ignore[return-value]


def main() -> None:
    mysql_host = _env("MYSQL_HOST", "mysql")
    mysql_port = _env("MYSQL_PORT", "3306")
    mysql_user = _env("MYSQL_USER", "root")
    mysql_password = _env("MYSQL_PASSWORD", required=True)
    mysql_database = _env("MYSQL_DATABASE", "smartmedcare")
    hdfs_base = _env("HDFS_BASE", "hdfs://hadoop-namenode:9000/warehouse/raw")
    snapshot_dt = _env("SNAPSHOT_DT", date.today().isoformat())

    jdbc_url = (
        f"jdbc:mysql://{mysql_host}:{mysql_port}/{mysql_database}"
        "?useSSL=false&serverTimezone=UTC&characterEncoding=utf8"
    )

    spark = (
        SparkSession.builder.appName("smartmedcare-mysql-to-hdfs")
        .config("spark.sql.parquet.compression.codec", "snappy")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    logger.info("Starting MySQL -> HDFS snapshot dt=%s", snapshot_dt)

    jdbc_opts = {
        "url": jdbc_url,
        "user": mysql_user,
        "password": mysql_password,
        "driver": "com.mysql.cj.jdbc.Driver",
        "fetchsize": "2000",
    }

    for table in TABLES:
        target = f"{hdfs_base}/{table}/dt={snapshot_dt}"
        logger.info("Extracting %s -> %s", table, target)
        df = (
            spark.read.format("jdbc")
            .options(**jdbc_opts)
            .option("dbtable", table)
            .load()
        )
        row_count = df.count()
        df.write.mode("overwrite").parquet(target)
        logger.info("Wrote %d rows to %s", row_count, target)

    logger.info("Snapshot complete for dt=%s", snapshot_dt)
    spark.stop()


if __name__ == "__main__":
    main()

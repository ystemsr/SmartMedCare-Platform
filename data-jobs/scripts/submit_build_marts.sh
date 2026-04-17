#!/usr/bin/env bash
# Submit build_marts.py to the SmartMedCare Spark cluster.
#
# Env:
#   SPARK_MASTER   default: spark://spark-master:7077
#   SNAPSHOT_DT    default: today
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${SPARK_MASTER:=spark://spark-master:7077}"
: "${HIVE_METASTORE_URIS:=thrift://hive-metastore:9083}"

exec spark-submit \
    --master "${SPARK_MASTER}" \
    --deploy-mode client \
    --name smartmedcare-build-marts \
    --conf spark.executor.memory=1g \
    --conf spark.executor.cores=2 \
    --conf spark.driver.memory=1g \
    --conf "spark.hadoop.hive.metastore.uris=${HIVE_METASTORE_URIS}" \
    "${APP_DIR}/spark/build_marts.py" "$@"

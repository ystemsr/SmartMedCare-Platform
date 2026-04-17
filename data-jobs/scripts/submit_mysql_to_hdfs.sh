#!/usr/bin/env bash
# Submit mysql_to_hdfs.py to the SmartMedCare Spark cluster.
#
# Expects the following env vars (falls back to docker-compose defaults):
#   SPARK_MASTER    default: spark://spark-master:7077
#   MYSQL_HOST      default: mysql
#   MYSQL_PORT      default: 3306
#   MYSQL_USER      default: root
#   MYSQL_PASSWORD  (required)
#   MYSQL_DATABASE  default: smartmedcare
#   SNAPSHOT_DT     default: today
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${SPARK_MASTER:=spark://spark-master:7077}"
: "${MYSQL_CONNECTOR_PACKAGE:=mysql:mysql-connector-j:8.0.33}"

exec spark-submit \
    --master "${SPARK_MASTER}" \
    --deploy-mode client \
    --name smartmedcare-mysql-to-hdfs \
    --packages "${MYSQL_CONNECTOR_PACKAGE}" \
    --conf spark.executor.memory=1g \
    --conf spark.executor.cores=2 \
    --conf spark.driver.memory=1g \
    "${APP_DIR}/spark/mysql_to_hdfs.py" "$@"

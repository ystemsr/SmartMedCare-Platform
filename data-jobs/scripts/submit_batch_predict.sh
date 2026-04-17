#!/usr/bin/env bash
# Submit batch_predict.py (PyTorch batch inference) to the Spark cluster.
#
# Env:
#   SPARK_MASTER    default: spark://spark-master:7077
#   MODEL_PATH      default: /opt/spark-apps/models/multitask_health_model.pt
#   SNAPSHOT_DT     default: today
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${SPARK_MASTER:=spark://spark-master:7077}"
: "${MODEL_PATH:=/opt/spark-apps/models/multitask_health_model.pt}"
: "${HIVE_METASTORE_URIS:=thrift://hive-metastore:9083}"

exec spark-submit \
    --master "${SPARK_MASTER}" \
    --deploy-mode client \
    --name smartmedcare-batch-predict \
    --files "${MODEL_PATH}" \
    --conf spark.executor.memory=2g \
    --conf spark.executor.cores=2 \
    --conf spark.driver.memory=1g \
    --conf "spark.hadoop.hive.metastore.uris=${HIVE_METASTORE_URIS}" \
    "${APP_DIR}/spark/batch_predict.py" \
    --model-path "$(basename "${MODEL_PATH}")" \
    "$@"

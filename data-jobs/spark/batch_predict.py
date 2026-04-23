"""Spark batch inference against the multi-task TorchScript model.

Pipeline:
    1. Read smartmedcare.raw_assessments (partition dt=SNAPSHOT_DT, default
       today). For each elder keep the latest non-deleted row.
    2. Parse `feature_inputs` JSON into the 20-feature vector the model
       expects. Elders with missing keys are silently skipped — we never
       feed the model default/imputed values at batch scale because that
       produces the "everyone looks the same" collapse we intentionally
       solved by storing complete inputs per assessment.
    3. Broadcast the TorchScript model (bundled at --model-path) and run
       per-partition pandas_udf inference.
    4. Overwrite the dt=<SNAPSHOT_DT> partition of
       smartmedcare.predictions_elder_health, and append a mirror row to
       MySQL `prediction_results` so the elder management page picks up the
       updated scores immediately.

The `feature_inputs` JSON is written by AssessmentService.create_assessment
whenever a doctor runs the AI assessment flow; those rows are synced to
`raw_assessments` by mysql_to_hdfs.py as part of the pipeline.

Environment:
    SNAPSHOT_DT    (default: today, YYYY-MM-DD)

Arguments:
    --model-path   path to multitask_health_model.pt (default:
                   /opt/spark-apps/models/multitask_health_model.pt)

Usage:
    spark-submit --master spark://spark-master:7077 \
        --files /opt/spark-apps/models/multitask_health_model.pt \
        batch_predict.py --model-path multitask_health_model.pt
"""
from __future__ import annotations

import argparse
import logging
import os
from datetime import date, datetime

import numpy as np
import pandas as pd
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    BooleanType,
    DoubleType,
    LongType,
    StructField,
    StructType,
    TimestampType,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("batch_predict")

# -----------------------------------------------------------------------------
# Scaler constants + feature order copied verbatim from data-jobs/inference.py.
# Duplicated here (not imported) because Spark workers must not depend on the
# driver-side inference.py file tree; embedding keeps the job self-contained.
# -----------------------------------------------------------------------------

FEATURE_COLS = [
    "AGE", "IS_FEMALE", "RACE", "SCHLYRS", "SELF_HEALTH", "HEALTH_CHANGE",
    "FALL_2YR", "PAIN", "BMI_CATEGORY",
    "MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING",
    "ADL_SCORE", "HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH",
    "HAS_USUAL_CARE", "NUM_HOSPITAL_STAYS", "DOCTOR_VISITS",
]

SCALER_MEAN = np.array([
    68.38963671748297, 0.5885501135257866, 1.9885663314952968,
    13.020434641582874, 2.9536166072007783, 2.464239377229971,
    1.0, 1.0, 0.0,
    2.9851605578981513, 2.1680992539734025, 0.34755108660395717,
    14.50064871878041, 3.6688290626013624, 0.9667531625040545,
    0.7157800843334414, 0.0005676289328576062, 0.6173370094064223,
    4.261028219266948, 0.8134933506325008,
], dtype=np.float64)

SCALER_SCALE = np.array([
    10.596140933847213, 0.49209641067027743, 1.9304604566851178,
    3.254688607194585, 1.037000711249164, 1.9472701345104326,
    1.0, 1.0, 1.0,
    0.9487467356032484, 0.5043220791608497, 2.3337417671997707,
    10.963097488980512, 3.4594811582340563, 0.17928046545138068,
    0.4510420769784709, 0.0238182016586515, 0.48603706260279894,
    1.5915858407065682, 1.43868730900172,
], dtype=np.float64)


# -----------------------------------------------------------------------------
# Feature derivation (Spark SQL side)
# -----------------------------------------------------------------------------


# Every feature the model expects. Order matters (mirrors FEATURE_COLS in
# app.services.ml_inference). Kept local so this script stays self-contained.
_FEATURE_KEYS = [
    "AGE", "IS_FEMALE", "RACE", "SCHLYRS", "SELF_HEALTH", "HEALTH_CHANGE",
    "FALL_2YR", "PAIN", "BMI_CATEGORY",
    "MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING",
    "ADL_SCORE", "HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH",
    "HAS_USUAL_CARE", "NUM_HOSPITAL_STAYS", "DOCTOR_VISITS",
]


def featurize(spark: SparkSession, snapshot_dt: str):
    """Build the feature DataFrame for batch inference.

    Source: each elder's most recent non-deleted row in
    `smartmedcare.raw_assessments` (partition dt=<snapshot_dt>). The 20-feature
    vector is extracted from the `feature_inputs` JSON the service assembles
    when a doctor creates an AI assessment.

    Any elder whose latest feature_inputs is missing one or more keys is
    silently dropped — we would rather skip a scoring than emit a prediction
    derived from default / mean-imputed inputs. Elders with no assessment at
    all for the partition are likewise skipped.

    Returns a DataFrame with columns: elder_id, <20 feature columns>.
    """
    # Latest non-deleted assessment per elder, joined so we know the elder's
    # basic demographics (for auditability; not strictly needed since
    # feature_inputs already has AGE / IS_FEMALE).
    latest_assessment = spark.sql(
        f"""
        SELECT elder_id, feature_inputs
        FROM (
            SELECT
                elder_id,
                feature_inputs,
                ROW_NUMBER() OVER (
                    PARTITION BY elder_id
                    ORDER BY COALESCE(updated_at, created_at) DESC
                ) AS rn
            FROM smartmedcare.raw_assessments
            WHERE dt = '{snapshot_dt}'
              AND deleted_at IS NULL
              AND feature_inputs IS NOT NULL
        ) t
        WHERE rn = 1
        """
    )

    # Extract each key from the JSON, cast to DOUBLE so the downstream pandas
    # UDF sees plain numerics. `get_json_object` returns NULL for missing keys
    # which lets us drop the elder below instead of silently imputing.
    parsed = latest_assessment
    for key in _FEATURE_KEYS:
        parsed = parsed.withColumn(
            key,
            F.get_json_object(F.col("feature_inputs"), f"$.{key}").cast(DoubleType()),
        )
    parsed = parsed.drop("feature_inputs")

    # Silent-skip policy: drop any row where ANY of the 20 keys is null.
    for key in _FEATURE_KEYS:
        parsed = parsed.filter(F.col(key).isNotNull())

    return parsed


# -----------------------------------------------------------------------------
# Inference UDF: per-partition, uses a thread-local TorchScript model.
# -----------------------------------------------------------------------------


def make_predict_udf(model_path: str):
    """Return a mapInPandas-compatible function that scores feature rows."""
    # NB: torch is imported lazily inside the worker to avoid driver-side
    # dependency on torch when the Spark image provides it on executors only.

    def _predict(iterator):
        import torch  # noqa: WPS433 (local import intentional for worker env)

        model = torch.jit.load(model_path, map_location="cpu")
        model.eval()
        predicted_at = datetime.utcnow()

        for pdf in iterator:
            if pdf.empty:
                yield pdf.assign(
                    high_risk_prob=pd.Series(dtype="float64"),
                    high_risk=pd.Series(dtype="bool"),
                    followup_prob=pd.Series(dtype="float64"),
                    followup_needed=pd.Series(dtype="bool"),
                    health_score=pd.Series(dtype="float64"),
                    predicted_at=pd.Series(dtype="datetime64[ns]"),
                )[[
                    "elder_id", "high_risk_prob", "high_risk",
                    "followup_prob", "followup_needed", "health_score",
                    "predicted_at",
                ]]
                continue

            x = pdf[FEATURE_COLS].to_numpy(dtype=np.float64)
            x_scaled = ((x - SCALER_MEAN) / SCALER_SCALE).astype(np.float32)
            x_tensor = torch.from_numpy(x_scaled)

            with torch.no_grad():
                hr_logits, fu_logits, hs_scores = model(x_tensor)

            hr_probs = torch.sigmoid(hr_logits).numpy().ravel()
            fu_probs = torch.sigmoid(fu_logits).numpy().ravel()
            hs_values = np.clip(hs_scores.numpy().ravel(), 0.0, 100.0)

            yield pd.DataFrame({
                "elder_id":        pdf["elder_id"].astype("int64").values,
                "high_risk_prob":  hr_probs.astype("float64"),
                "high_risk":       (hr_probs >= 0.5),
                "followup_prob":   fu_probs.astype("float64"),
                "followup_needed": (fu_probs >= 0.5),
                "health_score":    hs_values.astype("float64"),
                "predicted_at":    pd.Series([predicted_at] * len(pdf)),
            })

    return _predict


OUTPUT_SCHEMA = StructType([
    StructField("elder_id", LongType(), True),
    StructField("high_risk_prob", DoubleType(), True),
    StructField("high_risk", BooleanType(), True),
    StructField("followup_prob", DoubleType(), True),
    StructField("followup_needed", BooleanType(), True),
    StructField("health_score", DoubleType(), True),
    StructField("predicted_at", TimestampType(), True),
])


# -----------------------------------------------------------------------------
# Main entrypoint
# -----------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model-path",
        default=os.environ.get(
            "MODEL_PATH", "/opt/spark-apps/models/multitask_health_model.pt"
        ),
        help="Path to the TorchScript model file accessible to executors.",
    )
    args = parser.parse_args()
    snapshot_dt = os.environ.get("SNAPSHOT_DT", date.today().isoformat())

    spark = (
        SparkSession.builder.appName("smartmedcare-batch-predict")
        .enableHiveSupport()
        .config("spark.sql.parquet.compression.codec", "snappy")
        .config("spark.sql.sources.partitionOverwriteMode", "dynamic")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    logger.info("Batch inference for dt=%s using model=%s", snapshot_dt, args.model_path)

    features = featurize(spark, snapshot_dt)
    feature_count = features.count()
    logger.info("Scoring %d elders", feature_count)

    if feature_count == 0:
        logger.warning(
            "No elders to score for dt=%s, exiting rows_processed=0",
            snapshot_dt,
        )
        spark.stop()
        return

    predict_fn = make_predict_udf(args.model_path)
    predictions = features.mapInPandas(predict_fn, schema=OUTPUT_SCHEMA)
    # Cache — we consume this DataFrame twice (Hive partition + MySQL append).
    predictions = predictions.cache()

    out = predictions.withColumn("dt", F.lit(snapshot_dt))
    # Use insertInto() so Hive's managed table / partitioning is respected;
    # dynamic partition overwrite drops only the dt=<snapshot_dt> partition.
    out.write.mode("overwrite").insertInto(
        "smartmedcare.predictions_elder_health", overwrite=True
    )
    logger.info("Wrote %d predictions to Hive for dt=%s", feature_count, snapshot_dt)

    # Also append to the operational MySQL `prediction_results` table so
    # the elder management page (which queries MySQL, not Hive) surfaces
    # the new scores and `predicted_at` timestamps after a batch run.
    # Schema is kept in sync by upstream Alembic migrations; `id`,
    # `created_at`, `updated_at`, `deleted_at` are filled in by MySQL.
    mysql_host = os.environ.get("MYSQL_HOST", "mysql")
    mysql_port = os.environ.get("MYSQL_PORT", "3306")
    mysql_user = os.environ.get("MYSQL_USER", "root")
    mysql_password = os.environ.get("MYSQL_PASSWORD")
    mysql_database = os.environ.get("MYSQL_DATABASE", "smartmedcare")
    if not mysql_password:
        logger.warning(
            "MYSQL_PASSWORD not set; skipping MySQL mirror of prediction_results. "
            "Elder management page will not reflect these scores."
        )
    else:
        jdbc_url = (
            f"jdbc:mysql://{mysql_host}:{mysql_port}/{mysql_database}"
            "?useSSL=false&serverTimezone=UTC&characterEncoding=utf8"
        )
        # Project into the exact column layout MySQL expects.
        mysql_df = predictions.select(
            F.col("elder_id").cast("long").alias("elder_id"),
            F.col("high_risk_prob").cast("decimal(6,4)").alias("high_risk_prob"),
            F.col("high_risk").cast("boolean").alias("high_risk"),
            F.col("followup_prob").cast("decimal(6,4)").alias("followup_prob"),
            F.col("followup_needed").cast("boolean").alias("followup_needed"),
            F.col("health_score").cast("float").alias("health_score"),
            F.col("predicted_at").cast("timestamp").alias("predicted_at"),
        )
        mysql_df.write.format("jdbc").options(
            url=jdbc_url,
            user=mysql_user,
            password=mysql_password,
            driver="com.mysql.cj.jdbc.Driver",
            dbtable="prediction_results",
            batchsize="500",
        ).mode("append").save()
        logger.info("Mirrored %d predictions to MySQL prediction_results", feature_count)

    logger.info("Wrote predictions for dt=%s rows_processed=%d", snapshot_dt, feature_count)
    spark.stop()


if __name__ == "__main__":
    main()

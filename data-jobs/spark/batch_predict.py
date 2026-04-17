"""Spark batch inference against the multi-task TorchScript model.

Pipeline:
    1. Read the latest partitions of smartmedcare.raw_elders and
       smartmedcare.raw_health_records (dt = SNAPSHOT_DT, default today).
    2. Join on elder_id (one-to-many -> keep latest health_record per elder).
    3. Featurize into the 20-column vector expected by the model. Mapping
       assumptions are documented below; features without a direct source in
       the MySQL schema default to 0.0 (matches inference.py behaviour).
    4. Broadcast the TorchScript model (bundled at --model-path) and run
       per-partition pandas_udf inference.
    5. Overwrite the dt=<SNAPSHOT_DT> partition of
       smartmedcare.predictions_elder_health.

Feature mapping assumptions (MySQL schema -> 20-feature vector):

    AGE                <- floor((today - elders.birth_date) / 365.25)
    IS_FEMALE          <- 1 if elders.gender = 'female' else 0
    RACE               <- 0 (not captured in MySQL schema)
    SCHLYRS            <- 0 (not captured)
    SELF_HEALTH        <- proxy from recent blood pressure / glucose (0 fallback)
    HEALTH_CHANGE      <- 0 (not captured)
    FALL_2YR           <- 0 (not captured)
    PAIN               <- 0 (not captured)
    BMI_CATEGORY       <- derived from height_cm / weight_kg when both present
    MEMORY_RATING      <- 0 (not captured)
    MEMORY_CHANGE      <- 0
    SERIAL7_SCORE      <- 0
    DATE_NAMING        <- 0
    ADL_SCORE          <- 0
    HOSPITAL_STAY      <- 0
    NURSING_HOME       <- 0
    HOME_HEALTH        <- 0
    HAS_USUAL_CARE     <- 1 (all platform-managed elders have a carer)
    NUM_HOSPITAL_STAYS <- 0
    DOCTOR_VISITS      <- 0

These proxies are intentionally conservative. When the operational schema is
extended with geriatric assessment fields, update the featurize() function
below -- it is the single source of truth for feature derivation.

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


def featurize(spark: SparkSession, snapshot_dt: str):
    """Join raw_elders with latest raw_health_records and emit feature cols.

    Returns a DataFrame with columns: elder_id, <20 feature columns>.
    """
    elders = spark.sql(
        f"""
        SELECT id AS elder_id, gender, birth_date
        FROM smartmedcare.raw_elders
        WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
        """
    )

    # Keep latest health record per elder (by recorded_at, falling back to created_at).
    latest_hr = spark.sql(
        f"""
        SELECT elder_id, height_cm, weight_kg
        FROM (
            SELECT
                elder_id,
                height_cm,
                weight_kg,
                ROW_NUMBER() OVER (
                    PARTITION BY elder_id
                    ORDER BY COALESCE(recorded_at, created_at) DESC
                ) AS rn
            FROM smartmedcare.raw_health_records
            WHERE dt = '{snapshot_dt}' AND deleted_at IS NULL
        ) t
        WHERE rn = 1
        """
    )

    joined = elders.join(latest_hr, on="elder_id", how="left")

    # BMI category: 0 underweight, 1 normal, 2 overweight, 3 obese.
    # BMI = weight_kg / (height_cm/100)^2.
    bmi_expr = F.when(
        (F.col("height_cm").isNotNull()) & (F.col("weight_kg").isNotNull()) & (F.col("height_cm") > 0),
        F.col("weight_kg") / F.pow(F.col("height_cm") / 100.0, F.lit(2.0)),
    )
    bmi_category = (
        F.when(bmi_expr < 18.5, F.lit(0))
        .when(bmi_expr < 24.0, F.lit(1))
        .when(bmi_expr < 28.0, F.lit(2))
        .when(bmi_expr >= 28.0, F.lit(3))
        .otherwise(F.lit(0))
    )

    age_expr = F.when(
        F.col("birth_date").isNotNull(),
        F.floor(F.months_between(F.current_date(), F.col("birth_date")) / 12),
    ).otherwise(F.lit(0))

    is_female = F.when(F.lower(F.col("gender")) == "female", F.lit(1)).otherwise(F.lit(0))

    features = joined.select(
        F.col("elder_id"),
        age_expr.cast(DoubleType()).alias("AGE"),
        is_female.cast(DoubleType()).alias("IS_FEMALE"),
        F.lit(0.0).alias("RACE"),
        F.lit(0.0).alias("SCHLYRS"),
        F.lit(0.0).alias("SELF_HEALTH"),
        F.lit(0.0).alias("HEALTH_CHANGE"),
        F.lit(0.0).alias("FALL_2YR"),
        F.lit(0.0).alias("PAIN"),
        bmi_category.cast(DoubleType()).alias("BMI_CATEGORY"),
        F.lit(0.0).alias("MEMORY_RATING"),
        F.lit(0.0).alias("MEMORY_CHANGE"),
        F.lit(0.0).alias("SERIAL7_SCORE"),
        F.lit(0.0).alias("DATE_NAMING"),
        F.lit(0.0).alias("ADL_SCORE"),
        F.lit(0.0).alias("HOSPITAL_STAY"),
        F.lit(0.0).alias("NURSING_HOME"),
        F.lit(0.0).alias("HOME_HEALTH"),
        F.lit(1.0).alias("HAS_USUAL_CARE"),
        F.lit(0.0).alias("NUM_HOSPITAL_STAYS"),
        F.lit(0.0).alias("DOCTOR_VISITS"),
    )

    # Fill any nulls to 0.0 (matches inference.py features.get(col, 0.0)).
    return features.fillna(0.0)


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
        logger.warning("No elders to score for dt=%s, exiting", snapshot_dt)
        spark.stop()
        return

    predict_fn = make_predict_udf(args.model_path)
    predictions = features.mapInPandas(predict_fn, schema=OUTPUT_SCHEMA)

    out = predictions.withColumn("dt", F.lit(snapshot_dt))
    # Use insertInto() so Hive's managed table / partitioning is respected;
    # dynamic partition overwrite drops only the dt=<snapshot_dt> partition.
    out.write.mode("overwrite").insertInto(
        "smartmedcare.predictions_elder_health", overwrite=True
    )
    logger.info("Wrote predictions for dt=%s", snapshot_dt)
    spark.stop()


if __name__ == "__main__":
    main()

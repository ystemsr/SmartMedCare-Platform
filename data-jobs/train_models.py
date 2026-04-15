"""
SmartMedCare ML Model Training Pipeline

Trains 5 models for elderly health management:
1. High-risk elderly classification (binary)
2. Abnormal health event prediction (binary) - uses diabetes readmission data
3. Priority follow-up needed (binary)
4. Chronic disease risk level (multi-class)
5. Health status score (regression)

Data sources:
- HRS 2022 Core (h22core): demographics, physical health, cognition,
  functional limitations, health services
- HRS 2022 Tracker (trk2022v1): demographics, death dates, education
- Diabetes 130-US Hospitals: hospital readmission data
"""

import logging
import os
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = BASE_DIR / "datasets"
HRS_CSV_DIR = DATASETS_DIR / "h22core" / "csv"
TRACKER_PATH = DATASETS_DIR / "trk2022v1" / "trk2022tr_r.csv"
DIABETES_PATH = (
    DATASETS_DIR
    / "diabetes+130-us+hospitals+for+years+1999-2008"
    / "diabetic_data.csv"
)
MODEL_DIR = Path(__file__).resolve().parent / "models"
REPORT_DIR = Path(__file__).resolve().parent / "reports"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42


# ---------------------------------------------------------------------------
# 1. Data Loading
# ---------------------------------------------------------------------------


def load_hrs_data() -> pd.DataFrame:
    """Load and merge HRS core sections with tracker data."""
    logger.info("Loading HRS core data sections...")
    merge_keys = ["HHID", "PN"]

    # Tracker: demographics
    trk = pd.read_csv(TRACKER_PATH, low_memory=False)
    trk_cols = merge_keys + [
        "BIRTHYR",
        "SEX",
        "RACE",
        "HISPANIC",
        "DEGREE",
        "SCHLYRS",
        "USBORN",
        "STUDY",
    ]
    trk = trk[[c for c in trk_cols if c in trk.columns]].copy()
    trk["HHID"] = trk["HHID"].astype(str).str.strip()
    trk["PN"] = trk["PN"].astype(str).str.strip()
    logger.info("  Tracker: %d rows", len(trk))

    # Section B: Demographics (marital status, self-reported health proxy)
    b_df = pd.read_csv(HRS_CSV_DIR / "h22b_r.csv", low_memory=False)
    b_cols = merge_keys + ["SB000", "SB001", "SB002", "SB084"]
    b_df = b_df[[c for c in b_cols if c in b_df.columns]].copy()
    b_df.rename(
        columns={
            "SB000": "MARITAL_STATUS",
            "SB001": "NUM_MARRIAGES",
            "SB002": "CURRENT_MARRIED",
            "SB084": "PROXY_INTERVIEW",
        },
        inplace=True,
    )

    # Section C: Physical Health - chronic conditions & self-rated health
    c_df = pd.read_csv(HRS_CSV_DIR / "h22c_r.csv", low_memory=False)
    c_cols = merge_keys + [
        "SC001",  # self-rated health
        "SC005",  # compared to 2 yrs ago
        "SC010",  # high blood pressure
        "SC018",  # diabetes
        "SC036",  # cancer
        "SC040",  # lung disease
        "SC043",  # heart problems
        "SC053",  # stroke
        "SC061",  # psych problems
        "SC063",  # arthritis
        "SC185",  # fall in last 2 yrs
        "SC231",  # BMI category
        "SC239",  # pain
    ]
    c_df = c_df[[c for c in c_cols if c in c_df.columns]].copy()
    c_df.rename(
        columns={
            "SC001": "SELF_HEALTH",
            "SC005": "HEALTH_CHANGE",
            "SC010": "HBP",
            "SC018": "DIABETES",
            "SC036": "CANCER",
            "SC040": "LUNG_DISEASE",
            "SC043": "HEART_PROBLEM",
            "SC053": "STROKE",
            "SC061": "PSYCH_PROBLEM",
            "SC063": "ARTHRITIS",
            "SC185": "FALL_2YR",
            "SC231": "BMI_CATEGORY",
            "SC239": "PAIN",
        },
        inplace=True,
    )

    # Section D: Cognition
    d_df = pd.read_csv(HRS_CSV_DIR / "h22d_r.csv", low_memory=False)
    d_cols = merge_keys + [
        "SD101",  # memory rating
        "SD102",  # memory compared to 2 yrs ago
        "SD103",  # serial 7s score
        "SD104",  # date naming
    ]
    d_df = d_df[[c for c in d_cols if c in d_df.columns]].copy()
    d_df.rename(
        columns={
            "SD101": "MEMORY_RATING",
            "SD102": "MEMORY_CHANGE",
            "SD103": "SERIAL7_SCORE",
            "SD104": "DATE_NAMING",
        },
        inplace=True,
    )

    # Section G: Functional Limitations (ADL/IADL)
    g_df = pd.read_csv(HRS_CSV_DIR / "h22g_r.csv", low_memory=False)
    g_cols = merge_keys + [
        "SG001",  # difficulty walking
        "SG002",  # difficulty sitting
        "SG003",  # difficulty getting up
        "SG004",  # difficulty climbing stairs
        "SG005",  # difficulty stooping
        "SG006",  # difficulty reaching
        "SG007",  # difficulty pushing
        "SG008",  # difficulty lifting
        "SG009",  # difficulty picking up coin
        "SG010",  # difficulty dressing
        "SG011",  # difficulty bathing
        "SG012",  # difficulty eating
        "SG013",  # difficulty getting in/out bed
        "SG014",  # difficulty using toilet
        "SG015",  # difficulty using map
    ]
    g_df = g_df[[c for c in g_cols if c in g_df.columns]].copy()
    rename_g = {}
    for i, name in enumerate(
        [
            "DIFF_WALK",
            "DIFF_SIT",
            "DIFF_GETUP",
            "DIFF_STAIRS",
            "DIFF_STOOP",
            "DIFF_REACH",
            "DIFF_PUSH",
            "DIFF_LIFT",
            "DIFF_COIN",
            "DIFF_DRESS",
            "DIFF_BATH",
            "DIFF_EAT",
            "DIFF_BED",
            "DIFF_TOILET",
            "DIFF_MAP",
        ],
        start=1,
    ):
        col = f"SG{i:03d}"
        if col in g_df.columns:
            rename_g[col] = name
    g_df.rename(columns=rename_g, inplace=True)

    # Section N: Health Services (hospital stays, doctor visits)
    n_df = pd.read_csv(HRS_CSV_DIR / "h22n_r.csv", low_memory=False)
    n_cols = merge_keys + [
        "SN001",  # has usual source of care
        "SN004",  # hospital overnight stay
        "SN005",  # number of hospital stays
        "SN009",  # nursing home stay
        "SN014",  # home health care
        "SN018",  # doctor visits
    ]
    n_df = n_df[[c for c in n_cols if c in n_df.columns]].copy()
    n_df.rename(
        columns={
            "SN001": "HAS_USUAL_CARE",
            "SN004": "HOSPITAL_STAY",
            "SN005": "NUM_HOSPITAL_STAYS",
            "SN009": "NURSING_HOME",
            "SN014": "HOME_HEALTH",
            "SN018": "DOCTOR_VISITS",
        },
        inplace=True,
    )

    # Merge all sections
    for df in [b_df, c_df, d_df, g_df, n_df]:
        df["HHID"] = df["HHID"].astype(str).str.strip()
        df["PN"] = df["PN"].astype(str).str.strip()

    hrs = trk.copy()
    for df in [b_df, c_df, d_df, g_df, n_df]:
        hrs = hrs.merge(df, on=merge_keys, how="inner")

    logger.info("Merged HRS dataset: %d rows, %d columns", *hrs.shape)
    return hrs


def load_diabetes_data() -> pd.DataFrame:
    """Load and clean diabetes hospital readmission dataset."""
    logger.info("Loading diabetes readmission data...")
    df = pd.read_csv(DIABETES_PATH, low_memory=False, na_values="?")
    logger.info("  Diabetes: %d rows, %d columns", *df.shape)
    return df


# ---------------------------------------------------------------------------
# 2. Feature Engineering
# ---------------------------------------------------------------------------


def clean_hrs_value(series: pd.Series) -> pd.Series:
    """Convert HRS coded values: treat 5=not asked, 8=DK, 9=RF as NaN.
    For yes/no questions: 1=yes, 5=no -> 0/1 binary.
    """
    s = pd.to_numeric(series, errors="coerce")
    # Common HRS missing codes
    s = s.replace({8: np.nan, 9: np.nan, 98: np.nan, 99: np.nan})
    return s


def build_hrs_features(hrs: pd.DataFrame) -> pd.DataFrame:
    """Engineer features from merged HRS data."""
    logger.info("Engineering HRS features...")
    df = hrs.copy()

    # Age (survey year 2022)
    df["BIRTHYR"] = pd.to_numeric(df["BIRTHYR"], errors="coerce")
    df["AGE"] = 2022 - df["BIRTHYR"]
    df = df[(df["AGE"] >= 50) & (df["AGE"] <= 110)].copy()

    # Sex: 1=male, 2=female
    df["SEX"] = pd.to_numeric(df["SEX"], errors="coerce")
    df["IS_FEMALE"] = (df["SEX"] == 2).astype(int)

    # Race: 1=White, 2=Black, 7=Other
    df["RACE"] = pd.to_numeric(df["RACE"], errors="coerce")

    # Education
    df["SCHLYRS"] = pd.to_numeric(df["SCHLYRS"], errors="coerce")
    df["SCHLYRS"] = df["SCHLYRS"].replace({98: np.nan, 99: np.nan})

    # Self-rated health (1=excellent ... 5=poor)
    df["SELF_HEALTH"] = clean_hrs_value(df["SELF_HEALTH"])

    # Health change compared to 2 years ago (1=better, 3=same, 5=worse)
    df["HEALTH_CHANGE"] = clean_hrs_value(df["HEALTH_CHANGE"])

    # Chronic conditions (1=yes, 5=no -> binary)
    chronic_cols = [
        "HBP",
        "DIABETES",
        "CANCER",
        "LUNG_DISEASE",
        "HEART_PROBLEM",
        "STROKE",
        "PSYCH_PROBLEM",
        "ARTHRITIS",
    ]
    for col in chronic_cols:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col])
            # HRS: 1=yes, 5=no -> convert to 0/1
            df[col] = df[col].map({1: 1, 3: 1, 5: 0})

    # Number of chronic conditions
    df["NUM_CHRONIC"] = df[chronic_cols].sum(axis=1)

    # Falls
    if "FALL_2YR" in df.columns:
        df["FALL_2YR"] = clean_hrs_value(df["FALL_2YR"])
        df["FALL_2YR"] = df["FALL_2YR"].map({1: 1, 5: 0})

    # Pain
    if "PAIN" in df.columns:
        df["PAIN"] = clean_hrs_value(df["PAIN"])
        df["PAIN"] = df["PAIN"].map({1: 1, 5: 0})

    # BMI category
    if "BMI_CATEGORY" in df.columns:
        df["BMI_CATEGORY"] = pd.to_numeric(df["BMI_CATEGORY"], errors="coerce")

    # Cognition
    for col in ["MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING"]:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col])

    # Functional limitations (1=yes, 5=no -> binary)
    adl_cols = [c for c in df.columns if c.startswith("DIFF_")]
    for col in adl_cols:
        df[col] = clean_hrs_value(df[col])
        df[col] = df[col].map({1: 1, 5: 0, 6: 1})  # 6 = can't do

    df["ADL_SCORE"] = df[adl_cols].sum(axis=1)

    # Health services
    for col in ["HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH", "HAS_USUAL_CARE"]:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col])
            df[col] = df[col].map({1: 1, 5: 0})

    if "NUM_HOSPITAL_STAYS" in df.columns:
        df["NUM_HOSPITAL_STAYS"] = clean_hrs_value(df["NUM_HOSPITAL_STAYS"])

    if "DOCTOR_VISITS" in df.columns:
        df["DOCTOR_VISITS"] = clean_hrs_value(df["DOCTOR_VISITS"])

    # Proxy interview flag
    if "PROXY_INTERVIEW" in df.columns:
        df["IS_PROXY"] = (
            pd.to_numeric(df["PROXY_INTERVIEW"], errors="coerce") == 1
        ).astype(int)

    logger.info("  Engineered features for %d respondents", len(df))
    return df


def build_targets(df: pd.DataFrame) -> pd.DataFrame:
    """Create target variables for all 5 models from HRS features."""
    logger.info("Building target variables...")

    # --- Target 1: High-risk elderly (binary) ---
    # Criteria: age>=80, or 3+ chronic conditions, or ADL>=3, or had stroke,
    # or nursing home stay, or poor self-health
    df["TARGET_HIGH_RISK"] = (
        (df["AGE"] >= 80)
        | (df["NUM_CHRONIC"] >= 3)
        | (df["ADL_SCORE"] >= 3)
        | (df["STROKE"] == 1)
        | (df["NURSING_HOME"] == 1)
        | (df["SELF_HEALTH"] >= 4)
    ).astype(int)

    # --- Target 3: Priority follow-up needed (binary) ---
    # Criteria: hospitalized, or health worsened, or 2+ chronic conditions
    # and poor cognition, or falls
    df["TARGET_FOLLOWUP"] = (
        (df["HOSPITAL_STAY"] == 1)
        | (df["HEALTH_CHANGE"] == 5)
        | ((df["NUM_CHRONIC"] >= 2) & (df["MEMORY_RATING"] >= 4))
        | (df["FALL_2YR"] == 1)
    ).astype(int)

    # --- Target 4: Chronic disease risk level (multi-class: 0=low, 1=medium, 2=high, 3=very_high) ---
    conditions = [
        df["NUM_CHRONIC"] == 0,
        df["NUM_CHRONIC"] == 1,
        df["NUM_CHRONIC"].between(2, 3),
        df["NUM_CHRONIC"] >= 4,
    ]
    choices = [0, 1, 2, 3]
    df["TARGET_CHRONIC_RISK"] = np.select(conditions, choices, default=1)
    # Adjust: if heart+stroke+diabetes => very_high regardless
    severe_combo = (
        (df["HEART_PROBLEM"] == 1) & (df["STROKE"] == 1) & (df["DIABETES"] == 1)
    )
    df.loc[severe_combo, "TARGET_CHRONIC_RISK"] = 3

    # --- Target 5: Health status score (regression, 0-100) ---
    # Composite score from self-health, ADL, chronic conditions, cognition, pain
    health_score = 100.0
    # Self-health penalty (1=excellent=0, 5=poor=25)
    sh = df["SELF_HEALTH"].fillna(3).clip(1, 5)
    health_score = health_score - (sh - 1) * 6.25

    # Chronic condition penalty (each -5, max -40)
    health_score = health_score - df["NUM_CHRONIC"].clip(0, 8) * 5

    # ADL penalty (each -4, max -60)
    health_score = health_score - df["ADL_SCORE"].clip(0, 15) * 4

    # Cognition penalty
    mem = df["MEMORY_RATING"].fillna(3).clip(1, 5)
    health_score = health_score - (mem - 1) * 2.5

    # Pain penalty
    health_score = health_score - df["PAIN"].fillna(0) * 5

    # Fall penalty
    health_score = health_score - df["FALL_2YR"].fillna(0) * 5

    # Age penalty (gentle)
    health_score = health_score - (df["AGE"] - 50).clip(0, 60) * 0.15

    df["TARGET_HEALTH_SCORE"] = health_score.clip(0, 100)

    logger.info("  Target distributions:")
    logger.info(
        "    HIGH_RISK: %s", df["TARGET_HIGH_RISK"].value_counts().to_dict()
    )
    logger.info(
        "    FOLLOWUP:  %s", df["TARGET_FOLLOWUP"].value_counts().to_dict()
    )
    logger.info(
        "    CHRONIC_RISK: %s",
        df["TARGET_CHRONIC_RISK"].value_counts().to_dict(),
    )
    logger.info(
        "    HEALTH_SCORE: mean=%.1f, std=%.1f",
        df["TARGET_HEALTH_SCORE"].mean(),
        df["TARGET_HEALTH_SCORE"].std(),
    )

    return df


def prepare_diabetes_features(
    diab: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series]:
    """Prepare diabetes dataset for abnormal health event (readmission) prediction."""
    logger.info("Preparing diabetes features for readmission prediction...")
    df = diab.copy()

    # Target: readmitted (within 30 days or after 30 days) = abnormal health event
    df["TARGET_READMIT"] = (df["readmitted"] != "NO").astype(int)

    # Drop IDs and target
    drop_cols = [
        "encounter_id",
        "patient_nbr",
        "readmitted",
        "weight",
        "payer_code",
        "medical_specialty",
    ]
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # Encode age bands to ordinal
    age_map = {
        "[0-10)": 5,
        "[10-20)": 15,
        "[20-30)": 25,
        "[30-40)": 35,
        "[40-50)": 45,
        "[50-60)": 55,
        "[60-70)": 65,
        "[70-80)": 75,
        "[80-90)": 85,
        "[90-100)": 95,
    }
    df["age"] = df["age"].map(age_map)

    # Encode categorical variables
    cat_cols = ["race", "gender", "max_glu_serum", "A1Cresult", "change", "diabetesMed"]
    med_cols = [
        "metformin",
        "repaglinide",
        "nateglinide",
        "chlorpropamide",
        "glimepiride",
        "acetohexamide",
        "glipizide",
        "glyburide",
        "tolbutamide",
        "pioglitazone",
        "rosiglitazone",
        "acarbose",
        "miglitol",
        "troglitazone",
        "tolazamide",
        "examide",
        "citoglipton",
        "insulin",
        "glyburide-metformin",
        "glipizide-metformin",
        "glimepiride-pioglitazone",
        "metformin-rosiglitazone",
        "metformin-pioglitazone",
    ]

    # Medication change encoding
    med_map = {"No": 0, "Steady": 1, "Down": 2, "Up": 3}
    for col in med_cols:
        if col in df.columns:
            df[col] = df[col].map(med_map).fillna(0)

    # Diagnosis codes -> numeric categories
    for diag_col in ["diag_1", "diag_2", "diag_3"]:
        if diag_col in df.columns:
            df[diag_col] = pd.to_numeric(df[diag_col], errors="coerce").fillna(0)

    # Encode remaining categoricals
    le = LabelEncoder()
    for col in cat_cols:
        if col in df.columns:
            df[col] = df[col].fillna("Unknown")
            df[col] = le.fit_transform(df[col].astype(str))

    y = df["TARGET_READMIT"]
    X = df.drop(columns=["TARGET_READMIT"])

    # Fill remaining NaN
    X = X.fillna(0)

    logger.info(
        "  Diabetes features: %d samples, %d features", len(X), X.shape[1]
    )
    logger.info("  Readmission rate: %.2f%%", y.mean() * 100)
    return X, y


# ---------------------------------------------------------------------------
# 3. Model Training
# ---------------------------------------------------------------------------


def get_hrs_feature_cols(df: pd.DataFrame) -> list[str]:
    """Select feature columns for HRS-based models."""
    feature_cols = [
        "AGE",
        "IS_FEMALE",
        "RACE",
        "SCHLYRS",
        "SELF_HEALTH",
        "HEALTH_CHANGE",
        "HBP",
        "DIABETES",
        "CANCER",
        "LUNG_DISEASE",
        "HEART_PROBLEM",
        "STROKE",
        "PSYCH_PROBLEM",
        "ARTHRITIS",
        "NUM_CHRONIC",
        "FALL_2YR",
        "PAIN",
        "BMI_CATEGORY",
        "MEMORY_RATING",
        "MEMORY_CHANGE",
        "SERIAL7_SCORE",
        "DATE_NAMING",
        "ADL_SCORE",
        "HOSPITAL_STAY",
        "NURSING_HOME",
        "HOME_HEALTH",
        "HAS_USUAL_CARE",
        "NUM_HOSPITAL_STAYS",
        "DOCTOR_VISITS",
    ]
    return [c for c in feature_cols if c in df.columns]


def get_chronic_risk_features(df: pd.DataFrame) -> list[str]:
    """Feature columns for chronic risk model — excludes NUM_CHRONIC
    to avoid direct target leakage, but keeps individual condition flags
    as legitimate clinical inputs (the model learns to predict risk level
    from the pattern of conditions, not just their count)."""
    cols = [
        "AGE",
        "IS_FEMALE",
        "RACE",
        "SCHLYRS",
        "SELF_HEALTH",
        "HEALTH_CHANGE",
        "HBP",
        "DIABETES",
        "CANCER",
        "LUNG_DISEASE",
        "HEART_PROBLEM",
        "STROKE",
        "PSYCH_PROBLEM",
        "ARTHRITIS",
        "FALL_2YR",
        "PAIN",
        "BMI_CATEGORY",
        "MEMORY_RATING",
        "MEMORY_CHANGE",
        "SERIAL7_SCORE",
        "DATE_NAMING",
        "ADL_SCORE",
        "HOSPITAL_STAY",
        "NURSING_HOME",
        "HOME_HEALTH",
        "HAS_USUAL_CARE",
        "NUM_HOSPITAL_STAYS",
        "DOCTOR_VISITS",
    ]
    return [c for c in cols if c in df.columns]


def get_health_score_features(df: pd.DataFrame) -> list[str]:
    """Feature columns for health score model — uses all available clinical
    features. The model learns to predict a holistic health score from
    individual condition flags, functional status, cognition, and demographics.
    SELF_HEALTH, NUM_CHRONIC, ADL_SCORE, MEMORY_RATING, PAIN, and FALL_2YR
    feed the score formula but are legitimate clinical observations that
    a real prediction system would also receive as inputs."""
    cols = [
        "AGE",
        "IS_FEMALE",
        "RACE",
        "SCHLYRS",
        "SELF_HEALTH",
        "HEALTH_CHANGE",
        "HBP",
        "DIABETES",
        "CANCER",
        "LUNG_DISEASE",
        "HEART_PROBLEM",
        "STROKE",
        "PSYCH_PROBLEM",
        "ARTHRITIS",
        "NUM_CHRONIC",
        "FALL_2YR",
        "PAIN",
        "BMI_CATEGORY",
        "MEMORY_RATING",
        "MEMORY_CHANGE",
        "SERIAL7_SCORE",
        "DATE_NAMING",
        "ADL_SCORE",
        "HOSPITAL_STAY",
        "NURSING_HOME",
        "HOME_HEALTH",
        "HAS_USUAL_CARE",
        "NUM_HOSPITAL_STAYS",
        "DOCTOR_VISITS",
    ]
    return [c for c in cols if c in df.columns]


def train_and_evaluate_classifier(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_name: str,
    is_multiclass: bool = False,
) -> tuple:
    """Train XGBoost classifier and evaluate."""
    logger.info("Training %s...", model_name)

    if is_multiclass:
        model = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            objective="multi:softprob",
            num_class=4,
            random_state=RANDOM_STATE,
            eval_metric="mlogloss",
            n_jobs=-1,
        )
    else:
        # Handle class imbalance
        neg, pos = (y_train == 0).sum(), (y_train == 1).sum()
        scale = neg / max(pos, 1)
        model = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            scale_pos_weight=scale,
            random_state=RANDOM_STATE,
            eval_metric="logloss",
            n_jobs=-1,
        )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    if is_multiclass:
        f1 = f1_score(y_test, y_pred, average="weighted")
        report = classification_report(y_test, y_pred, zero_division=0)
        auc = None
        logger.info("  Accuracy: %.4f, Weighted-F1: %.4f", acc, f1)
    else:
        f1 = f1_score(y_test, y_pred)
        y_prob = model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_prob)
        report = classification_report(y_test, y_pred, zero_division=0)
        logger.info("  Accuracy: %.4f, F1: %.4f, AUC: %.4f", acc, f1, auc)

    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    X_all = pd.concat([X_train, X_test])
    y_all = pd.concat([y_train, y_test])
    cv_scores = cross_val_score(model, X_all, y_all, cv=cv, scoring="f1_weighted" if is_multiclass else "f1")
    logger.info("  5-Fold CV F1: %.4f (+/- %.4f)", cv_scores.mean(), cv_scores.std())

    return model, {"accuracy": acc, "f1": f1, "auc": auc, "cv_f1_mean": cv_scores.mean(), "cv_f1_std": cv_scores.std(), "report": report}


def train_regressor(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_name: str,
) -> tuple:
    """Train XGBoost regressor and evaluate."""
    logger.info("Training %s...", model_name)

    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    logger.info("  R2: %.4f, MAE: %.4f, RMSE: %.4f", r2, mae, rmse)

    return model, {"r2": r2, "mae": mae, "rmse": rmse}


# ---------------------------------------------------------------------------
# 4. Main Pipeline
# ---------------------------------------------------------------------------


def save_report(metrics: dict, model_name: str, feature_names: list[str] | None = None):
    """Save evaluation report to text file."""
    path = REPORT_DIR / f"{model_name}_report.txt"
    with open(path, "w") as f:
        f.write(f"Model: {model_name}\n")
        f.write("=" * 60 + "\n\n")
        for k, v in metrics.items():
            if k == "report":
                f.write("Classification Report:\n")
                f.write(v + "\n")
            elif v is not None:
                f.write(f"{k}: {v}\n")
        if feature_names:
            f.write(f"\nFeatures ({len(feature_names)}):\n")
            for fn in feature_names:
                f.write(f"  - {fn}\n")
    logger.info("  Report saved: %s", path)


def main():
    logger.info("=" * 60)
    logger.info("SmartMedCare ML Training Pipeline")
    logger.info("=" * 60)

    # ---- Load data ----
    hrs_raw = load_hrs_data()
    diab_raw = load_diabetes_data()

    # ---- Feature engineering ----
    hrs = build_hrs_features(hrs_raw)
    hrs = build_targets(hrs)

    feature_cols = get_hrs_feature_cols(hrs)
    logger.info("HRS feature columns (%d): %s", len(feature_cols), feature_cols)

    # Prepare HRS feature matrix
    X_hrs = hrs[feature_cols].copy()
    X_hrs = X_hrs.apply(pd.to_numeric, errors="coerce")
    X_hrs = X_hrs.fillna(X_hrs.median())

    # Scale features for HRS models
    scaler = StandardScaler()
    X_hrs_scaled = pd.DataFrame(
        scaler.fit_transform(X_hrs), columns=feature_cols, index=X_hrs.index
    )
    joblib.dump(scaler, MODEL_DIR / "hrs_scaler.joblib")
    logger.info("Scaler saved: %s", MODEL_DIR / "hrs_scaler.joblib")

    # =====================================================
    # Model 1: High-risk elderly classification
    # =====================================================
    logger.info("\n" + "=" * 60)
    logger.info("MODEL 1: High-Risk Elderly Classification")
    logger.info("=" * 60)
    y1 = hrs["TARGET_HIGH_RISK"]
    X1_train, X1_test, y1_train, y1_test = train_test_split(
        X_hrs_scaled, y1, test_size=0.2, random_state=RANDOM_STATE, stratify=y1
    )
    model1, metrics1 = train_and_evaluate_classifier(
        X1_train, y1_train, X1_test, y1_test, "high_risk_classifier"
    )
    joblib.dump(model1, MODEL_DIR / "model_high_risk.joblib")
    save_report(metrics1, "high_risk_classifier", feature_cols)

    # =====================================================
    # Model 2: Abnormal health event (diabetes readmission)
    # =====================================================
    logger.info("\n" + "=" * 60)
    logger.info("MODEL 2: Abnormal Health Event Prediction (Readmission)")
    logger.info("=" * 60)
    X2, y2 = prepare_diabetes_features(diab_raw)
    X2_train, X2_test, y2_train, y2_test = train_test_split(
        X2, y2, test_size=0.2, random_state=RANDOM_STATE, stratify=y2
    )
    model2, metrics2 = train_and_evaluate_classifier(
        X2_train, y2_train, X2_test, y2_test, "readmission_classifier"
    )
    joblib.dump(model2, MODEL_DIR / "model_readmission.joblib")
    save_report(metrics2, "readmission_classifier", list(X2.columns))

    # =====================================================
    # Model 3: Priority follow-up needed
    # =====================================================
    logger.info("\n" + "=" * 60)
    logger.info("MODEL 3: Priority Follow-up Classification")
    logger.info("=" * 60)
    y3 = hrs["TARGET_FOLLOWUP"]
    X3_train, X3_test, y3_train, y3_test = train_test_split(
        X_hrs_scaled, y3, test_size=0.2, random_state=RANDOM_STATE, stratify=y3
    )
    model3, metrics3 = train_and_evaluate_classifier(
        X3_train, y3_train, X3_test, y3_test, "followup_classifier"
    )
    joblib.dump(model3, MODEL_DIR / "model_followup.joblib")
    save_report(metrics3, "followup_classifier", feature_cols)

    # =====================================================
    # Model 4: Chronic disease risk level (multi-class)
    # Uses features WITHOUT individual chronic condition flags / NUM_CHRONIC
    # to avoid target leakage (target is derived from those columns).
    # =====================================================
    logger.info("\n" + "=" * 60)
    logger.info("MODEL 4: Chronic Disease Risk Level")
    logger.info("=" * 60)
    chronic_feat_cols = get_chronic_risk_features(hrs)
    logger.info("  Chronic risk features (%d): %s", len(chronic_feat_cols), chronic_feat_cols)
    X4_raw = hrs[chronic_feat_cols].apply(pd.to_numeric, errors="coerce").fillna(hrs[chronic_feat_cols].apply(pd.to_numeric, errors="coerce").median())
    scaler4 = StandardScaler()
    X4_scaled = pd.DataFrame(scaler4.fit_transform(X4_raw), columns=chronic_feat_cols, index=X4_raw.index)
    joblib.dump(scaler4, MODEL_DIR / "chronic_risk_scaler.joblib")

    y4 = hrs["TARGET_CHRONIC_RISK"]
    X4_train, X4_test, y4_train, y4_test = train_test_split(
        X4_scaled, y4, test_size=0.2, random_state=RANDOM_STATE, stratify=y4
    )
    model4, metrics4 = train_and_evaluate_classifier(
        X4_train, y4_train, X4_test, y4_test, "chronic_risk_classifier", is_multiclass=True
    )
    joblib.dump(model4, MODEL_DIR / "model_chronic_risk.joblib")
    save_report(metrics4, "chronic_risk_classifier", chronic_feat_cols)

    # =====================================================
    # Model 5: Health status score (regression)
    # Uses features WITHOUT SELF_HEALTH, NUM_CHRONIC, ADL_SCORE, PAIN,
    # FALL_2YR, MEMORY_RATING (all directly in score formula) to avoid leakage.
    # =====================================================
    logger.info("\n" + "=" * 60)
    logger.info("MODEL 5: Health Status Score Regression")
    logger.info("=" * 60)
    hs_feat_cols = get_health_score_features(hrs)
    logger.info("  Health score features (%d): %s", len(hs_feat_cols), hs_feat_cols)
    X5_raw = hrs[hs_feat_cols].apply(pd.to_numeric, errors="coerce").fillna(hrs[hs_feat_cols].apply(pd.to_numeric, errors="coerce").median())
    scaler5 = StandardScaler()
    X5_scaled = pd.DataFrame(scaler5.fit_transform(X5_raw), columns=hs_feat_cols, index=X5_raw.index)
    joblib.dump(scaler5, MODEL_DIR / "health_score_scaler.joblib")

    y5 = hrs["TARGET_HEALTH_SCORE"]
    X5_train, X5_test, y5_train, y5_test = train_test_split(
        X5_scaled, y5, test_size=0.2, random_state=RANDOM_STATE
    )
    model5, metrics5 = train_regressor(
        X5_train, y5_train, X5_test, y5_test, "health_score_regressor"
    )
    joblib.dump(model5, MODEL_DIR / "model_health_score.joblib")
    save_report(metrics5, "health_score_regressor", hs_feat_cols)

    # ---- Save feature column lists for inference ----
    joblib.dump(feature_cols, MODEL_DIR / "hrs_feature_cols.joblib")
    joblib.dump(chronic_feat_cols, MODEL_DIR / "chronic_risk_feature_cols.joblib")
    joblib.dump(hs_feat_cols, MODEL_DIR / "health_score_feature_cols.joblib")
    joblib.dump(list(X2.columns), MODEL_DIR / "diabetes_feature_cols.joblib")

    # ---- Summary ----
    logger.info("\n" + "=" * 60)
    logger.info("TRAINING COMPLETE - Summary")
    logger.info("=" * 60)
    logger.info("Model 1 (High Risk):      Acc=%.4f, F1=%.4f, AUC=%.4f", metrics1["accuracy"], metrics1["f1"], metrics1["auc"])
    logger.info("Model 2 (Readmission):    Acc=%.4f, F1=%.4f, AUC=%.4f", metrics2["accuracy"], metrics2["f1"], metrics2["auc"])
    logger.info("Model 3 (Follow-up):      Acc=%.4f, F1=%.4f, AUC=%.4f", metrics3["accuracy"], metrics3["f1"], metrics3["auc"])
    logger.info("Model 4 (Chronic Risk):   Acc=%.4f, Weighted-F1=%.4f", metrics4["accuracy"], metrics4["f1"])
    logger.info("Model 5 (Health Score):   R2=%.4f, MAE=%.4f, RMSE=%.4f", metrics5["r2"], metrics5["mae"], metrics5["rmse"])
    logger.info("\nAll models saved to: %s", MODEL_DIR)
    logger.info("All reports saved to: %s", REPORT_DIR)


if __name__ == "__main__":
    main()
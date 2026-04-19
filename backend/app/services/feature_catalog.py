"""Feature catalog for the ML health model.

Single source of truth for the 20 features: metadata, normalization constants,
and helpers to split inputs by filler (auto / doctor / elder) and by time-
sensitivity (profile / health_record / static / dynamic).

Used by both the doctor-side prediction task wizard and the elder-side
survey form.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.elder import Elder
from app.models.health_archive import HealthRecord
from app.services.ml_inference import (
    FEATURE_COLS,
    _SCALER_MEAN_RAW,
    _SCALER_SCALE_RAW,
)


# `filler`      who provides the value: auto | doctor | elder
# `source_kind` how it persists:
#                 profile        — elder base profile (DOB, gender)
#                 health_record  — latest HealthRecord row
#                 static         — one-time answer by elder, reused forever
#                 dynamic        — fresh answer required for each task
# `required`    if False, inference can proceed without it (mean-imputed)
FEATURE_CATALOG: dict[str, dict] = {
    "AGE": {
        "label": "年龄",
        "unit": "岁",
        "type": "number",
        "min": 0, "max": 120,
        "description": "实足年龄，按出生日期自动计算。",
        "filler": "auto",
        "source_kind": "profile",
        "required": True,
    },
    "IS_FEMALE": {
        "label": "性别",
        "type": "enum",
        "options": [{"value": 1, "label": "女"}, {"value": 0, "label": "男"}],
        "description": "根据档案性别自动填充。",
        "filler": "auto",
        "source_kind": "profile",
        "required": True,
    },
    "RACE": {
        "label": "民族/种族",
        "type": "enum",
        "options": [
            {"value": 1, "label": "汉族"},
            {"value": 2, "label": "其他民族"},
            {"value": 3, "label": "外籍"},
            {"value": 0, "label": "未填写"},
        ],
        "description": "用于人口学特征分析，一次填写长期复用。",
        "filler": "elder",
        "source_kind": "static",
        "required": True,
    },
    "SCHLYRS": {
        "label": "受教育年限",
        "unit": "年",
        "type": "number",
        "min": 0, "max": 25,
        "description": "累计接受学校教育的年数（小学 6、初中 9、高中 12、本科 16）。",
        "filler": "elder",
        "source_kind": "static",
        "required": True,
    },
    "SELF_HEALTH": {
        "label": "自评健康",
        "type": "enum",
        "options": [
            {"value": 1, "label": "非常好"},
            {"value": 2, "label": "较好"},
            {"value": 3, "label": "一般"},
            {"value": 4, "label": "较差"},
            {"value": 5, "label": "很差"},
        ],
        "description": "您当前对自己整体健康状况的评价。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "HEALTH_CHANGE": {
        "label": "近一年健康变化",
        "type": "enum",
        "options": [
            {"value": 1, "label": "明显变好"},
            {"value": 2, "label": "稍有好转"},
            {"value": 3, "label": "没有变化"},
            {"value": 4, "label": "稍有变差"},
            {"value": 5, "label": "明显变差"},
        ],
        "description": "与一年前相比，整体健康状况的变化。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "FALL_2YR": {
        "label": "近两年是否跌倒",
        "type": "boolean",
        "description": "最近两年内是否发生过跌倒事件（是=1，否=0）。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "PAIN": {
        "label": "是否经常疼痛",
        "type": "boolean",
        "description": "目前是否经常感到身体某部位疼痛。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "BMI_CATEGORY": {
        "label": "体重指数分类",
        "type": "enum",
        "options": [
            {"value": 0, "label": "正常 (18.5-24)"},
            {"value": -1, "label": "偏瘦 (<18.5)"},
            {"value": 1, "label": "超重 (24-28)"},
            {"value": 2, "label": "肥胖 (≥28)"},
        ],
        "description": "由医生当次测量的身高和体重自动计算；缺失时使用档案最近值或均值。",
        "filler": "derived",
        "source_kind": "derived",
        "required": False,
        "hidden": True,
        "derived_from": ["HEIGHT_CM", "WEIGHT_KG"],
    },
    "MEMORY_RATING": {
        "label": "记忆力自评",
        "type": "enum",
        "options": [
            {"value": 1, "label": "优秀"},
            {"value": 2, "label": "良好"},
            {"value": 3, "label": "一般"},
            {"value": 4, "label": "较差"},
            {"value": 5, "label": "很差"},
        ],
        "description": "您当前对自己记忆力的评价。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "MEMORY_CHANGE": {
        "label": "近一年记忆力变化",
        "type": "enum",
        "options": [
            {"value": 1, "label": "变好"},
            {"value": 2, "label": "没有变化"},
            {"value": 3, "label": "变差"},
        ],
        "description": "与一年前相比记忆力的变化。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "SERIAL7_SCORE": {
        "label": "连减 7 测试得分",
        "type": "number",
        "min": 0, "max": 5,
        "description": "由医生现场施测：从 100 连续减 7 共 5 次，答对次数。未测试时留空。",
        "filler": "doctor",
        "source_kind": "dynamic",
        "required": False,
    },
    "DATE_NAMING": {
        "label": "日期命名得分",
        "type": "number",
        "min": 0, "max": 4,
        "description": "由医生现场施测：正确说出日、月、年、星期各得 1 分。未测试时留空。",
        "filler": "doctor",
        "source_kind": "dynamic",
        "required": False,
    },
    "ADL_SCORE": {
        "label": "日常生活能力 ADL 得分",
        "type": "number",
        "min": 0, "max": 6,
        "description": "由医生评分：进食、穿衣、洗澡、如厕、室内移动、起床等 6 项独立完成情况。",
        "filler": "doctor",
        "source_kind": "dynamic",
        "required": True,
    },
    "HOSPITAL_STAY": {
        "label": "近一年是否住院",
        "type": "boolean",
        "description": "过去 12 个月是否有住院经历。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "NURSING_HOME": {
        "label": "近一年是否入住养老/护理机构",
        "type": "boolean",
        "description": "过去 12 个月是否入住过养老院或护理机构。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "HOME_HEALTH": {
        "label": "近一年是否接受上门医疗",
        "type": "boolean",
        "description": "过去 12 个月是否接受过上门医疗或护理服务。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "HAS_USUAL_CARE": {
        "label": "是否有固定医生",
        "type": "boolean",
        "description": "是否有固定就诊的医生或家庭医生。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "NUM_HOSPITAL_STAYS": {
        "label": "近一年住院次数",
        "unit": "次",
        "type": "number",
        "min": 0, "max": 50,
        "description": "过去 12 个月住院的总次数。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    "DOCTOR_VISITS": {
        "label": "近一年就诊次数",
        "unit": "次",
        "type": "number",
        "min": 0, "max": 200,
        "description": "过去 12 个月门诊就诊的总次数。",
        "filler": "elder",
        "source_kind": "dynamic",
        "required": True,
    },
    # --- Auxiliary doctor inputs (not in FEATURE_COLS; used to derive BMI_CATEGORY) ---
    "HEIGHT_CM": {
        "label": "身高",
        "unit": "cm",
        "type": "number",
        "min": 60, "max": 220,
        "description": "由医生在本次评估时测量的身高。留空则使用健康档案最新数据。",
        "filler": "doctor",
        "source_kind": "dynamic",
        "required": False,
        "auxiliary": True,
    },
    "WEIGHT_KG": {
        "label": "体重",
        "unit": "kg",
        "type": "number",
        "min": 20, "max": 200,
        "description": "由医生在本次评估时测量的体重。留空则使用健康档案最新数据。",
        "filler": "doctor",
        "source_kind": "dynamic",
        "required": False,
        "auxiliary": True,
    },
}


# Aliases often-used sets.
AUX_KEYS = [k for k, v in FEATURE_CATALOG.items() if v.get("auxiliary")]
HIDDEN_KEYS = [k for k, v in FEATURE_CATALOG.items() if v.get("hidden")]


# ---------- Groupings ----------


def _all_keys() -> list[str]:
    """All catalog keys, starting with FEATURE_COLS then auxiliary ones."""
    aux = [k for k in FEATURE_CATALOG if k not in FEATURE_COLS]
    return list(FEATURE_COLS) + aux


def keys_by_filler(filler: str) -> list[str]:
    return [k for k in _all_keys() if FEATURE_CATALOG[k].get("filler") == filler]


def keys_by_source(source_kind: str) -> list[str]:
    return [
        k for k in _all_keys() if FEATURE_CATALOG[k].get("source_kind") == source_kind
    ]


AUTO_KEYS = keys_by_filler("auto")
DOCTOR_KEYS = keys_by_filler("doctor")
ELDER_KEYS = keys_by_filler("elder")
STATIC_KEYS = keys_by_source("static")
DYNAMIC_KEYS = keys_by_source("dynamic")

# Required for inference (model inputs only — BMI_CATEGORY counts).
REQUIRED_KEYS = [k for k in FEATURE_COLS if FEATURE_CATALOG[k].get("required", True)]
OPTIONAL_KEYS = [k for k in FEATURE_COLS if not FEATURE_CATALOG[k].get("required", True)]

# Required from a UX perspective (HEIGHT/WEIGHT doctor has to fill, BMI_CATEGORY is derived).
UI_REQUIRED_KEYS = [
    k
    for k in _all_keys()
    if FEATURE_CATALOG[k].get("required", True)
    and not FEATURE_CATALOG[k].get("hidden")
]


def public_catalog() -> list[dict]:
    """Return catalog as a list (visible entries only) for frontend forms."""
    return [
        {"key": k, **FEATURE_CATALOG[k]}
        for k in _all_keys()
        if not FEATURE_CATALOG[k].get("hidden")
    ]


# ---------- Auto-fill helpers ----------


def _compute_age(birth: Optional[date]) -> Optional[int]:
    if not birth:
        return None
    today = date.today()
    years = today.year - birth.year - (
        (today.month, today.day) < (birth.month, birth.day)
    )
    return max(0, int(years))


def _compute_bmi_category(
    height_cm: Optional[Decimal], weight_kg: Optional[Decimal]
) -> Optional[int]:
    if not height_cm or not weight_kg:
        return None
    try:
        h_m = float(height_cm) / 100.0
        if h_m <= 0:
            return None
        bmi = float(weight_kg) / (h_m * h_m)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if bmi < 18.5:
        return -1
    if bmi < 24:
        return 0
    if bmi < 28:
        return 1
    return 2


async def build_auto_inputs(
    db: AsyncSession, elder_id: int
) -> dict[str, Any]:
    """Snapshot of auto-derivable inputs for an elder.

    Returns AGE and IS_FEMALE from the elder profile, plus the latest
    HEIGHT_CM / WEIGHT_KG from the elder's health record (used as a fallback
    when the doctor doesn't re-measure during the current evaluation).
    BMI_CATEGORY itself is derived later in `assemble_feature_vector`.
    """
    elder = (
        await db.execute(
            select(Elder).where(Elder.id == elder_id, Elder.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    out: dict[str, Any] = {k: None for k in AUTO_KEYS}

    if elder is not None:
        age = _compute_age(elder.birth_date)
        if age is not None:
            out["AGE"] = age
        gender = (elder.gender or "").lower()
        if gender in ("female", "f", "woman", "女"):
            out["IS_FEMALE"] = 1
        elif gender in ("male", "m", "man", "男"):
            out["IS_FEMALE"] = 0

    latest_hr = (
        await db.execute(
            select(HealthRecord)
            .where(
                HealthRecord.elder_id == elder_id,
                HealthRecord.deleted_at.is_(None),
            )
            .order_by(desc(HealthRecord.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if latest_hr is not None:
        if latest_hr.height_cm is not None:
            try:
                out["HEIGHT_CM"] = float(latest_hr.height_cm)
            except (TypeError, ValueError):
                pass
        if latest_hr.weight_kg is not None:
            try:
                out["WEIGHT_KG"] = float(latest_hr.weight_kg)
            except (TypeError, ValueError):
                pass

    return out


async def build_permanent_cached(
    db: AsyncSession, elder_id: int
) -> dict[str, Any]:
    """Latest cached values for static elder fields (RACE, SCHLYRS).

    Pulled from the most recent non-null answer across prediction tasks and
    legacy survey tasks. Returns {KEY: value} for keys that have cached data.
    """
    # Import lazily to avoid circular refs.
    from app.models.prediction_task import PredictionTask  # noqa: WPS433
    from app.models.survey_task import SurveyTask  # noqa: WPS433

    merged: dict[str, Any] = {}

    # Legacy survey tasks (latest wins per field).
    rows = (
        await db.execute(
            select(SurveyTask)
            .where(
                SurveyTask.elder_id == elder_id,
                SurveyTask.status == "submitted",
                SurveyTask.deleted_at.is_(None),
            )
            .order_by(SurveyTask.submitted_at.asc())
        )
    ).scalars().all()
    for row in rows:
        if isinstance(row.responses, dict):
            for k, v in row.responses.items():
                if k in STATIC_KEYS and v is not None and v != "":
                    merged[k] = v

    # Prediction task elder_inputs (latest wins).
    prows = (
        await db.execute(
            select(PredictionTask)
            .where(
                PredictionTask.elder_id == elder_id,
                PredictionTask.deleted_at.is_(None),
            )
            .order_by(PredictionTask.updated_at.asc())
        )
    ).scalars().all()
    for row in prows:
        if isinstance(row.elder_inputs, dict):
            for k, v in row.elder_inputs.items():
                if k in STATIC_KEYS and v is not None and v != "":
                    merged[k] = v

    return merged


# ---------- Feature assembly & attribution ----------


def assemble_feature_vector(
    auto_inputs: Optional[dict[str, Any]] = None,
    permanent_inputs: Optional[dict[str, Any]] = None,
    doctor_inputs: Optional[dict[str, Any]] = None,
    elder_inputs: Optional[dict[str, Any]] = None,
) -> tuple[dict[str, Any], dict[str, str]]:
    """Merge input sources into a full {KEY: value|None} feature dict.

    Returns (features, sources) where sources[KEY] is one of:
    "auto" | "permanent" | "doctor" | "elder" | "missing".

    Later sources override earlier ones. Empty string / None values are ignored.
    """
    features: dict[str, Any] = {k: None for k in FEATURE_COLS}
    sources: dict[str, str] = {k: "missing" for k in FEATURE_COLS}

    def _apply(payload: Optional[dict[str, Any]], tag: str) -> None:
        if not isinstance(payload, dict):
            return
        for k, v in payload.items():
            if k in features and v is not None and v != "":
                features[k] = v
                sources[k] = tag

    _apply(auto_inputs, "auto")
    _apply(permanent_inputs, "permanent")
    _apply(doctor_inputs, "doctor")
    _apply(elder_inputs, "elder")

    # Derive BMI_CATEGORY from auxiliary HEIGHT_CM + WEIGHT_KG if present and
    # the category itself wasn't supplied directly. Priority: doctor override
    # → elder submitted → auto (latest archive). Auxiliary keys live outside
    # FEATURE_COLS so `_apply` skipped them — read from the raw input dicts.
    if features.get("BMI_CATEGORY") is None:
        height = None
        weight = None
        for src in (doctor_inputs, elder_inputs, auto_inputs):
            if isinstance(src, dict):
                if height is None and src.get("HEIGHT_CM") not in (None, ""):
                    height = src.get("HEIGHT_CM")
                if weight is None and src.get("WEIGHT_KG") not in (None, ""):
                    weight = src.get("WEIGHT_KG")
        if height is not None and weight is not None:
            try:
                bmi_cat = _compute_bmi_category(
                    Decimal(str(height)), Decimal(str(weight))
                )
            except Exception:  # noqa: BLE001 — cast errors shouldn't break inference
                bmi_cat = None
            if bmi_cat is not None:
                features["BMI_CATEGORY"] = bmi_cat
                sources["BMI_CATEGORY"] = "doctor"

    return features, sources


def missing_required(features: dict[str, Any]) -> list[str]:
    """List of required feature keys that have no value."""
    return [k for k in REQUIRED_KEYS if features.get(k) in (None, "")]


def estimate_feature_contributions(
    features: dict[str, float], top_k: int = 3
) -> list[dict]:
    """Standardized distance from population mean — cheap model-agnostic attribution."""
    result = []
    for i, key in enumerate(FEATURE_COLS):
        mean = _SCALER_MEAN_RAW[i]
        scale = _SCALER_SCALE_RAW[i] or 1.0
        raw = features.get(key)
        if raw is None:
            continue
        try:
            v = float(raw)
        except (TypeError, ValueError):
            continue
        z = (v - mean) / scale
        result.append(
            {
                "key": key,
                "label": FEATURE_CATALOG.get(key, {}).get("label", key),
                "value": v,
                "z_score": round(z, 3),
                "direction": "higher" if z > 0 else "lower",
            }
        )
    result.sort(key=lambda x: abs(x["z_score"]), reverse=True)
    return result[:top_k]


# ---------- Legacy shim (kept for surveys/ endpoints during migration) ----------


async def build_feature_payload(
    db: AsyncSession, elder_id: int
) -> dict[str, Any]:
    """Legacy helper used by the old /ml/features endpoint and surveys view.

    Builds a best-effort feature dict using auto inputs + latest cached elder
    answers (both static and dynamic). Callers that need per-task isolation
    should use the PredictionTask pipeline instead.
    """
    auto = await build_auto_inputs(db, elder_id)

    # Merge all historical elder answers (latest wins) — used purely for UI
    # hints like "which fields still have no data anywhere".
    from app.models.prediction_task import PredictionTask  # noqa: WPS433
    from app.models.survey_task import SurveyTask  # noqa: WPS433

    merged_elder: dict[str, Any] = {}
    rows = (
        await db.execute(
            select(SurveyTask)
            .where(
                SurveyTask.elder_id == elder_id,
                SurveyTask.status == "submitted",
                SurveyTask.deleted_at.is_(None),
            )
            .order_by(SurveyTask.submitted_at.asc())
        )
    ).scalars().all()
    for row in rows:
        if isinstance(row.responses, dict):
            for k, v in row.responses.items():
                if k in ELDER_KEYS and v is not None and v != "":
                    merged_elder[k] = v
    prows = (
        await db.execute(
            select(PredictionTask)
            .where(
                PredictionTask.elder_id == elder_id,
                PredictionTask.deleted_at.is_(None),
            )
            .order_by(PredictionTask.updated_at.asc())
        )
    ).scalars().all()
    for row in prows:
        if isinstance(row.elder_inputs, dict):
            for k, v in row.elder_inputs.items():
                if k in ELDER_KEYS and v is not None and v != "":
                    merged_elder[k] = v

    features, sources = assemble_feature_vector(
        auto_inputs=auto, elder_inputs=merged_elder
    )
    # Map internal source tags to legacy tags for backward compat.
    legacy_sources = {
        k: (
            "elder"
            if v == "permanent"
            else "health_record"
            if k == "BMI_CATEGORY" and v == "auto"
            else "elder"
            if v == "elder"
            else "elder"
            if v == "auto" and k in ("AGE", "IS_FEMALE")
            else None
        )
        for k, v in sources.items()
    }
    missing = [k for k, v in features.items() if v is None]
    return {"features": features, "sources": legacy_sources, "missing": missing}

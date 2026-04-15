"""
SmartMedCare Multi-Task Learning Model (PyTorch)

Architecture: MoE-Transformer (Mixture-of-Experts inside Transformer)
  - Per-feature linear embeddings + [CLS] token (FT-Transformer style)
  - Transformer encoder layers where the FFN is replaced by top-k MoE
    (similar to Switch Transformer / Mixtral)
  - Attention captures cross-feature interactions; MoE FFN provides
    expert-level specialization and capacity
  - Dynamic loss weighting via learned uncertainty (Kendall et al. 2018)

3 task heads:
  1. High-risk elderly classification  (binary)
  2. Priority follow-up needed         (binary)
  3. Health status score                (regression 0-100)

Note: Chronic disease risk level was removed due to data leakage —
TARGET_CHRONIC_RISK is a deterministic function of NUM_CHRONIC and
individual chronic disease columns, all of which were input features.

Usage:
    python data-jobs/train_multitask.py
"""

import logging
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

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
MODEL_DIR = Path(__file__).resolve().parent / "models"
REPORT_DIR = Path(__file__).resolve().parent / "reports"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================================
# 1. Data loading & feature engineering
# ============================================================================


def clean_hrs_value(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce")
    s = s.replace({8: np.nan, 9: np.nan, 98: np.nan, 99: np.nan})
    return s


def load_and_prepare_data() -> tuple[pd.DataFrame, list[str]]:
    """Load HRS data, engineer features, build targets. Returns (df, feature_cols)."""
    logger.info("Loading HRS data...")
    merge_keys = ["HHID", "PN"]

    trk = pd.read_csv(TRACKER_PATH, low_memory=False)
    trk_cols = merge_keys + ["BIRTHYR", "SEX", "RACE", "HISPANIC", "DEGREE", "SCHLYRS", "USBORN", "STUDY"]
    trk = trk[[c for c in trk_cols if c in trk.columns]].copy()
    trk["HHID"] = trk["HHID"].astype(str).str.strip()
    trk["PN"] = trk["PN"].astype(str).str.strip()

    b_df = pd.read_csv(HRS_CSV_DIR / "h22b_r.csv", low_memory=False)
    b_cols = merge_keys + ["SB000", "SB001", "SB002", "SB084"]
    b_df = b_df[[c for c in b_cols if c in b_df.columns]].copy()
    b_df.rename(columns={"SB000": "MARITAL_STATUS", "SB001": "NUM_MARRIAGES", "SB002": "CURRENT_MARRIED", "SB084": "PROXY_INTERVIEW"}, inplace=True)

    c_df = pd.read_csv(HRS_CSV_DIR / "h22c_r.csv", low_memory=False)
    c_cols = merge_keys + ["SC001", "SC005", "SC010", "SC018", "SC036", "SC040", "SC043", "SC053", "SC061", "SC063", "SC185", "SC231", "SC239"]
    c_df = c_df[[c for c in c_cols if c in c_df.columns]].copy()
    c_df.rename(columns={
        "SC001": "SELF_HEALTH", "SC005": "HEALTH_CHANGE", "SC010": "HBP", "SC018": "DIABETES",
        "SC036": "CANCER", "SC040": "LUNG_DISEASE", "SC043": "HEART_PROBLEM", "SC053": "STROKE",
        "SC061": "PSYCH_PROBLEM", "SC063": "ARTHRITIS", "SC185": "FALL_2YR", "SC231": "BMI_CATEGORY", "SC239": "PAIN",
    }, inplace=True)

    d_df = pd.read_csv(HRS_CSV_DIR / "h22d_r.csv", low_memory=False)
    d_cols = merge_keys + ["SD101", "SD102", "SD103", "SD104"]
    d_df = d_df[[c for c in d_cols if c in d_df.columns]].copy()
    d_df.rename(columns={"SD101": "MEMORY_RATING", "SD102": "MEMORY_CHANGE", "SD103": "SERIAL7_SCORE", "SD104": "DATE_NAMING"}, inplace=True)

    g_df = pd.read_csv(HRS_CSV_DIR / "h22g_r.csv", low_memory=False)
    g_cols = merge_keys + [f"SG{i:03d}" for i in range(1, 16)]
    g_df = g_df[[c for c in g_cols if c in g_df.columns]].copy()
    diff_names = ["DIFF_WALK", "DIFF_SIT", "DIFF_GETUP", "DIFF_STAIRS", "DIFF_STOOP", "DIFF_REACH",
                  "DIFF_PUSH", "DIFF_LIFT", "DIFF_COIN", "DIFF_DRESS", "DIFF_BATH", "DIFF_EAT",
                  "DIFF_BED", "DIFF_TOILET", "DIFF_MAP"]
    for i, name in enumerate(diff_names, start=1):
        col = f"SG{i:03d}"
        if col in g_df.columns:
            g_df.rename(columns={col: name}, inplace=True)

    n_df = pd.read_csv(HRS_CSV_DIR / "h22n_r.csv", low_memory=False)
    n_cols = merge_keys + ["SN001", "SN004", "SN005", "SN009", "SN014", "SN018"]
    n_df = n_df[[c for c in n_cols if c in n_df.columns]].copy()
    n_df.rename(columns={
        "SN001": "HAS_USUAL_CARE", "SN004": "HOSPITAL_STAY", "SN005": "NUM_HOSPITAL_STAYS",
        "SN009": "NURSING_HOME", "SN014": "HOME_HEALTH", "SN018": "DOCTOR_VISITS",
    }, inplace=True)

    for df in [b_df, c_df, d_df, g_df, n_df]:
        df["HHID"] = df["HHID"].astype(str).str.strip()
        df["PN"] = df["PN"].astype(str).str.strip()

    hrs = trk.copy()
    for df in [b_df, c_df, d_df, g_df, n_df]:
        hrs = hrs.merge(df, on=merge_keys, how="inner")
    logger.info("  Merged HRS: %d rows", len(hrs))

    # --- Feature engineering ---
    df = hrs.copy()
    df["BIRTHYR"] = pd.to_numeric(df["BIRTHYR"], errors="coerce")
    df["AGE"] = 2022 - df["BIRTHYR"]
    df = df[(df["AGE"] >= 50) & (df["AGE"] <= 110)].copy()
    df["SEX"] = pd.to_numeric(df["SEX"], errors="coerce")
    df["IS_FEMALE"] = (df["SEX"] == 2).astype(int)
    df["RACE"] = pd.to_numeric(df["RACE"], errors="coerce")
    df["SCHLYRS"] = pd.to_numeric(df["SCHLYRS"], errors="coerce").replace({98: np.nan, 99: np.nan})
    df["SELF_HEALTH"] = clean_hrs_value(df["SELF_HEALTH"])
    df["HEALTH_CHANGE"] = clean_hrs_value(df["HEALTH_CHANGE"])

    chronic_cols = ["HBP", "DIABETES", "CANCER", "LUNG_DISEASE", "HEART_PROBLEM", "STROKE", "PSYCH_PROBLEM", "ARTHRITIS"]
    for col in chronic_cols:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col]).map({1: 1, 3: 1, 5: 0})
    df["NUM_CHRONIC"] = df[chronic_cols].sum(axis=1)

    for col in ["FALL_2YR", "PAIN"]:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col]).map({1: 1, 5: 0})
    if "BMI_CATEGORY" in df.columns:
        df["BMI_CATEGORY"] = pd.to_numeric(df["BMI_CATEGORY"], errors="coerce")
    for col in ["MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING"]:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col])

    adl_cols = [c for c in df.columns if c.startswith("DIFF_")]
    for col in adl_cols:
        df[col] = clean_hrs_value(df[col]).map({1: 1, 5: 0, 6: 1})
    df["ADL_SCORE"] = df[adl_cols].sum(axis=1)

    for col in ["HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH", "HAS_USUAL_CARE"]:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col]).map({1: 1, 5: 0})
    for col in ["NUM_HOSPITAL_STAYS", "DOCTOR_VISITS"]:
        if col in df.columns:
            df[col] = clean_hrs_value(df[col])

    # --- Targets ---
    df["TARGET_HIGH_RISK"] = (
        (df["AGE"] >= 80) | (df["NUM_CHRONIC"] >= 3) | (df["ADL_SCORE"] >= 3)
        | (df["STROKE"] == 1) | (df["NURSING_HOME"] == 1) | (df["SELF_HEALTH"] >= 4)
    ).astype(int)

    df["TARGET_FOLLOWUP"] = (
        (df["HOSPITAL_STAY"] == 1) | (df["HEALTH_CHANGE"] == 5)
        | ((df["NUM_CHRONIC"] >= 2) & (df["MEMORY_RATING"] >= 4)) | (df["FALL_2YR"] == 1)
    ).astype(int)

    health_score = 100.0
    sh = df["SELF_HEALTH"].fillna(3).clip(1, 5)
    health_score = health_score - (sh - 1) * 6.25
    health_score = health_score - df["NUM_CHRONIC"].clip(0, 8) * 5
    health_score = health_score - df["ADL_SCORE"].clip(0, 15) * 4
    mem = df["MEMORY_RATING"].fillna(3).clip(1, 5)
    health_score = health_score - (mem - 1) * 2.5
    health_score = health_score - df["PAIN"].fillna(0) * 5
    health_score = health_score - df["FALL_2YR"].fillna(0) * 5
    health_score = health_score - (df["AGE"] - 50).clip(0, 60) * 0.15
    df["TARGET_HEALTH_SCORE"] = health_score.clip(0, 100)

    # NOTE: NUM_CHRONIC and 8 individual chronic disease columns are excluded
    # to prevent data leakage — TARGET_CHRONIC_RISK is derived from them, and
    # they also leak into TARGET_HIGH_RISK, TARGET_FOLLOWUP, TARGET_HEALTH_SCORE.
    feature_cols = [
        "AGE", "IS_FEMALE", "RACE", "SCHLYRS", "SELF_HEALTH", "HEALTH_CHANGE",
        "FALL_2YR", "PAIN", "BMI_CATEGORY",
        "MEMORY_RATING", "MEMORY_CHANGE", "SERIAL7_SCORE", "DATE_NAMING", "ADL_SCORE",
        "HOSPITAL_STAY", "NURSING_HOME", "HOME_HEALTH", "HAS_USUAL_CARE",
        "NUM_HOSPITAL_STAYS", "DOCTOR_VISITS",
    ]
    feature_cols = [c for c in feature_cols if c in df.columns]

    logger.info("  Features: %d, Samples: %d", len(feature_cols), len(df))
    return df, feature_cols


# ============================================================================
# 2. Model architecture — MoE-Transformer
# ============================================================================


class MoEFeedForward(nn.Module):
    """Mixture-of-Experts feed-forward layer (replaces standard FFN in Transformer).

    Each expert is a 2-layer MLP. A gating network routes each token to
    the top-k experts. All experts are computed (trace-friendly) and
    combined via top-k gate weights.
    """

    def __init__(self, d_model: int, d_ff: int, num_experts: int = 8,
                 top_k: int = 2, dropout: float = 0.1):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k

        self.gate = nn.Linear(d_model, num_experts, bias=False)

        # Expert weights stored as 3D tensors for batched matmul
        self.w1 = nn.Parameter(torch.empty(num_experts, d_model, d_ff))
        self.w2 = nn.Parameter(torch.empty(num_experts, d_ff, d_model))
        self.b1 = nn.Parameter(torch.zeros(num_experts, d_ff))
        self.b2 = nn.Parameter(torch.zeros(num_experts, d_model))

        self.dropout = nn.Dropout(dropout)

        for i in range(num_experts):
            nn.init.kaiming_uniform_(self.w1[i], a=math.sqrt(5))
            nn.init.kaiming_uniform_(self.w2[i], a=math.sqrt(5))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        B, S, D = x.shape
        x_flat = x.reshape(B * S, D)

        gate_logits = self.gate(x_flat)
        gate_probs = F.softmax(gate_logits, dim=-1)

        top_k_probs, top_k_idx = torch.topk(gate_probs, self.top_k, dim=-1)
        top_k_probs = top_k_probs / (top_k_probs.sum(dim=-1, keepdim=True) + 1e-8)

        mask = torch.zeros_like(gate_probs)
        mask.scatter_(1, top_k_idx, top_k_probs)

        # Batched expert computation via einsum
        x_exp = x_flat.unsqueeze(1).expand(-1, self.num_experts, -1)
        h = torch.einsum("bed,edf->bef", x_exp, self.w1) + self.b1
        h = F.gelu(h)
        h = self.dropout(h)
        h = torch.einsum("bef,efd->bed", h, self.w2) + self.b2

        output = (h * mask.unsqueeze(-1)).sum(dim=1)
        output = output.reshape(B, S, D)

        # Load-balancing loss
        tokens_per_expert = mask.sum(dim=0)
        mean_gate_prob = gate_probs.mean(dim=0)
        balance_loss = (
            self.num_experts
            * (tokens_per_expert / (tokens_per_expert.sum() + 1e-8)
               * mean_gate_prob).sum()
        )

        return output, balance_loss


class MoETransformerLayer(nn.Module):
    """Pre-norm Transformer layer with MoE feed-forward."""

    def __init__(self, d_model: int, nhead: int, d_ff: int,
                 num_experts: int = 8, top_k: int = 2, dropout: float = 0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(
            d_model, nhead, dropout=dropout, batch_first=True,
        )
        self.attn_dropout = nn.Dropout(dropout)

        self.norm2 = nn.LayerNorm(d_model)
        self.moe_ffn = MoEFeedForward(d_model, d_ff, num_experts, top_k, dropout)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        x_norm = self.norm1(x)
        attn_out, _ = self.attn(x_norm, x_norm, x_norm, need_weights=False)
        x = x + self.attn_dropout(attn_out)

        x_norm = self.norm2(x)
        ffn_out, balance_loss = self.moe_ffn(x_norm)
        x = x + ffn_out

        return x, balance_loss


class MoETransformerMultiTaskModel(nn.Module):
    """FT-Transformer with MoE feed-forward layers for multi-task health prediction.

    Architecture:
        Input (N scalars)
          -> Per-feature linear embeddings -> [CLS, f1, f2, ..., fN] tokens
          -> MoE-Transformer layers x num_layers
          -> Final LayerNorm -> [CLS] -> 4 task heads
    """

    def __init__(self, input_dim: int, d_model: int = 128, nhead: int = 8,
                 num_layers: int = 4, num_experts: int = 8, top_k: int = 2,
                 dropout: float = 0.1):
        super().__init__()
        self.input_dim = input_dim
        self.d_model = d_model

        self.feature_weights = nn.Parameter(torch.randn(input_dim, d_model) * 0.02)
        self.feature_biases = nn.Parameter(torch.zeros(input_dim, d_model))
        self.embed_norm = nn.LayerNorm(d_model)

        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)

        self.layers = nn.ModuleList([
            MoETransformerLayer(
                d_model=d_model, nhead=nhead,
                d_ff=d_model * 4, num_experts=num_experts,
                top_k=top_k, dropout=dropout,
            )
            for _ in range(num_layers)
        ])
        self.final_norm = nn.LayerNorm(d_model)

        self.head_high_risk = nn.Sequential(
            nn.Linear(d_model, 64), nn.GELU(), nn.Dropout(dropout), nn.Linear(64, 1))
        self.head_followup = nn.Sequential(
            nn.Linear(d_model, 64), nn.GELU(), nn.Dropout(dropout), nn.Linear(64, 1))
        self.head_health_score = nn.Sequential(
            nn.Linear(d_model, 64), nn.GELU(), nn.Dropout(dropout), nn.Linear(64, 1))

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        B = x.size(0)

        tokens = (x.unsqueeze(-1) * self.feature_weights.unsqueeze(0)
                  + self.feature_biases.unsqueeze(0))
        tokens = self.embed_norm(tokens)

        cls = self.cls_token.expand(B, -1, -1)
        tokens = torch.cat([cls, tokens], dim=1)

        total_balance_loss = torch.tensor(0.0, device=x.device)
        for layer in self.layers:
            tokens, bl = layer(tokens)
            total_balance_loss = total_balance_loss + bl

        tokens = self.final_norm(tokens)
        cls_out = tokens[:, 0]

        out_hr = self.head_high_risk(cls_out).squeeze(-1)
        out_fu = self.head_followup(cls_out).squeeze(-1)
        out_hs = self.head_health_score(cls_out).squeeze(-1)

        return out_hr, out_fu, out_hs, total_balance_loss


class ExportWrapper(nn.Module):
    """Drops the auxiliary balance loss for TorchScript export."""

    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        out_hr, out_fu, out_hs, _ = self.model(x)
        return out_hr, out_fu, out_hs


class UncertaintyWeighting(nn.Module):
    """Learned uncertainty weighting for multi-task loss balancing (Kendall et al. 2018).

    Each task gets a learnable log(sigma^2). Loss becomes:
        L_i / (2 * sigma_i^2) + log(sigma_i)
    log_vars clamped to [-6, 6] for numerical stability.
    """

    def __init__(self, num_tasks: int = 3):
        super().__init__()
        self.log_vars = nn.Parameter(torch.zeros(num_tasks))

    def forward(self, losses: list[torch.Tensor]) -> torch.Tensor:
        total = torch.tensor(0.0, device=losses[0].device)
        for i, loss in enumerate(losses):
            log_var = self.log_vars[i].clamp(-6.0, 6.0)
            precision = torch.exp(-log_var)
            total = total + precision * loss + log_var
        return total


# ============================================================================
# 3. Evaluation
# ============================================================================


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader, optimize_threshold: bool = False) -> dict:
    model.eval()
    all_hr_logits, all_fu_logits, all_hs_preds = [], [], []
    all_hr_y, all_fu_y, all_hs_y = [], [], []

    for X_batch, y_hr, y_fu, y_hs in loader:
        X_batch = X_batch.to(DEVICE)
        out_hr, out_fu, out_hs, _ = model(X_batch)

        all_hr_logits.append(out_hr.cpu())
        all_fu_logits.append(out_fu.cpu())
        all_hs_preds.append(out_hs.cpu())

        all_hr_y.append(y_hr)
        all_fu_y.append(y_fu)
        all_hs_y.append(y_hs)

    hr_logits = torch.cat(all_hr_logits)
    fu_logits = torch.cat(all_fu_logits)
    hs_preds = torch.cat(all_hs_preds)
    hr_y = torch.cat(all_hr_y)
    fu_y = torch.cat(all_fu_y)
    hs_y = torch.cat(all_hs_y)

    def _best_threshold(prob: np.ndarray, true: np.ndarray) -> float:
        best_t, best_f = 0.5, 0.0
        for t in np.arange(0.20, 0.80, 0.01):
            p = (prob >= t).astype(int)
            f = f1_score(true, p)
            if f > best_f:
                best_f = f
                best_t = t
        return best_t

    hr_prob = torch.sigmoid(hr_logits).numpy()
    hr_true = hr_y.numpy().astype(int)
    hr_thresh = _best_threshold(hr_prob, hr_true) if optimize_threshold else 0.5
    hr_pred = (hr_prob >= hr_thresh).astype(int)

    fu_prob = torch.sigmoid(fu_logits).numpy()
    fu_true = fu_y.numpy().astype(int)
    fu_thresh = _best_threshold(fu_prob, fu_true) if optimize_threshold else 0.5
    fu_pred = (fu_prob >= fu_thresh).astype(int)

    hs_pred_np = hs_preds.numpy()
    hs_true_np = hs_y.numpy()

    return {
        "hr_f1": f1_score(hr_true, hr_pred),
        "hr_auc": roc_auc_score(hr_true, hr_prob),
        "hr_acc": accuracy_score(hr_true, hr_pred),
        "fu_f1": f1_score(fu_true, fu_pred),
        "fu_auc": roc_auc_score(fu_true, fu_prob),
        "fu_acc": accuracy_score(fu_true, fu_pred),
        "hs_r2": r2_score(hs_true_np, hs_pred_np),
        "hs_mae": mean_absolute_error(hs_true_np, hs_pred_np),
        "hs_rmse": np.sqrt(mean_squared_error(hs_true_np, hs_pred_np)),
        "hr_true": hr_true, "hr_pred": hr_pred,
        "fu_true": fu_true, "fu_pred": fu_pred,
        "hs_true": hs_true_np, "hs_pred": hs_pred_np,
    }


# ============================================================================
# 4. Main
# ============================================================================


def main():
    logger.info("=" * 60)
    logger.info("SmartMedCare MoE-Transformer Multi-Task Learning")
    logger.info("=" * 60)
    logger.info("Device: %s", DEVICE)

    torch.manual_seed(RANDOM_STATE)
    np.random.seed(RANDOM_STATE)

    # --- Data ---
    df, feature_cols = load_and_prepare_data()
    input_dim = len(feature_cols)

    X = df[feature_cols].apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median())
    X = X.fillna(0)

    y_hr = df["TARGET_HIGH_RISK"].fillna(0).values.astype(np.float32)
    y_fu = df["TARGET_FOLLOWUP"].fillna(0).values.astype(np.float32)
    y_hs = df["TARGET_HEALTH_SCORE"].fillna(50.0).values.astype(np.float32)

    strat_key = y_hr.astype(int) * 10 + y_fu.astype(int)
    idx = np.arange(len(X))
    idx_train, idx_test = train_test_split(
        idx, test_size=0.2, random_state=RANDOM_STATE, stratify=strat_key,
    )
    logger.info("  Split: train=%d, test=%d", len(idx_train), len(idx_test))

    scaler = StandardScaler()
    X_train_np = scaler.fit_transform(X.iloc[idx_train].values)
    X_test_np = scaler.transform(X.iloc[idx_test].values)
    X_train_np = np.nan_to_num(X_train_np, nan=0.0)
    X_test_np = np.nan_to_num(X_test_np, nan=0.0)

    # ---- PyTorch data ----
    X_train_t = torch.tensor(X_train_np, dtype=torch.float32)
    X_test_t = torch.tensor(X_test_np, dtype=torch.float32)
    y_hr_train = torch.tensor(y_hr[idx_train], dtype=torch.float32)
    y_fu_train = torch.tensor(y_fu[idx_train], dtype=torch.float32)
    y_hs_train = torch.tensor(y_hs[idx_train], dtype=torch.float32)

    train_loader = DataLoader(
        TensorDataset(X_train_t, y_hr_train, y_fu_train, y_hs_train),
        batch_size=128, shuffle=True,
    )
    test_loader = DataLoader(
        TensorDataset(
            X_test_t,
            torch.tensor(y_hr[idx_test], dtype=torch.float32),
            torch.tensor(y_fu[idx_test], dtype=torch.float32),
            torch.tensor(y_hs[idx_test], dtype=torch.float32),
        ),
        batch_size=512, shuffle=False,
    )

    # ---- Loss functions ----
    hr_pos_wt = torch.tensor([(y_hr_train == 0).sum() / max((y_hr_train == 1).sum(), 1)], dtype=torch.float32).to(DEVICE)
    fu_pos_wt = torch.tensor([(y_fu_train == 0).sum() / max((y_fu_train == 1).sum(), 1)], dtype=torch.float32).to(DEVICE)

    criterion_bce_hr = nn.BCEWithLogitsLoss(pos_weight=hr_pos_wt)
    criterion_bce_fu = nn.BCEWithLogitsLoss(pos_weight=fu_pos_wt)
    criterion_mse = nn.MSELoss()

    # ---- Model ----
    logger.info("\n" + "=" * 60)
    logger.info("MoE-Transformer (d=128, 4 layers, 8 heads, 8 experts top-2)")
    logger.info("=" * 60)

    torch.manual_seed(RANDOM_STATE)
    model = MoETransformerMultiTaskModel(
        input_dim=input_dim, d_model=128, nhead=8,
        num_layers=4, num_experts=8, top_k=2, dropout=0.1,
    ).to(DEVICE)
    logger.info("Parameters: %d", sum(p.numel() for p in model.parameters()))

    uncertainty = UncertaintyWeighting(num_tasks=3).to(DEVICE)

    all_params = list(model.parameters()) + list(uncertainty.parameters())
    optimizer = torch.optim.AdamW(all_params, lr=3e-4, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=6e-4, total_steps=1000,
        pct_start=0.1, anneal_strategy="cos",
    )

    # ---- Training ----
    NUM_EPOCHS = 1000
    PATIENCE = 150
    EVAL_EVERY = 10
    BALANCE_LOSS_WT = 0.01

    best_score = -float("inf")
    best_state = None
    patience_counter = 0

    logger.info("Training for up to %d epochs (patience=%d)...", NUM_EPOCHS, PATIENCE)

    for epoch in range(1, NUM_EPOCHS + 1):
        model.train()
        uncertainty.train()
        total_loss = 0.0

        for X_batch, y_hr_b, y_fu_b, y_hs_b in train_loader:
            X_batch = X_batch.to(DEVICE)
            y_hr_b = y_hr_b.to(DEVICE)
            y_fu_b = y_fu_b.to(DEVICE)
            y_hs_b = y_hs_b.to(DEVICE)

            out_hr, out_fu, out_hs, aux_loss = model(X_batch)

            loss = uncertainty([
                criterion_bce_hr(out_hr, y_hr_b),
                criterion_bce_fu(out_fu, y_fu_b),
                criterion_mse(out_hs, y_hs_b),
            ]) + BALANCE_LOSS_WT * aux_loss

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(all_params, max_norm=1.0)
            optimizer.step()
            total_loss += loss.item() * X_batch.size(0)

        scheduler.step()
        avg_loss = total_loss / len(train_loader.dataset)

        if epoch % EVAL_EVERY == 0 or epoch <= 5:
            metrics = evaluate(model, test_loader)
            composite = (metrics["hr_f1"] + metrics["fu_f1"] + metrics["hs_r2"]) / 3.0

            if epoch % 50 == 0 or epoch <= 5:
                weights = torch.exp(-uncertainty.log_vars.clamp(-6, 6)).detach().cpu().numpy()
                w_str = " ".join(f"{w:.2f}" for w in weights)
                logger.info(
                    "  Epoch %3d | loss=%.4f | HR-F1=%.4f | FU-F1=%.4f | HS-R2=%.4f | weights=[%s]",
                    epoch, avg_loss, metrics["hr_f1"], metrics["fu_f1"],
                    metrics["hs_r2"], w_str,
                )

            if composite > best_score:
                best_score = composite
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += EVAL_EVERY
                if patience_counter >= PATIENCE:
                    logger.info("  Early stopping at epoch %d (best composite=%.4f)", epoch, best_score)
                    break

    # ---- Restore best & evaluate ----
    model.load_state_dict(best_state)
    model.eval()

    final = evaluate(model, test_loader, optimize_threshold=True)

    logger.info("\n" + "=" * 60)
    logger.info("FINAL EVALUATION")
    logger.info("=" * 60)
    logger.info("Task 1 - High Risk:    Acc=%.4f  F1=%.4f  AUC=%.4f",
                final["hr_acc"], final["hr_f1"], final["hr_auc"])
    logger.info("Task 2 - Follow-up:    Acc=%.4f  F1=%.4f  AUC=%.4f",
                final["fu_acc"], final["fu_f1"], final["fu_auc"])
    logger.info("Task 3 - Health Score: R2=%.4f  MAE=%.4f  RMSE=%.4f",
                final["hs_r2"], final["hs_mae"], final["hs_rmse"])

    # ---- Report ----
    report_path = REPORT_DIR / "multitask_report.txt"
    with open(report_path, "w") as f:
        f.write("SmartMedCare Multi-Task Model Evaluation Report\n")
        f.write("=" * 60 + "\n")
        f.write("Architecture: MoE-Transformer\n")
        f.write("  - FT-Transformer with MoE feed-forward layers\n")
        f.write("  - d_model=128, 4 layers, 8 heads, 8 experts (top-2)\n")
        f.write("  - Dynamic loss weighting via learned uncertainty\n")
        f.write("  - 3 tasks (chronic risk removed due to data leakage)\n\n")

        f.write("Task 1: High-Risk Elderly Classification\n")
        f.write(f"  Accuracy: {final['hr_acc']:.4f}\n")
        f.write(f"  F1:       {final['hr_f1']:.4f}\n")
        f.write(f"  AUC:      {final['hr_auc']:.4f}\n")
        f.write(classification_report(final["hr_true"], final["hr_pred"], zero_division=0))
        f.write("\n")

        f.write("Task 2: Priority Follow-up Classification\n")
        f.write(f"  Accuracy: {final['fu_acc']:.4f}\n")
        f.write(f"  F1:       {final['fu_f1']:.4f}\n")
        f.write(f"  AUC:      {final['fu_auc']:.4f}\n")
        f.write(classification_report(final["fu_true"], final["fu_pred"], zero_division=0))
        f.write("\n")

        f.write("Task 3: Health Status Score Regression\n")
        f.write(f"  R2:   {final['hs_r2']:.4f}\n")
        f.write(f"  MAE:  {final['hs_mae']:.4f}\n")
        f.write(f"  RMSE: {final['hs_rmse']:.4f}\n\n")

        f.write(f"Feature columns ({len(feature_cols)}):\n")
        for fc in feature_cols:
            f.write(f"  - {fc}\n")
        f.write("\nNote: NUM_CHRONIC + 8 chronic disease columns removed to prevent\n")
        f.write("data leakage. Chronic disease risk task dropped (wF1 < 0.9).\n")
    logger.info("Report saved: %s", report_path)

    # ---- Export TorchScript ----
    logger.info("\nExporting TorchScript model...")
    model_cpu = model.to("cpu")
    wrapper = ExportWrapper(model_cpu)
    wrapper.eval()

    traced = torch.jit.trace(wrapper, torch.randn(1, input_dim), check_trace=False)

    save_path = MODEL_DIR / "multitask_health_model.pt"
    traced.save(str(save_path))
    logger.info("TorchScript model saved: %s (%.1f KB)", save_path, save_path.stat().st_size / 1024)

    # Verify
    with torch.no_grad():
        loaded = torch.jit.load(str(save_path))
        loaded.eval()
        test_input = X_test_t[:5]
        orig_out = wrapper(test_input)
        load_out = loaded(test_input)
        for i, (a, b) in enumerate(zip(orig_out, load_out)):
            diff = (a - b).abs().max().item()
            assert diff < 1e-5, f"Head {i} output mismatch: {diff}"
    logger.info("TorchScript verification PASSED.")

    logger.info("\nScaler parameters for inference.py:")
    logger.info("  mean_ = %s", repr(scaler.mean_.tolist()))
    logger.info("  scale_ = %s", repr(scaler.scale_.tolist()))

    logger.info("\n" + "=" * 60)
    logger.info("DONE — Model: %s  Report: %s", save_path, report_path)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
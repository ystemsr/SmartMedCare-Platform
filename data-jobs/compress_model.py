"""
SmartMedCare Model Distillation — Knowledge Distillation from MoE-Transformer

Trains a lightweight FT-Transformer student (no MoE, d=64, 2 layers)
using soft targets from the teacher MoE-Transformer (d=128, 4 layers, 8 experts).

3 tasks (chronic risk removed due to data leakage):
  1. High-risk elderly classification  (binary)
  2. Priority follow-up needed         (binary)
  3. Health status score                (regression 0-100)

Usage:
    python data-jobs/compress_model.py
"""

import logging
import sys
import time
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

from train_multitask import (
    DEVICE,
    MODEL_DIR,
    RANDOM_STATE,
    REPORT_DIR,
    MoETransformerMultiTaskModel,
    load_and_prepare_data,
)

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ============================================================================
# 1. Student architecture — lightweight Transformer (no MoE)
# ============================================================================


class StudentModel(nn.Module):
    """Lightweight FT-Transformer student — no MoE, smaller dimensions.

    Same embedding strategy (per-feature linear + [CLS]) and task heads
    as the teacher, but with standard FFN instead of MoE and reduced
    d_model / num_layers. 3 tasks only (no chronic risk).
    """

    def __init__(
        self,
        input_dim: int,
        d_model: int = 64,
        nhead: int = 4,
        num_layers: int = 2,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.input_dim = input_dim
        self.d_model = d_model

        self.feature_weights = nn.Parameter(torch.randn(input_dim, d_model) * 0.02)
        self.feature_biases = nn.Parameter(torch.zeros(input_dim, d_model))
        self.embed_norm = nn.LayerNorm(d_model)
        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.final_norm = nn.LayerNorm(d_model)

        self.head_high_risk = nn.Sequential(
            nn.Linear(d_model, 32), nn.GELU(), nn.Dropout(dropout), nn.Linear(32, 1)
        )
        self.head_followup = nn.Sequential(
            nn.Linear(d_model, 32), nn.GELU(), nn.Dropout(dropout), nn.Linear(32, 1)
        )
        self.head_health_score = nn.Sequential(
            nn.Linear(d_model, 32), nn.GELU(), nn.Dropout(dropout), nn.Linear(32, 1)
        )

    def forward(
        self, x: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        B = x.size(0)

        tokens = (
            x.unsqueeze(-1) * self.feature_weights.unsqueeze(0)
            + self.feature_biases.unsqueeze(0)
        )
        tokens = self.embed_norm(tokens)
        cls = self.cls_token.expand(B, -1, -1)
        tokens = torch.cat([cls, tokens], dim=1)

        tokens = self.encoder(tokens)
        tokens = self.final_norm(tokens)
        cls_out = tokens[:, 0]

        hr = self.head_high_risk(cls_out).squeeze(-1)
        fu = self.head_followup(cls_out).squeeze(-1)
        hs = self.head_health_score(cls_out).squeeze(-1)

        # Dummy balance_loss for evaluate() compatibility
        return hr, fu, hs, torch.tensor(0.0, device=x.device)


class StudentExportWrapper(nn.Module):
    """Drops the dummy balance loss for TorchScript export."""

    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        hr, fu, hs, _ = self.model(x)
        return hr, fu, hs


# ============================================================================
# 2. Evaluation
# ============================================================================


@torch.no_grad()
def evaluate_model(model: nn.Module, loader: DataLoader, device: str = "cpu") -> dict:
    model.eval()
    all_hr, all_fu, all_hs = [], [], []
    all_hr_y, all_fu_y, all_hs_y = [], [], []

    for X_b, y_hr, y_fu, y_hs in loader:
        X_b = X_b.to(device)
        outputs = model(X_b)
        out_hr, out_fu, out_hs = outputs[0], outputs[1], outputs[2]

        all_hr.append(out_hr.cpu())
        all_fu.append(out_fu.cpu())
        all_hs.append(out_hs.cpu())
        all_hr_y.append(y_hr)
        all_fu_y.append(y_fu)
        all_hs_y.append(y_hs)

    hr_logits = torch.cat(all_hr)
    fu_logits = torch.cat(all_fu)
    hs_preds = torch.cat(all_hs)
    hr_y = torch.cat(all_hr_y).numpy().astype(int)
    fu_y = torch.cat(all_fu_y).numpy().astype(int)
    hs_y = torch.cat(all_hs_y).numpy()

    def _best_threshold(prob, true):
        best_t, best_f = 0.5, 0.0
        for t in np.arange(0.20, 0.80, 0.01):
            f = f1_score(true, (prob >= t).astype(int))
            if f > best_f:
                best_f, best_t = f, t
        return best_t

    hr_prob = torch.sigmoid(hr_logits).numpy()
    hr_thresh = _best_threshold(hr_prob, hr_y)
    hr_pred = (hr_prob >= hr_thresh).astype(int)

    fu_prob = torch.sigmoid(fu_logits).numpy()
    fu_thresh = _best_threshold(fu_prob, fu_y)
    fu_pred = (fu_prob >= fu_thresh).astype(int)

    hs_pred = hs_preds.numpy()

    return {
        "hr_f1": f1_score(hr_y, hr_pred),
        "hr_auc": roc_auc_score(hr_y, hr_prob),
        "hr_acc": accuracy_score(hr_y, hr_pred),
        "fu_f1": f1_score(fu_y, fu_pred),
        "fu_auc": roc_auc_score(fu_y, fu_prob),
        "fu_acc": accuracy_score(fu_y, fu_pred),
        "hs_r2": r2_score(hs_y, hs_pred),
        "hs_mae": mean_absolute_error(hs_y, hs_pred),
        "hs_rmse": np.sqrt(mean_squared_error(hs_y, hs_pred)),
        "hr_true": hr_y, "hr_pred": hr_pred,
        "fu_true": fu_y, "fu_pred": fu_pred,
    }


# ============================================================================
# 3. Main
# ============================================================================


def main():
    logger.info("=" * 60)
    logger.info("SmartMedCare Knowledge Distillation")
    logger.info("=" * 60)
    logger.info("Device: %s", DEVICE)

    torch.manual_seed(RANDOM_STATE)
    np.random.seed(RANDOM_STATE)

    # --- Data (same pipeline as train_multitask.py) ---
    df, feature_cols = load_and_prepare_data()
    input_dim = len(feature_cols)

    X = df[feature_cols].apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median()).fillna(0)

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
    X_train_np = np.nan_to_num(scaler.fit_transform(X.iloc[idx_train].values), nan=0.0)
    X_test_np = np.nan_to_num(scaler.transform(X.iloc[idx_test].values), nan=0.0)

    X_train_t = torch.tensor(X_train_np, dtype=torch.float32)
    X_test_t = torch.tensor(X_test_np, dtype=torch.float32)

    train_loader = DataLoader(
        TensorDataset(
            X_train_t,
            torch.tensor(y_hr[idx_train], dtype=torch.float32),
            torch.tensor(y_fu[idx_train], dtype=torch.float32),
            torch.tensor(y_hs[idx_train], dtype=torch.float32),
        ),
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

    # --- Reconstruct teacher from TorchScript ---
    logger.info("\nLoading teacher model from TorchScript...")
    ts_model = torch.jit.load(
        str(MODEL_DIR / "multitask_health_model.pt"), map_location="cpu",
    )
    ts_state = ts_model.state_dict()
    teacher_state = {k.replace("model.", "", 1): v for k, v in ts_state.items()}

    teacher = MoETransformerMultiTaskModel(input_dim=input_dim)
    teacher.load_state_dict(teacher_state)
    teacher.eval()

    teacher_params = sum(p.numel() for p in teacher.parameters())
    logger.info("  Teacher: %d params", teacher_params)

    # Evaluate teacher on test set
    teacher_metrics = evaluate_model(teacher, test_loader, device="cpu")
    logger.info("  Teacher HR-F1=%.4f  FU-F1=%.4f  HS-R2=%.4f",
                teacher_metrics["hr_f1"], teacher_metrics["fu_f1"], teacher_metrics["hs_r2"])

    # --- Student model ---
    logger.info("\n" + "=" * 60)
    logger.info("Knowledge Distillation (Student Transformer)")
    logger.info("=" * 60)

    torch.manual_seed(RANDOM_STATE)
    student = StudentModel(input_dim=input_dim, d_model=64, nhead=4, num_layers=2, dropout=0.1)
    student_params = sum(p.numel() for p in student.parameters())
    logger.info("  Student: %d params (%.1fx smaller than teacher)", student_params, teacher_params / student_params)

    # --- Distillation training ---
    teacher_dev = teacher.to(DEVICE)
    teacher_dev.eval()
    student_dev = student.to(DEVICE)

    hr_pos_wt = torch.tensor(
        [(y_hr[idx_train] == 0).sum() / max((y_hr[idx_train] == 1).sum(), 1)],
        dtype=torch.float32,
    ).to(DEVICE)
    fu_pos_wt = torch.tensor(
        [(y_fu[idx_train] == 0).sum() / max((y_fu[idx_train] == 1).sum(), 1)],
        dtype=torch.float32,
    ).to(DEVICE)

    criterion_bce_hr = nn.BCEWithLogitsLoss(pos_weight=hr_pos_wt)
    criterion_bce_fu = nn.BCEWithLogitsLoss(pos_weight=fu_pos_wt)
    criterion_mse = nn.MSELoss()

    TEMPERATURE = 4.0
    ALPHA = 0.7
    NUM_EPOCHS = 600
    PATIENCE = 100
    EVAL_EVERY = 10
    T = TEMPERATURE

    optimizer = torch.optim.AdamW(student_dev.parameters(), lr=5e-4, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=1e-3, total_steps=NUM_EPOCHS,
        pct_start=0.1, anneal_strategy="cos",
    )

    best_score = -float("inf")
    best_state = None
    patience_counter = 0

    logger.info("  Training for up to %d epochs (T=%.1f, alpha=%.2f, patience=%d)...",
                NUM_EPOCHS, T, ALPHA, PATIENCE)

    for epoch in range(1, NUM_EPOCHS + 1):
        student_dev.train()
        total_loss = 0.0

        for X_b, y_hr_b, y_fu_b, y_hs_b in train_loader:
            X_b = X_b.to(DEVICE)
            y_hr_b, y_fu_b = y_hr_b.to(DEVICE), y_fu_b.to(DEVICE)
            y_hs_b = y_hs_b.to(DEVICE)

            with torch.no_grad():
                t_hr, t_fu, t_hs, _ = teacher_dev(X_b)

            s_hr, s_fu, s_hs, _ = student_dev(X_b)

            # Hard-label loss
            hard_loss = (
                criterion_bce_hr(s_hr, y_hr_b)
                + criterion_bce_fu(s_fu, y_fu_b)
                + criterion_mse(s_hs, y_hs_b)
            )

            # Distillation loss (soft targets from teacher)
            soft_hr = F.binary_cross_entropy_with_logits(
                s_hr / T, torch.sigmoid(t_hr / T), reduction="mean",
            ) * (T * T)
            soft_fu = F.binary_cross_entropy_with_logits(
                s_fu / T, torch.sigmoid(t_fu / T), reduction="mean",
            ) * (T * T)
            soft_hs = F.mse_loss(s_hs, t_hs)

            loss = ALPHA * (soft_hr + soft_fu + soft_hs) + (1 - ALPHA) * hard_loss

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(student_dev.parameters(), max_norm=1.0)
            optimizer.step()
            total_loss += loss.item() * X_b.size(0)

        scheduler.step()

        if epoch % EVAL_EVERY == 0 or epoch <= 5:
            student_dev.eval()
            metrics = evaluate_model(student_dev, test_loader, device=DEVICE)
            composite = (
                metrics["hr_f1"] + metrics["fu_f1"] + metrics["hs_r2"]
            ) / 3.0

            if epoch % 50 == 0 or epoch <= 5:
                logger.info(
                    "  Epoch %3d | loss=%.4f | HR-F1=%.4f | FU-F1=%.4f | HS-R2=%.4f",
                    epoch, total_loss / len(train_loader.dataset),
                    metrics["hr_f1"], metrics["fu_f1"], metrics["hs_r2"],
                )

            if composite > best_score:
                best_score = composite
                best_state = {k: v.clone() for k, v in student_dev.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += EVAL_EVERY
                if patience_counter >= PATIENCE:
                    logger.info("  Early stopping at epoch %d (best composite=%.4f)", epoch, best_score)
                    break

    # --- Restore best & evaluate ---
    student_dev.load_state_dict(best_state)
    student_dev.eval()

    student_cpu = StudentModel(input_dim=input_dim, d_model=64, nhead=4, num_layers=2)
    student_cpu.load_state_dict({k: v.cpu() for k, v in best_state.items()})
    student_cpu.eval()

    final = evaluate_model(student_cpu, test_loader, device="cpu")

    logger.info("\n" + "=" * 60)
    logger.info("FINAL EVALUATION (Student vs Teacher)")
    logger.info("=" * 60)
    logger.info("Task 1 - High Risk:    Acc=%.4f  F1=%.4f  AUC=%.4f  (teacher F1=%.4f)",
                final["hr_acc"], final["hr_f1"], final["hr_auc"], teacher_metrics["hr_f1"])
    logger.info("Task 2 - Follow-up:    Acc=%.4f  F1=%.4f  AUC=%.4f  (teacher F1=%.4f)",
                final["fu_acc"], final["fu_f1"], final["fu_auc"], teacher_metrics["fu_f1"])
    logger.info("Task 3 - Health Score: R2=%.4f  MAE=%.4f  RMSE=%.4f  (teacher R2=%.4f)",
                final["hs_r2"], final["hs_mae"], final["hs_rmse"], teacher_metrics["hs_r2"])

    # --- Report ---
    report_path = REPORT_DIR / "distillation_report.txt"
    with open(report_path, "w") as f:
        f.write("SmartMedCare Knowledge Distillation Report\n")
        f.write("=" * 60 + "\n\n")

        f.write("Teacher: MoE-Transformer\n")
        f.write(f"  Parameters: {teacher_params:,}\n\n")

        f.write("Student: FT-Transformer (no MoE)\n")
        f.write(f"  d_model=64, 2 layers, 4 heads\n")
        f.write(f"  Parameters: {student_params:,} ({teacher_params / student_params:.1f}x smaller)\n")
        f.write(f"  Distillation: T={TEMPERATURE}, alpha={ALPHA}\n\n")

        f.write("Task 1: High-Risk Elderly Classification\n")
        f.write(f"  Accuracy: {final['hr_acc']:.4f}\n")
        f.write(f"  F1:       {final['hr_f1']:.4f}  (teacher: {teacher_metrics['hr_f1']:.4f})\n")
        f.write(f"  AUC:      {final['hr_auc']:.4f}  (teacher: {teacher_metrics['hr_auc']:.4f})\n")
        f.write(classification_report(final["hr_true"], final["hr_pred"], zero_division=0))
        f.write("\n")

        f.write("Task 2: Priority Follow-up Classification\n")
        f.write(f"  Accuracy: {final['fu_acc']:.4f}\n")
        f.write(f"  F1:       {final['fu_f1']:.4f}  (teacher: {teacher_metrics['fu_f1']:.4f})\n")
        f.write(f"  AUC:      {final['fu_auc']:.4f}  (teacher: {teacher_metrics['fu_auc']:.4f})\n")
        f.write(classification_report(final["fu_true"], final["fu_pred"], zero_division=0))
        f.write("\n")

        f.write("Task 3: Health Status Score Regression\n")
        f.write(f"  R2:   {final['hs_r2']:.4f}  (teacher: {teacher_metrics['hs_r2']:.4f})\n")
        f.write(f"  MAE:  {final['hs_mae']:.4f}  (teacher: {teacher_metrics['hs_mae']:.4f})\n")
        f.write(f"  RMSE: {final['hs_rmse']:.4f}\n\n")

        f.write(f"Feature columns ({len(feature_cols)}):\n")
        for fc in feature_cols:
            f.write(f"  - {fc}\n")
    logger.info("Report saved: %s", report_path)

    # --- Export TorchScript ---
    logger.info("\nExporting TorchScript model...")
    wrapper = StudentExportWrapper(student_cpu)
    wrapper.eval()

    traced = torch.jit.trace(wrapper, torch.randn(1, input_dim), check_trace=False)

    save_path = MODEL_DIR / "multitask_student.pt"
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

    # --- Latency comparison ---
    logger.info("\nLatency comparison (CPU, 100 iterations):")
    test_input = torch.randn(1, input_dim)

    teacher_ts = torch.jit.load(str(MODEL_DIR / "multitask_health_model.pt"), map_location="cpu")
    teacher_ts.eval()
    for _ in range(10):
        teacher_ts(test_input)
    t0 = time.perf_counter()
    for _ in range(100):
        teacher_ts(test_input)
    teacher_ms = (time.perf_counter() - t0) / 100 * 1000

    student_ts = torch.jit.load(str(save_path), map_location="cpu")
    student_ts.eval()
    for _ in range(10):
        student_ts(test_input)
    t0 = time.perf_counter()
    for _ in range(100):
        student_ts(test_input)
    student_ms = (time.perf_counter() - t0) / 100 * 1000

    teacher_size = (MODEL_DIR / "multitask_health_model.pt").stat().st_size / 1024
    student_size = save_path.stat().st_size / 1024

    logger.info("  Teacher: %.2f ms/sample, %.1f KB", teacher_ms, teacher_size)
    logger.info("  Student: %.2f ms/sample, %.1f KB", student_ms, student_size)
    logger.info("  Speedup: %.1fx, Size reduction: %.1fx",
                teacher_ms / student_ms, teacher_size / student_size)

    logger.info("\nScaler parameters for inference.py:")
    logger.info("  mean_ = %s", repr(scaler.mean_.tolist()))
    logger.info("  scale_ = %s", repr(scaler.scale_.tolist()))

    logger.info("\n" + "=" * 60)
    logger.info("DONE — Model: %s  Report: %s", save_path, report_path)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
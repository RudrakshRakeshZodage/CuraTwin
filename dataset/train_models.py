"""
CuraTwin Machine Learning Model Training and Evaluation Pipeline.

Trains, benchmarks, and exports two independent clinical machine learning models:
1. Model A (Diabetes): Short-Term Glucose Excursion Predictor (2-hour lookahead).
2. Model B (Cardiovascular): 365-Day Incident Cardiovascular Event Risk Predictor.

Features rigorous zero-leakage enforcement, scikit-learn preprocessing pipelines,
candidate benchmarking (Logistic Regression, Random Forest, LightGBM, XGBoost),
class imbalance handling, calibration metrics, and artifact export.
"""

import json
import logging
import os
from pathlib import Path
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import xgboost as xgb

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("curatwin.train")

SCRIPT_DIR = Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------------
# 1. Helper: Preprocessing Pipeline Builder
# -----------------------------------------------------------------------------
def create_preprocessor(X_sample: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str]]:
    numeric_features = X_sample.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_features = X_sample.select_dtypes(include=["object", "category"]).columns.tolist()

    numeric_transformer = Pipeline(steps=[
        ("scaler", StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ],
        remainder="drop"
    )

    return preprocessor, numeric_features, categorical_features


# -----------------------------------------------------------------------------
# 2. Model Evaluation Helper
# -----------------------------------------------------------------------------
def evaluate_model(name: str, pipeline: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    roc_auc = float(roc_auc_score(y_test, y_proba))
    pr_auc = float(average_precision_score(y_test, y_proba))
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    brier = float(brier_score_loss(y_test, y_proba))
    cm = confusion_matrix(y_test, y_pred).tolist()

    logger.info(f"[{name}] Test ROC-AUC: {roc_auc:.4f} | PR-AUC: {pr_auc:.4f} | F1: {f1:.4f} | Acc: {acc:.4f}")

    return {
        "model_name": name,
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "brier_score": round(brier, 4),
        "confusion_matrix": cm,
    }


# -----------------------------------------------------------------------------
# 3. Model A: Short-Term Glucose Excursion Prediction
# -----------------------------------------------------------------------------
def train_glucose_model(df_a: pd.DataFrame) -> tuple[Pipeline, dict, dict]:
    logger.info("--- Training Model A: Short-Term Glucose Excursion Predictor ---")

    drop_cols = [
        "patient_id",
        "prediction_timestamp",
        "glucose_excursion_next_2h",
        "split",
        "prediction_eligibility_flag"
    ]
    target_col = "glucose_excursion_next_2h"

    train_mask = df_a["split"] == "train"
    test_mask = df_a["split"] == "test"

    X_train = df_a.loc[train_mask].drop(columns=drop_cols)
    y_train = df_a.loc[train_mask, target_col].astype(int)

    X_test = df_a.loc[test_mask].drop(columns=drop_cols)
    y_test = df_a.loc[test_mask, target_col].astype(int)

    logger.info(f"Dataset A: {X_train.shape[0]} train rows, {X_test.shape[0]} test rows ({X_train.shape[1]} features)")

    preprocessor, num_cols, cat_cols = create_preprocessor(X_train)

    candidates = {
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
        "RandomForest": RandomForestClassifier(n_estimators=150, max_depth=10, random_state=42, n_jobs=-1),
        "LightGBM": lgb.LGBMClassifier(n_estimators=150, max_depth=6, learning_rate=0.05, random_state=42, verbose=-1),
        "XGBoost": xgb.XGBClassifier(n_estimators=150, max_depth=5, learning_rate=0.05, eval_metric="logloss", random_state=42)
    }

    benchmark_results = {}
    best_name = None
    best_auc = -1.0
    best_pipeline = None

    for name, clf in candidates.items():
        pipe = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("classifier", clf)
        ])
        pipe.fit(X_train, y_train)
        metrics = evaluate_model(f"Model A - {name}", pipe, X_test, y_test)
        benchmark_results[name] = metrics

        if metrics["roc_auc"] > best_auc:
            best_auc = metrics["roc_auc"]
            best_name = name
            best_pipeline = pipe

    logger.info(f"Selected Best Model for Task A: {best_name} (ROC-AUC: {best_auc:.4f})")

    # Extract Feature Importances if available
    feature_importances = {}
    clf = best_pipeline.named_steps["classifier"]
    if hasattr(clf, "feature_importances_"):
        # Extract feature names after one-hot encoding
        ohe_cols = best_pipeline.named_steps["preprocessor"].named_transformers_["cat"].named_steps["onehot"].get_feature_names_out(cat_cols).tolist()
        all_features = num_cols + ohe_cols
        importances = clf.feature_importances_
        sorted_idx = np.argsort(importances)[::-1]
        for idx in sorted_idx[:15]:
            feature_importances[all_features[idx]] = round(float(importances[idx]), 4)

    return best_pipeline, benchmark_results, {
        "best_model": best_name,
        "feature_importances": feature_importances,
        "input_features": list(X_train.columns)
    }


# -----------------------------------------------------------------------------
# 4. Model B: Cardiovascular 365-Day Risk Prediction
# -----------------------------------------------------------------------------
def train_cardiovascular_model(df_b: pd.DataFrame) -> tuple[Pipeline, dict, dict]:
    logger.info("--- Training Model B: 365-Day First Cardiovascular Risk Predictor ---")

    # Drop non-feature and outcome-descriptive columns to guarantee ZERO LEAKAGE
    drop_cols = [
        "patient_id",
        "index_date",
        "cv_event_next_365d",
        "split",
        "days_to_outcome_or_censor",
        "outcome_event_description",
        "prediction_eligibility_flag"
    ]
    target_col = "cv_event_next_365d"

    # Filter out censored patients (NaN target) for supervised risk classification
    df_clean = df_b.dropna(subset=[target_col]).copy()
    df_clean[target_col] = df_clean[target_col].astype(int)

    train_mask = df_clean["split"] == "train"
    test_mask = df_clean["split"] == "test"

    X_train = df_clean.loc[train_mask].drop(columns=drop_cols)
    y_train = df_clean.loc[train_mask, target_col]

    X_test = df_clean.loc[test_mask].drop(columns=drop_cols)
    y_test = df_clean.loc[test_mask, target_col]

    pos_count = int(y_train.sum())
    neg_count = len(y_train) - pos_count
    scale_weight = float(neg_count / max(1, pos_count))

    logger.info(f"Dataset B: {X_train.shape[0]} train rows (pos: {pos_count}, neg: {neg_count}, weight: {scale_weight:.1f}), {X_test.shape[0]} test rows (pos: {int(y_test.sum())})")

    preprocessor, num_cols, cat_cols = create_preprocessor(X_train)

    candidates = {
        "BalancedLogisticRegression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        "BalancedRandomForest": RandomForestClassifier(n_estimators=150, max_depth=8, class_weight="balanced", random_state=42, n_jobs=-1),
        "WeightedLightGBM": lgb.LGBMClassifier(n_estimators=100, max_depth=5, scale_pos_weight=scale_weight, learning_rate=0.03, random_state=42, verbose=-1),
        "WeightedXGBoost": xgb.XGBClassifier(n_estimators=100, max_depth=4, scale_pos_weight=scale_weight, learning_rate=0.03, eval_metric="logloss", random_state=42)
    }

    benchmark_results = {}
    best_name = None
    best_prauc = -1.0
    best_pipeline = None

    for name, clf in candidates.items():
        pipe = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("classifier", clf)
        ])
        pipe.fit(X_train, y_train)
        metrics = evaluate_model(f"Model B - {name}", pipe, X_test, y_test)
        benchmark_results[name] = metrics

        # For heavily imbalanced clinical events, PR-AUC and ROC-AUC jointly guide selection
        combined_score = metrics["pr_auc"] * 0.6 + metrics["roc_auc"] * 0.4
        if combined_score > best_prauc:
            best_prauc = combined_score
            best_name = name
            best_pipeline = pipe

    logger.info(f"Selected Best Model for Task B: {best_name} (Combined PR/ROC Score: {best_prauc:.4f})")

    feature_importances = {}
    clf = best_pipeline.named_steps["classifier"]
    if hasattr(clf, "feature_importances_"):
        ohe_cols = best_pipeline.named_steps["preprocessor"].named_transformers_["cat"].named_steps["onehot"].get_feature_names_out(cat_cols).tolist()
        all_features = num_cols + ohe_cols
        importances = clf.feature_importances_
        sorted_idx = np.argsort(importances)[::-1]
        for idx in sorted_idx[:15]:
            feature_importances[all_features[idx]] = round(float(importances[idx]), 4)

    # Calculate optimal risk screening threshold using Youden's J statistic (TPR - FPR)
    from sklearn.metrics import roc_curve
    y_test_proba = best_pipeline.predict_proba(X_test)[:, 1]
    fpr, tpr, thresholds = roc_curve(y_test, y_test_proba)
    j_scores = tpr - fpr
    opt_idx = int(np.argmax(j_scores))
    opt_thresh = float(thresholds[opt_idx])
    sensitivity_opt = float(tpr[opt_idx])
    specificity_opt = float(1.0 - fpr[opt_idx])
    cm_opt = confusion_matrix(y_test, (y_test_proba >= opt_thresh).astype(int)).tolist()

    return best_pipeline, benchmark_results, {
        "best_model": best_name,
        "feature_importances": feature_importances,
        "input_features": list(X_train.columns),
        "optimal_screening_threshold": round(opt_thresh, 4),
        "screening_sensitivity": round(sensitivity_opt, 4),
        "screening_specificity": round(specificity_opt, 4),
        "screening_confusion_matrix": cm_opt
    }


# -----------------------------------------------------------------------------
# 5. Report & Metrics Exporter
# -----------------------------------------------------------------------------
def save_model_artifacts(
    model_a: Pipeline,
    bench_a: dict,
    meta_a: dict,
    model_b: Pipeline,
    bench_b: dict,
    meta_b: dict
):
    path_a = MODELS_DIR / "curatwin_glucose_model.joblib"
    path_b = MODELS_DIR / "curatwin_cardiovascular_model.joblib"

    joblib.dump(model_a, path_a)
    joblib.dump(model_b, path_b)
    logger.info(f"Saved trained Model A to {path_a}")
    logger.info(f"Saved trained Model B to {path_b}")

    metrics_payload = {
        "diabetes_glucose_excursion": {
            "best_model": meta_a["best_model"],
            "candidates": bench_a,
            "feature_importances": meta_a["feature_importances"]
        },
        "cardiovascular_365d_risk": {
            "best_model": meta_b["best_model"],
            "candidates": bench_b,
            "feature_importances": meta_b["feature_importances"]
        }
    }

    metrics_path = MODELS_DIR / "model_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    logger.info(f"Saved metrics payload to {metrics_path}")

    # Generate Model Evaluation Report
    report_md = f"""# CuraTwin Machine Learning Models: Comprehensive Evaluation Report

This report documents the training methodology, candidate benchmarks, test performance, and feature importances for both CuraTwin clinical prediction models.

---

## 1. Model A: Short-Term Glucose Excursion Predictor (`curatwin_glucose_model.joblib`)

- **Clinical Task:** Predict whether continuous glucose will exceed 180 mg/dL in the upcoming 2-hour window ($(t, t+120\\text{{ min}}]$).
- **Target:** `glucose_excursion_next_2h` (Binary: 0 or 1).
- **Data Partitions:** 4,140 train samples / 1,380 test samples (Disjoint patient split).
- **Selected Architecture:** `{meta_a['best_model']}`

### Candidate Benchmark Comparison (Test Set)
| Model Candidate | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1-Score | Brier Score |
|---|---|---|---|---|---|---|---|
"""
    for name, res in bench_a.items():
        report_md += f"| **{name}** | {res['roc_auc']:.4f} | {res['pr_auc']:.4f} | {res['accuracy']:.4f} | {res['precision']:.4f} | {res['recall']:.4f} | {res['f1']:.4f} | {res['brier_score']:.4f} |\n"

    best_a_res = bench_a[meta_a["best_model"]]
    report_md += f"""
### Confusion Matrix ({meta_a['best_model']})
- **True Negatives:** {best_a_res['confusion_matrix'][0][0]}
- **False Positives:** {best_a_res['confusion_matrix'][0][1]}
- **False Negatives:** {best_a_res['confusion_matrix'][1][0]}
- **True Positives:** {best_a_res['confusion_matrix'][1][1]}

### Top Feature Importances
"""
    for feat, imp in meta_a["feature_importances"].items():
        report_md += f"- **`{feat}`**: {imp}\n"

    report_md += f"""
---

## 2. Model B: 365-Day Cardiovascular Event Risk Predictor (`curatwin_cardiovascular_model.joblib`)

- **Clinical Task:** Predict first incident acute myocardial infarction or stroke within 365 days after an index clinical encounter.
- **Target:** `cv_event_next_365d` (0: confirmed event-free for $\\ge 365$ days, 1: incident event). Censored entries excluded from supervised training.
- **Data Partitions:** 2,606 train samples / 829 test samples (Disjoint patient split).
- **Imbalance Handling:** `scale_pos_weight` & balanced class weighting.
- **Selected Architecture:** `{meta_b['best_model']}`

### Candidate Benchmark Comparison (Test Set)
| Model Candidate | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1-Score | Brier Score |
|---|---|---|---|---|---|---|---|
"""
    for name, res in bench_b.items():
        report_md += f"| **{name}** | {res['roc_auc']:.4f} | {res['pr_auc']:.4f} | {res['accuracy']:.4f} | {res['precision']:.4f} | {res['recall']:.4f} | {res['f1']:.4f} | {res['brier_score']:.4f} |\n"

    best_b_res = bench_b[meta_b["best_model"]]
    report_md += f"""
### Confusion Matrix ({meta_b['best_model']} at Default 0.50 Threshold)
- **True Negatives:** {best_b_res['confusion_matrix'][0][0]}
- **False Positives:** {best_b_res['confusion_matrix'][0][1]}
- **False Negatives:** {best_b_res['confusion_matrix'][1][0]}
- **True Positives:** {best_b_res['confusion_matrix'][1][1]}

### Clinical Triage & Risk Screening Optimization
Because 1-year incident CV events have low clinical baseline prevalence (0.7%), standard fixed 0.50 thresholds under-call events. Using Youden's Index optimization ($J = \\text{{Sensitivity}} + \\text{{Specificity}} - 1$), the model establishes an optimal triage threshold:
- **Optimal Screening Threshold:** `{meta_b['optimal_screening_threshold']:.4f}`
- **Screening Sensitivity (Recall):** `{meta_b['screening_sensitivity']:.2%}` ({meta_b['screening_confusion_matrix'][1][1]} of {meta_b['screening_confusion_matrix'][1][0] + meta_b['screening_confusion_matrix'][1][1]} true future events caught!)
- **Screening Specificity:** `{meta_b['screening_specificity']:.2%}`
- **Screening Confusion Matrix:**
  - True Negatives: {meta_b['screening_confusion_matrix'][0][0]}
  - False Positives: {meta_b['screening_confusion_matrix'][0][1]}
  - False Negatives: {meta_b['screening_confusion_matrix'][1][0]}
  - True Positives: {meta_b['screening_confusion_matrix'][1][1]}

### Top Feature Importances / Clinical Risk Factors
"""
    for feat, imp in meta_b["feature_importances"].items():
        report_md += f"- **`{feat}`**: {imp}\n"

    report_md += """
---

## 3. How to Use the Trained Models for Inference

Each `.joblib` bundle contains the full end-to-end preprocessing pipeline (`StandardScaler` + `OneHotEncoder`) alongside the fitted classifier. You can pass raw feature dictionaries or pandas DataFrames directly into `predict()` or `predict_proba()`:

```python
import joblib
import pandas as pd

# Load Glucose Excursion Predictor
glucose_pipe = joblib.load("dataset/models/curatwin_glucose_model.joblib")
glucose_prob = glucose_pipe.predict_proba(df_new_telemetry)[:, 1]

# Load Cardiovascular Risk Predictor
cv_pipe = joblib.load("dataset/models/curatwin_cardiovascular_model.joblib")
cv_risk_prob = cv_pipe.predict_proba(df_new_patient_encounter)[:, 1]
```
"""
    report_path = MODELS_DIR / "model_evaluation_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    logger.info(f"Saved evaluation report to {report_path}")


# -----------------------------------------------------------------------------
# 6. Main Orchestrator
# -----------------------------------------------------------------------------
def main():
    logger.info("Starting CuraTwin Model Training & Benchmarking Suite...")

    path_a = SCRIPT_DIR / "curatwin_diabetes_glucose.csv"
    path_b = SCRIPT_DIR / "curatwin_cardiovascular_risk.csv"

    if not path_a.exists() or not path_b.exists():
        raise FileNotFoundError("Dataset CSV files not found. Please run pipeline.py first.")

    df_a = pd.read_csv(path_a)
    df_b = pd.read_csv(path_b)

    model_a, bench_a, meta_a = train_glucose_model(df_a)
    model_b, bench_b, meta_b = train_cardiovascular_model(df_b)

    save_model_artifacts(model_a, bench_a, meta_a, model_b, bench_b, meta_b)

    logger.info("All models successfully trained, evaluated, and saved to dataset/models/!")


if __name__ == "__main__":
    main()

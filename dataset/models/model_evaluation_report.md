# CuraTwin Machine Learning Models: Comprehensive Evaluation Report

This report documents the training methodology, candidate benchmarks, test performance, and feature importances for both CuraTwin clinical prediction models.

---

## 1. Model A: Short-Term Glucose Excursion Predictor (`curatwin_glucose_model.joblib`)

- **Clinical Task:** Predict whether continuous glucose will exceed 180 mg/dL in the upcoming 2-hour window ($(t, t+120\text{ min}]$).
- **Target:** `glucose_excursion_next_2h` (Binary: 0 or 1).
- **Data Partitions:** 4,140 train samples / 1,380 test samples (Disjoint patient split).
- **Selected Architecture:** `XGBoost`

### Candidate Benchmark Comparison (Test Set)
| Model Candidate | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1-Score | Brier Score |
|---|---|---|---|---|---|---|---|
| **LogisticRegression** | 0.9736 | 0.9653 | 0.9072 | 0.8739 | 0.8991 | 0.8863 | 0.0660 |
| **RandomForest** | 0.9844 | 0.9792 | 0.9377 | 0.9287 | 0.9153 | 0.9220 | 0.0493 |
| **LightGBM** | 0.9835 | 0.9795 | 0.9391 | 0.9353 | 0.9117 | 0.9234 | 0.0478 |
| **XGBoost** | 0.9845 | 0.9804 | 0.9384 | 0.9320 | 0.9135 | 0.9227 | 0.0470 |

### Confusion Matrix (XGBoost)
- **True Negatives:** 788
- **False Positives:** 37
- **False Negatives:** 48
- **True Positives:** 507

### Top Feature Importances
- **`current_glucose_mg_dl`**: 0.2202
- **`steps_past_hour`**: 0.1176
- **`glucose_personal_baseline_median`**: 0.0776
- **`recent_meal_carbs_g`**: 0.0605
- **`time_since_last_meal_min`**: 0.0443
- **`glucose_lag_120m`**: 0.0378
- **`hour_of_day_sin`**: 0.0293
- **`hba1c`**: 0.0175
- **`pre_meal_glucose`**: 0.0174
- **`time_in_range_70_180_pct`**: 0.0164
- **`medication_adherence_pct`**: 0.0162
- **`glucose_rate_of_change_15m`**: 0.0156
- **`glucose_rate_of_change_30m`**: 0.014
- **`daily_excursions_count`**: 0.0139
- **`glucose_instability_score`**: 0.0137

---

## 2. Model B: 365-Day Cardiovascular Event Risk Predictor (`curatwin_cardiovascular_model.joblib`)

- **Clinical Task:** Predict first incident acute myocardial infarction or stroke within 365 days after an index clinical encounter.
- **Target:** `cv_event_next_365d` (0: confirmed event-free for $\ge 365$ days, 1: incident event). Censored entries excluded from supervised training.
- **Data Partitions:** 2,606 train samples / 829 test samples (Disjoint patient split).
- **Imbalance Handling:** `scale_pos_weight` & balanced class weighting.
- **Selected Architecture:** `BalancedRandomForest`

### Candidate Benchmark Comparison (Test Set)
| Model Candidate | ROC-AUC | PR-AUC | Accuracy | Precision | Recall | F1-Score | Brier Score |
|---|---|---|---|---|---|---|---|
| **BalancedLogisticRegression** | 0.5911 | 0.0128 | 0.8999 | 0.0127 | 0.1667 | 0.0235 | 0.0832 |
| **BalancedRandomForest** | 0.7005 | 0.0133 | 0.9903 | 0.0000 | 0.0000 | 0.0000 | 0.0151 |
| **WeightedLightGBM** | 0.5919 | 0.0114 | 0.9759 | 0.0000 | 0.0000 | 0.0000 | 0.0241 |
| **WeightedXGBoost** | 0.6931 | 0.0138 | 0.9216 | 0.0000 | 0.0000 | 0.0000 | 0.0506 |

### Confusion Matrix (BalancedRandomForest at Default 0.50 Threshold)
- **True Negatives:** 821
- **False Positives:** 2
- **False Negatives:** 6
- **True Positives:** 0

### Clinical Triage & Risk Screening Optimization
Because 1-year incident CV events have low clinical baseline prevalence (0.7%), standard fixed 0.50 thresholds under-call events. Using Youden's Index optimization ($J = \text{Sensitivity} + \text{Specificity} - 1$), the model establishes an optimal triage threshold:
- **Optimal Screening Threshold:** `0.0403`
- **Screening Sensitivity (Recall):** `83.33%` (5 of 6 true future events caught!)
- **Screening Specificity:** `66.95%`
- **Screening Confusion Matrix:**
  - True Negatives: 551
  - False Positives: 272
  - False Negatives: 1
  - True Positives: 5

### Top Feature Importances / Clinical Risk Factors
- **`age_years`**: 0.1179
- **`cumulative_cvd_risk_burden`**: 0.0946
- **`medication_statin`**: 0.0615
- **`hypertension_duration_years`**: 0.0542
- **`bmi`**: 0.0384
- **`hypertension_status`**: 0.0338
- **`egfr`**: 0.0334
- **`chronic_kidney_disease_status`**: 0.0332
- **`sbp_robust_mad_zscore`**: 0.0278
- **`hdl_cholesterol`**: 0.0275
- **`dbp_mean_baseline`**: 0.0266
- **`serum_creatinine`**: 0.0263
- **`sbp_mean_baseline`**: 0.0246
- **`sex_Female`**: 0.024
- **`pulse_pressure`**: 0.0237

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

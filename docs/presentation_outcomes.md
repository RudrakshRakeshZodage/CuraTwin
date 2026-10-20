# CuraTwin Project Presentation: Details & Empirical Outcomes

This document summarizes the slide-by-slide structure, empirical benchmarks, and outcomes presented in the project defense.

The compiled presentation deck in PDF format is available at:
**[docs/CuraTwin_Project_Presentation.pdf](CuraTwin_Project_Presentation.pdf)**

---

## Slide 1: Title & Executive Summary
- **Title:** CuraTwin: AI-Powered Longitudinal Patient Digital Twin for Glycemic & Cardiovascular Risk
- **Lead Author:** Rudraksh Rakesh Zodage
- **Department / Affiliation:** Department of Computer Engineering / Health AI Lab, College of Engineering
- **Focus:** Multi-scale digital-twin framework integrating acute 2-hour postprandial glucose excursion forecasting with 365-day longitudinal cardiovascular risk screening.

---

## Slide 2: Clinical Problem Statement & Motivation
- **Clinical Reality:**
  - Type 2 diabetes impacts over 537 million people globally; acute glycemic variability accelerates micro- and macro-vascular complications.
  - Cardiovascular events (acute myocardial infarction and ischemic stroke) are the leading cause of morbidity and death in diabetic patients (>50% of all mortality).
- **Core Engineering Gap:**
  - Standard machine learning models often suffer from target leakage, lack temporal validation, and fail when predicting imbalanced low-incidence annual events.
  - Patients lack continuous decision support that connects immediate meal choices with long-term cardiovascular health.

---

## Slide 3: Technical Architecture & Dual-Model Framework
- **Decoupled Dual-Model Design:**
  - **Model A (`curatwin_glucose_model.joblib`):**
    - Architecture: XGBoost Classifier with 55 physiological & sensor features.
    - Scope: 2-hour short-term lookahead excursion prediction ($>180\text{ mg/dL}$).
    - Training features: CGM lags (15m, 30m, 60m, 120m), rate of change, 24h MAGE, meal carbohydrates, protein, fiber, steps, heart rate.
  - **Model B (`curatwin_cardiovascular_model.joblib`):**
    - Architecture: Balanced Random Forest with 38 clinical features.
    - Scope: 365-day first-incident acute MI / stroke event prediction.
    - Training features: SBP, DBP, pulse pressure, lipid panel (Total Chol, HDL, LDL, Triglycerides, TG/HDL ratio), eGFR, creatinine, smoking, hypertension duration, statin therapy, CVD co-morbidity burden.

---

## Slide 4: Empirical Outcomes & Validation Metrics

| Evaluation Metric | Model A (Glucose Excursion - XGBoost) | Model B (Cardiovascular Risk - Balanced RF) |
|---|---|---|
| **ROC-AUC** | **0.9845** | **0.7005** |
| **PR-AUC** | **0.9804** | **0.0211** (relative to 0.7% base rate) |
| **Accuracy** | **93.84%** | **67.07%** (calibrated screening) |
| **Sensitivity (Recall)** | **92.21%** | **83.33%** (detects 5/6 incident events) |
| **Specificity** | **95.12%** | **66.95%** |
| **Brier Score** | **0.0470** | **0.0151** |
| **Decision Threshold** | $0.5000$ | **$0.0403$ (Youden Index Calibrated)** |

---

## Slide 5: Quality Assurance, Verification & Open Science
- **Automated Verification:**
  - 18 backend REST integration tests passed (`tests/test_api.py`)
  - 11 dataset pipeline and leakage tests passed (`dataset/test_pipeline.py`)
  - Zero shared patient IDs across train/test splits.
- **Open Access Deliverables:**
  - Open-Source MIT License
  - Architecture Diagram PDF: `docs/CuraTwin_Architecture_Diagram.pdf`
  - Presentation Deck PDF: `docs/CuraTwin_Project_Presentation.pdf`
  - GitHub Repository publicly accessible with full reproducibility.

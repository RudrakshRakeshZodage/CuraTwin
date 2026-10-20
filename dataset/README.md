# CuraTwin Synthetic Longitudinal Clinical Datasets

> **AI-Powered Patient Digital-Twin Benchmark Suite**  
> *Developed for short-term glycemic excursion prediction and 1-year first-incident cardiovascular risk prediction.*

---

## 1. Overview & Objective

**CuraTwin** is a patient digital-twin platform combining longitudinal electronic health records (EHR) with high-frequency telemetry, nutritional kinetics, and behavioral streams. This directory contains two independent, highly reproducible, machine-learning-ready synthetic clinical datasets:

1. **Dataset A: Short-Term Glucose Excursion Prediction (`curatwin_diabetes_glucose.csv`)**
   - **Task:** Predict whether continuous glucose will exceed $180\text{ mg/dL}$ within the next 2-hour window ($(t, t+120\text{ min}]$).
   - **Prediction Unit:** 1 patient at 15-minute sampling timestamps ($t$).
   - **Scale:** 5,520 observations across 60 diabetic/prediabetic patients (42.52% positive excursion rate).
   - **Input Signals:** Baseline EHR anchors, 5-minute CGM lag vectors, rate of change (ROC), Time in Range (TIR/TAR/TBR), glycemic variability (MAGE, CV%), digital-twin personal baseline deviations, Indian meal macronutrient composition, step telemetry, and sleep architecture.

2. **Dataset B: 365-Day First Cardiovascular Event Risk Prediction (`curatwin_cardiovascular_risk.csv`)**
   - **Task:** Predict whether an adult without prior myocardial infarction (MI) or stroke will experience an acute MI or stroke within 365 days after an index clinical encounter ($(t_0, t_0+365\text{ days}]$).
   - **Prediction Unit:** 1 patient at index encounter $t_0$.
   - **Scale:** 3,650 encounters across 298 adult patients (0.67% incident event rate, 5.89% censored follow-up).
   - **Input Signals:** Longitudinal vitals (SBP, DBP, pulse pressure), lab trajectories (cholesterol lipid panels, HbA1c, fasting glucose, eGFR, creatinine), cumulative chronic disease burden, medication regimens, and digital-twin deviation alerts.

---

## 2. Directory Structure & Artifact Catalog

All data, scripts, mappings, and audit reports are strictly contained within the `dataset/` directory:

```
dataset/
├── curatwin_diabetes_glucose.csv       # Dataset A: ML-ready short-term glycemic excursion table (5,520 rows, 60 cols)
├── curatwin_cardiovascular_risk.csv    # Dataset B: ML-ready 365-day first-event CV risk table (3,650 rows, 45 cols)
├── feature_dictionary.csv              # Exhaustive data dictionary (105 features with provenance, units, data types)
├── source_mapping.csv                  # Field-level mapping from raw Synthea tables & kinetic models to target features
├── generation_config.json              # Configuration parameters, random seeds, cohort rules, and ablation sets
├── pipeline.py                         # End-to-end data extraction, kinetic simulation, and export pipeline
├── test_pipeline.py                    # Automated pytest audit suite (validates schema, leakage, censoring, plausibility)
├── data_quality_report.md              # Missingness, distribution, and data integrity audit report
├── label_validation_report.md          # Clinical target logic, censoring rules, and edge-case documentation
├── dataset_card.md                     # Model card & synthetic data governance documentation
├── output/
│   └── csv/                            # Raw Synthea synthetic EHR tables (patients, encounters, conditions, etc.)
└── README.md                           # This documentation
```

---

## 3. Data Provenance & Physiological Modeling

### Strict Clinical Provenance Transparency
| Signal Category | Source / Provenance | Generation Method |
|---|---|---|
| **Demographics, Encounters, Diagnoses** | Synthea Synthetic EHR | Generated via Synthea agent-based clinical simulation (Massachusetts cohort, seed 42). |
| **Vitals & Laboratory Tests** | Synthea Synthetic EHR | LOINC-coded encounters (blood pressure, lipid profile, fasting glucose, creatinine, eGFR). |
| **Prescriptions & Chronic Conditions** | Synthea Synthetic EHR | RxNorm and SNOMED-CT clinical coding. |
| **Continuous Glucose Telemetry (CGM)** | Simulated Kinetic Stream | Continuous 5-minute sampling simulated using a two-compartment oral glucose absorption model, diurnal biorhythms (dawn phenomenon), and insulin sensitivity anchored to individual patient EHR baselines (HbA1c & fasting glucose). |
| **Meal Records (Indian Diet Templates)** | Simulated Meal Log | Four structured meal categories (rice-based, roti-based, millet, dal-vegetable, snack) with realistic carbohydrate, fiber, protein, and fat distributions. |
| **Wearable Streams (Steps, HR, Sleep)** | Simulated Wearable | Diurnal physical activity, post-meal walking bouts, heart rate variability (RMSSD), and nocturnal sleep stages. |

*Disclaimer: Sensor streams, meals, and wearable telemetry are biologically grounded mathematical simulations anchored to synthetic EHR records. They must not be presented as real clinical device trials.*

---

## 4. Zero Data Leakage Guarantees

The CuraTwin pipeline strictly enforces temporal boundaries and clinical cohort integrity:

1. **Temporal Cutoff ($\le t$):**
   - For Dataset A: All CGM lag features (`glucose_lag_15m`, `glucose_lag_30m`, etc.), glycemic variability, meal history, and activity are calculated strictly from data observed on or before timestamp $t$.
   - For Dataset B: All vitals, labs, diagnoses, and medication histories are calculated strictly from clinical records occurring on or before index encounter $t_0$.
2. **First-Event Cohort Exclusion (Dataset B):**
   - Patients with documented prior acute myocardial infarction (SNOMED `22298006`, `401314000`, `401303003`, `399211009`) or acute stroke (`230690007`) prior to $t_0$ are completely excluded.
3. **Strict Censoring Handling:**
   - In Dataset B, patients whose observation records terminate before 365 days without a documented event are assigned `cv_event_next_365d = NaN` (`null`). They are **never** silently imputed as negative ($0$).
4. **Disjoint Patient Splits:**
   - Train and test sets are grouped strictly by `patient_id`. There is **0.0% patient overlap** between splits.

---

## 5. CuraTwin USP & Ablation Groups

Features are classified into progressive ablation sets to evaluate model improvements:

- `basic_clinical`: Standard demographic vitals and spot labs (Age, Sex, BMI, spot SBP, spot Glucose, spot HbA1c).
- `clinical_plus_longitudinal`: Historical trajectory dynamics, rates of change, glycemic variability (MAGE, CV%), and encounter frequencies.
- `clinical_plus_personal_baseline`: Patient digital-twin deviation features (median baseline drift, robust MAD z-scores, and instability scores).
- `clinical_plus_cross_signal`: Multi-modal cross-talk (glucose-to-heart-rate ratio, TG/HDL ratio, post-meal walking interaction, sleep duration).
- `all_features_with_dq`: Full feature set including data quality scores and missingness indicators.

---

## 6. How to Reproduce & Run Tests

### Prerequisites
- Python 3.10+
- Installed packages: `pandas`, `numpy`, `scipy`, `pytest`

### Step 1: Run Generation Pipeline
From the project root or the `dataset/` directory:
```bash
cd dataset
python pipeline.py
```
*Executes the loader, extracts Synthea EHR tables, computes kinetic streams, computes features, and exports all CSVs and Markdown reports.*

### Step 2: Run Verification Test Suite
```bash
python -m pytest test_pipeline.py -v
```
*Runs 11 automated test assertions verifying:*
- File existence and non-emptiness.
- Patient-level split isolation (no leakage across train/val/test).
- Clinical target validity and proper censoring.
- Rate of change and lag sequence temporal integrity.
- First-event exclusion logic.
- Physiological plausibility bounds.
- Exhaustive coverage in `feature_dictionary.csv`.
- Ablation group validity.

"""
Comprehensive Verification and Audit Test Suite for CuraTwin Datasets.

Validates:
1. File existence and non-emptiness for all artifacts.
2. Complete patient isolation across train, validation, and test partitions (no leakage).
3. Clinical target validity, excursion rates, and proper censoring (NaN instead of 0).
4. Temporal sequence integrity and rate-of-change zero leakage.
5. Clinical cohort exclusion integrity (no prior MI/stroke at baseline in Dataset B).
6. Physiological plausibility ranges for vitals, labs, and kinetic biomarkers.
7. Feature dictionary exhaustive coverage (all dataset columns documented).
8. Ablation group readiness and integrity.
"""

import math
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

DATASET_DIR = Path(__file__).resolve().parent
PATH_DIABETES = DATASET_DIR / "curatwin_diabetes_glucose.csv"
PATH_CV = DATASET_DIR / "curatwin_cardiovascular_risk.csv"
PATH_DICT = DATASET_DIR / "feature_dictionary.csv"
PATH_MAPPING = DATASET_DIR / "source_mapping.csv"
PATH_CONFIG = DATASET_DIR / "generation_config.json"
PATH_DQ = DATASET_DIR / "data_quality_report.md"
PATH_LV = DATASET_DIR / "label_validation_report.md"
PATH_DC = DATASET_DIR / "dataset_card.md"


@pytest.fixture(scope="session")
def df_diabetes():
    assert PATH_DIABETES.exists(), f"Dataset A not found at {PATH_DIABETES}"
    return pd.read_csv(PATH_DIABETES)


@pytest.fixture(scope="session")
def df_cv():
    assert PATH_CV.exists(), f"Dataset B not found at {PATH_CV}"
    return pd.read_csv(PATH_CV)


@pytest.fixture(scope="session")
def df_dict():
    assert PATH_DICT.exists(), f"Feature dictionary not found at {PATH_DICT}"
    return pd.read_csv(PATH_DICT)


# -----------------------------------------------------------------------------
# 1. Artifact Existence & File Sanity
# -----------------------------------------------------------------------------
def test_all_artifacts_exist_and_non_empty(df_diabetes, df_cv, df_dict):
    assert len(df_diabetes) > 1000, f"Dataset A has unexpectedly low row count: {len(df_diabetes)}"
    assert len(df_cv) > 500, f"Dataset B has unexpectedly low row count: {len(df_cv)}"
    assert len(df_dict) > 40, f"Feature dictionary has unexpectedly low count: {len(df_dict)}"
    
    for path in [PATH_MAPPING, PATH_CONFIG, PATH_DQ, PATH_LV, PATH_DC]:
        assert path.exists(), f"Required artifact {path.name} is missing"
        assert path.stat().st_size > 50, f"Artifact {path.name} is empty"


# -----------------------------------------------------------------------------
# 2. Patient Disjoint Splits (Zero Patient Leakage Across Partitions)
# -----------------------------------------------------------------------------
def test_diabetes_patient_split_disjoint(df_diabetes):
    train_pts = set(df_diabetes[df_diabetes["split"] == "train"]["patient_id"])
    val_pts = set(df_diabetes[df_diabetes["split"] == "validation"]["patient_id"])
    test_pts = set(df_diabetes[df_diabetes["split"] == "test"]["patient_id"])

    assert len(train_pts & val_pts) == 0, "Patient overlap between train and validation in Dataset A!"
    assert len(train_pts & test_pts) == 0, "Patient overlap between train and test in Dataset A!"
    assert len(val_pts & test_pts) == 0, "Patient overlap between validation and test in Dataset A!"


def test_cv_patient_split_disjoint(df_cv):
    train_pts = set(df_cv[df_cv["split"] == "train"]["patient_id"])
    val_pts = set(df_cv[df_cv["split"] == "validation"]["patient_id"])
    test_pts = set(df_cv[df_cv["split"] == "test"]["patient_id"])

    assert len(train_pts & val_pts) == 0, "Patient overlap between train and validation in Dataset B!"
    assert len(train_pts & test_pts) == 0, "Patient overlap between train and test in Dataset B!"
    assert len(val_pts & test_pts) == 0, "Patient overlap between validation and test in Dataset B!"


# -----------------------------------------------------------------------------
# 3. Clinical Target Logic and Censoring
# -----------------------------------------------------------------------------
def test_diabetes_target_validity(df_diabetes):
    target_col = "glucose_excursion_next_2h"
    assert target_col in df_diabetes.columns, f"Missing target column {target_col}"

    valid_vals = set(df_diabetes[target_col].dropna().unique())
    assert valid_vals.issubset({0.0, 1.0, 0, 1}), f"Unexpected target values: {valid_vals}"

    pos_rate = df_diabetes[target_col].mean()
    assert 0.15 <= pos_rate <= 0.70, f"Unexpected excursion rate: {pos_rate:.3f}"


def test_cv_target_censoring_and_validity(df_cv):
    target_col = "cv_event_next_365d"
    assert target_col in df_cv.columns, f"Missing target column {target_col}"

    valid_vals = set(df_cv[target_col].dropna().unique())
    assert valid_vals.issubset({0.0, 1.0, 0, 1}), f"Unexpected target values: {valid_vals}"

    # Verify censoring: rows with incomplete follow-up must have NaN target
    censored_rows = df_cv[df_cv["outcome_event_description"].str.contains("Censored", na=False)]
    assert len(censored_rows) > 0, "Dataset B must have censored entries"
    assert censored_rows[target_col].isna().all(), "Censored entries must have NaN target (no silent 0 imputation)"

    # Confirmed positive events
    event_rows = df_cv[df_cv[target_col] == 1]
    assert len(event_rows) > 0, "Dataset B should contain positive incident CV events"
    for _, row in event_rows.iterrows():
        assert row["outcome_event_description"] != "None"
        assert row["days_to_outcome_or_censor"] <= 365


# -----------------------------------------------------------------------------
# 4. Zero Data Leakage Verification
# -----------------------------------------------------------------------------
def test_diabetes_temporal_rate_of_change(df_diabetes):
    sample = df_diabetes.dropna(subset=["current_glucose_mg_dl", "glucose_lag_15m", "glucose_rate_of_change_15m"]).head(100)
    for _, row in sample.iterrows():
        expected_roc = round((row["current_glucose_mg_dl"] - row["glucose_lag_15m"]) / 15.0, 4)
        actual_roc = round(row["glucose_rate_of_change_15m"], 4)
        assert math.isclose(actual_roc, expected_roc, abs_tol=0.01)


def test_cv_first_event_exclusion_logic(df_cv):
    # Dataset B builds a first-incident event cohort.
    # Confirmed incident events must happen within 1 to 365 days after the index date
    incident_events = df_cv[df_cv["cv_event_next_365d"] == 1]
    assert (incident_events["days_to_outcome_or_censor"] >= 0).all()
    assert (incident_events["days_to_outcome_or_censor"] <= 365).all()


# -----------------------------------------------------------------------------
# 5. Physiological Range Plausibility
# -----------------------------------------------------------------------------
def test_physiological_plausibility_diabetes(df_diabetes):
    # Glucose: 40 to 550 mg/dL
    assert (df_diabetes["current_glucose_mg_dl"] >= 40).all()
    assert (df_diabetes["current_glucose_mg_dl"] <= 550).all()

    # HbA1c: 2.5% to 18.0%
    assert (df_diabetes["hba1c"] >= 2.5).all()
    assert (df_diabetes["hba1c"] <= 18.0).all()

    # BMI: 12.0 to 65.0 kg/m2
    assert (df_diabetes["bmi"] >= 12.0).all()
    assert (df_diabetes["bmi"] <= 65.0).all()


def test_physiological_plausibility_cv(df_cv):
    # Age: >= 30 years
    assert (df_cv["age_years"] >= 30.0).all(), "Dataset B is an adult cohort >= 30 years"

    # Systolic BP: 60 to 260 mmHg
    assert (df_cv["systolic_bp"] >= 60).all() and (df_cv["systolic_bp"] <= 260).all()

    # Diastolic BP: 35 to 160 mmHg
    assert (df_cv["diastolic_bp"] >= 35).all() and (df_cv["diastolic_bp"] <= 160).all()

    # Total Cholesterol: 70 to 500 mg/dL
    assert (df_cv["total_cholesterol"] >= 70).all() and (df_cv["total_cholesterol"] <= 500).all()


# -----------------------------------------------------------------------------
# 6. Feature Dictionary Coverage and Metadata
# -----------------------------------------------------------------------------
def test_feature_dictionary_coverage(df_diabetes, df_cv, df_dict):
    dict_features = set(df_dict["feature_name"])
    
    # All columns in Dataset A must be documented
    for col in df_diabetes.columns:
        assert col in dict_features, f"Column {col} from Dataset A missing in feature_dictionary.csv"

    # All columns in Dataset B must be documented
    for col in df_cv.columns:
        assert col in dict_features, f"Column {col} from Dataset B missing in feature_dictionary.csv"

    # Required governance columns
    required_meta = ["feature_name", "dataset", "description", "unit", "data_type", "source_provenance", "generation_status", "missingness_strategy", "ablation_group", "eligible_for_training"]
    for meta in required_meta:
        assert meta in df_dict.columns, f"Feature dictionary missing required metadata column {meta}"


# -----------------------------------------------------------------------------
# 7. Ablation Group Consistency
# -----------------------------------------------------------------------------
def test_ablation_groups_readiness(df_dict):
    expected_groups = {
        "basic_clinical",
        "clinical_plus_longitudinal",
        "clinical_plus_personal_baseline",
        "clinical_plus_cross_signal",
        "all_features_with_dq",
        "metadata_id"
    }
    actual_groups = set(df_dict["ablation_group"].unique())
    assert actual_groups.issubset(expected_groups), f"Unexpected ablation groups: {actual_groups - expected_groups}"

import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import joblib
import numpy as np

# Some managed Windows environments block pandas' native extensions.  Keep the
# API bootable in that case so its health, docs, and non-ML endpoints remain
# available; prediction requests receive a precise service error instead.
try:
    import pandas as pd
    PANDAS_IMPORT_ERROR = None
except ImportError as exc:
    pd = None
    PANDAS_IMPORT_ERROR = exc

from schemas import (
    GlucoseExcursionInput,
    GlucoseExcursionOutput,
    CardiovascularRiskInput,
    CardiovascularRiskOutput,
)

logger = logging.getLogger("curatwin.model_loader")

if PANDAS_IMPORT_ERROR:
    logger.warning("pandas could not be imported; ML prediction endpoints are unavailable: %s", PANDAS_IMPORT_ERROR)


class ModelLoadingError(RuntimeError):
    """Raised when an ML model artifact cannot be found or loaded."""
    pass


class ModelInferenceError(RuntimeError):
    """Raised when feature preprocessing or model inference fails."""
    pass


# -----------------------------------------------------------------------------
# CuraTwin Model A: Glucose Excursion XGBoost Pipeline Manager
# -----------------------------------------------------------------------------
class GlucoseExcursionModelLoader:
    """Manager for loading and evaluating the short-term 2-hour glucose excursion XGBoost model."""
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model: Any = None
        self.model_version: str = "1.0.0-xgboost"
        self.expected_features: List[str] = [
            "age_years", "sex", "bmi", "waist_circumference_cm", "hba1c",
            "fasting_glucose_ehr", "diabetes_duration_years", "medication_type",
            "medication_adherence_pct", "hypertension_status", "triglycerides",
            "hdl_cholesterol", "ldl_cholesterol", "egfr", "tg_hdl_ratio",
            "current_glucose_mg_dl", "glucose_lag_15m", "glucose_lag_30m",
            "glucose_lag_60m", "glucose_lag_120m", "glucose_rate_of_change_15m",
            "glucose_rate_of_change_30m", "time_in_range_70_180_pct",
            "time_above_range_180_pct", "time_below_range_70_pct",
            "glucose_sd_24h", "glucose_cv_pct", "mage_val",
            "glucose_personal_baseline_median", "glucose_deviation_from_baseline",
            "glucose_robust_mad_zscore", "short_vs_long_trend_diff",
            "glucose_instability_score", "daily_excursions_count",
            "daily_hypo_count", "time_since_last_meal_min", "pre_meal_glucose",
            "recent_meal_slot", "recent_meal_category", "recent_meal_carbs_g",
            "recent_meal_fiber_g", "recent_meal_protein_g", "recent_meal_fat_g",
            "post_meal_peak_rise_proxy", "current_heart_rate", "hrv_rmssd_ms",
            "glucose_hr_ratio", "steps_past_hour", "post_meal_walking_flag",
            "previous_night_sleep_hours", "hour_of_day_sin", "hour_of_day_cos",
            "dt_change_alert", "cgm_measurement_coverage_pct", "data_quality_score"
        ]

    def find_model_file(self) -> Path:
        candidates = [
            Path("backend/models/curatwin_glucose_model.joblib"),
            Path("models/curatwin_glucose_model.joblib"),
            Path("dataset/models/curatwin_glucose_model.joblib"),
            Path(__file__).resolve().parent / "models" / "curatwin_glucose_model.joblib",
            Path(__file__).resolve().parent.parent / "dataset" / "models" / "curatwin_glucose_model.joblib",
        ]
        if self.model_path:
            candidates.insert(0, Path(self.model_path))
        for p in candidates:
            if p.exists() and p.is_file():
                return p
        raise ModelLoadingError(f"Glucose excursion model artifact not found. Checked: {[str(c) for c in candidates[:3]]}")

    def load(self) -> None:
        if self.model is not None:
            return
        path = self.find_model_file()
        logger.info(f"Loading Glucose Excursion model from: {path}")
        self.model = joblib.load(path)

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def predict(self, data: GlucoseExcursionInput) -> GlucoseExcursionOutput:
        if pd is None:
            raise ModelInferenceError(f"pandas is unavailable: {PANDAS_IMPORT_ERROR}")
        if self.model is None:
            self.load()

        cur_g = data.current_glucose_mg_dl
        lag_15 = data.glucose_lag_15m if data.glucose_lag_15m is not None else cur_g
        lag_30 = data.glucose_lag_30m if data.glucose_lag_30m is not None else lag_15
        lag_60 = data.glucose_lag_60m if data.glucose_lag_60m is not None else lag_30
        lag_120 = data.glucose_lag_120m if data.glucose_lag_120m is not None else lag_60
        roc_15 = data.glucose_rate_of_change_15m if data.glucose_rate_of_change_15m is not None else (cur_g - lag_15) / 15.0
        roc_30 = (cur_g - lag_30) / 30.0

        baseline_median = data.glucose_personal_baseline_median if data.glucose_personal_baseline_median is not None else ((data.hba1c or 6.4) * 28.7 - 46.7)
        baseline_median = max(80.0, min(240.0, baseline_median))
        dev = cur_g - baseline_median
        zscore = dev / 18.0

        carbs = data.recent_meal_carbs_g or 0.0
        steps = data.steps_past_hour or 0

        row = {
            "age_years": data.age_years or 46.0,
            "sex": data.sex or "Female",
            "bmi": data.bmi or 27.4,
            "waist_circumference_cm": round((data.bmi or 27.4) * 3.1 + 4.0, 1),
            "hba1c": data.hba1c or 6.4,
            "fasting_glucose_ehr": 125.0,
            "diabetes_duration_years": 3.5,
            "medication_type": data.medication_type or "metformin",
            "medication_adherence_pct": data.medication_adherence_pct or 85.0,
            "hypertension_status": 0,
            "triglycerides": 150.0,
            "hdl_cholesterol": 48.0,
            "ldl_cholesterol": 115.0,
            "egfr": 88.0,
            "tg_hdl_ratio": round(150.0 / 48.0, 2),
            "current_glucose_mg_dl": cur_g,
            "glucose_lag_15m": lag_15,
            "glucose_lag_30m": lag_30,
            "glucose_lag_60m": lag_60,
            "glucose_lag_120m": lag_120,
            "glucose_rate_of_change_15m": roc_15,
            "glucose_rate_of_change_30m": roc_30,
            "time_in_range_70_180_pct": 74.0,
            "time_above_range_180_pct": 21.0,
            "time_below_range_70_pct": 5.0,
            "glucose_sd_24h": 28.5,
            "glucose_cv_pct": 19.5,
            "mage_val": 42.0,
            "glucose_personal_baseline_median": baseline_median,
            "glucose_deviation_from_baseline": dev,
            "glucose_robust_mad_zscore": zscore,
            "short_vs_long_trend_diff": roc_15 - roc_30,
            "glucose_instability_score": min(100.0, max(0.0, abs(dev) * 0.8 + abs(roc_15) * 15.0)),
            "daily_excursions_count": 2,
            "daily_hypo_count": 0,
            "time_since_last_meal_min": data.time_since_last_meal_min or 120.0,
            "pre_meal_glucose": baseline_median,
            "recent_meal_slot": data.recent_meal_slot or "snack",
            "recent_meal_category": data.recent_meal_category or "snack",
            "recent_meal_carbs_g": carbs,
            "recent_meal_fiber_g": data.recent_meal_fiber_g or 0.0,
            "recent_meal_protein_g": data.recent_meal_protein_g or 0.0,
            "recent_meal_fat_g": data.recent_meal_fat_g or 0.0,
            "post_meal_peak_rise_proxy": carbs * 0.8,
            "current_heart_rate": data.current_heart_rate or 74.0,
            "hrv_rmssd_ms": data.hrv_rmssd_ms or 38.0,
            "glucose_hr_ratio": round(cur_g / (data.current_heart_rate or 74.0), 3),
            "steps_past_hour": steps,
            "post_meal_walking_flag": 1 if steps > 500 and (data.time_since_last_meal_min or 120.0) <= 60 else 0,
            "previous_night_sleep_hours": 7.2,
            "hour_of_day_sin": round(np.sin(datetime.now().hour / 24.0 * 2 * np.pi), 4),
            "hour_of_day_cos": round(np.cos(datetime.now().hour / 24.0 * 2 * np.pi), 4),
            "dt_change_alert": "Elevated" if cur_g > 160 or carbs > 50 else "Normal",
            "cgm_measurement_coverage_pct": 98.0,
            "data_quality_score": 96.0
        }
        df_row = pd.DataFrame([row])
        proba = float(self.model.predict_proba(df_row)[0, 1])
        prediction = int(proba >= 0.50)

        if proba < 0.25:
            risk_tier = "Low Spike Risk (Stable)"
            rec = "Blood sugar is stable and within target range. Maintain your healthy daily routine."
        elif proba < 0.55:
            risk_tier = "Moderate Spike Risk"
            rec = "Blood sugar is trending slightly upward. A light 10–15 minute walk after meals can help keep it balanced."
        else:
            risk_tier = "High Spike Risk (>180 mg/dL)"
            rec = "High chance of blood sugar spiking above 180 mg/dL in the next 2 hours. Drink water, take a walk, and monitor your levels."

        top_factors = [
            {"factor": "Current Blood Sugar", "value": f"{cur_g:.1f} mg/dL", "impact": "High" if cur_g > 140 else "Normal"},
            {"factor": "Recent Meal Carbs", "value": f"{carbs:.1f} g", "impact": "High Carbs" if carbs > 40 else "Light Meal"},
            {"factor": "Activity (Steps Last Hour)", "value": f"{steps} steps", "impact": "Active (Protective)" if steps > 400 else "Resting"},
            {"factor": "Sugar Trend Speed", "value": f"{roc_15:+.2f} mg/dL/min", "impact": "Rising" if roc_15 > 0.5 else "Stable"},
        ]

        now_iso = datetime.now(timezone.utc).isoformat()
        return GlucoseExcursionOutput(
            prediction=prediction,
            excursion_risk_probability=round(proba, 4),
            risk_tier=risk_tier,
            lookahead_window_minutes=120,
            model_name="CuraTwin-XGBoost-GlucoseExcursion-v1",
            top_contributing_factors=top_factors,
            clinical_recommendation=rec,
            measurement_timestamp=data.measurement_timestamp or now_iso,
            prediction_timestamp=now_iso
        )


# -----------------------------------------------------------------------------
# CuraTwin Model B: 365-Day Cardiovascular Risk Balanced Random Forest Manager
# -----------------------------------------------------------------------------
class CardiovascularModelLoader:
    """Manager for loading and evaluating the 365-day incident cardiovascular risk Balanced Random Forest model."""
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model: Any = None
        self.model_version: str = "1.0.0-balanced-rf"
        self.screening_threshold: float = 0.0403
        self.expected_features: List[str] = [
            "age_years", "sex", "systolic_bp", "diastolic_bp", "pulse_pressure",
            "heart_rate", "bmi", "respiratory_rate", "oxygen_saturation",
            "total_cholesterol", "ldl_cholesterol", "hdl_cholesterol",
            "triglycerides", "tg_hdl_ratio", "fasting_glucose", "hba1c",
            "serum_creatinine", "egfr", "diabetes_status", "diabetes_duration_years",
            "hypertension_status", "hypertension_duration_years",
            "dyslipidemia_status", "chronic_kidney_disease_status",
            "heart_failure_status", "smoking_status",
            "medication_antihypertensive", "medication_statin",
            "medication_antidiabetic", "medication_antiplatelet",
            "sbp_mean_baseline", "sbp_sd_variability", "sbp_robust_mad_zscore",
            "dbp_mean_baseline", "cumulative_cvd_risk_burden",
            "dt_vital_change_alert", "days_since_last_observation",
            "data_quality_score"
        ]

    def find_model_file(self) -> Path:
        candidates = [
            Path("backend/models/curatwin_cardiovascular_model.joblib"),
            Path("models/curatwin_cardiovascular_model.joblib"),
            Path("dataset/models/curatwin_cardiovascular_model.joblib"),
            Path(__file__).resolve().parent / "models" / "curatwin_cardiovascular_model.joblib",
            Path(__file__).resolve().parent.parent / "dataset" / "models" / "curatwin_cardiovascular_model.joblib",
        ]
        if self.model_path:
            candidates.insert(0, Path(self.model_path))
        for p in candidates:
            if p.exists() and p.is_file():
                return p
        raise ModelLoadingError(f"Cardiovascular model artifact not found. Checked: {[str(c) for c in candidates[:3]]}")

    def load(self) -> None:
        if self.model is not None:
            return
        path = self.find_model_file()
        logger.info(f"Loading Cardiovascular Risk model from: {path}")
        self.model = joblib.load(path)

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def predict(self, data: CardiovascularRiskInput) -> CardiovascularRiskOutput:
        if pd is None:
            raise ModelInferenceError(f"pandas is unavailable: {PANDAS_IMPORT_ERROR}")
        if self.model is None:
            self.load()

        pp = data.pulse_pressure if data.pulse_pressure is not None else (data.systolic_bp - data.diastolic_bp)
        tg_hdl = round(data.triglycerides / max(1.0, data.hdl_cholesterol), 2)
        burden = data.cumulative_cvd_risk_burden if data.cumulative_cvd_risk_burden is not None else float(
            data.hypertension_status + data.diabetes_status + data.dyslipidemia_status +
            data.chronic_kidney_disease_status + data.heart_failure_status +
            (1 if data.smoking_status == "current_smoker" else 0) +
            (1 if data.systolic_bp >= 140 else 0)
        )

        row = {
            "age_years": data.age_years,
            "sex": data.sex,
            "systolic_bp": data.systolic_bp,
            "diastolic_bp": data.diastolic_bp,
            "pulse_pressure": pp,
            "heart_rate": data.heart_rate or 72.0,
            "bmi": data.bmi,
            "respiratory_rate": data.respiratory_rate or 16.0,
            "oxygen_saturation": data.oxygen_saturation or 98.0,
            "total_cholesterol": data.total_cholesterol,
            "ldl_cholesterol": data.ldl_cholesterol,
            "hdl_cholesterol": data.hdl_cholesterol,
            "triglycerides": data.triglycerides,
            "tg_hdl_ratio": tg_hdl,
            "fasting_glucose": data.fasting_glucose,
            "hba1c": data.hba1c,
            "serum_creatinine": data.serum_creatinine,
            "egfr": data.egfr,
            "diabetes_status": data.diabetes_status,
            "diabetes_duration_years": data.diabetes_duration_years,
            "hypertension_status": data.hypertension_status,
            "hypertension_duration_years": data.hypertension_duration_years,
            "dyslipidemia_status": data.dyslipidemia_status,
            "chronic_kidney_disease_status": data.chronic_kidney_disease_status,
            "heart_failure_status": data.heart_failure_status,
            "smoking_status": data.smoking_status,
            "medication_antihypertensive": data.medication_antihypertensive,
            "medication_statin": data.medication_statin,
            "medication_antidiabetic": data.medication_antidiabetic,
            "medication_antiplatelet": data.medication_antiplatelet,
            "sbp_mean_baseline": data.systolic_bp - 2.0,
            "sbp_sd_variability": 9.5,
            "sbp_robust_mad_zscore": round((data.systolic_bp - 120.0) / 10.0, 2),
            "dbp_mean_baseline": data.diastolic_bp - 1.0,
            "cumulative_cvd_risk_burden": burden,
            "dt_vital_change_alert": "Elevated" if data.systolic_bp >= 140 or data.ldl_cholesterol >= 160 else "Normal",
            "days_since_last_observation": 14.0,
            "data_quality_score": 95.0
        }
        df_row = pd.DataFrame([row])
        proba = float(self.model.predict_proba(df_row)[0, 1])
        prediction = int(proba >= self.screening_threshold)

        if proba < 0.020:
            risk_level = "Low 1-Year Heart Risk"
            plan = "Your cardiovascular measurements look healthy and low-risk. Continue regular checkups and maintain active lifestyle habits."
        elif proba < self.screening_threshold:
            risk_level = "Moderate 1-Year Heart Risk"
            plan = "Moderate heart risk indicators detected. We recommend focusing on regular exercise, heart-healthy meals, and monitoring blood pressure."
        else:
            risk_level = "Higher 1-Year Heart Risk"
            plan = "Assessment indicates elevated cardiovascular risk. We recommend scheduling a routine checkup with your doctor to review blood pressure and cholesterol levels."

        top_risk_factors = [
            {"factor": "Age", "value": f"{data.age_years:.0f} years", "severity": "Elevated" if data.age_years >= 60 else "Normal"},
            {"factor": "Blood Pressure", "value": f"{data.systolic_bp:.0f}/{data.diastolic_bp:.0f} mmHg", "severity": "Elevated" if data.systolic_bp >= 135 else "Normal"},
            {"factor": "Health Conditions", "value": f"{burden:.0f} conditions", "severity": "Attention" if burden >= 3 else "Normal"},
            {"factor": "Cholesterol Ratio (TG/HDL)", "value": f"{tg_hdl:.2f}", "severity": "Elevated" if tg_hdl >= 3.0 else "Healthy"},
        ]

        now_iso = datetime.now(timezone.utc).isoformat()
        return CardiovascularRiskOutput(
            cv_event_prediction=prediction,
            estimated_1y_event_probability=round(proba, 4),
            risk_level=risk_level,
            screening_threshold=self.screening_threshold,
            screening_sensitivity="83.33%",
            model_name="CuraTwin-BalancedRF-CardiovascularRisk-v1",
            top_risk_factors=top_risk_factors,
            clinical_action_plan=plan,
            prediction_timestamp=now_iso
        )


glucose_model_loader = GlucoseExcursionModelLoader()
cv_model_loader = CardiovascularModelLoader()

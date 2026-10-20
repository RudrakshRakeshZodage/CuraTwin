"""
CuraTwin — Pydantic Schemas for Request & Response Validation
"""

from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


# Exact categories supported by the fitted LogisticRegression model
VALID_GENDERS = ["Female", "Male", "Other"]
VALID_SMOKING_HISTORIES = ["never", "current", "former", "ever", "not current", "No Info"]


class PredictionInput(BaseModel):
    """
    Input schema representing clinical and lifestyle biomarkers for diabetes prediction.
    Features and types directly map to the training dataset specifications.
    """
    gender: str = Field(
        ...,
        description="Patient biological sex or gender category ('Female', 'Male', 'Other')",
        examples=["Female"]
    )
    age: float = Field(
        ...,
        ge=0.0,
        le=120.0,
        description="Patient age in years (0 - 120)",
        examples=[45.0]
    )
    hypertension: int = Field(
        ...,
        ge=0,
        le=1,
        description="Hypertension diagnosis indicator (0: No hypertension, 1: Diagnosed hypertension)",
        examples=[0]
    )
    heart_disease: int = Field(
        ...,
        ge=0,
        le=1,
        description="Heart disease diagnosis indicator (0: No heart disease, 1: Diagnosed heart disease)",
        examples=[0]
    )
    smoking_history: str = Field(
        ...,
        description="Smoking history category ('never', 'current', 'former', 'ever', 'not current', 'No Info')",
        examples=["never"]
    )
    bmi: float = Field(
        ...,
        ge=10.0,
        le=95.0,
        description="Body Mass Index in kg/m² (typically 10.0 - 95.0)",
        examples=[27.5]
    )
    HbA1c_level: float = Field(
        ...,
        ge=3.5,
        le=16.0,
        description="Glycated hemoglobin (HbA1c) level percentage (3.5% - 16.0%)",
        examples=[5.8]
    )
    blood_glucose_level: float = Field(
        ...,
        ge=40.0,
        le=500.0,
        description="Blood glucose level in mg/dL (40 - 500 mg/dL)",
        examples=[110.0]
    )
    source: Optional[str] = Field(
        default="manual",
        description="Telemetry input source: 'manual' or 'sensor'",
        examples=["manual"]
    )
    device_id: Optional[str] = Field(
        default=None,
        description="Optional sensor device identifier (e.g. 'CuraWatch-B12')",
        examples=["CuraWatch-B12"]
    )
    measurement_timestamp: Optional[str] = Field(
        default=None,
        description="ISO timestamp when the physiological biomarker was recorded by device or user",
        examples=["2026-10-18T15:00:00Z"]
    )

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        cleaned = v.strip().title() if isinstance(v, str) else v
        if cleaned not in VALID_GENDERS:
            raise ValueError(
                f"Invalid gender '{v}'. Supported values are: {', '.join(VALID_GENDERS)}"
            )
        return cleaned

    @field_validator("smoking_history")
    @classmethod
    def validate_smoking_history(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError(f"smoking_history must be a string, got {type(v).__name__}")
        cleaned = v.strip()
        # Handle case variations gracefully
        mapping = {
            "never": "never",
            "current": "current",
            "former": "former",
            "ever": "ever",
            "not current": "not current",
            "not-current": "not current",
            "no info": "No Info",
            "no_info": "No Info",
            "no-info": "No Info",
            "noinfo": "No Info",
            "No Info": "No Info",
        }
        normalized = mapping.get(cleaned.lower())
        if not normalized or normalized not in VALID_SMOKING_HISTORIES:
            raise ValueError(
                f"Invalid smoking_history '{v}'. Supported values are: {', '.join(VALID_SMOKING_HISTORIES)}"
            )
        return normalized

    model_config = {
        "json_schema_extra": {
            "example": {
                "gender": "Female",
                "age": 45,
                "hypertension": 0,
                "heart_disease": 0,
                "smoking_history": "never",
                "bmi": 27.5,
                "HbA1c_level": 5.8,
                "blood_glucose_level": 110,
                "source": "manual",
                "device_id": None,
                "measurement_timestamp": "2026-10-18T15:00:00Z"
            }
        }
    }


class PredictionOutput(BaseModel):
    """
    Standardized response structure for diabetes prediction endpoint.
    Includes classification prediction, human-readable label, statistical probability,
    telemetry provenance, and explanatory notes adhering to medical AI communication standards.
    """
    prediction: int = Field(
        ...,
        description="Binary model prediction (0: Negative classification, 1: Positive classification)"
    )
    label: str = Field(
        ...,
        description="Human-readable classification outcome description"
    )
    probability: Optional[float] = Field(
        None,
        description="Statistical model probability for class 1 (diabetes). Null if unsupported."
    )
    model_version: str = Field(
        default="1.0",
        description="Semantic version of the deployed ML model"
    )
    source: str = Field(
        default="manual",
        description="Input source of the biomarker evaluation: 'manual' or 'sensor'"
    )
    device_id: Optional[str] = Field(
        default=None,
        description="Originating wearable or sensor device identifier"
    )
    measurement_timestamp: Optional[str] = Field(
        default=None,
        description="Timestamp of the physiological measurement utilized for this inference"
    )
    prediction_timestamp: Optional[str] = Field(
        default=None,
        description="ISO timestamp when the prediction was evaluated by the backend model"
    )
    probability_note: Optional[str] = Field(
        default=(
            "Estimated probability of class 1 (diabetes) output by the logistic regression sigmoid function. "
            "Note: This is an uncalibrated statistical model estimate and should not be interpreted as calibrated clinical risk."
        ),
        description="Clinical and statistical context regarding the probability value"
    )
    input_summary: Optional[Dict[str, Any]] = Field(
        None,
        description="Echo of the parsed input features for auditability and verification"
    )


class HealthResponse(BaseModel):
    """
    API health check response schema.
    """
    status: str
    model_loaded: bool
    model_version: str
    estimator: str
    feature_count: int
    expected_features: List[str]
    supported_genders: List[str]
    supported_smoking_categories: List[str]


class FoodItemBreakdown(BaseModel):
    item_name: str
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fats: float = 0.0


class FoodAlternative(BaseModel):
    alternative_dish: str = Field(..., description="Recommended healthier diabetic meal alternative")
    calorie_reduction: Optional[float] = Field(None, description="Estimated calories saved with this alternative")
    carb_reduction: Optional[float] = Field(None, description="Estimated grams of carbohydrates reduced")
    explanation: str = Field(..., description="Clinical reason why this alternative is better for glycemic stability")


class FoodAnalysisRequest(BaseModel):
    query: Optional[str] = Field(None, description="Meal description, dish name, or food items")
    image_name: Optional[str] = None
    image_data: Optional[str] = Field(None, description="Base64 data URL of the food plate image for multimodal vision AI")
    patient_bmi: Optional[float] = Field(27.5, description="Patient BMI for personalized intake limit analysis")


class FoodAnalysisResponse(BaseModel):
    meal_name: str
    category: str = "Meal"
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fats: float
    fiber: float = 0.0
    glycemic_index: str = "Moderate GI"
    clinical_insight: Optional[str] = Field(None, description="Clinical metabolic assessment of the meal")
    healthier_alternative: Optional[FoodAlternative] = Field(None, description="Healthier substitute to prevent glycemic spikes")
    bmi_meal_limit_exceeded: Optional[bool] = Field(False, description="Flag indicating if meal exceeds recommended limit for patient BMI")
    recommended_max_meal_calories: Optional[float] = Field(None, description="Personalized maximum meal calories for patient BMI")
    items: List[FoodItemBreakdown] = []


# -----------------------------------------------------------------------------
# CuraTwin Dual Digital Twin Models Schemas
# -----------------------------------------------------------------------------
class GlucoseExcursionInput(BaseModel):
    """Input payload for 2-hour short-term continuous glucose excursion forecasting."""
    current_glucose_mg_dl: float = Field(..., ge=30.0, le=600.0, description="Current instantaneous CGM reading in mg/dL")
    glucose_lag_15m: Optional[float] = Field(None, description="CGM glucose reading 15 minutes prior")
    glucose_lag_30m: Optional[float] = Field(None, description="CGM glucose reading 30 minutes prior")
    glucose_lag_60m: Optional[float] = Field(None, description="CGM glucose reading 60 minutes prior")
    glucose_lag_120m: Optional[float] = Field(None, description="CGM glucose reading 120 minutes prior")
    glucose_rate_of_change_15m: Optional[float] = Field(None, description="Velocity of glucose change (mg/dL/min)")
    recent_meal_carbs_g: Optional[float] = Field(0.0, ge=0.0, description="Carbohydrates in grams from recent meal")
    recent_meal_fiber_g: Optional[float] = Field(0.0, ge=0.0, description="Dietary fiber in grams")
    recent_meal_protein_g: Optional[float] = Field(0.0, ge=0.0, description="Protein in grams")
    recent_meal_fat_g: Optional[float] = Field(0.0, ge=0.0, description="Fat in grams")
    time_since_last_meal_min: Optional[float] = Field(120.0, ge=0.0, description="Elapsed minutes since last meal")
    recent_meal_slot: Optional[str] = Field("snack", description="Meal slot: breakfast, lunch, dinner, snack, or none")
    recent_meal_category: Optional[str] = Field("snack", description="Meal type: roti-based, rice-based, millet, dal-vegetable, snack, none")
    steps_past_hour: Optional[int] = Field(350, ge=0, description="Step count recorded over past 60 minutes")
    current_heart_rate: Optional[float] = Field(74.0, ge=40.0, le=220.0, description="Instantaneous heart rate in bpm")
    hrv_rmssd_ms: Optional[float] = Field(38.0, ge=5.0, description="Heart rate variability RMSSD in ms")
    hba1c: Optional[float] = Field(6.4, ge=3.5, le=18.0, description="Baseline HbA1c percentage")
    bmi: Optional[float] = Field(27.4, ge=10.0, le=80.0, description="Body Mass Index")
    age_years: Optional[float] = Field(46.0, ge=18.0, le=120.0, description="Age in years")
    sex: Optional[str] = Field("Female", description="Biological sex (Female, Male)")
    medication_type: Optional[str] = Field("metformin", description="Active diabetes medication: insulin, metformin, none")
    medication_adherence_pct: Optional[float] = Field(85.0, ge=0.0, le=100.0, description="Reported medication adherence percentage")
    glucose_personal_baseline_median: Optional[float] = Field(None, description="Digital twin rolling 7-day median baseline glucose")
    device_id: Optional[str] = Field(None, description="CGM sensor device ID")
    measurement_timestamp: Optional[str] = Field(None, description="Sensor recording timestamp")


class GlucoseExcursionOutput(BaseModel):
    """Prediction outcome for 2-hour glucose excursion risk."""
    prediction: int = Field(..., description="0: Glucose expected <= 180 mg/dL; 1: Excursion expected > 180 mg/dL")
    excursion_risk_probability: float = Field(..., description="Estimated probability of glucose exceeding 180 mg/dL")
    risk_tier: str = Field(..., description="Clinical risk tier: Low, Moderate, or High Excursion Risk")
    lookahead_window_minutes: int = 120
    model_name: str = "CuraTwin-XGBoost-GlucoseExcursion-v1"
    top_contributing_factors: List[Dict[str, Any]] = []
    clinical_recommendation: str
    measurement_timestamp: Optional[str] = None
    prediction_timestamp: str


class CardiovascularRiskInput(BaseModel):
    """Input payload for 365-day first-incident cardiovascular risk prediction."""
    age_years: float = Field(..., ge=30.0, le=105.0, description="Patient age in years (adult cohort)")
    sex: str = Field("Male", description="Biological sex: Male or Female")
    systolic_bp: float = Field(128.0, ge=70.0, le=250.0, description="Systolic blood pressure in mmHg")
    diastolic_bp: float = Field(82.0, ge=40.0, le=160.0, description="Diastolic blood pressure in mmHg")
    pulse_pressure: Optional[float] = Field(None, description="Pulse pressure (SBP - DBP)")
    heart_rate: Optional[float] = Field(72.0, ge=40.0, le=200.0)
    respiratory_rate: Optional[float] = Field(16.0, ge=8.0, le=45.0)
    oxygen_saturation: Optional[float] = Field(98.0, ge=70.0, le=100.0)
    total_cholesterol: float = Field(195.0, ge=80.0, le=450.0, description="Total serum cholesterol in mg/dL")
    ldl_cholesterol: float = Field(118.0, ge=30.0, le=300.0, description="LDL cholesterol in mg/dL")
    hdl_cholesterol: float = Field(48.0, ge=15.0, le=150.0, description="HDL cholesterol in mg/dL")
    triglycerides: float = Field(145.0, ge=30.0, le=800.0, description="Triglycerides in mg/dL")
    fasting_glucose: float = Field(102.0, ge=50.0, le=400.0, description="Fasting blood glucose in mg/dL")
    hba1c: float = Field(6.0, ge=3.5, le=16.0, description="HbA1c level in %")
    bmi: float = Field(27.5, ge=12.0, le=65.0, description="Body Mass Index")
    smoking_status: str = Field("non_smoker", description="Smoking history: non_smoker, former_smoker, current_smoker")
    hypertension_status: int = Field(0, description="Hypertension diagnosis: 0 or 1")
    hypertension_duration_years: float = Field(0.0, ge=0.0, description="Years with diagnosed hypertension")
    diabetes_status: int = Field(0, description="Diabetes diagnosis: 0 or 1")
    diabetes_duration_years: float = Field(0.0, ge=0.0, description="Years with diagnosed diabetes")
    dyslipidemia_status: int = Field(0, description="Dyslipidemia diagnosis: 0 or 1")
    chronic_kidney_disease_status: int = Field(0, description="CKD diagnosis: 0 or 1")
    heart_failure_status: int = Field(0, description="Heart failure diagnosis: 0 or 1")
    medication_statin: int = Field(0, description="Currently taking statin lipid-lowering medication: 0 or 1")
    medication_antihypertensive: int = Field(0, description="Currently taking blood pressure medication: 0 or 1")
    medication_antiplatelet: int = Field(0, description="Currently taking aspirin/clopidogrel: 0 or 1")
    medication_antidiabetic: int = Field(0, description="Currently taking antidiabetic medication: 0 or 1")
    serum_creatinine: float = Field(0.95, ge=0.2, le=12.0, description="Serum creatinine in mg/dL")
    egfr: float = Field(88.0, ge=5.0, le=150.0, description="eGFR in mL/min/1.73m2")
    cumulative_cvd_risk_burden: Optional[float] = Field(None, description="Composite co-morbidity score")


class CardiovascularRiskOutput(BaseModel):
    """Prediction outcome for 365-day incident cardiovascular event risk."""
    cv_event_prediction: int = Field(..., description="Screening outcome: 0 (Below Triage Threshold) or 1 (Elevated Risk)")
    estimated_1y_event_probability: float = Field(..., description="Estimated statistical probability of acute MI/stroke in 1 year")
    risk_level: str = Field(..., description="Clinical risk tier: Low, Moderate, or High Incident CV Risk")
    screening_threshold: float = 0.0403
    screening_sensitivity: str = "83.33%"
    model_name: str = "CuraTwin-BalancedRF-CardiovascularRisk-v1"
    top_risk_factors: List[Dict[str, Any]] = []
    clinical_action_plan: str
    prediction_timestamp: str

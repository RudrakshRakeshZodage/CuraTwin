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


class FoodAnalysisRequest(BaseModel):
    query: str = Field(..., description="Meal description, dish name, or food items")
    image_name: Optional[str] = None


class FoodAnalysisResponse(BaseModel):
    meal_name: str
    category: str = "Meal"
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fats: float
    fiber: float = 0.0
    glycemic_index: str = "Moderate GI"
    items: List[FoodItemBreakdown] = []

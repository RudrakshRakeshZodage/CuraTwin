"""
CuraTwin — Automated Backend & Dual Digital Twin Models Test Suite
Tests endpoints, schemas, preprocessing, edge cases, and mathematical consistency
for curatwin_glucose_model.joblib and curatwin_cardiovascular_model.joblib.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import os
import json
import joblib
import pandas as pd
import numpy as np

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app
from model_loader import glucose_model_loader, cv_model_loader


@pytest.fixture(scope="session", autouse=True)
def initialize_models():
    """Ensure both trained ML models are loaded prior to test execution."""
    glucose_model_loader.load()
    cv_model_loader.load()
    yield


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


# =============================================================================
# 1. Model Loading Tests
# =============================================================================

def test_models_loading_and_attributes():
    """Verify that both model artifacts load cleanly and exhibit expected properties."""
    assert glucose_model_loader.is_loaded is True
    assert glucose_model_loader.model is not None
    assert cv_model_loader.is_loaded is True
    assert cv_model_loader.model is not None
    assert len(glucose_model_loader.expected_features) == 55
    assert len(cv_model_loader.expected_features) == 38


# =============================================================================
# 2. Basic Endpoint Tests
# =============================================================================

def test_root_endpoint(client):
    """Verify GET / returns a 200 status with service information."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "CuraTwin" in data["service"]


def test_health_endpoint(client):
    """Verify GET /health confirms operational status and dual models loaded."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert "XGBoost" in data["estimator"]
    assert "Balanced Random Forest" in data["estimator"]
    assert "Female" in data["supported_genders"]
    assert "never" in data["supported_smoking_categories"]


# =============================================================================
# 3. Model A: Glucose Excursion Prediction Endpoint Tests
# =============================================================================

def test_glucose_excursion_prediction_endpoint(client):
    """Verify POST /api/predict/glucose-excursion returns 2-hour forecast with probabilities."""
    payload = {
        "current_glucose_mg_dl": 168.0,
        "glucose_lag_15m": 150.0,
        "glucose_lag_30m": 138.0,
        "steps_past_hour": 150,
        "recent_meal_carbs_g": 68.0,
        "time_since_last_meal_min": 50.0,
        "recent_meal_slot": "lunch",
        "recent_meal_category": "rice-based",
        "hba1c": 6.8,
        "bmi": 28.5
    }
    response = client.post("/api/predict/glucose-excursion", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert data["prediction"] in (0, 1)
    assert "excursion_risk_probability" in data
    assert 0.0 <= data["excursion_risk_probability"] <= 1.0
    assert "risk_tier" in data
    assert len(data["top_contributing_factors"]) > 0
    assert "clinical_recommendation" in data
    assert data["model_name"] == "CuraTwin-XGBoost-GlucoseExcursion-v1"


def test_glucose_excursion_low_risk(client):
    """Verify low excursion risk scenario (low carbs, high activity, baseline glucose)."""
    payload = {
        "current_glucose_mg_dl": 95.0,
        "glucose_lag_15m": 94.0,
        "glucose_lag_30m": 96.0,
        "steps_past_hour": 850,
        "recent_meal_carbs_g": 12.0,
        "time_since_last_meal_min": 180.0,
        "recent_meal_slot": "snack",
        "recent_meal_category": "dal-vegetable",
        "hba1c": 5.2,
        "bmi": 22.0
    }
    response = client.post("/api/predict/glucose-excursion", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] == 0
    assert data["excursion_risk_probability"] < 0.50
    assert "Low" in data["risk_tier"] or "Moderate" in data["risk_tier"]


# =============================================================================
# 4. Model B: Cardiovascular Risk Prediction Endpoint Tests
# =============================================================================

def test_cardiovascular_risk_prediction_endpoint(client):
    """Verify POST /api/predict/cardiovascular-risk returns 365-day event probability and risk factors."""
    payload = {
        "age_years": 62.0,
        "sex": "Male",
        "systolic_bp": 148.0,
        "diastolic_bp": 92.0,
        "total_cholesterol": 230.0,
        "ldl_cholesterol": 155.0,
        "hdl_cholesterol": 38.0,
        "triglycerides": 185.0,
        "fasting_glucose": 125.0,
        "hba1c": 7.1,
        "bmi": 30.5,
        "smoking_status": "current_smoker",
        "hypertension_status": 1,
        "hypertension_duration_years": 8.0,
        "diabetes_status": 1
    }
    response = client.post("/api/predict/cardiovascular-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "cv_event_prediction" in data
    assert data["cv_event_prediction"] in (0, 1)
    assert "estimated_1y_event_probability" in data
    assert 0.0 <= data["estimated_1y_event_probability"] <= 1.0
    assert "risk_level" in data
    assert len(data["top_risk_factors"]) > 0
    assert "clinical_action_plan" in data
    assert data["model_name"] == "CuraTwin-BalancedRF-CardiovascularRisk-v1"


def test_cardiovascular_risk_low_risk(client):
    """Verify young normotensive patient yields below-screening-threshold risk."""
    payload = {
        "age_years": 35.0,
        "sex": "Female",
        "systolic_bp": 110.0,
        "diastolic_bp": 70.0,
        "total_cholesterol": 165.0,
        "ldl_cholesterol": 85.0,
        "hdl_cholesterol": 62.0,
        "triglycerides": 90.0,
        "fasting_glucose": 86.0,
        "hba1c": 5.1,
        "bmi": 21.8,
        "smoking_status": "non_smoker",
        "hypertension_status": 0,
        "diabetes_status": 0
    }
    response = client.post("/api/predict/cardiovascular-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["cv_event_prediction"] == 0
    assert data["estimated_1y_event_probability"] < 0.0403


# =============================================================================
# 5. Direct Model vs API Mathematical Consistency Verification
# =============================================================================

def test_direct_glucose_model_vs_api_consistency(client):
    """Verify direct glucose excursion model inference matches the API endpoint output."""
    test_input = {
        "current_glucose_mg_dl": 172.0,
        "glucose_lag_15m": 158.0,
        "glucose_lag_30m": 142.0,
        "glucose_lag_60m": 120.0,
        "glucose_lag_120m": 105.0,
        "steps_past_hour": 210,
        "recent_meal_carbs_g": 55.0,
        "time_since_last_meal_min": 60.0,
        "hba1c": 7.0,
        "bmi": 28.0,
        "age_years": 50.0,
        "sex": "Male"
    }

    # Direct loader inference
    from schemas import GlucoseExcursionInput
    direct_res = glucose_model_loader.predict(GlucoseExcursionInput(**test_input))

    # API response
    api_resp = client.post("/api/predict/glucose-excursion", json=test_input)
    assert api_resp.status_code == 200
    api_data = api_resp.json()

    assert api_data["prediction"] == direct_res.prediction
    assert abs(api_data["excursion_risk_probability"] - direct_res.excursion_risk_probability) < 1e-4


def test_direct_cv_model_vs_api_consistency(client):
    """Verify direct cardiovascular risk model inference matches the API endpoint output."""
    test_input = {
        "age_years": 65.0,
        "sex": "Male",
        "systolic_bp": 152.0,
        "diastolic_bp": 94.0,
        "total_cholesterol": 240.0,
        "ldl_cholesterol": 160.0,
        "hdl_cholesterol": 36.0,
        "triglycerides": 210.0,
        "fasting_glucose": 135.0,
        "hba1c": 7.5,
        "bmi": 31.0,
        "smoking_status": "current_smoker",
        "hypertension_status": 1,
        "hypertension_duration_years": 10.0,
        "diabetes_status": 1
    }

    from schemas import CardiovascularRiskInput
    direct_res = cv_model_loader.predict(CardiovascularRiskInput(**test_input))

    api_resp = client.post("/api/predict/cardiovascular-risk", json=test_input)
    assert api_resp.status_code == 200
    api_data = api_resp.json()

    assert api_data["cv_event_prediction"] == direct_res.cv_event_prediction
    assert abs(api_data["estimated_1y_event_probability"] - direct_res.estimated_1y_event_probability) < 1e-4


# =============================================================================
# 6. Backward Compatible /predict Endpoint Tests (Driven by Glucose Model)
# =============================================================================

def test_predict_prompt_sample(client):
    """Test legacy format /predict payload runs on curatwin_glucose_model.joblib."""
    payload = {
        "gender": "Female",
        "age": 45,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 27.5,
        "HbA1c_level": 5.8,
        "blood_glucose_level": 110
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert data["prediction"] in (0, 1)
    assert "probability" in data
    assert 0.0 <= data["probability"] <= 1.0


def test_predict_sensor_stream(client):
    """Verify sensor stream format runs through /predict."""
    payload = {
        "gender": "Male",
        "age": 55,
        "hypertension": 1,
        "heart_disease": 0,
        "smoking_history": "former",
        "bmi": 29.0,
        "HbA1c_level": 6.8,
        "blood_glucose_level": 165,
        "source": "sensor",
        "device_id": "CuraWatch-B12",
        "measurement_timestamp": "2026-10-18T10:15:30Z"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "sensor"
    assert data["device_id"] == "CuraWatch-B12"


def test_predict_high_risk_patient(client):
    """Verify severe biomarker profile triggers positive prediction."""
    payload = {
        "gender": "Male",
        "age": 70,
        "hypertension": 1,
        "heart_disease": 1,
        "smoking_history": "current",
        "bmi": 38.5,
        "HbA1c_level": 9.2,
        "blood_glucose_level": 250
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] == 1
    assert data["probability"] >= 0.50


def test_predict_low_risk_patient(client):
    """Verify optimal healthy profile yields negative prediction."""
    payload = {
        "gender": "Female",
        "age": 22,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 20.5,
        "HbA1c_level": 4.8,
        "blood_glucose_level": 82
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] == 0
    assert data["probability"] < 0.50


# =============================================================================
# 7. Input Validation & Edge Case Handling
# =============================================================================

def test_missing_features(client):
    """Verify that omitting required features triggers HTTP 422."""
    payload = {"gender": "Female", "age": 45}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_invalid_data_types(client):
    """Verify that string in numerical field returns HTTP 422."""
    payload = {
        "gender": "Female",
        "age": "invalid_age_string",
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 27.5,
        "HbA1c_level": 5.8,
        "blood_glucose_level": 110
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_unsupported_categorical_gender(client):
    """Verify that unsupported gender category triggers HTTP 422."""
    payload = {
        "gender": "UnknownGender",
        "age": 45,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 25.0,
        "HbA1c_level": 5.5,
        "blood_glucose_level": 100
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_out_of_range_numerical_values(client):
    """Verify that clinically impossible out-of-range values trigger HTTP 422."""
    payload = {
        "gender": "Male",
        "age": 180,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 25.0,
        "HbA1c_level": 5.5,
        "blood_glucose_level": 100
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


# =============================================================================
# 8. Food Analysis Endpoint Test
# =============================================================================
from unittest.mock import patch, MagicMock

def test_food_analysis_endpoint(client):
    """Verify that /api/analyze-food parses and returns a valid nutritional breakdown."""
    mock_groq_response = {
        "meal_name": "Grilled Chicken and Quinoa Bowl",
        "category": "High-Protein Lunch",
        "total_calories": 480.0,
        "total_protein": 42.0,
        "total_carbs": 38.0,
        "total_fats": 12.0,
        "fiber": 6.5,
        "glycemic_index": "Low GI",
        "clinical_insight": "Balanced meal with strong glycemic stability.",
        "healthier_alternative": {
            "alternative_dish": "Grilled Chicken with Riced Cauliflower",
            "calorie_reduction": 140.0,
            "carb_reduction": 25.0,
            "explanation": "Replacing quinoa with cauliflower rice further lowers postprandial glucose spike."
        },
        "bmi_meal_limit_exceeded": False,
        "recommended_max_meal_calories": 550.0,
        "items": [
            {"item_name": "Grilled Chicken Breast (150g)", "total_calories": 250.0, "total_protein": 38.0, "total_carbs": 0.0, "total_fats": 5.0},
            {"item_name": "Cooked Quinoa (1 cup)", "total_calories": 180.0, "total_protein": 4.0, "total_carbs": 34.0, "total_fats": 4.0},
            {"item_name": "Steamed Broccoli", "total_calories": 50.0, "total_protein": 0.0, "total_carbs": 4.0, "total_fats": 3.0}
        ]
    }

    groq_api_return = {
        "choices": [
            {"message": {"content": json.dumps(mock_groq_response)}}
        ]
    }

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test_key"}):
        with patch("main.call_groq_api", return_value=groq_api_return):
            payload = {"query": "Grilled chicken bowl with quinoa and vegetables", "patient_bmi": 27.5}
            response = client.post("/api/analyze-food", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["meal_name"] == "Grilled Chicken and Quinoa Bowl"
            assert data["total_calories"] == 480.0
            assert data["total_carbs"] == 38.0
            assert data["healthier_alternative"]["alternative_dish"] == "Grilled Chicken with Riced Cauliflower"

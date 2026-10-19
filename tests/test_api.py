"""
DiaWatch AI — Automated Backend & Model Test Suite
Tests endpoints, schemas, preprocessing, edge cases, and mathematical consistency
between direct model inference and the FastAPI REST endpoints.
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
from model_loader import model_loader


@pytest.fixture(scope="session", autouse=True)
def initialize_model():
    """Ensure the model is loaded prior to test execution."""
    model_loader.load()
    yield


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


# =============================================================================
# 1. Model Loading Tests
# =============================================================================

def test_model_loading_and_attributes():
    """Verify that the model artifact loads and exhibits the expected scikit-learn attributes."""
    assert model_loader.is_loaded is True
    assert model_loader.model is not None
    assert model_loader.estimator_name == "LogisticRegression"
    assert model_loader.supports_proba is True
    assert len(model_loader.expected_features) == 15
    assert "HbA1c_level" in model_loader.expected_features
    assert "blood_glucose_level" in model_loader.expected_features


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
    """Verify GET /health confirms operational status and loaded model details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["model_version"] == "1.0"
    assert data["estimator"] == "LogisticRegression"
    assert data["feature_count"] == 15
    assert "Female" in data["supported_genders"]
    assert "never" in data["supported_smoking_categories"]


# =============================================================================
# 3. Valid Prediction Requests & Scenarios
# =============================================================================

def test_predict_prompt_sample(client):
    """
    Test prediction on the sample given in user specification:
    gender: Female, age: 45, hypertension: 0, heart_disease: 0,
    smoking_history: never, bmi: 27.5, HbA1c_level: 5.8, blood_glucose_level: 110
    """
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
    assert data["prediction"] == 0
    assert data["label"] == "Negative model classification"
    assert isinstance(data["probability"], float)
    assert 0.0 <= data["probability"] <= 1.0
    # Expected probability is ~0.047
    assert 0.03 <= data["probability"] <= 0.07
    assert data["model_version"] == "1.0"
    assert "probability_note" in data
    assert data["input_summary"]["age"] == 45
    assert data["source"] == "manual"
    assert "prediction_timestamp" in data


def test_predict_sensor_stream(client):
    """
    Verify that sensor-driven payload with device provenance and timestamp
    is accepted and returns valid prediction and matching provenance metadata.
    """
    payload = {
        "gender": "Male",
        "age": 58,
        "hypertension": 1,
        "heart_disease": 0,
        "smoking_history": "former",
        "bmi": 29.0,
        "HbA1c_level": 6.8,
        "blood_glucose_level": 165.0,
        "source": "sensor",
        "device_id": "CuraWatch-B12",
        "measurement_timestamp": "2026-10-18T15:00:00Z"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "sensor"
    assert data["device_id"] == "CuraWatch-B12"
    assert data["measurement_timestamp"] == "2026-10-18T15:00:00Z"
    assert data["prediction_timestamp"] is not None
    assert isinstance(data["prediction"], int)
    assert data["probability"] is not None


def test_predict_high_risk_patient(client):
    """Verify that a high-risk biomarker profile yields a Positive classification."""
    payload = {
        "gender": "Male",
        "age": 68,
        "hypertension": 1,
        "heart_disease": 1,
        "smoking_history": "current",
        "bmi": 36.5,
        "HbA1c_level": 8.5,
        "blood_glucose_level": 230
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] == 1
    assert data["label"] == "Positive model classification"
    assert data["probability"] > 0.90


def test_predict_low_risk_patient(client):
    """Verify that a healthy, young biomarker profile yields a Negative classification with low probability."""
    payload = {
        "gender": "Female",
        "age": 22,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 20.5,
        "HbA1c_level": 4.8,
        "blood_glucose_level": 85
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] == 0
    assert data["label"] == "Negative model classification"
    assert data["probability"] < 0.02


def test_case_insensitive_normalization(client):
    """Verify that lowercase or hyphenated inputs are normalized gracefully."""
    payload = {
        "gender": "female",
        "age": 35,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "no info",
        "bmi": 24.0,
        "HbA1c_level": 5.2,
        "blood_glucose_level": 95
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["input_summary"]["gender"] == "Female"
    assert data["input_summary"]["smoking_history"] == "No Info"


# =============================================================================
# 4. Error Handling & Validation Tests
# =============================================================================

def test_missing_features(client):
    """Verify that omitting required fields triggers HTTP 422 with validation errors."""
    # Missing blood_glucose_level and bmi
    payload = {
        "gender": "Female",
        "age": 45,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "HbA1c_level": 5.8
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "Validation Error"
    assert len(data["field_errors"]) >= 2


def test_invalid_data_types(client):
    """Verify that non-numeric types for numerical fields trigger HTTP 422."""
    payload = {
        "gender": "Female",
        "age": "forty-five",  # Invalid type
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "never",
        "bmi": 25.0,
        "HbA1c_level": 5.5,
        "blood_glucose_level": 100
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_unsupported_categorical_gender(client):
    """Verify that an unsupported gender category is rejected with HTTP 422."""
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
    data = response.json()
    error_text = str(data["field_errors"])
    assert "Invalid gender" in error_text


def test_unsupported_categorical_smoking_history(client):
    """Verify that an unsupported smoking history is rejected with HTTP 422."""
    payload = {
        "gender": "Male",
        "age": 45,
        "hypertension": 0,
        "heart_disease": 0,
        "smoking_history": "occasional_vaper",
        "bmi": 25.0,
        "HbA1c_level": 5.5,
        "blood_glucose_level": 100
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    data = response.json()
    error_text = str(data["field_errors"])
    assert "Invalid smoking_history" in error_text


def test_out_of_range_numerical_values(client):
    """Verify that clinically impossible out-of-range values trigger HTTP 422."""
    payload = {
        "gender": "Male",
        "age": 180,  # Max is 120
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
# 5. Direct Model vs API Mathematical Consistency Verification
# =============================================================================

def test_direct_model_vs_api_consistency(client):
    """
    Compare raw scikit-learn model inference directly with the FastAPI endpoint output.
    Ensures that preprocessing, column alignment, and probability computations
    are 100% faithful to the original trained model.
    """
    test_cases = [
        {
            "gender": "Female",
            "age": 52.0,
            "hypertension": 1,
            "heart_disease": 0,
            "smoking_history": "former",
            "bmi": 29.8,
            "HbA1c_level": 6.4,
            "blood_glucose_level": 155.0
        },
        {
            "gender": "Male",
            "age": 38.0,
            "hypertension": 0,
            "heart_disease": 0,
            "smoking_history": "never",
            "bmi": 23.4,
            "HbA1c_level": 5.1,
            "blood_glucose_level": 92.0
        },
        {
            "gender": "Other",
            "age": 60.0,
            "hypertension": 1,
            "heart_disease": 1,
            "smoking_history": "current",
            "bmi": 32.1,
            "HbA1c_level": 7.9,
            "blood_glucose_level": 210.0
        }
    ]

    raw_model = joblib.load(model_loader.find_model_file())

    for case in test_cases:
        # 1. Compute direct model output
        encoded_dict = {
            "gender_Female": 1.0 if case["gender"] == "Female" else 0.0,
            "gender_Male": 1.0 if case["gender"] == "Male" else 0.0,
            "gender_Other": 1.0 if case["gender"] == "Other" else 0.0,
            "smoking_history_No Info": 1.0 if case["smoking_history"] == "No Info" else 0.0,
            "smoking_history_current": 1.0 if case["smoking_history"] == "current" else 0.0,
            "smoking_history_ever": 1.0 if case["smoking_history"] == "ever" else 0.0,
            "smoking_history_former": 1.0 if case["smoking_history"] == "former" else 0.0,
            "smoking_history_never": 1.0 if case["smoking_history"] == "never" else 0.0,
            "smoking_history_not current": 1.0 if case["smoking_history"] == "not current" else 0.0,
            "age": float(case["age"]),
            "hypertension": float(case["hypertension"]),
            "heart_disease": float(case["heart_disease"]),
            "bmi": float(case["bmi"]),
            "HbA1c_level": float(case["HbA1c_level"]),
            "blood_glucose_level": float(case["blood_glucose_level"]),
        }
        df_direct = pd.DataFrame([encoded_dict])[list(raw_model.feature_names_in_)]
        expected_pred = int(raw_model.predict(df_direct)[0])
        expected_prob = float(round(raw_model.predict_proba(df_direct)[0][1], 4))

        # 2. Call API endpoint
        api_response = client.post("/predict", json=case)
        assert api_response.status_code == 200
        api_data = api_response.json()

        # 3. Assert mathematical equality
        assert api_data["prediction"] == expected_pred, f"Prediction mismatch for case {case}"
        assert abs(api_data["probability"] - expected_prob) < 1e-4, f"Probability mismatch for case {case}"


from unittest.mock import patch, MagicMock

def test_food_analysis_endpoint(client):
    """Verify that /api/analyze-food parses and returns a valid nutritional breakdown."""
    mock_groq_response = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "meal_name": "Grilled Chicken and Broccoli",
                        "category": "Lunch",
                        "total_calories": 420.0,
                        "total_protein": 38.0,
                        "total_carbs": 35.0,
                        "total_fats": 8.0,
                        "fiber": 6.0,
                        "glycemic_index": "Low GI",
                        "clinical_insight": "Lean poultry paired with cruciferous fiber provides steady amino acids and low glycemic impact.",
                        "healthier_alternative": {
                            "alternative_dish": "Grilled Chicken with Riced Cauliflower",
                            "calorie_reduction": 110.0,
                            "carb_reduction": 28.0,
                            "explanation": "Replacing brown rice with riced cauliflower reduces glycemic load while retaining high fiber."
                        },
                        "items": [
                            {"item_name": "Chicken Breast", "total_calories": 220.0, "total_protein": 35.0, "total_carbs": 0.0, "total_fats": 4.0},
                            {"item_name": "Steamed Broccoli", "total_calories": 50.0, "total_protein": 3.0, "total_carbs": 10.0, "total_fats": 0.5},
                            {"item_name": "Brown Rice", "total_calories": 150.0, "total_protein": 3.0, "total_carbs": 32.0, "total_fats": 1.0}
                        ]
                    })
                }
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(mock_groq_response).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch.dict(os.environ, {"GROQ_API_KEY": "mock_test_key"}):
        with patch("urllib.request.urlopen", return_value=mock_resp):
            payload = {
                "query": "Grilled chicken breast with steamed broccoli and brown rice",
                "patient_bmi": 28.4
            }
            response = client.post("/api/analyze-food", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["meal_name"] == "Grilled Chicken and Broccoli"
            assert data["total_calories"] == 420.0
            assert data["total_protein"] == 38.0
            assert data["total_carbs"] == 35.0
            assert data["total_fats"] == 8.0
            assert data["glycemic_index"] == "Low GI"
            assert "clinical_insight" in data
            assert data["healthier_alternative"]["alternative_dish"] == "Grilled Chicken with Riced Cauliflower"
            assert data["bmi_meal_limit_exceeded"] is False
            assert len(data["items"]) == 3


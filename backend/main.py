"""
CuraTwin — FastAPI Diabetes Prediction & Sensor Telemetry REST API
"""

import os
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Dict, Any, List

from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from schemas import (
    PredictionInput,
    PredictionOutput,
    HealthResponse,
    FoodAnalysisRequest,
    FoodAnalysisResponse,
    FoodItemBreakdown,
    VALID_GENDERS,
    VALID_SMOKING_HISTORIES,
    GlucoseExcursionInput,
    GlucoseExcursionOutput,
    CardiovascularRiskInput,
    CardiovascularRiskOutput,
)
import json
import urllib.request
import urllib.error
from model_loader import (
    glucose_model_loader,
    cv_model_loader,
    ModelLoadingError,
    ModelInferenceError,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("curatwin.api")


# -----------------------------------------------------------------------------
# Lifespan Context Manager: Load ML Models on Startup
# -----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load and verify trained machine learning models during startup.
    Ensures zero inference latency on incoming HTTP requests.
    Only curatwin_glucose_model.joblib and curatwin_cardiovascular_model.joblib are loaded.
    """
    logger.info("Starting CuraTwin API application with dual digital-twin models...")

    try:
        glucose_model_loader.load()
        logger.info("Trained Glucose Excursion XGBoost model (curatwin_glucose_model.joblib) loaded successfully into memory.")
    except Exception as exc:
        logger.error(f"Failed to load glucose excursion model during startup: {exc}")

    try:
        cv_model_loader.load()
        logger.info("Trained Cardiovascular Risk Balanced Random Forest model (curatwin_cardiovascular_model.joblib) loaded successfully into memory.")
    except Exception as exc:
        logger.error(f"Failed to load cardiovascular risk model during startup: {exc}")

    yield
    logger.info("Shutting down CuraTwin API application...")


app = FastAPI(
    title="CuraTwin — Diabetes Prediction & Digital Twin API",
    description=(
        "Production-ready REST API serving predictions from a machine learning model "
        "trained on clinical biomarkers. Supports manual clinical inputs and wearable sensor telemetry."
    ),
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------
# Support development localhost origins and GitHub Pages domains.
# Unrestricted '*' is strictly avoided in production.
default_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5500",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8000",
]

# Allow custom origins specified via environment variable (comma-separated)
custom_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
if custom_origins_env.strip():
    custom_origins = [orig.strip() for orig in custom_origins_env.split(",") if orig.strip()]
    default_allowed_origins.extend(custom_origins)

# Regex matches all GitHub Pages domains (e.g. https://<username>.github.io)
github_pages_regex = r"^https://[a-zA-Z0-9-]+\.github\.io$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_allowed_origins,
    allow_origin_regex=github_pages_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization", "X-Requested-With"],
)


# Compatibility for Starlette 0.46+ / 1.0+
HTTP_422_STATUS = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", status.HTTP_422_UNPROCESSABLE_ENTITY)

# -----------------------------------------------------------------------------
# Exception Handlers
# -----------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Format Pydantic validation errors with clear, actionable error messages.
    """
    errors_summary = []
    for err in exc.errors():
        field_path = " -> ".join(str(loc) for loc in err.get("loc", []))
        message = err.get("msg", "Validation error")
        errors_summary.append({"field": field_path, "message": message})

    return JSONResponse(
        status_code=HTTP_422_STATUS,
        content={
            "error": "Validation Error",
            "detail": "One or more input fields failed clinical range or category validation.",
            "field_errors": errors_summary,
            "supported_categories": {
                "gender": VALID_GENDERS,
                "smoking_history": VALID_SMOKING_HISTORIES,
            }
        }
    )


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@app.get("/", summary="Root Endpoint")
def get_root() -> Dict[str, Any]:
    """
    Return basic service confirmation and status.
    """
    return {
        "service": "CuraTwin — AI-Assisted Diabetes Monitoring & Digital Twin API",
        "status": "online",
        "version": "1.1.0",
        "health_check": "/health",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse, summary="Service & Model Health")
def get_health() -> HealthResponse:
    """
    Confirm service operational status and verify that both ML models are loaded and ready.
    """
    both_loaded = glucose_model_loader.is_loaded and cv_model_loader.is_loaded
    expected_feats = glucose_model_loader.expected_features + cv_model_loader.expected_features
    return HealthResponse(
        status="healthy" if both_loaded else "degraded",
        model_loaded=both_loaded,
        model_version="CuraTwin v1.2 (Dual Models)",
        estimator="XGBoost (Glucose Excursion) + Balanced Random Forest (Cardiovascular Risk)",
        feature_count=len(expected_feats),
        expected_features=expected_feats,
        supported_genders=VALID_GENDERS,
        supported_smoking_categories=VALID_SMOKING_HISTORIES,
    )


@app.post("/predict", response_model=PredictionOutput, summary="Predict Excursion / Diabetes Risk Classification")
def predict_diabetes(payload: PredictionInput) -> PredictionOutput:
    """
    Evaluates patient clinical biomarkers using the trained CuraTwin Glucose Excursion model (curatwin_glucose_model.joblib).
    """
    if not glucose_model_loader.is_loaded:
        glucose_model_loader.load()

    try:
        exc_input = GlucoseExcursionInput(
            current_glucose_mg_dl=float(payload.blood_glucose_level),
            hba1c=float(payload.HbA1c_level),
            bmi=float(payload.bmi),
            age_years=float(payload.age),
            sex=payload.gender,
            device_id=payload.device_id,
            measurement_timestamp=payload.measurement_timestamp
        )
        res = glucose_model_loader.predict(exc_input)
        now_iso = datetime.now(timezone.utc).isoformat()
        return PredictionOutput(
            prediction=res.prediction,
            label="Sugar Spike Alert (>180 mg/dL)" if res.prediction == 1 else "Normal Blood Sugar Expected",
            probability=res.excursion_risk_probability,
            model_version="CuraTwin-GlucoseForecast-v1",
            probability_note=f"Estimated likelihood of blood sugar rising above 180 mg/dL in the next 2 hours: {res.risk_tier}",
            source=payload.source or "manual",
            device_id=payload.device_id,
            measurement_timestamp=payload.measurement_timestamp or now_iso,
            prediction_timestamp=now_iso,
            input_summary={
                "gender": payload.gender,
                "age": payload.age,
                "hypertension": payload.hypertension,
                "heart_disease": payload.heart_disease,
                "smoking_history": payload.smoking_history,
                "bmi": payload.bmi,
                "HbA1c_level": payload.HbA1c_level,
                "blood_glucose_level": payload.blood_glucose_level,
            }
        )
    except Exception as exc:
        logger.exception("Unexpected error during prediction")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during prediction computation: {str(exc)}"
        )


@app.post("/api/predict/glucose-excursion", response_model=GlucoseExcursionOutput, summary="Predict 2-Hour Short-Term Glucose Excursion Risk")
def predict_glucose_excursion(payload: GlucoseExcursionInput) -> GlucoseExcursionOutput:
    """
    Accepts instantaneous CGM telemetry, meal nutrition, step cadence, and personal baselines,
    and returns 2-hour lookahead glucose excursion risk probability (>180 mg/dL).
    """
    try:
        return glucose_model_loader.predict(payload)
    except Exception as exc:
        logger.exception("Glucose excursion inference failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Glucose excursion inference error: {str(exc)}"
        )


@app.post("/api/predict/cardiovascular-risk", response_model=CardiovascularRiskOutput, summary="Predict 365-Day Incident Cardiovascular Event Risk")
def predict_cardiovascular_risk(payload: CardiovascularRiskInput) -> CardiovascularRiskOutput:
    """
    Accepts longitudinal vitals, blood pressure, lipid panels, and co-morbidities,
    and returns 1-year first-incident acute MI/stroke risk evaluation.
    """
    try:
        return cv_model_loader.predict(payload)
    except Exception as exc:
        logger.exception("Cardiovascular risk inference failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cardiovascular risk inference error: {str(exc)}"
        )


def call_groq_api(req: urllib.request.Request) -> Dict[str, Any]:
    with urllib.request.urlopen(req, timeout=18) as resp:
        return json.loads(resp.read().decode("utf-8"))


@app.post("/api/analyze-food", response_model=FoodAnalysisResponse, summary="Analyze Meal Nutrition via Real AI")
def analyze_food_nutrition(payload: FoodAnalysisRequest) -> FoodAnalysisResponse:
    """
    Evaluate meal query using real AI language model (Groq) to determine
    calories, macronutrients (protein, carbs, fats), fiber, glycemic index,
    and individual plate ingredients for diabetic patients.
    """
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY environment variable is not configured. Please add GROQ_API_KEY in Render environment settings."
        )

    # Clean query if it is just a filename
    raw_query = (payload.query or "").strip()
    if raw_query and any(raw_query.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]):
        clean_name = raw_query.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
        meal_desc = f"Diabetic-friendly meal based on plate image '{clean_name}'"
    elif raw_query:
        meal_desc = raw_query
    else:
        meal_desc = "Analyze the uploaded food plate photo and identify the dish, portion, and ingredients accurately."

    bmi = payload.patient_bmi if payload.patient_bmi and payload.patient_bmi > 10 else 27.5
    # Clinical caloric limit per meal based on metabolic BMI brackets
    if bmi >= 30.0:
        recommended_max_cals = 500.0
    elif bmi >= 25.0:
        recommended_max_cals = 600.0
    else:
        recommended_max_cals = 650.0

    prompt = (
        f"You are a clinical diabetic nutrition and Computer Vision AI for CuraTwin. Analyze this meal for a diabetic patient with BMI {bmi:.1f}:\n"
        f"Description/Context: '{meal_desc}'\n\n"
        f"If an image is attached, inspect the food plate visually to identify the exact dish (e.g. braised chicken feet, curry, pasta, salad, etc.).\n"
        f"Estimate the realistic portion, total calories, macronutrients (in grams), dietary fiber (in grams), "
        f"glycemic index category ('Low GI', 'Moderate GI', or 'High GI'), meal category ('Breakfast', 'Lunch', 'Dinner', or 'Snack'), "
        f"and itemized plate components.\n"
        f"ALSO provide:\n"
        f"1. 'clinical_insight': A precise 1-sentence clinical metabolic summary of how this meal impacts blood glucose, insulin sensitivity, and glycemic response.\n"
        f"2. 'healthier_alternative': A specific healthier diabetic-friendly swap/alternative for this meal, including:\n"
        f"   - 'alternative_dish': Name of the healthier alternative dish\n"
        f"   - 'calorie_reduction': Approximate calories saved (float)\n"
        f"   - 'carb_reduction': Approximate carbohydrate grams reduced (float)\n"
        f"   - 'explanation': Why this alternative is clinically superior for diabetes and prevents glycemic spikes\n\n"
        f"Return ONLY a valid JSON object matching this schema:\n"
        f"{{\n"
        f'  "meal_name": "Short descriptive name",\n'
        f'  "category": "Breakfast, Lunch, Dinner, or Snack",\n'
        f'  "total_calories": float,\n'
        f'  "total_protein": float,\n'
        f'  "total_carbs": float,\n'
        f'  "total_fats": float,\n'
        f'  "fiber": float,\n'
        f'  "glycemic_index": "Low GI, Moderate GI, or High GI",\n'
        f'  "clinical_insight": "string",\n'
        f'  "healthier_alternative": {{\n'
        f'    "alternative_dish": "string",\n'
        f'    "calorie_reduction": float,\n'
        f'    "carb_reduction": float,\n'
        f'    "explanation": "string"\n'
        f"  }},\n"
        f'  "items": [\n'
        f'    {{"item_name": "string", "total_calories": float, "total_protein": float, "total_carbs": float, "total_fats": float}}\n'
        f"  ]\n"
        f"}}"
    )

    has_image = bool(payload.image_data and payload.image_data.startswith("data:image"))

    if has_image:
        user_message_content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": payload.image_data}}
        ]
        chosen_model = "llama-3.2-11b-vision-preview"
    else:
        user_message_content = prompt
        chosen_model = "openai/gpt-oss-120b"

    req_data = json.dumps({
        "messages": [
            {
                "role": "system",
                "content": "You are a professional clinical dietitian assistant for diabetic patients. Output strictly JSON."
            },
            {
                "role": "user",
                "content": user_message_content
            }
        ],
        "model": chosen_model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=req_data,
        headers={
            "Authorization": f"Bearer {groq_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "CuraTwin-FastAPI/1.1"
        },
        method="POST"
    )

    try:
        resp_body = call_groq_api(req)
        content = resp_body["choices"][0]["message"]["content"]
        parsed_json = json.loads(content)
            
        # Apply clinical BMI intake threshold rules
        cals = float(parsed_json.get("total_calories", 0.0))
        parsed_json["recommended_max_meal_calories"] = recommended_max_cals
        parsed_json["bmi_meal_limit_exceeded"] = cals > recommended_max_cals
        
        return FoodAnalysisResponse(**parsed_json)
    except urllib.error.HTTPError as http_err:
        err_msg = http_err.read().decode("utf-8", errors="replace")
        logger.error(f"Groq API HTTP error: {http_err.code} - {err_msg}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Groq AI service returned HTTP {http_err.code}: {err_msg}"
        )
    except Exception as exc:
        logger.exception("Failed to analyze food via AI")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze food nutrition via AI: {str(exc)}"
        )



    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

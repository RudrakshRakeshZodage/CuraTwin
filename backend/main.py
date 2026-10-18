"""
CuraTwin — FastAPI Diabetes Prediction & Sensor Telemetry REST API
"""

import os
import logging
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
    VALID_GENDERS,
    VALID_SMOKING_HISTORIES,
)
from model_loader import (
    model_loader,
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
# Lifespan Context Manager: Load ML Model Once on Startup
# -----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load and verify the trained diabetes machine learning model during startup.
    Ensures zero inference latency on incoming HTTP requests.
    """
    logger.info("Starting CuraTwin API application...")
    try:
        model_loader.load()
        logger.info("Trained diabetes ML model loaded successfully into memory.")
    except Exception as exc:
        logger.error(f"CRITICAL: Failed to load diabetes model during startup: {exc}")
        # Note: We do not crash the app so that /health can report degraded status to monitoring
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
    Confirm service operational status and verify that the ML model is loaded and ready.
    """
    is_loaded = model_loader.is_loaded
    return HealthResponse(
        status="healthy" if is_loaded else "degraded",
        model_loaded=is_loaded,
        model_version=model_loader.model_version,
        estimator=model_loader.estimator_name,
        feature_count=len(model_loader.expected_features),
        expected_features=model_loader.expected_features,
        supported_genders=VALID_GENDERS,
        supported_smoking_categories=VALID_SMOKING_HISTORIES,
    )


@app.post("/predict", response_model=PredictionOutput, summary="Predict Diabetes Risk Classification")
def predict_diabetes(payload: PredictionInput) -> PredictionOutput:
    """
    Accept patient clinical biomarkers, validate inputs, apply fitted preprocessing,
    and return the model's binary classification and statistical probability.
    """
    if not model_loader.is_loaded:
        logger.error("Predict called while model is not loaded.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Diabetes machine learning model is not currently loaded. "
                "The server may be starting up or the model file could not be found."
            )
        )

    try:
        result = model_loader.predict(payload)
        return result
    except ModelInferenceError as err:
        logger.error(f"Inference error encountered: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(err)}"
        )
    except Exception as exc:
        logger.exception("Unexpected error during prediction")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during prediction computation: {str(exc)}"
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

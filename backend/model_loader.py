import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import joblib
import pandas as pd
import numpy as np

from schemas import PredictionInput, PredictionOutput, VALID_GENDERS, VALID_SMOKING_HISTORIES

logger = logging.getLogger("curatwin.model_loader")


class ModelLoadingError(RuntimeError):
    """Raised when the diabetes ML model artifact cannot be found or loaded."""
    pass


class ModelInferenceError(RuntimeError):
    """Raised when feature preprocessing or model inference fails."""
    pass


class DiabetesModelLoader:
    """
    Singleton-style manager for loading the trained diabetes model artifact,
    validating input features, applying exact preprocessing, and executing predictions.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model: Any = None
        self.model_version: str = "1.0"
        self.expected_features: List[str] = [
            "gender_Female",
            "gender_Male",
            "gender_Other",
            "smoking_history_No Info",
            "smoking_history_current",
            "smoking_history_ever",
            "smoking_history_former",
            "smoking_history_never",
            "smoking_history_not current",
            "age",
            "hypertension",
            "heart_disease",
            "bmi",
            "HbA1c_level",
            "blood_glucose_level",
        ]
        self.supports_proba: bool = False
        self.estimator_name: str = "Unknown"

    def find_model_file(self) -> Path:
        """
        Search for the diabetes_model.joblib file across candidate paths.
        """
        candidates: List[Path] = []

        if self.model_path:
            candidates.append(Path(self.model_path))

        env_path = os.environ.get("MODEL_PATH")
        if env_path:
            candidates.append(Path(env_path))

        base_dir = Path(__file__).resolve().parent
        candidates.extend([
            base_dir / "models" / "diabetes_model.joblib",
            base_dir / "diabetes_model.joblib",
            base_dir.parent / "diabetes_model.joblib",
            base_dir.parent / "backend" / "models" / "diabetes_model.joblib",
            Path("backend/models/diabetes_model.joblib"),
            Path("models/diabetes_model.joblib"),
            Path("diabetes_model.joblib"),
        ])

        for path in candidates:
            if path.exists() and path.is_file():
                return path

        candidate_strs = "\n - ".join(str(p.resolve()) for p in candidates[:5])
        raise ModelLoadingError(
            f"Diabetes model file 'diabetes_model.joblib' could not be found. "
            f"Please ensure it is located at 'backend/models/diabetes_model.joblib'.\n"
            f"Checked locations:\n - {candidate_strs}"
        )

    def load(self) -> None:
        """
        Load the joblib model artifact into memory once at application startup.
        Inspects model metadata, feature names, and estimator capabilities.
        """
        if self.model is not None:
            logger.info("Model is already loaded.")
            return

        resolved_path = self.find_model_file()
        logger.info(f"Loading trained diabetes model from: {resolved_path}")

        try:
            self.model = joblib.load(resolved_path)
        except Exception as exc:
            logger.exception("Failed to deserialize model joblib artifact")
            raise ModelLoadingError(f"Error unpickling model from {resolved_path}: {exc}") from exc

        # Verify estimator attributes
        self.estimator_name = type(self.model).__name__
        self.supports_proba = hasattr(self.model, "predict_proba")

        if hasattr(self.model, "feature_names_in_"):
            detected_features = list(self.model.feature_names_in_)
            logger.info(f"Detected {len(detected_features)} input features from model: {detected_features}")
            self.expected_features = detected_features

        logger.info(
            f"Model successfully loaded: Estimator={self.estimator_name}, "
            f"Supports predict_proba={self.supports_proba}, "
            f"Features={len(self.expected_features)}"
        )

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def preprocess(self, data: PredictionInput) -> pd.DataFrame:
        """
        Convert validated PredictionInput into the exact 15-feature DataFrame
        expected by the trained LogisticRegression model.
        
        Categorical features (gender, smoking_history) are one-hot encoded identically
        to training pandas get_dummies representation.
        Numerical features remain unscaled as in original training.
        """
        row_dict: Dict[str, float] = {
            # One-hot encoded gender
            "gender_Female": 1.0 if data.gender == "Female" else 0.0,
            "gender_Male": 1.0 if data.gender == "Male" else 0.0,
            "gender_Other": 1.0 if data.gender == "Other" else 0.0,
            # One-hot encoded smoking_history
            "smoking_history_No Info": 1.0 if data.smoking_history == "No Info" else 0.0,
            "smoking_history_current": 1.0 if data.smoking_history == "current" else 0.0,
            "smoking_history_ever": 1.0 if data.smoking_history == "ever" else 0.0,
            "smoking_history_former": 1.0 if data.smoking_history == "former" else 0.0,
            "smoking_history_never": 1.0 if data.smoking_history == "never" else 0.0,
            "smoking_history_not current": 1.0 if data.smoking_history == "not current" else 0.0,
            # Numerical features
            "age": float(data.age),
            "hypertension": float(data.hypertension),
            "heart_disease": float(data.heart_disease),
            "bmi": float(data.bmi),
            "HbA1c_level": float(data.HbA1c_level),
            "blood_glucose_level": float(data.blood_glucose_level),
        }

        # Build single-row DataFrame with exact feature order required by model
        df = pd.DataFrame([row_dict])
        try:
            return df[self.expected_features]
        except KeyError as missing:
            raise ModelInferenceError(f"Missing expected model feature column: {missing}")

    def predict(self, data: PredictionInput) -> PredictionOutput:
        """
        Execute prediction on validated patient input.
        """
        if not self.is_loaded:
            raise ModelLoadingError("Cannot perform inference: Model has not been loaded.")

        try:
            features_df = self.preprocess(data)
            raw_pred = self.model.predict(features_df)
            prediction_int = int(raw_pred[0])

            probability_val: Optional[float] = None
            if self.supports_proba:
                probs = self.model.predict_proba(features_df)[0]
                # Probability of class 1 (diabetes positive)
                probability_val = float(round(probs[1], 4))

            label = (
                "Positive model classification"
                if prediction_int == 1
                else "Negative model classification"
            )

            now_iso = datetime.now(timezone.utc).isoformat()

            return PredictionOutput(
                prediction=prediction_int,
                label=label,
                probability=probability_val,
                model_version=self.model_version,
                source=data.source or "manual",
                device_id=data.device_id,
                measurement_timestamp=data.measurement_timestamp or now_iso,
                prediction_timestamp=now_iso,
                input_summary={
                    "gender": data.gender,
                    "age": data.age,
                    "hypertension": data.hypertension,
                    "heart_disease": data.heart_disease,
                    "smoking_history": data.smoking_history,
                    "bmi": data.bmi,
                    "HbA1c_level": data.HbA1c_level,
                    "blood_glucose_level": data.blood_glucose_level,
                }
            )
        except Exception as exc:
            logger.exception("Inference failed")
            raise ModelInferenceError(f"Model prediction computation failed: {exc}") from exc


# Global shared instance
model_loader = DiabetesModelLoader()

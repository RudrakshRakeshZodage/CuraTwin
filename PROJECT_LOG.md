# CuraTwin — Project Implementation & Audit Log

This document chronicles every inspection, architectural decision, code change, automated test, and deployment setting for the **CuraTwin** AI-Assisted Diabetes Monitoring & Digital Twin Dashboard.

---

## Session Metadata
- **Product Name:** CuraTwin
- **Lead Engineer:** Antigravity Senior Full-Stack & Machine Learning Pair Programmer
- **Repository:** `d:\Rudraksh\College\app\CuraTwin`
- **Remote:** `https://github.com/RudrakshRakeshZodage/CuraTwin.git`
- **Architecture:** GitHub Pages (Frontend) + FastAPI on Render (Backend) + Scikit-Learn Model

---

## Phase 1: Model Inspection & Preprocessing Verification

1. Located model artifact: `backend/models/diabetes_model.joblib` (and workspace root).
2. Identified estimator: `sklearn.linear_model.LogisticRegression(penalty='l2', max_iter=1000)`.
3. Validated input dimensionality: 15 features in strict order:
   `gender_Female`, `gender_Male`, `gender_Other`, `smoking_history_No Info`, `smoking_history_current`, `smoking_history_ever`, `smoking_history_former`, `smoking_history_never`, `smoking_history_not current`, `age`, `hypertension`, `heart_disease`, `bmi`, `HbA1c_level`, `blood_glucose_level`.
4. Mathematical verification: Confirmed numerical features are unscaled, categorical features are one-hot encoded.

---

## Phase 2: Dual-Modality Architecture Implementation

### Files Created & Modified:
1. `backend/schemas.py`:
   - Updated product branding to CuraTwin.
   - Added telemetry fields: `source` ("manual" / "sensor"), `device_id` (e.g. "CuraWatch-B12"), and `measurement_timestamp`.
   - Updated `PredictionOutput` with `source`, `device_id`, `measurement_timestamp`, and `prediction_timestamp`.
2. `backend/model_loader.py`:
   - Enriched inference return object with measurement and prediction timestamps for provenance tracking.
3. `backend/main.py`:
   - Updated title, description, and root service info to CuraTwin.
4. `frontend/sensorAdapter.js`:
   - `SensorAdapter` base class with event emitter pattern (`on`, `emit`).
   - `validateIncomingMeasurement`: Physiological boundary validator.
   - `SimulatedSensorAdapter`: Deterministic continuous glucose kinetics generator with heart rate and step variance.
   - `PatientStateManager`: Digital twin state manager merging patient baseline clinical profile with incoming sensor stream.
5. `frontend/index.html`:
   - Mode Selector segmented tabs: `Manual Input` vs `Watch / Sensor Input`.
   - Preserved 100% of the manual input assessment form and controls.
   - Added Watch / Sensor streaming panel:
     - Device information and live state badge (`Disconnected`, `Connecting`, `Connected`, `Streaming`, `Paused`, `Error`).
     - Telemetry cards: Live Glucose with trend indicator ($\rightarrow, \nearrow, \searrow$), Heart Rate (BPM), and Cumulative Steps.
     - Real-time continuous glucose SVG trend chart.
     - Linked patient baseline profile chips with one-click form sync.
     - Live prediction policy toggle and on-demand inference trigger.
     - Recent telemetry event log table.
   - Enhanced Results card with dual timestamps (`Measurement Time` vs `Prediction Time`) and stale prediction alerts.
6. `frontend/style.css`:
   - Added design tokens, layout styles, and animations for mode tabs, telemetry cards, trend chart, and provenance badges while preserving the clean healthcare aesthetic.
7. `frontend/app.js`:
   - Integrated sensor streaming lifecycle, mode tab transitions, chart rendering, profile sync, and live prediction throttling.
8. `tests/test_api.py`:
   - Expanded test suite to 14 test cases covering sensor payload ingestion and provenance verification.

---

## Phase 3: Automated Testing & Verification

Executed full automated pytest suite:
```bash
python -m pytest tests/test_api.py -v
```
**Result:** 14 passed, 0 failed in 1.71s.
- `test_model_loading_and_attributes`: PASSED
- `test_root_endpoint`: PASSED
- `test_health_endpoint`: PASSED
- `test_predict_prompt_sample`: PASSED (Negative classification, 4.72% probability)
- `test_predict_sensor_stream`: PASSED (Ingesting sensor stream with device ID and timestamps)
- `test_predict_high_risk_patient`: PASSED (Positive classification, >99% probability)
- `test_predict_low_risk_patient`: PASSED (Negative classification, <1% probability)
- `test_case_insensitive_normalization`: PASSED
- `test_missing_features`: PASSED (HTTP 422)
- `test_invalid_data_types`: PASSED (HTTP 422)
- `test_unsupported_categorical_gender`: PASSED (HTTP 422)
- `test_unsupported_categorical_smoking_history`: PASSED (HTTP 422)
- `test_out_of_range_numerical_values`: PASSED (HTTP 422)
- `test_direct_model_vs_api_consistency`: PASSED (Exact parity between direct joblib model and REST endpoint)

---

## Phase 4: Live Browser Verification

Tested live in headless Chromium browser session:
- Tested Manual Input mode: Loaded specification sample, clicked Run Prediction, verified 4.72% probability and Negative classification.
- Tested Watch / Sensor Input mode: Switched tabs, clicked Start Stream.
- Verified connection status transitioned from Disconnected to Streaming.
- Verified live glucose, heart rate, and steps populated continuously.
- Verified SVG trend chart dynamically drew continuous points.
- Verified live ML prediction evaluated with provenance `Source: Watch / Sensor (CuraWatch-B12)`.
- Verified stale prediction banner appeared when newer readings arrived.

---

## Phase 5: Render Deployment Configuration Checklist

When configuring the backend on [Render](https://dashboard.render.com):
- [x] Push all workspace files to GitHub: `git add . && git commit -m "..." && git push origin main`
- [x] Service Type: **Web Service**
- [x] Root Directory: **`backend`**
- [x] Runtime: **`Python 3`**
- [x] Build Command: `pip install --upgrade pip && pip install -r requirements.txt`
- [x] Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [x] Environment Variable: `PYTHON_VERSION` = `3.11.9`
- [x] Environment Variable: `ALLOWED_ORIGINS` = `https://rudrakshrakeshzodage.github.io,http://localhost:5500`
- [x] Health Check Path: `/health`

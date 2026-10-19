# 🩺 CuraTwin: Real-Time AI Diabetes Digital Twin & Telemetry Dashboard

CuraTwin is a production-grade healthcare digital twin web application that merges **clinical biomarker evaluations** with **real-time wearable sensor streaming** (Continuous Glucose Monitoring CGM, PPG Heart Rate, and IMU step telemetry), **daily lifestyle check-ins**, and **real AI food nutrition scanning** for comprehensive diabetes monitoring and risk prediction.

It connects a responsive, glassmorphic client hosted on **GitHub Pages** to a containerized **FastAPI** machine learning backend deployed on **Render**, featuring automated 24/7 keep-alive execution with zero cold starts.

---

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/scikit_learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="Scikit-Learn" />
  <img src="https://img.shields.io/badge/Groq_AI-F05A28?style=for-the-badge&logo=groq&logoColor=white" alt="Groq AI" />
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" />
  <img src="https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white" alt="GitHub Pages" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/Tests-15%20Passed-brightgreen?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

---

## 📐 Workflow & Telemetry Sequence Logic

```mermaid
sequenceDiagram
    autonumber
    actor User as Patient / Clinician
    participant UI as Frontend UI (index.html)
    participant Adapter as SensorAdapter (Wearable IoT)
    participant Timeline as TimelineManager (7-Stream Digital Twin)
    participant API as FastAPI Backend (Render)
    participant ML as Scikit-Learn Model (diabetes_model.joblib)
    participant AI as Real AI Nutrition Engine (Groq)

    alt Mode A: Manual Clinical Evaluation
        User->>UI: Enter Patient Biomarkers (Age, BMI, HbA1c, Glucose)
        UI->>UI: Client-side Clinical Bounds & BMI Calculation
        User->>UI: Click "Evaluate Diabetes Risk"
        UI->>API: POST /predict (15-feature JSON payload)
        API->>API: Pydantic Validation & Categorical One-Hot Encoding
        API->>ML: predict_proba() & predict()
        ML-->>API: Probability (e.g. 0.0472) & Binary Classification (0)
        API-->>UI: JSON Response with Dual Timestamps & Audit Log
        UI->>Timeline: Log ML Risk Assessment to Timeline
        UI->>User: Render Risk Card, Confidence Gauge & Interpretation

    else Mode B: Continuous Wearable Sensor Streaming
        User->>UI: Select "Watch / Sensor Input" Mode
        User->>Adapter: Click "Start Telemetry Stream"
        loop Every 2s / 4s / 8s Interval
            Adapter->>UI: Emit Telemetry Packet (CGM, Heart Rate, Steps)
            UI->>UI: Append Reading to Real-time SVG Trend Chart
            UI->>Timeline: Ingest Periodic Glucose Reading & Vital Event
        end
        User->>UI: Trigger Model Inference on Latest Digital Twin State
        UI->>API: POST /predict (Synced Baseline + Live Sensor Glucose)
        API->>ML: Evaluate Live Physiological Risk
        ML-->>API: Prediction Result
        API-->>UI: Return Result with Sensor Device ID & Timestamp
        UI->>User: Display Live Provenance Badges (Staleness Monitoring)

    else Mode C: Daily Health Check-in (5 Core Questions)
        User->>UI: Open "Daily Health Check-in" Modal
        User->>UI: Answer Sleep, Medication, Recent Food, Activity & Symptoms
        UI->>Timeline: Commit Daily Questionnaire Events into Chronological Timeline
        Timeline->>UI: Refresh Telemetry Bar (Sleep, Adherence, Symptoms) & Recalculate Scores

    else Mode D: AI Food Nutrition & Calorie Scanner
        User->>UI: Enter Meal Description or Upload Food Photo
        User->>UI: Click "Analyze with AI"
        UI->>API: POST /api/analyze-food (JSON query payload)
        API->>AI: Evaluate Nutritional & Glycemic Kinetics
        AI-->>API: Structured JSON (Calories, Protein, Carbs, Fats, Fiber, GI, Plate Components)
        API-->>UI: Verified Nutritional Breakdown
        UI->>User: Render Macro Rings, Calibrated GI Badge & Ingredient Table
        User->>Timeline: Click "Add Meal & Macros to Digital Twin Timeline"
        Timeline->>UI: Update Daily Nutrition Dashboard & Calorie Rings
    end
```

---

## 📸 Application Preview

<p align="center">
  <img src="images/1.png" alt="CuraTwin Dashboard Live Preview" width="100%" />
</p>

---

## 🛠️ The CuraTwin Architecture & Engineering Highlights

### 1. Dual-Modality Digital Twin Architecture
Unlike static clinical risk forms, CuraTwin bridges **multiple clinical operating modalities**:
- **Manual Clinical Assessment:** Evaluation of primary metabolic biomarkers (Age, Gender, Hypertension, Heart Disease, Smoking History, BMI, HbA1c, and Fasting Glucose).
- **Wearable Sensor Streaming:** Continuous live telemetry tracking via an extensible `SensorAdapter` interface (Continuous Glucose Monitoring CGM, PPG Heart Rate, and IMU step counters).
- **Dynamic SVG Glycemic Trend Chart:** Real-time continuous rolling curve tracking glycemic drift against target therapeutic zones (70–140 mg/dL).
- **Provenance & Staleness Tracking:** Clear visual distinction between **Measurement Timestamp** (when sensor recorded the biomarker) and **Prediction Timestamp** (when inference was performed), with automatic staleness warnings if new sensor data arrives.

---

### 2. 24-Hour Chronological Digital Twin Timeline
CuraTwin integrates all patient physiological and lifestyle streams into an interactive chronological timeline:
- **7-Stream Unified Ingestion:**
  1. 🥗 **Meals:** Caloric and macronutrient breakdowns with glycemic index ratings.
  2. 🏃 **Physical Activity:** Workout types, step counts, active duration, and calories burned.
  3. 😴 **Sleep Patterns:** Duration, sleep quality, and disturbances.
  4. 💊 **Medication Logs:** Prescriptions, dosages, schedules, and adherence verification.
  5. 🩸 **Glucose Telemetry:** Fasting and postprandial CGM readings with clinical target zone tags.
  6. ⚠️ **Unusual Symptoms:** Fatigue, hypoglycemia alerts, and clinical flags.
  7. 🧠 **Model Predictions:** Live scikit-learn diabetes risk probability scores.
- **Interactive Multi-Filter System:** Filter timeline by All, Meals, Activity, Sleep, Medications, Glucose, Symptoms, or Model Predictions.
- **Summary Telemetry Bar:** 6 real-time metrics summarizing Net Calories, Glucose Average, Physical Activity Steps, Medication Adherence, Sleep, and Active Symptoms.

---

### 3. AI Food Nutrition & Calorie Scanner (`POST /api/analyze-food`)
- **Zero Hardcoding:** Uses real generative AI via Groq (`openai/gpt-oss-120b`) to dynamically analyze any food item or plate photo.
- **Comprehensive Diabetic Analysis:**
  - Total Calories (with circular SVG macro ring).
  - Macronutrients: Protein, Total Carbohydrates, Healthy Fats, Dietary Fiber.
  - Calibrated Glycemic Index (`Low GI`, `Moderate GI`, or `High GI`).
  - Itemized plate components with individual calorie and macro breakdowns.
- **Direct Timeline Integration:** One-click commit adds scanned meals and calculated macros directly to the patient's digital twin timeline.

---

### 4. Daily Health Check-in (The 5 Core Clinical Questions)
A dedicated clinical check-in modal guiding patients through 5 essential daily questions:
1. *"How did you sleep last night?"* (Hours and sleep quality).
2. *"Have you taken your prescribed medication?"* (Adherence tracking).
3. *"What did you eat recently?"* (Direct integration with Food Scanner).
4. *"How physically active have you been today?"* (Duration and intensity).
5. *"Are you experiencing any unusual symptoms?"* (Hypoglycemia, dizziness, fatigue).

---

### 5. Machine Learning Pipeline & Model Training

The core diagnostic classification is driven by a supervised machine learning model:

| Property | Details |
|---|---|
| **Training Dataset** | 100,000 healthcare patient records |
| **Target Variable** | `diabetes` (0 = Negative / Non-diabetic, 1 = Positive / Diabetic) |
| **Model Algorithm** | **Logistic Regression** (`LogisticRegression(max_iter=1000, penalty='l2')`) |
| **Artifact Format** | Compressed Scikit-Learn artifact (`diabetes_model.joblib`) |
| **Feature Dimensionality**| Exactly 15 input columns after one-hot categorical expansion |
| **Scaling Strategy** | **Unscaled** — trained directly on raw physiological units (mg/dL, %, kg/m², years) |
| **Inference Output** | Binary classification (`0` or `1`) + Sigmoid probability estimate (0.0 to 1.0) |

#### Exact 15-Feature Order:
```python
[
    'gender_Female', 'gender_Male', 'gender_Other',
    'smoking_history_No Info', 'smoking_history_current', 'smoking_history_ever',
    'smoking_history_former', 'smoking_history_never', 'smoking_history_not current',
    'age', 'hypertension', 'heart_disease', 'bmi', 'HbA1c_level', 'blood_glucose_level'
]
```

---

### 6. 24/7 Cloud Reliability & Zero Cold Starts

Free-tier cloud containers (like Render) automatically spin down after 15 minutes of inactivity. CuraTwin implements an automated keep-alive engine:
- **GitHub Actions Scheduled Cron ([keep_alive.yml](.github/workflows/keep_alive.yml)):** Automatically pings the backend `/health` endpoint every **10 minutes**.
- **Continuous Availability:** Render detects active traffic and never goes to sleep, ensuring instantaneous inference response times 24/7.

---

## 💻 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), Modern CSS3 (Glassmorphism, CSS Custom Properties), HTML5, SVG Trajectory Engine |
| **IoT / Sensor Adapter** | Modular `SensorAdapter` Pattern, `SimulatedSensorAdapter` (CGM, PPG, IMU), `PatientStateManager` |
| **Digital Twin Timeline** | `TimelineManager`, `DailyCheckinManager`, `FoodNutritionScanner` |
| **Backend & API** | Python 3.11, FastAPI, Uvicorn (ASGI), Pydantic v2 (Strict clinical range validation) |
| **Machine Learning & AI** | Scikit-Learn, NumPy, Pandas, Joblib, Groq AI API (`openai/gpt-oss-120b`) |
| **Cloud Hosting** | **GitHub Pages** (Frontend) & **Render** (FastAPI Backend Container) |
| **Automation** | GitHub Actions (24/7 Keep-Alive Workflow & Health Monitoring) |

---

## 🚀 Quickstart & Local Development

### 1. Run FastAPI Backend Locally:
```bash
python -m venv venv
venv\Scripts\activate            # On Windows (or source venv/bin/activate on Linux/Mac)
pip install -r backend/requirements.txt

# Set your Groq API key for AI food nutrition analysis
set GROQ_API_KEY=your_groq_api_key_here     # Windows CMD
$env:GROQ_API_KEY="your_groq_api_key_here"  # Windows PowerShell
export GROQ_API_KEY="your_groq_api_key_here" # Linux/macOS

uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 2. Run Frontend Dashboard:
```bash
python -m http.server 5173
```
Open `http://localhost:5173` in any modern web browser.

### 3. Run Automated Tests:
```bash
pytest tests/test_api.py -v
```
All **15 automated tests** validate clinical input range constraints, one-hot vector alignment, mathematical model parity, sensor telemetry ingestion, and food nutrition analysis endpoints.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

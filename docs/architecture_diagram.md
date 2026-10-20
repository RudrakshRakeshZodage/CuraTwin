# CuraTwin Architecture Diagram Specifications

This document outlines the detailed system architecture, component breakdown, and communication protocols for **CuraTwin**.

A publication-ready vector PDF version of this architecture diagram is available at:
**[docs/CuraTwin_Architecture_Diagram.pdf](CuraTwin_Architecture_Diagram.pdf)**

---

## 1. High-Level Architectural Flow

```mermaid
graph TD
    subgraph DataLayer["1. Data Ingestion & Synthetic Generation"]
        D1["Synthea Longitudinal EHR Generator"] --> D2["Patient Demographics, Encounters, Conditions & Labs"]
        D3["Synthetic CGM Stream Engine"] --> D4["Realistic 5-min Trajectories & Meal Responses"]
        D2 & D4 --> D5["Strict Disjoint Patient Split (Train / Held-Out Test)"]
    end

    subgraph MLLayer["2. Dual Machine Learning Pipeline"]
        D5 --> M1["Model A: curatwin_glucose_model.joblib (XGBoost)"]
        D5 --> M2["Model B: curatwin_cardiovascular_model.joblib (Balanced RF)"]
        M1 --> M3["2-Hour Lookahead Excursion Forecast (>180 mg/dL)"]
        M2 --> M4["365-Day Incident Event Risk (Youden Threshold: 0.0403)"]
    end

    subgraph APILayer["3. Production Backend (FastAPI / Python 3.13)"]
        M1 & M2 --> API["FastAPI Async Engine (backend/main.py)"]
        API --> End1["POST /api/predict/glucose-excursion"]
        API --> End2["POST /api/predict/cardiovascular-risk"]
        API --> End3["GET /health (Dual Model Readiness Probe)"]
    end

    subgraph ClientLayer["4. Minimal Clinical Client (HTML5 / Vanilla CSS / ES6)"]
        Client["Browser Dashboard"] --> TabA["Tab 1: Glucose Excursion Twin (Model A)"]
        Client --> TabB["Tab 2: Cardiovascular Risk Twin (Model B)"]
        TabA --> Sensor["SensorAdapter (Continuous CGM Telemetry)"]
        TabA & TabB --> Card["Dynamic Risk Outcome & Clinical Action Card"]
    end

    End1 & End2 <--> Client
```

---

## 2. Component Directory Structure

```text
CuraTwin/
├── backend/
│   ├── main.py                  # FastAPI server & route handlers
│   ├── model_loader.py          # Dual model loaders & matrix builders
│   ├── schemas.py               # Pydantic v2 validation contracts
│   ├── requirements.txt         # Dependencies (FastAPI, XGBoost, scikit-learn)
│   └── models/
│       ├── curatwin_glucose_model.joblib        # Model A artifact
│       └── curatwin_cardiovascular_model.joblib # Model B artifact
├── dataset/
│   ├── pipeline.py              # Synthetic generation & feature engineering
│   ├── train_models.py          # Benchmark & model training script
│   └── test_pipeline.py         # Pipeline zero-leakage test suite
├── docs/
│   ├── CuraTwin_Architecture_Diagram.pdf # Publication PDF diagram
│   ├── CuraTwin_Project_Presentation.pdf # Presentation slide deck PDF
│   ├── architecture_diagram.md  # Architectural specification
│   └── presentation_outcomes.md # Slide outline & project outcomes
├── tests/
│   └── test_api.py              # Automated 18-test backend validation suite
├── index.html                   # Minimal clinical digital-twin UI
├── style.css                    # Clean, accessible styling
├── app.js                       # Frontend controller & prediction ingestion
├── sensorAdapter.js             # IoT wearable sensor adapter
└── README.md                    # Project documentation & checklist
```

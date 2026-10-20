# CuraTwin Dataset Card

## Summary
- **Dataset Names:** `curatwin_diabetes_glucose.csv`, `curatwin_cardiovascular_risk.csv`
- **Domain:** Clinical Healthcare, Digital Twins, Machine Learning for Chronic Disease.
- **Primary Tasks:**
  1. Short-term glucose excursion prediction (2-hour lookahead).
  2. First-event 1-year acute myocardial infarction or stroke risk prediction.

## Limitations of Synthetic Data
- **Synthetic EHR Records:** Originates from Synthea simulations. While demographic correlations and incidence distributions match clinical epidemiology, individual records do not represent real human subjects.
- **Simulated CGM & Wearable Streams:** Generated using biologically grounded physiological kinetics (two-compartment oral absorption model and diurnal biorhythms). These measurements should not be cited as real clinical device sensor trials.
- **Intended Use:** Algorithm prototyping, digital twin feature engineering benchmark, and educational ML pipeline validation.

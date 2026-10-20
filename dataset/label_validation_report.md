# CuraTwin Clinical Label Validation & Censoring Report

---

## 1. Target Definition & Logic Validation

### Task 1: Short-Term Glucose Excursion (`glucose_excursion_next_2h`)
- **Clinical Rationale:** Acute postprandial or unmitigated hyperglycemia (>180 mg/dL) induces endothelial oxidative stress, glycation, and autonomic imbalance. Predicting excursions 2 hours ahead enables proactive behavioral intervention (e.g. post-meal walking) or micro-bolus insulin delivery.
- **Target Logic:**
  - `1`: At least one valid CGM reading in $(t, t+120\text{ minutes}]$ exceeds $180.0\text{ mg/dL}$.
  - `0`: Valid CGM readings span the entire 2-hour window and all readings remain $\le 180.0\text{ mg/dL}$.
  - `null`: Fewer than 20 readings (out of 24 expected 5-min intervals) are present in the future window.
- **Observed Prevalence:** 42.52% positive excursion rate.

### Task 2: 365-Day Cardiovascular Event (`cv_event_next_365d`)
- **Clinical Rationale:** Identifies high-risk individuals without existing documented myocardial infarction or stroke who require aggressive statin/antihypertensive optimization or intensive digital-twin surveillance.
- **Target Logic:**
  - `1`: Documented acute event matching qualifying SNOMED codes (22298006, 401314000, 401303003, 230690007) in $(t_0, t_0 + 365\text{ days}]$.
  - `0`: Confirmed follow-up $\ge 365$ days with no qualifying event.
  - `null`: Patient follow-up terminated before 365 days without documented event (strictly censored to avoid misclassifying unobserved events as negative).
- **Censoring Rate:** 5.89% censored due to truncated EHR simulation timeline.

---

## 2. Boundary Cases Tested

1. **Event Preceding Index Date:** Excluded from first-event prediction cohort.
2. **Event on Exact Index Date:** Treated as part of baseline medical history, not future incident event.
3. **Event Exactly on Day 365:** Included as positive case (`cv_event_next_365d = 1`).
4. **Loss to Follow-up on Day 200 without Event:** Assigned `null` (not 0).

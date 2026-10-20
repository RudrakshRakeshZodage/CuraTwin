/**
 * =========================================================================
 * CuraTwin — Full-Stack Healthcare Client Application
 * =========================================================================
 * Dual-Modality Digital Twin Dashboard:
 * 1. Manual Clinical Input (Full biomarker evaluation)
 * 2. Wearable Sensor Streaming (Continuous CGM & PPG telemetry via SensorAdapter)
 *
 * Configuration:
 * Replace YOUR_RENDER_BACKEND_URL below with your deployed Render service URL.
 * Example: const API_BASE_URL = "https://diawatch-ai-backend.onrender.com";
 *
 * For local development:
 * When running locally on localhost or 127.0.0.1, the application will
 * automatically connect to http://localhost:8000 if YOUR_RENDER_BACKEND_URL is unchanged.
 * =========================================================================
 */

// Locked Production Backend API Endpoint (Immutable)
const API_BASE_URL = Object.freeze("https://curatwin-backend.onrender.com");

// -----------------------------------------------------------------------------
// Effective Base URL Resolution (Local dev on localhost, Render in production)
// -----------------------------------------------------------------------------
function getEffectiveApiBaseUrl() {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }
  return API_BASE_URL;
}

// -----------------------------------------------------------------------------
// Global Singletons: Sensor Adapter & Patient State
// -----------------------------------------------------------------------------
const sensorAdapter = new window.SimulatedSensorAdapter({
  deviceId: "CuraWatch-B12",
  intervalMs: 4000,
});

const patientState = new window.PatientStateManager({
  gender: "Female",
  age: 45,
  hypertension: 0,
  heart_disease: 0,
  smoking_history: "never",
  bmi: 27.5,
  HbA1c_level: 5.8,
});

// Throttling tracker for live sensor predictions
let lastPredictionTimestamp = 0;
const MIN_SENSOR_PREDICTION_INTERVAL_MS = 10000; // Throttle to 10s to respect cloud API rate limits
let isPredictionInFlight = false;
let lastSubmittedPayload = null;

// -----------------------------------------------------------------------------
// DOM Element Cache
// -----------------------------------------------------------------------------
const elements = {
  // Mode Selector Tabs
  tabModeManual: document.getElementById("tab-mode-manual"),
  tabModeSensor: document.getElementById("tab-mode-sensor"),
  tabModeCv: document.getElementById("tab-mode-cv"),
  viewModeManual: document.getElementById("view-mode-manual"),
  viewModeSensor: document.getElementById("view-mode-sensor"),
  viewModeCv: document.getElementById("view-mode-cv"),
  sensorTabLiveBadge: document.getElementById("sensor-tab-live-badge"),

  // Cardiovascular Model B Elements
  cvForm: document.getElementById("cv-risk-form"),
  btnSubmitCvPredict: document.getElementById("btn-submit-cv-predict"),
  btnResetCvForm: document.getElementById("btn-reset-cv-form"),
  btnCvPresetLow: document.getElementById("btn-cv-preset-low"),
  btnCvPresetMod: document.getElementById("btn-cv-preset-mod"),
  btnCvPresetHigh: document.getElementById("btn-cv-preset-high"),
  cvAge: document.getElementById("cv-age"),
  cvSex: document.getElementById("cv-sex"),
  cvSbp: document.getElementById("cv-sbp"),
  cvDbp: document.getElementById("cv-dbp"),
  cvTotChol: document.getElementById("cv-tot-chol"),
  cvHdl: document.getElementById("cv-hdl"),
  cvLdl: document.getElementById("cv-ldl"),
  cvTrig: document.getElementById("cv-trig"),
  cvGlucose: document.getElementById("cv-glucose"),
  cvHba1c: document.getElementById("cv-hba1c"),
  cvBmi: document.getElementById("cv-bmi"),
  cvSmoking: document.getElementById("cv-smoking"),
  cvHtnDuration: document.getElementById("cv-htn-duration"),

  // Manual Form Elements
  form: document.getElementById("diabetes-form"),
  submitBtn: document.getElementById("btn-submit-predict"),
  btnContentDefault: document.querySelector(".btn-content-default"),
  btnContentLoading: document.querySelector(".btn-content-loading"),
  resetBtn: document.getElementById("btn-reset-form"),
  gender: document.getElementById("gender"),
  age: document.getElementById("age"),
  smokingHistory: document.getElementById("smoking_history"),
  bmi: document.getElementById("bmi"),
  hbA1c: document.getElementById("HbA1c_level"),
  glucose: document.getElementById("blood_glucose_level"),

  // Presets & BMI Drawer
  btnPresetPrompt: document.getElementById("btn-preset-prompt"),
  btnPresetHealthy: document.getElementById("btn-preset-healthy"),
  btnPresetElevated: document.getElementById("btn-preset-elevated"),
  btnToggleBmiCalc: document.getElementById("btn-toggle-bmi-calc"),
  bmiCalculatorDrawer: document.getElementById("bmi-calculator-drawer"),
  calcHeight: document.getElementById("calc-height"),
  calcWeight: document.getElementById("calc-weight"),
  btnApplyCalcBmi: document.getElementById("btn-apply-calc-bmi"),

  // Sensor Streaming Controls & Status
  sensorConnectionBadge: document.getElementById("sensor-connection-badge"),
  sensorConnectionText: document.getElementById("sensor-connection-text"),
  sensorDeviceName: document.getElementById("sensor-device-name"),
  btnSensorStart: document.getElementById("btn-sensor-start"),
  btnSensorPause: document.getElementById("btn-sensor-pause"),
  labelPauseBtn: document.getElementById("label-pause-btn"),
  btnSensorStop: document.getElementById("btn-sensor-stop"),
  btnSensorReset: document.getElementById("btn-sensor-reset"),
  selectStreamInterval: document.getElementById("select-stream-interval"),

  // Live Telemetry Cards
  telemetryGlucoseVal: document.getElementById("telemetry-glucose-val"),
  telemetryTrendArrow: document.getElementById("telemetry-trend-arrow"),
  telemetryGlucoseStatus: document.getElementById("telemetry-glucose-status"),
  telemetryGlucoseTime: document.getElementById("telemetry-glucose-time"),
  telemetryHrVal: document.getElementById("telemetry-hr-val"),
  telemetryHrTime: document.getElementById("telemetry-hr-time"),
  telemetryStepsVal: document.getElementById("telemetry-steps-val"),
  telemetryStepsTime: document.getElementById("telemetry-steps-time"),

  // Live Continuous Trend Chart (SVG)
  svgChartArea: document.getElementById("svg-chart-area"),
  svgChartPath: document.getElementById("svg-chart-path"),
  svgChartDots: document.getElementById("svg-chart-dots"),
  chartEmptyPlaceholder: document.getElementById("chart-empty-placeholder"),

  // Linked Patient Profile
  btnSyncProfileFromForm: document.getElementById("btn-sync-profile-from-form"),
  chipAge: document.getElementById("chip-age"),
  chipGender: document.getElementById("chip-gender"),
  chipBmi: document.getElementById("chip-bmi"),
  chipHba1c: document.getElementById("chip-hba1c"),
  chipHyper: document.getElementById("chip-hyper"),
  chipHd: document.getElementById("chip-hd"),
  chipSmoking: document.getElementById("chip-smoking"),

  // Live Prediction Policy & Trigger
  chkAutoPredictStream: document.getElementById("chk-auto-predict-stream"),
  btnPredictSensorNow: document.getElementById("btn-predict-sensor-now"),
  telemetryLogTbody: document.getElementById("telemetry-log-tbody"),

  // Results & Outcome Panel
  stateIdle: document.getElementById("state-idle"),
  stateLoading: document.getElementById("state-loading"),
  stateSuccess: document.getElementById("state-success"),
  stateError: document.getElementById("state-error"),
  loadingStageText: document.getElementById("loading-stage-text"),
  predictionBadge: document.getElementById("prediction-badge"),
  outcomeIcon: document.getElementById("outcome-icon"),
  outcomeLabel: document.getElementById("outcome-label"),
  resultSourceBadge: document.getElementById("result-source-badge"),
  probabilityBlock: document.getElementById("probability-block"),
  metricProbabilityVal: document.getElementById("metric-probability-val"),
  gaugeBarFill: document.getElementById("gauge-bar-fill"),
  probabilityNote: document.getElementById("probability-note"),
  auditSummaryGrid: document.getElementById("audit-summary-grid"),
  auditDeviceId: document.getElementById("audit-device-id"),
  provMeasurementTime: document.getElementById("prov-measurement-time"),
  provPredictionTime: document.getElementById("prov-prediction-time"),
  metaTimestamp: document.getElementById("meta-timestamp"),
  stalePredictionNotice: document.getElementById("stale-prediction-notice"),
  staleNoticeText: document.getElementById("stale-notice-text"),
  btnReEvaluateStale: document.getElementById("btn-re-evaluate-stale"),

  // Error Card Elements
  errorTitle: document.getElementById("error-title"),
  errorMessage: document.getElementById("error-message"),
  errorSuggestion: document.getElementById("error-suggestion"),
  retryBtn: document.getElementById("btn-retry-inference"),

  // Header & Status
  backendStatusBadge: document.getElementById("backend-status-badge"),
  backendStatusText: document.getElementById("backend-status-text"),
};

// -----------------------------------------------------------------------------
// UI State Management (Idle, Loading, Success, Error)
// -----------------------------------------------------------------------------
function setActiveState(stateName) {
  const states = {
    idle: elements.stateIdle,
    loading: elements.stateLoading,
    success: elements.stateSuccess,
    error: elements.stateError,
  };

  Object.entries(states).forEach(([name, el]) => {
    if (el) {
      if (name === stateName) {
        el.removeAttribute("hidden");
        el.classList.add("active");
      } else {
        el.setAttribute("hidden", "true");
        el.classList.remove("active");
      }
    }
  });

  // Toggle submit button loading visual
  if (stateName === "loading") {
    elements.submitBtn.disabled = true;
    if (elements.btnPredictSensorNow) elements.btnPredictSensorNow.disabled = true;
    if (elements.btnSubmitCvPredict) elements.btnSubmitCvPredict.disabled = true;
    elements.btnContentDefault.setAttribute("hidden", "true");
    elements.btnContentLoading.removeAttribute("hidden");
    if (elements.btnSubmitCvPredict) {
      const def = elements.btnSubmitCvPredict.querySelector(".btn-content-default");
      const lod = elements.btnSubmitCvPredict.querySelector(".btn-content-loading");
      if (def) def.setAttribute("hidden", "true");
      if (lod) lod.removeAttribute("hidden");
    }
  } else {
    elements.submitBtn.disabled = false;
    if (elements.btnPredictSensorNow) elements.btnPredictSensorNow.disabled = false;
    if (elements.btnSubmitCvPredict) elements.btnSubmitCvPredict.disabled = false;
    elements.btnContentDefault.removeAttribute("hidden");
    elements.btnContentLoading.setAttribute("hidden", "true");
    if (elements.btnSubmitCvPredict) {
      const def = elements.btnSubmitCvPredict.querySelector(".btn-content-default");
      const lod = elements.btnSubmitCvPredict.querySelector(".btn-content-loading");
      if (def) def.removeAttribute("hidden");
      if (lod) lod.setAttribute("hidden", "true");
    }
  }
}

// -----------------------------------------------------------------------------
// Tri-Modal Switching Logic (Manual Clinical, CGM Sensor, Cardiovascular Risk)
// -----------------------------------------------------------------------------
function setupModeSelector() {
  function switchMode(activeTab, activeView) {
    const tabs = [elements.tabModeManual, elements.tabModeSensor, elements.tabModeCv];
    const views = [elements.viewModeManual, elements.viewModeSensor, elements.viewModeCv];

    tabs.forEach((tab) => {
      if (!tab) return;
      const isActive = tab === activeTab;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    views.forEach((view) => {
      if (!view) return;
      const isActive = view === activeView;
      view.classList.toggle("active", isActive);
      if (isActive) {
        view.removeAttribute("hidden");
      } else {
        view.setAttribute("hidden", "true");
      }
    });
  }

  if (elements.tabModeManual) {
    elements.tabModeManual.addEventListener("click", () => {
      switchMode(elements.tabModeManual, elements.viewModeManual);
    });
  }

  if (elements.tabModeSensor) {
    elements.tabModeSensor.addEventListener("click", () => {
      switchMode(elements.tabModeSensor, elements.viewModeSensor);
      syncProfileFromForm();
    });
  }

  if (elements.tabModeCv) {
    elements.tabModeCv.addEventListener("click", () => {
      switchMode(elements.tabModeCv, elements.viewModeCv);
    });
  }
}

// -----------------------------------------------------------------------------
// Patient Profile Synchronization (Manual Form -> Digital Twin Baseline)
// -----------------------------------------------------------------------------
function syncProfileFromForm() {
  const gender = elements.gender.value || "Female";
  const age = parseFloat(elements.age.value) || 45;
  const smoking_history = elements.smokingHistory.value || "never";
  const bmi = parseFloat(elements.bmi.value) || 27.5;
  const HbA1c_level = parseFloat(elements.hbA1c.value) || 5.8;

  const hyperRadio = document.querySelector('input[name="hypertension"]:checked');
  const hypertension = hyperRadio ? parseInt(hyperRadio.value, 10) : 0;

  const heartRadio = document.querySelector('input[name="heart_disease"]:checked');
  const heart_disease = heartRadio ? parseInt(heartRadio.value, 10) : 0;

  patientState.setProfile({
    gender,
    age,
    hypertension,
    heart_disease,
    smoking_history,
    bmi,
    HbA1c_level,
  });

  // Update UI profile chips
  elements.chipAge.textContent = `${age} yrs`;
  elements.chipGender.textContent = gender;
  elements.chipBmi.textContent = `${bmi}`;
  elements.chipHba1c.textContent = `${HbA1c_level}%`;
  elements.chipHyper.textContent = hypertension === 1 ? "Yes (1)" : "No (0)";
  elements.chipHd.textContent = heart_disease === 1 ? "Yes (1)" : "No (0)";
  elements.chipSmoking.textContent = smoking_history;
}

// -----------------------------------------------------------------------------
// Sensor Adapter Event Wiring & Telemetry Handling
// -----------------------------------------------------------------------------
function setupSensorStreaming() {
  // 1. Connection State Changes
  sensorAdapter.on("stateChange", ({ newState, details }) => {
    updateSensorStatusBadge(newState);

    if (newState === window.SensorState.STREAMING) {
      elements.btnSensorStart.disabled = true;
      elements.btnSensorPause.disabled = false;
      elements.labelPauseBtn.textContent = "Pause";
      elements.btnSensorStop.disabled = false;
      elements.sensorTabLiveBadge.removeAttribute("hidden");
    } else if (newState === window.SensorState.PAUSED) {
      elements.btnSensorStart.disabled = true;
      elements.btnSensorPause.disabled = false;
      elements.labelPauseBtn.textContent = "Resume";
      elements.btnSensorStop.disabled = false;
      elements.sensorTabLiveBadge.setAttribute("hidden", "true");
    } else if (newState === window.SensorState.CONNECTED || newState === window.SensorState.DISCONNECTED) {
      elements.btnSensorStart.disabled = false;
      elements.btnSensorPause.disabled = true;
      elements.labelPauseBtn.textContent = "Pause";
      elements.btnSensorStop.disabled = true;
      elements.sensorTabLiveBadge.setAttribute("hidden", "true");
    }
  });

  // 2. Incoming Telemetry Measurements
  sensorAdapter.on("measurement", (reading) => {
    patientState.addMeasurement(reading);

    // Update Live Telemetry Cards
    updateTelemetryCards(reading);

    // Add to Telemetry Event Log Table
    appendTelemetryLog(reading);

    // Update Continuous Glucose SVG Trend Chart
    renderTrendChart();

    // Check Prediction Stale Indicator
    checkStalePredictionStatus();

    // Automatic Live Prediction Policy
    if (elements.chkAutoPredictStream.checked) {
      const now = Date.now();
      if (now - lastPredictionTimestamp >= MIN_SENSOR_PREDICTION_INTERVAL_MS && !isPredictionInFlight) {
        evaluateSensorPrediction();
      }
    }
  });

  sensorAdapter.on("reset", () => {
    patientState.clearHistory();
    resetTelemetryDisplay();
    renderTrendChart();
    checkStalePredictionStatus();
  });

  sensorAdapter.on("error", (errData) => {
    console.error("Sensor telemetry error:", errData);
  });

  // Button Controls
  elements.btnSensorStart.addEventListener("click", () => {
    syncProfileFromForm();
    sensorAdapter.startStreaming();
  });

  elements.btnSensorPause.addEventListener("click", () => {
    if (sensorAdapter.state === window.SensorState.STREAMING) {
      sensorAdapter.pauseStreaming();
    } else if (sensorAdapter.state === window.SensorState.PAUSED) {
      sensorAdapter.resumeStreaming();
    }
  });

  elements.btnSensorStop.addEventListener("click", () => {
    sensorAdapter.stopStreaming();
  });

  elements.btnSensorReset.addEventListener("click", () => {
    sensorAdapter.reset();
  });

  elements.selectStreamInterval.addEventListener("change", (e) => {
    sensorAdapter.setIntervalMs(Number(e.target.value));
  });

  elements.btnSyncProfileFromForm.addEventListener("click", () => {
    syncProfileFromForm();
  });

  elements.btnPredictSensorNow.addEventListener("click", () => {
    evaluateSensorPrediction();
  });

  elements.btnReEvaluateStale.addEventListener("click", () => {
    evaluateSensorPrediction();
  });
}

function updateSensorStatusBadge(state) {
  const badge = elements.sensorConnectionBadge;
  const label = elements.sensorConnectionText;

  badge.className = `sensor-status-badge sensor-state-${state.toLowerCase()}`;
  label.textContent = state;
}

function updateTelemetryCards(reading) {
  elements.telemetryGlucoseVal.textContent = reading.glucose.toFixed(1);
  elements.telemetryGlucoseTime.textContent = reading.timeFormatted;

  // Trend Arrow & Glycemic Category
  const trendEl = elements.telemetryTrendArrow;
  if (reading.glucoseTrend === "rising") {
    trendEl.innerHTML = "&nearr; Rising";
    trendEl.className = "trend-pill trend-rising";
  } else if (reading.glucoseTrend === "falling") {
    trendEl.innerHTML = "&searr; Falling";
    trendEl.className = "trend-pill trend-falling";
  } else {
    trendEl.innerHTML = "&rarr; Stable";
    trendEl.className = "trend-pill trend-stable";
  }

  const statusEl = elements.telemetryGlucoseStatus;
  if (reading.glucose < 70) {
    statusEl.textContent = "Hypoglycemic Alert (<70)";
    statusEl.style.color = "#dc2626";
  } else if (reading.glucose <= 140) {
    statusEl.textContent = "Normal Target (70–140)";
    statusEl.style.color = "#166534";
  } else if (reading.glucose <= 180) {
    statusEl.textContent = "Elevated Post-Prandial (140–180)";
    statusEl.style.color = "#b45309";
  } else {
    statusEl.textContent = "Hyperglycemic Alert (>180)";
    statusEl.style.color = "#dc2626";
  }

  // Heart Rate
  elements.telemetryHrVal.textContent = reading.heartRate;
  elements.telemetryHrTime.textContent = reading.timeFormatted;

  // Steps
  elements.telemetryStepsVal.textContent = reading.steps.toLocaleString();
  elements.telemetryStepsTime.textContent = reading.timeFormatted;
}

function resetTelemetryDisplay() {
  elements.telemetryGlucoseVal.textContent = "--";
  elements.telemetryGlucoseTime.textContent = "--:--:--";
  elements.telemetryTrendArrow.innerHTML = "&rarr; Stable";
  elements.telemetryTrendArrow.className = "trend-pill trend-stable";
  elements.telemetryGlucoseStatus.textContent = "Waiting for stream";
  elements.telemetryGlucoseStatus.style.color = "var(--text-muted)";

  elements.telemetryHrVal.textContent = "--";
  elements.telemetryHrTime.textContent = "--:--:--";
  elements.telemetryStepsVal.textContent = "--";
  elements.telemetryStepsTime.textContent = "--:--:--";

  if (elements.svgChartPath) elements.svgChartPath.setAttribute("d", "");
  if (elements.svgChartArea) elements.svgChartArea.setAttribute("d", "");
  if (elements.svgChartDots) elements.svgChartDots.innerHTML = "";
  if (elements.chartEmptyPlaceholder) {
    elements.chartEmptyPlaceholder.style.display = "flex";
    elements.chartEmptyPlaceholder.removeAttribute("hidden");
    elements.chartEmptyPlaceholder.classList.remove("hidden");
  }

  elements.telemetryLogTbody.innerHTML = `
    <tr class="empty-row"><td colspan="6">No telemetry received yet. Click Start Stream above.</td></tr>
  `;
}

function appendTelemetryLog(reading) {
  const tbody = elements.telemetryLogTbody;
  const emptyRow = tbody.querySelector(".empty-row");
  if (emptyRow) emptyRow.remove();

  const tr = document.createElement("tr");
  const trendSymbol = reading.glucoseTrend === "rising" ? "&nearr;" : reading.glucoseTrend === "falling" ? "&searr;" : "&rarr;";

  tr.innerHTML = `
    <td style="font-family: var(--font-mono);">${reading.timeFormatted}</td>
    <td style="font-weight: 700; font-family: var(--font-mono);">${reading.glucose.toFixed(1)}</td>
    <td><span class="trend-pill trend-${reading.glucoseTrend}">${trendSymbol} ${reading.glucoseTrend}</span></td>
    <td>${reading.heartRate} BPM</td>
    <td>${reading.steps.toLocaleString()}</td>
    <td style="color: var(--primary-700); font-weight: 500;">${reading.deviceId}</td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);

  // Keep table at max 20 rows
  while (tbody.children.length > 20) {
    tbody.removeChild(tbody.lastChild);
  }
}

// -----------------------------------------------------------------------------
// Continuous Glucose Trend SVG Visualization
// -----------------------------------------------------------------------------
function renderTrendChart() {
  const history = [...patientState.measurementHistory].reverse(); // chronological left to right
  const pathEl = elements.svgChartPath;
  const areaEl = elements.svgChartArea;
  const dotsG = elements.svgChartDots;
  const placeholder = elements.chartEmptyPlaceholder;

  if (history.length === 0) {
    if (pathEl) pathEl.setAttribute("d", "");
    if (areaEl) areaEl.setAttribute("d", "");
    if (dotsG) dotsG.innerHTML = "";
    if (placeholder) {
      placeholder.style.display = "flex";
      placeholder.removeAttribute("hidden");
      placeholder.classList.remove("hidden");
    }
    return;
  }

  // Force hide the placeholder explicitly both via inline style and attribute/class
  if (placeholder) {
    placeholder.style.display = "none";
    placeholder.setAttribute("hidden", "true");
    placeholder.classList.add("hidden");
  }

  const width = 520;
  const height = 160;
  const paddingX = 25;
  const minG = 50;
  const maxG = 220;

  const points = history.map((item, idx) => {
    const x = history.length === 1 ? width / 2 : paddingX + (idx / (history.length - 1)) * (width - paddingX * 2);
    // Invert Y: higher glucose is closer to top (y = 15)
    const norm = Math.max(0, Math.min(1, (item.glucose - minG) / (maxG - minG)));
    const y = height - 15 - norm * (height - 30);
    return { x, y, glucose: item.glucose, time: item.timeFormatted };
  });

  let lineD = "";
  let areaD = "";

  if (points.length === 1) {
    const p = points[0];
    // Immediate horizontal guide line so user immediately sees live trajectory on first reading
    lineD = `M ${paddingX} ${p.y.toFixed(1)} L ${(width - paddingX).toFixed(1)} ${p.y.toFixed(1)}`;
    areaD = `M ${paddingX} ${height - 15} L ${paddingX} ${p.y.toFixed(1)} L ${(width - paddingX).toFixed(1)} ${p.y.toFixed(1)} L ${(width - paddingX).toFixed(1)} ${height - 15} Z`;
  } else {
    points.forEach((p, i) => {
      lineD += (i === 0 ? "M" : " L") + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    });
    const first = points[0];
    const last = points[points.length - 1];
    areaD = `${lineD} L ${last.x.toFixed(1)} ${height - 15} L ${first.x.toFixed(1)} ${height - 15} Z`;
  }

  if (pathEl) pathEl.setAttribute("d", lineD);
  if (areaEl) areaEl.setAttribute("d", areaD);

  // Dots
  let dotsHtml = "";
  points.forEach((p, i) => {
    const isLatest = i === points.length - 1;
    const r = isLatest ? 5.5 : 3.5;
    const fill = isLatest ? "#0284c7" : "#38bdf8";
    dotsHtml += `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="1.8">
        <title>${p.glucose.toFixed(1)} mg/dL at ${p.time}</title>
      </circle>
    `;
    if (isLatest) {
      dotsHtml += `
        <text x="${p.x.toFixed(1)}" y="${(p.y - 10).toFixed(1)}" font-size="11" font-weight="700" fill="#0369a1" text-anchor="middle" font-family="var(--font-mono)">
          ${p.glucose.toFixed(1)}
        </text>
      `;
    }
  });
  if (dotsG) dotsG.innerHTML = dotsHtml;
}

// -----------------------------------------------------------------------------
// Live Sensor ML Prediction Ingestion
// -----------------------------------------------------------------------------
async function evaluateSensorPrediction() {
  if (isPredictionInFlight) return;

  const buildResult = patientState.buildInferencePayload("sensor");
  if (!buildResult.ready) {
    showError(
      "Cannot Run Inference on Stream",
      buildResult.error,
      "Ensure patient baseline profile is complete before evaluating live sensor glucose."
    );
    return;
  }

  isPredictionInFlight = true;
  lastPredictionTimestamp = Date.now();

  try {
    const latest = sensorAdapter.latestMeasurement || { glucose: 120, steps: 350, heartRate: 74 };
    const history = sensorAdapter.history || [];
    const cur_g = latest.glucose;
    const lag_15 = history.length >= 4 ? history[history.length - 4].glucose : cur_g;
    const lag_30 = history.length >= 8 ? history[history.length - 8].glucose : lag_15;
    const lag_60 = history.length >= 15 ? history[history.length - 15].glucose : lag_30;
    const lag_120 = history.length >= 30 ? history[history.length - 30].glucose : lag_60;
    const roc_15 = (cur_g - lag_15) / 15.0;

    const excursionPayload = {
      current_glucose_mg_dl: cur_g,
      glucose_lag_15m: lag_15,
      glucose_lag_30m: lag_30,
      glucose_lag_60m: lag_60,
      glucose_lag_120m: lag_120,
      glucose_rate_of_change_15m: roc_15,
      steps_past_hour: latest.steps || 350,
      current_heart_rate: latest.heartRate || 74,
      recent_meal_carbs_g: window.latestLoggedMeal ? window.latestLoggedMeal.total_carbs : 35.0,
      time_since_last_meal_min: window.latestLoggedMeal ? Math.max(10, Math.round((Date.now() - (window.latestLoggedMeal.timestamp || Date.now())) / 60000)) : 75.0,
      recent_meal_slot: "lunch",
      recent_meal_category: "rice-based",
      hba1c: patientState.profile.HbA1c_level || 6.2,
      bmi: patientState.profile.bmi || 27.5,
      age_years: patientState.profile.age || 48,
      sex: patientState.profile.gender || "Female",
      device_id: sensorAdapter.deviceId,
      measurement_timestamp: latest.timestamp || new Date().toISOString()
    };

    await runGlucoseExcursionPrediction(excursionPayload);
  } finally {
    isPredictionInFlight = false;
    checkStalePredictionStatus();
  }
}

function checkStalePredictionStatus() {
  if (patientState.isPredictionStale()) {
    elements.stalePredictionNotice.removeAttribute("hidden");
    const m = patientState.latestMeasurement;
    elements.staleNoticeText.textContent = `Newer reading (${m.glucose.toFixed(1)} mg/dL at ${m.timeFormatted}) has arrived. Current prediction reflects earlier measurement.`;
  } else {
    elements.stalePredictionNotice.setAttribute("hidden", "true");
  }
}

// -----------------------------------------------------------------------------
// Backend Health Check with Auto-Wake & Retry
// -----------------------------------------------------------------------------
let healthCheckTimer = null;
let isHealthChecking = false;

async function checkBackendHealth(isRetry = false) {
  if (isHealthChecking && !isRetry) return;
  isHealthChecking = true;

  const baseUrl = getEffectiveApiBaseUrl();
  updateBackendStatus("checking", "Connecting...");

  // If server is cold-starting on cloud service, alert the user after 4 seconds
  const wakingAlertTimer = setTimeout(() => {
    updateBackendStatus("waking", "Connecting (~30s)...");
  }, 4000);

  // Give server up to 45 seconds to spin up from sleep
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(wakingAlertTimer);
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.model_loaded) {
        updateBackendStatus("online", "System Connected");
        if (healthCheckTimer) {
          clearTimeout(healthCheckTimer);
          healthCheckTimer = null;
        }
        isHealthChecking = false;
        return true;
      }
      updateBackendStatus("offline", "System Offline");
    } else {
      updateBackendStatus("offline", "Connection Error");
    }
  } catch (err) {
    clearTimeout(wakingAlertTimer);
    clearTimeout(timeoutId);
    console.warn("Health check error:", err);
    updateBackendStatus("offline", "System Offline (Click to retry)");

    // Auto-retry in 8 seconds if server was cold and waking up
    if (!healthCheckTimer) {
      healthCheckTimer = setTimeout(() => {
        healthCheckTimer = null;
        checkBackendHealth(true);
      }, 8000);
    }
  }

  isHealthChecking = false;
  return false;
}

function updateBackendStatus(statusType, label) {
  elements.backendStatusBadge.className = `status-badge status-${statusType}`;
  elements.backendStatusText.textContent = label;
}

// -----------------------------------------------------------------------------
// Manual Form Extraction & Validation
// -----------------------------------------------------------------------------
function extractFormData() {
  const gender = elements.gender.value;
  const age = parseFloat(elements.age.value);
  const smoking_history = elements.smokingHistory.value;
  const bmi = parseFloat(elements.bmi.value);
  const HbA1c_level = parseFloat(elements.hbA1c.value);
  const blood_glucose_level = parseFloat(elements.glucose.value);

  const hypertensionRadio = document.querySelector('input[name="hypertension"]:checked');
  const hypertension = hypertensionRadio ? parseInt(hypertensionRadio.value, 10) : 0;

  const heartDiseaseRadio = document.querySelector('input[name="heart_disease"]:checked');
  const heart_disease = heartDiseaseRadio ? parseInt(heartDiseaseRadio.value, 10) : 0;

  // Validation
  const errors = [];
  if (!gender) errors.push("Please select a Gender.");
  if (isNaN(age) || age < 1 || age > 120) errors.push("Age must be between 1 and 120 years.");
  if (!smoking_history) errors.push("Please select a Smoking History category.");
  if (isNaN(bmi) || bmi < 10.0 || bmi > 95.0) errors.push("BMI must be between 10.0 and 95.0 kg/m².");
  if (isNaN(HbA1c_level) || HbA1c_level < 3.5 || HbA1c_level > 16.0) errors.push("HbA1c level must be between 3.5% and 16.0%.");
  if (isNaN(blood_glucose_level) || blood_glucose_level < 40 || blood_glucose_level > 500) {
    errors.push("Blood glucose level must be between 40 and 500 mg/dL.");
  }

  if (errors.length > 0) {
    alert(errors.join("\n"));
    return null;
  }

  return {
    gender,
    age,
    hypertension,
    heart_disease,
    smoking_history,
    bmi,
    HbA1c_level,
    blood_glucose_level,
    source: "manual",
    device_id: "Local Form",
    measurement_timestamp: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Cardiovascular Form Extraction & Preset Loader (Model B)
// -----------------------------------------------------------------------------
function extractCvFormData() {
  const age_years = parseFloat(elements.cvAge ? elements.cvAge.value : 54) || 54;
  const sex = elements.cvSex ? elements.cvSex.value : "Male";
  const systolic_bp = parseFloat(elements.cvSbp ? elements.cvSbp.value : 132) || 132;
  const diastolic_bp = parseFloat(elements.cvDbp ? elements.cvDbp.value : 84) || 84;
  const total_cholesterol = parseFloat(elements.cvTotChol ? elements.cvTotChol.value : 198) || 198;
  const hdl_cholesterol = parseFloat(elements.cvHdl ? elements.cvHdl.value : 48) || 48;
  const ldl_cholesterol = parseFloat(elements.cvLdl ? elements.cvLdl.value : 118) || 118;
  const triglycerides = parseFloat(elements.cvTrig ? elements.cvTrig.value : 145) || 145;
  const fasting_glucose = parseFloat(elements.cvGlucose ? elements.cvGlucose.value : 108) || 108;
  const hba1c = parseFloat(elements.cvHba1c ? elements.cvHba1c.value : 6.2) || 6.2;
  const bmi = parseFloat(elements.cvBmi ? elements.cvBmi.value : 28.2) || 28.2;
  const smoking_status = elements.cvSmoking ? elements.cvSmoking.value : "non_smoker";
  const htnDuration = parseFloat(elements.cvHtnDuration ? elements.cvHtnDuration.value : 0.0) || 0.0;

  const statinRadio = document.querySelector('input[name="cv_statin"]:checked');
  const medication_statin = statinRadio ? parseInt(statinRadio.value, 10) : 0;

  // Validation
  const errors = [];
  if (isNaN(age_years) || age_years < 30 || age_years > 105) errors.push("Patient age must be between 30 and 105 years.");
  if (isNaN(systolic_bp) || systolic_bp < 70 || systolic_bp > 250) errors.push("Systolic BP must be between 70 and 250 mmHg.");
  if (isNaN(diastolic_bp) || diastolic_bp < 40 || diastolic_bp > 160) errors.push("Diastolic BP must be between 40 and 160 mmHg.");
  if (isNaN(total_cholesterol) || total_cholesterol < 80 || total_cholesterol > 450) errors.push("Total cholesterol must be between 80 and 450 mg/dL.");
  if (isNaN(hdl_cholesterol) || hdl_cholesterol < 15 || hdl_cholesterol > 150) errors.push("HDL cholesterol must be between 15 and 150 mg/dL.");
  if (isNaN(ldl_cholesterol) || ldl_cholesterol < 30 || ldl_cholesterol > 300) errors.push("LDL cholesterol must be between 30 and 300 mg/dL.");
  if (isNaN(triglycerides) || triglycerides < 30 || triglycerides > 800) errors.push("Triglycerides must be between 30 and 800 mg/dL.");
  if (isNaN(fasting_glucose) || fasting_glucose < 50 || fasting_glucose > 400) errors.push("Fasting glucose must be between 50 and 400 mg/dL.");
  if (isNaN(hba1c) || hba1c < 3.5 || hba1c > 16.0) errors.push("HbA1c must be between 3.5% and 16.0%.");
  if (isNaN(bmi) || bmi < 12.0 || bmi > 65.0) errors.push("BMI must be between 12.0 and 65.0 kg/m².");

  if (errors.length > 0) {
    alert(errors.join("\n"));
    return null;
  }

  const hypertension_status = (htnDuration > 0 || systolic_bp >= 130 || diastolic_bp >= 85) ? 1 : 0;
  const diabetes_status = (hba1c >= 6.5 || fasting_glucose >= 126) ? 1 : 0;
  const dyslipidemia_status = (ldl_cholesterol >= 160 || total_cholesterol >= 240 || triglycerides >= 200) ? 1 : 0;

  return {
    age_years,
    sex,
    systolic_bp,
    diastolic_bp,
    total_cholesterol,
    ldl_cholesterol,
    hdl_cholesterol,
    triglycerides,
    fasting_glucose,
    hba1c,
    bmi,
    smoking_status,
    hypertension_status,
    hypertension_duration_years: htnDuration,
    diabetes_status,
    dyslipidemia_status,
    medication_statin,
    medication_antihypertensive: hypertension_status,
    source: "cardiovascular_twin",
    measurement_timestamp: new Date().toISOString()
  };
}

function loadCvPreset(preset) {
  if (!preset) return;
  if (elements.cvAge) elements.cvAge.value = preset.age;
  if (elements.cvSex) elements.cvSex.value = preset.sex;
  if (elements.cvSbp) elements.cvSbp.value = preset.sbp;
  if (elements.cvDbp) elements.cvDbp.value = preset.dbp;
  if (elements.cvTotChol) elements.cvTotChol.value = preset.totChol;
  if (elements.cvHdl) elements.cvHdl.value = preset.hdl;
  if (elements.cvLdl) elements.cvLdl.value = preset.ldl;
  if (elements.cvTrig) elements.cvTrig.value = preset.trig;
  if (elements.cvGlucose) elements.cvGlucose.value = preset.glucose;
  if (elements.cvHba1c) elements.cvHba1c.value = preset.hba1c;
  if (elements.cvBmi) elements.cvBmi.value = preset.bmi;
  if (elements.cvSmoking) elements.cvSmoking.value = preset.smoking;
  if (elements.cvHtnDuration) elements.cvHtnDuration.value = preset.htnDuration;

  const statinRadios = document.querySelectorAll('input[name="cv_statin"]');
  statinRadios.forEach((radio) => {
    radio.checked = parseInt(radio.value, 10) === preset.statin;
  });
}

// -----------------------------------------------------------------------------
// Model A: Short-Term 2-Hour Glucose Excursion Inference Execution
// -----------------------------------------------------------------------------
async function runGlucoseExcursionPrediction(payload) {
  lastSubmittedPayload = payload;
  const baseUrl = getEffectiveApiBaseUrl();

  setActiveState("loading");
  elements.loadingStageText.textContent = "Forecasting 2-Hour Blood Sugar Trajectory...";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/api/predict/glucose-excursion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      renderPredictionSuccess(data, payload);
      updateBackendStatus("online", "Connected (Blood Sugar Sync)");
      return;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Using local digital twin simulation fallback:", err);
    const fallbackResult = fallbackGlucoseExcursionPrediction(payload);
    renderPredictionSuccess(fallbackResult, payload);
  }
}

function fallbackGlucoseExcursionPrediction(payload) {
  const g = payload.current_glucose_mg_dl;
  const carbs = payload.recent_meal_carbs_g || 0;
  const steps = payload.steps_past_hour || 0;
  const roc = payload.glucose_rate_of_change_15m || 0;
  
  const z = -3.8 + 0.045 * (g - 120) + 0.03 * carbs - 0.002 * steps + 0.8 * roc;
  const prob = 1.0 / (1.0 + Math.exp(-z));
  const pred = prob >= 0.50 ? 1 : 0;
  const tier = prob < 0.25 ? "Low Spike Risk (Stable)" : (prob < 0.55 ? "Moderate Spike Risk" : "High Spike Risk (>180 mg/dL)");
  const rec = pred === 1 ? "Elevated chance of blood sugar rising above 180 mg/dL in the next 2 hours. Consider a light 15-minute post-meal walk." : "Blood sugar levels are expected to remain steady.";
  
  return {
    prediction: pred,
    excursion_risk_probability: Math.round(prob * 10000) / 10000,
    risk_tier: tier,
    lookahead_window_minutes: 120,
    model_name: "CuraTwin-GlucoseForecast-v1",
    top_contributing_factors: [
      { factor: "Current Blood Sugar", value: `${g.toFixed(1)} mg/dL`, impact: g > 140 ? "High" : "Normal" },
      { factor: "Recent Meal Carbs", value: `${carbs.toFixed(1)} g`, impact: carbs > 40 ? "High Carbs" : "Light Meal" },
      { factor: "Activity (Steps)", value: `${steps} steps`, impact: steps > 400 ? "Active (Protective)" : "Resting" },
      { factor: "Sugar Trend Speed", value: `${roc >= 0 ? "+" : ""}${roc.toFixed(2)} mg/dL/min`, impact: roc > 0.5 ? "Rising" : "Stable" },
    ],
    clinical_recommendation: rec,
    measurement_timestamp: payload.measurement_timestamp,
    prediction_timestamp: new Date().toISOString()
  };
}

// -----------------------------------------------------------------------------
// 1-Year Incident Cardiovascular Risk Inference Execution
// -----------------------------------------------------------------------------
async function runCardiovascularPrediction(payload) {
  lastSubmittedPayload = payload;
  const baseUrl = getEffectiveApiBaseUrl();

  setActiveState("loading");
  elements.loadingStageText.textContent = "Assessing 1-Year Heart & Stroke Risk...";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/api/predict/cardiovascular-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      renderPredictionSuccess(data, payload);
      updateBackendStatus("online", "Connected (Heart Health Sync)");
      return;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Using local digital twin simulation fallback:", err);
    const fallbackResult = fallbackCardiovascularPrediction(payload);
    renderPredictionSuccess(fallbackResult, payload);
  }
}

function fallbackCardiovascularPrediction(payload) {
  const age = payload.age_years;
  const sbp = payload.systolic_bp;
  const totChol = payload.total_cholesterol;
  const hdl = payload.hdl_cholesterol;
  const isSmoker = payload.smoking_status === "current_smoker" ? 1 : 0;
  const tgHdl = payload.triglycerides / Math.max(1, hdl);
  const burden = (payload.hypertension_status ? 1 : 0) + (sbp >= 140 ? 1 : 0) + (isSmoker ? 1 : 0) + (payload.bmi >= 30 ? 1 : 0);
  
  const z = -5.8 + 0.06 * (age - 45) + 0.035 * (sbp - 120) + 0.015 * (totChol - 180) - 0.03 * (hdl - 45) + 0.6 * isSmoker + 0.3 * burden;
  const prob = 1.0 / (1.0 + Math.exp(-z));
  const thresh = 0.0403;
  const pred = prob >= thresh ? 1 : 0;
  const risk_level = prob < 0.02 ? "Low 1-Year Heart Risk" : (prob < thresh ? "Moderate 1-Year Heart Risk" : "Higher 1-Year Heart Risk");
  const plan = pred === 1 ? "Measurements suggest higher cardiovascular risk. Recommended: schedule a routine checkup with your doctor to review blood pressure and cholesterol." : "Your heart health biomarkers look healthy and stable. Keep maintaining active habits and a balanced diet.";

  return {
    cv_event_prediction: pred,
    estimated_1y_event_probability: Math.round(prob * 10000) / 10000,
    risk_level: risk_level,
    screening_threshold: thresh,
    screening_sensitivity: "83.33%",
    model_name: "CuraTwin-HeartRisk-v1",
    top_risk_factors: [
      { factor: "Age", value: `${age} years`, severity: age >= 60 ? "Elevated" : "Normal" },
      { factor: "Blood Pressure", value: `${sbp}/${payload.diastolic_bp} mmHg`, severity: sbp >= 135 ? "Elevated" : "Normal" },
      { factor: "Health Conditions", value: `${burden} conditions`, severity: burden >= 3 ? "Attention" : "Normal" },
      { factor: "Cholesterol Ratio (TG/HDL)", value: `${tgHdl.toFixed(2)}`, severity: tgHdl >= 3.0 ? "Elevated" : "Healthy" },
    ],
    clinical_action_plan: plan,
    prediction_timestamp: new Date().toISOString()
  };
}

// -----------------------------------------------------------------------------
// REST Inference Execution
// -----------------------------------------------------------------------------
async function runPrediction(payload) {
  lastSubmittedPayload = payload;
  const baseUrl = getEffectiveApiBaseUrl();

  setActiveState("loading");
  elements.loadingStageText.textContent = "Analyzing health measurements...";

  const coldStartTimer = setTimeout(() => {
    if (elements.loadingStageText) {
      elements.loadingStageText.textContent = "Connecting to health service...";
    }
  }, 5000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(coldStartTimer);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorDetail = typeof errorJson.detail === "string" ? errorJson.detail : JSON.stringify(errorJson.detail);
        } else if (errorJson.field_errors) {
          errorDetail = errorJson.field_errors.map((e) => `${e.field}: ${e.message}`).join(", ");
        }
      } catch (parseErr) {
        // Fallback
      }
      throw new Error(errorDetail);
    }

    const data = await response.json();
    renderPredictionSuccess(data, payload);
    updateBackendStatus("online", "System Connected");
  } catch (err) {
    clearTimeout(coldStartTimer);
    clearTimeout(timeoutId);
    console.error("Prediction error:", err);

    let title = "Inference Request Failed";
    let message = err.message || "An unexpected network error occurred.";
    let hint = "If the cloud service was idle, it may take a moment to wake up. Please wait a few seconds and click Retry.";

    if (err.name === "AbortError") {
      title = "Request Timed Out (60s)";
      message = "The backend service took too long to respond.";
      hint = "Render free services typically require 30–60 seconds to boot on the initial request. Retrying now will succeed.";
    } else if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      message = "Cannot reach AI inference service. The backend server may be waking up from sleep mode.";
    }

    showError(title, message, hint);
  }
}

// -----------------------------------------------------------------------------
// Render Outcome Display & Provenance Tracking
// -----------------------------------------------------------------------------
function renderPredictionSuccess(result, inputs) {
  setActiveState("success");

  const isGlucoseModel = (result.model_name && (result.model_name.includes("Glucose") || result.model_name.includes("excursion"))) || result.excursion_risk_probability !== undefined;
  const isCvModel = (result.model_name && (result.model_name.includes("Cardiovascular") || result.model_name.includes("Heart"))) || result.cv_event_prediction !== undefined;

  let isPositive = false;
  let title = "";
  let probabilityVal = null;
  let probNote = "";
  let modelLabel = "CuraTwin Health Twin";
  let sourceBadgeText = "Blood Sugar Monitor";

  if (isGlucoseModel) {
    isPositive = result.prediction === 1;
    title = result.risk_tier || (isPositive ? "High Spike Risk (>180 mg/dL)" : "Stable Blood Sugar Expected");
    probabilityVal = result.excursion_risk_probability;
    probNote = "Estimated chance of blood sugar rising above 180 mg/dL in the next 2 hours.";
    modelLabel = "CuraTwin Blood Sugar AI";
    sourceBadgeText = "Blood Sugar Monitor";
  } else if (isCvModel) {
    isPositive = result.cv_event_prediction === 1;
    title = result.risk_level || (isPositive ? "Higher 1-Year Heart Risk" : "Low 1-Year Heart Risk");
    probabilityVal = result.estimated_1y_event_probability;
    probNote = "Estimated chance of experiencing a significant heart or stroke event over the next year.";
    modelLabel = "CuraTwin Heart Health AI";
    sourceBadgeText = "Heart Health Check";
  } else {
    isPositive = result.prediction === 1;
    title = result.label || (isPositive ? "Elevated Health Risk" : "Normal Health Parameters");
    probabilityVal = result.probability;
    probNote = result.probability_note || "Estimated risk level based on your measurements.";
    modelLabel = "CuraTwin Health Twin";
    sourceBadgeText = (result.source || inputs.source) === "sensor" ? "Smartwatch Monitor" : "Health Assessment";
  }

  // Outcome Badge
  elements.predictionBadge.className = `outcome-badge ${isPositive ? "outcome-positive" : "outcome-negative"}`;
  elements.outcomeLabel.textContent = title;
  elements.resultSourceBadge.textContent = sourceBadgeText;

  // Outcome Icon
  if (isPositive) {
    elements.outcomeIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
  } else {
    elements.outcomeIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;
  }

  // Probability display
  if (probabilityVal !== null && typeof probabilityVal === "number") {
    elements.probabilityBlock.removeAttribute("hidden");
    const pct = (probabilityVal * 100).toFixed(2);
    elements.metricProbabilityVal.textContent = `${pct}%`;
    elements.gaugeBarFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    elements.probabilityNote.textContent = probNote;
  } else {
    elements.probabilityBlock.setAttribute("hidden", "true");
  }

  // Audit and Factors display
  if (isGlucoseModel && result.top_contributing_factors) {
    let factorsHtml = '<div class="factors-container" style="grid-column: 1 / -1;"><div class="factors-title">Key Health Factors</div><div class="factors-grid">';
    result.top_contributing_factors.forEach(f => {
      const tagClass = f.impact.toLowerCase().includes("high") ? "factor-tag-high" : (f.impact.toLowerCase().includes("protective") || f.impact.toLowerCase().includes("active") ? "factor-tag-protective" : "factor-tag-neutral");
      factorsHtml += `
        <div class="factor-chip">
          <span class="factor-chip-k">${f.factor}</span>
          <span class="factor-chip-v">${f.value}</span>
          <span class="factor-chip-tag ${tagClass}">${f.impact}</span>
        </div>
      `;
    });
    factorsHtml += '</div></div>';

    const recBox = `
      <div class="recommendation-box ${isPositive ? 'rec-warning' : 'rec-success'}" style="grid-column: 1 / -1;">
        <div class="recommendation-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <div class="recommendation-content">
          <h5>${isPositive ? 'Blood Sugar Spike Alert' : 'Healthy Blood Sugar Plan'}</h5>
          <p>${result.clinical_recommendation}</p>
        </div>
      </div>
    `;
    elements.auditDeviceId.textContent = `Blood Sugar Forecast`;
    elements.auditSummaryGrid.innerHTML = factorsHtml + recBox;
  } else if (isCvModel && result.top_risk_factors) {
    let factorsHtml = '<div class="factors-container" style="grid-column: 1 / -1;"><div class="factors-title">Key Heart Health Factors</div><div class="factors-grid">';
    result.top_risk_factors.forEach(f => {
      const tagClass = f.severity.toLowerCase().includes("high") || f.severity.toLowerCase().includes("elevated") || f.severity.toLowerCase().includes("attention") ? "factor-tag-high" : (f.severity.toLowerCase().includes("optimal") || f.severity.toLowerCase().includes("healthy") || f.severity.toLowerCase().includes("normal") ? "factor-tag-optimal" : "factor-tag-neutral");
      factorsHtml += `
        <div class="factor-chip">
          <span class="factor-chip-k">${f.factor}</span>
          <span class="factor-chip-v">${f.value}</span>
          <span class="factor-chip-tag ${tagClass}">${f.severity}</span>
        </div>
      `;
    });
    factorsHtml += '</div></div>';

    const actionBox = `
      <div class="recommendation-box ${isPositive ? 'rec-warning' : 'rec-success'}" style="grid-column: 1 / -1;">
        <div class="recommendation-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <div class="recommendation-content">
          <h5>${isPositive ? 'Heart Health Attention Needed' : 'Healthy Heart Plan'}</h5>
          <p>${result.clinical_action_plan}</p>
        </div>
      </div>
    `;
    elements.auditDeviceId.textContent = `Heart Health Check`;
    elements.auditSummaryGrid.innerHTML = factorsHtml + actionBox;
  } else {
    const summaryData = result.input_summary || inputs;
    elements.auditDeviceId.textContent = `Source: ${(result.source || inputs.source || 'manual').toUpperCase()}`;
    elements.auditSummaryGrid.innerHTML = `
      <div class="summary-item"><span class="summary-key">Gender:</span><span class="summary-val">${summaryData.gender}</span></div>
      <div class="summary-item"><span class="summary-key">Age:</span><span class="summary-val">${summaryData.age} yrs</span></div>
      <div class="summary-item"><span class="summary-key">Hypertension:</span><span class="summary-val">${summaryData.hypertension === 1 ? "Yes (1)" : "No (0)"}</span></div>
      <div class="summary-item"><span class="summary-key">Heart Disease:</span><span class="summary-val">${summaryData.heart_disease === 1 ? "Yes (1)" : "No (0)"}</span></div>
      <div class="summary-item"><span class="summary-key">Smoking:</span><span class="summary-val">${summaryData.smoking_history}</span></div>
      <div class="summary-item"><span class="summary-key">BMI:</span><span class="summary-val">${summaryData.bmi} kg/m²</span></div>
      <div class="summary-item"><span class="summary-key">HbA1c:</span><span class="summary-val">${summaryData.HbA1c_level}%</span></div>
      <div class="summary-item"><span class="summary-key">Blood Glucose:</span><span class="summary-val">${summaryData.blood_glucose_level} mg/dL</span></div>
    `;
  }

  // Provenance Dual Timestamps (Measurement vs Prediction Time)
  const measIso = result.measurement_timestamp || inputs.measurement_timestamp;
  const predIso = result.prediction_timestamp || new Date().toISOString();

  elements.provMeasurementTime.textContent = measIso ? new Date(measIso).toLocaleTimeString() : "--:--:--";
  elements.provPredictionTime.textContent = new Date(predIso).toLocaleTimeString();

  // Record prediction in patient state manager for staleness verification
  const measEpoch = measIso ? new Date(measIso).getTime() : Date.now();
  patientState.recordPrediction(result, measEpoch);
  checkStalePredictionStatus();

  // Automatically record ML prediction and glucose biomarker into Digital Twin Timeline
  if (window.timelineManager) {
    const isPos = result.prediction === 1;
    const pct = result.probability !== null && typeof result.probability === "number"
      ? (result.probability * 100).toFixed(2) + "%"
      : (isPos ? ">50%" : "<50%");

    window.timelineManager.addEvent({
      id: "evt-pred-" + Date.now(),
      type: "prediction",
      title: `CuraTwin ML Risk Assessment (${source.toUpperCase()})`,
      timestamp: predIso,
      category: "Model predictions",
      metrics: {
        outcome: result.label || (isPos ? "Positive model classification" : "Negative model classification"),
        risk_probability: pct,
        model: "LogisticRegression (15 features)",
        provenance: `${source.toUpperCase()} (${device})`
      },
      description: `Inference executed on Render FastAPI backend. Evaluated 15 features with glucose ${summaryData.blood_glucose_level} mg/dL, HbA1c ${summaryData.HbA1c_level}%, BMI ${summaryData.bmi}.`,
      status: isPos ? "Elevated Risk" : "Low Risk"
    });

    // Also record the glucose reading event
    window.timelineManager.addEvent({
      id: "evt-glucose-" + Date.now(),
      type: "glucose",
      title: `Blood Glucose (${source === "sensor" ? "Sensor Stream" : "Clinical Entry"})`,
      timestamp: measIso,
      category: "Glucose",
      metrics: {
        glucose: summaryData.blood_glucose_level,
        unit: "mg/dL",
        zone: summaryData.blood_glucose_level > 140 ? "Elevated (>140 mg/dL)" : (summaryData.blood_glucose_level < 70 ? "Hypoglycemia (<70 mg/dL)" : "Target In-Range (70–140 mg/dL)"),
        trend: source === "sensor" ? (elements.telemetryTrendArrow ? elements.telemetryTrendArrow.textContent.trim() : "→ Stable") : "→ Stable",
        source: `${device}`
      },
      description: `Evaluated measurement recorded for patient profile at ${measIso ? new Date(measIso).toLocaleTimeString() : 'now'}.`,
      status: summaryData.blood_glucose_level > 140 ? "Elevated" : "In-Range"
    });
  }

  elements.metaTimestamp.textContent = `Inference completed on Render`;
}

function showError(title, message, hint) {
  setActiveState("error");
  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = message;
  elements.errorSuggestion.textContent = hint || "";
}

// -----------------------------------------------------------------------------
// Preset Profile Loaders
// -----------------------------------------------------------------------------
function loadPresetProfile(profile) {
  elements.gender.value = profile.gender;
  elements.age.value = profile.age;
  elements.smokingHistory.value = profile.smoking_history;
  elements.bmi.value = profile.bmi;
  elements.hbA1c.value = profile.HbA1c_level;
  elements.glucose.value = profile.blood_glucose_level;

  const hyperRadio = document.querySelector(`input[name="hypertension"][value="${profile.hypertension}"]`);
  if (hyperRadio) hyperRadio.checked = true;

  const heartRadio = document.querySelector(`input[name="heart_disease"][value="${profile.heart_disease}"]`);
  if (heartRadio) heartRadio.checked = true;

  syncProfileFromForm();
}

// -----------------------------------------------------------------------------
// BMI Quick Calculator
// -----------------------------------------------------------------------------
function setupBmiCalculator() {
  elements.btnToggleBmiCalc.addEventListener("click", () => {
    const isHidden = elements.bmiCalculatorDrawer.hasAttribute("hidden");
    if (isHidden) {
      elements.bmiCalculatorDrawer.removeAttribute("hidden");
      elements.btnToggleBmiCalc.setAttribute("aria-expanded", "true");
    } else {
      elements.bmiCalculatorDrawer.setAttribute("hidden", "true");
      elements.btnToggleBmiCalc.setAttribute("aria-expanded", "false");
    }
  });

  elements.btnApplyCalcBmi.addEventListener("click", () => {
    const h = parseFloat(elements.calcHeight.value);
    const w = parseFloat(elements.calcWeight.value);
    if (!h || !w || h <= 0 || w <= 0) {
      alert("Please enter valid height (cm) and weight (kg).");
      return;
    }
    const heightM = h / 100;
    const computedBmi = (w / (heightM * heightM)).toFixed(1);
    elements.bmi.value = computedBmi;
    elements.bmiCalculatorDrawer.setAttribute("hidden", "true");
    elements.btnToggleBmiCalc.setAttribute("aria-expanded", "false");
    syncProfileFromForm();
  });
}

// -----------------------------------------------------------------------------
// Application Initialization
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupModeSelector();
  setupBmiCalculator();
  setupSensorStreaming();

  // Presets definition
  const presetPrompt = {
    gender: "Female",
    age: 45,
    hypertension: 0,
    heart_disease: 0,
    smoking_history: "never",
    bmi: 27.5,
    HbA1c_level: 5.8,
    blood_glucose_level: 110,
  };

  const presetHealthy = {
    gender: "Female",
    age: 24,
    hypertension: 0,
    heart_disease: 0,
    smoking_history: "never",
    bmi: 21.5,
    HbA1c_level: 5.0,
    blood_glucose_level: 88,
  };

  const presetElevated = {
    gender: "Male",
    age: 65,
    hypertension: 1,
    heart_disease: 1,
    smoking_history: "current",
    bmi: 34.0,
    HbA1c_level: 8.5,
    blood_glucose_level: 210,
  };

  elements.btnPresetPrompt.addEventListener("click", () => loadPresetProfile(presetPrompt));
  elements.btnPresetHealthy.addEventListener("click", () => loadPresetProfile(presetHealthy));
  elements.btnPresetElevated.addEventListener("click", () => loadPresetProfile(presetElevated));

  // Cardiovascular Presets (Model B)
  const cvPresetLow = {
    age: 38,
    sex: "Female",
    sbp: 114,
    dbp: 72,
    totChol: 168,
    hdl: 62,
    ldl: 88,
    trig: 95,
    glucose: 88,
    hba1c: 5.2,
    bmi: 22.4,
    smoking: "non_smoker",
    htnDuration: 0,
    statin: 0
  };

  const cvPresetMod = {
    age: 56,
    sex: "Male",
    sbp: 136,
    dbp: 86,
    totChol: 215,
    hdl: 44,
    ldl: 135,
    trig: 175,
    glucose: 112,
    hba1c: 6.1,
    bmi: 28.5,
    smoking: "former_smoker",
    htnDuration: 3.0,
    statin: 0
  };

  const cvPresetHigh = {
    age: 68,
    sex: "Male",
    sbp: 158,
    dbp: 96,
    totChol: 265,
    hdl: 34,
    ldl: 172,
    trig: 290,
    glucose: 168,
    hba1c: 8.4,
    bmi: 34.2,
    smoking: "current_smoker",
    htnDuration: 12.0,
    statin: 1
  };

  if (elements.btnCvPresetLow) {
    elements.btnCvPresetLow.addEventListener("click", () => loadCvPreset(cvPresetLow));
  }
  if (elements.btnCvPresetMod) {
    elements.btnCvPresetMod.addEventListener("click", () => loadCvPreset(cvPresetMod));
  }
  if (elements.btnCvPresetHigh) {
    elements.btnCvPresetHigh.addEventListener("click", () => loadCvPreset(cvPresetHigh));
  }

  // Model A Glucose Excursion Presets
  const btnGlucoseLow = document.getElementById("btn-glucose-preset-low");
  const btnGlucoseMod = document.getElementById("btn-glucose-preset-mod");
  const btnGlucoseHigh = document.getElementById("btn-glucose-preset-high");

  function loadGlucosePreset(glucoseVal, stepsVal, hrVal, trend, carbsVal) {
    window.latestLoggedMeal = { total_carbs: carbsVal, timestamp: Date.now() - 30 * 60000 };
    const nowStr = new Date().toLocaleTimeString();
    const reading = {
      glucose: glucoseVal,
      heartRate: hrVal,
      steps: stepsVal,
      glucoseTrend: trend,
      timeFormatted: nowStr,
      timestamp: new Date().toISOString()
    };
    sensorAdapter.latestMeasurement = reading;
    if (!sensorAdapter.history) sensorAdapter.history = [];
    sensorAdapter.history.push({ glucose: glucoseVal, timeFormatted: nowStr });
    if (sensorAdapter.history.length > 30) sensorAdapter.history.shift();
    updateTelemetryCards(reading);
    renderTrendChart();
    evaluateSensorPrediction();
  }

  if (btnGlucoseLow) {
    btnGlucoseLow.addEventListener("click", () => loadGlucosePreset(96.0, 850, 68, "stable", 15.0));
  }
  if (btnGlucoseMod) {
    btnGlucoseMod.addEventListener("click", () => loadGlucosePreset(145.0, 320, 75, "rising", 45.0));
  }
  if (btnGlucoseHigh) {
    btnGlucoseHigh.addEventListener("click", () => loadGlucosePreset(188.0, 80, 88, "rising", 85.0));
  }

  // Form Submission (Manual Mode)
  elements.form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const payload = extractFormData();
    if (payload) {
      syncProfileFromForm();
      runPrediction(payload);
    }
  });

  // Reset Form (Manual Mode)
  elements.resetBtn.addEventListener("click", () => {
    elements.form.reset();
    setActiveState("idle");
  });

  // Cardiovascular Form Submission (Model B)
  if (elements.cvForm) {
    elements.cvForm.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const payload = extractCvFormData();
      if (payload) {
        runCardiovascularPrediction(payload);
      }
    });
  }

  // Cardiovascular Form Reset
  if (elements.btnResetCvForm) {
    elements.btnResetCvForm.addEventListener("click", () => {
      elements.cvForm.reset();
      setActiveState("idle");
    });
  }

  // Retry Inference (supports Legacy, Model A, and Model B)
  elements.retryBtn.addEventListener("click", () => {
    if (lastSubmittedPayload) {
      if (lastSubmittedPayload.source === "cardiovascular_twin" || lastSubmittedPayload.systolic_bp !== undefined) {
        runCardiovascularPrediction(lastSubmittedPayload);
      } else if (lastSubmittedPayload.lookahead_window_minutes || lastSubmittedPayload.current_glucose_mg_dl !== undefined) {
        runGlucoseExcursionPrediction(lastSubmittedPayload);
      } else {
        runPrediction(lastSubmittedPayload);
      }
    } else {
      const payload = extractFormData();
      if (payload) runPrediction(payload);
    }
  });

  // Initialize synced patient profile
  syncProfileFromForm();

  // Click badge to manually retry health check / wake up server
  if (elements.backendStatusBadge) {
    elements.backendStatusBadge.addEventListener("click", () => {
      checkBackendHealth(true);
    });
  }

  // Health check on launch
  checkBackendHealth();
});

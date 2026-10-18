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
// Effective Base URL Resolution (Locked to production service)
// -----------------------------------------------------------------------------
function getEffectiveApiBaseUrl() {
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
  viewModeManual: document.getElementById("view-mode-manual"),
  viewModeSensor: document.getElementById("view-mode-sensor"),
  sensorTabLiveBadge: document.getElementById("sensor-tab-live-badge"),

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
    elements.btnContentDefault.setAttribute("hidden", "true");
    elements.btnContentLoading.removeAttribute("hidden");
  } else {
    elements.submitBtn.disabled = false;
    if (elements.btnPredictSensorNow) elements.btnPredictSensorNow.disabled = false;
    elements.btnContentDefault.removeAttribute("hidden");
    elements.btnContentLoading.setAttribute("hidden", "true");
  }
}

// -----------------------------------------------------------------------------
// Dual-Mode Switching Logic (Manual Clinical Input vs Watch / Sensor Stream)
// -----------------------------------------------------------------------------
function setupModeSelector() {
  elements.tabModeManual.addEventListener("click", () => {
    elements.tabModeManual.classList.add("active");
    elements.tabModeManual.setAttribute("aria-selected", "true");
    elements.tabModeSensor.classList.remove("active");
    elements.tabModeSensor.setAttribute("aria-selected", "false");

    elements.viewModeManual.removeAttribute("hidden");
    elements.viewModeManual.classList.add("active");
    elements.viewModeSensor.setAttribute("hidden", "true");
    elements.viewModeSensor.classList.remove("active");
  });

  elements.tabModeSensor.addEventListener("click", () => {
    elements.tabModeSensor.classList.add("active");
    elements.tabModeSensor.setAttribute("aria-selected", "true");
    elements.tabModeManual.classList.remove("active");
    elements.tabModeManual.setAttribute("aria-selected", "false");

    elements.viewModeSensor.removeAttribute("hidden");
    elements.viewModeSensor.classList.add("active");
    elements.viewModeManual.setAttribute("hidden", "true");
    elements.viewModeManual.classList.remove("active");

    // Automatically sync patient profile when switching to sensor mode
    syncProfileFromForm();
  });
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
  const dotsG = elements.svgChartDots;
  const placeholder = elements.chartEmptyPlaceholder;

  if (history.length === 0) {
    pathEl.setAttribute("d", "");
    dotsG.innerHTML = "";
    placeholder.removeAttribute("hidden");
    return;
  }

  placeholder.setAttribute("hidden", "true");

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

  // Construct SVG path command
  let d = "";
  points.forEach((p, i) => {
    d += (i === 0 ? "M" : " L") + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });
  pathEl.setAttribute("d", d);

  // Dots
  let dotsHtml = "";
  points.forEach((p, i) => {
    const isLatest = i === points.length - 1;
    const r = isLatest ? 5 : 3;
    const fill = isLatest ? "#0284c7" : "#0ea5e9";
    dotsHtml += `
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="1.5">
        <title>${p.glucose.toFixed(1)} mg/dL at ${p.time}</title>
      </circle>
    `;
    if (isLatest) {
      dotsHtml += `
        <text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" font-size="10" font-weight="700" fill="#0369a1" text-anchor="middle" font-family="var(--font-mono)">
          ${p.glucose.toFixed(1)}
        </text>
      `;
    }
  });
  dotsG.innerHTML = dotsHtml;
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
    await runPrediction(buildResult.payload);
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
// Backend Health Check
// -----------------------------------------------------------------------------
async function checkBackendHealth() {
  const baseUrl = getEffectiveApiBaseUrl();
  updateBackendStatus("checking", "Connecting to Backend...");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.model_loaded) {
        updateBackendStatus("online", `Backend Online (${data.estimator})`);
        return true;
      }
      updateBackendStatus("offline", "Model Not Loaded");
      return false;
    }
    updateBackendStatus("offline", `HTTP Error ${response.status}`);
    return false;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Health check error:", err);
    updateBackendStatus("offline", "Backend Sleeping / Offline");
    return false;
  }
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
// REST Inference Execution
// -----------------------------------------------------------------------------
async function runPrediction(payload) {
  lastSubmittedPayload = payload;
  const baseUrl = getEffectiveApiBaseUrl();

  setActiveState("loading");
  elements.loadingStageText.textContent = "Connecting to CuraTwin AI Engine...";

  const coldStartTimer = setTimeout(() => {
    if (elements.loadingStageText) {
      elements.loadingStageText.textContent = "Server is waking up from cold sleep (Render free tier may take 30–50s)...";
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
    updateBackendStatus("online", "Backend Online");
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

  const isPositive = result.prediction === 1;

  // Outcome Badge
  elements.predictionBadge.className = `outcome-badge ${
    isPositive ? "outcome-positive" : "outcome-negative"
  }`;
  elements.outcomeLabel.textContent = result.label || (isPositive ? "Positive model classification" : "Negative model classification");

  // Source Badge
  const source = result.source || inputs.source || "manual";
  const device = result.device_id || inputs.device_id || "Local Form";
  if (source === "sensor") {
    elements.resultSourceBadge.textContent = `Watch / Sensor (${device})`;
    elements.resultSourceBadge.style.backgroundColor = "rgba(14, 165, 233, 0.15)";
    elements.resultSourceBadge.style.color = "#0369a1";
  } else {
    elements.resultSourceBadge.textContent = "Manual Input";
    elements.resultSourceBadge.style.backgroundColor = "rgba(0, 0, 0, 0.08)";
    elements.resultSourceBadge.style.color = "inherit";
  }

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
  if (result.probability !== null && typeof result.probability === "number") {
    elements.probabilityBlock.removeAttribute("hidden");
    const pct = (result.probability * 100).toFixed(2);
    elements.metricProbabilityVal.textContent = `${pct}%`;
    elements.gaugeBarFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    if (result.probability_note) {
      elements.probabilityNote.textContent = result.probability_note;
    }
  } else {
    elements.probabilityBlock.setAttribute("hidden", "true");
  }

  // Audit / Feature Summary Grid
  const summaryData = result.input_summary || inputs;
  elements.auditDeviceId.textContent = `Source: ${source.toUpperCase()} (${device})`;
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

  // Provenance Dual Timestamps (Measurement vs Prediction Time)
  const measIso = result.measurement_timestamp || inputs.measurement_timestamp;
  const predIso = result.prediction_timestamp || new Date().toISOString();

  elements.provMeasurementTime.textContent = measIso ? new Date(measIso).toLocaleTimeString() : "--:--:--";
  elements.provPredictionTime.textContent = new Date(predIso).toLocaleTimeString();

  // Record prediction in patient state manager for staleness verification
  const measEpoch = measIso ? new Date(measIso).getTime() : Date.now();
  patientState.recordPrediction(result, measEpoch);
  checkStalePredictionStatus();

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

  // Form Submission (Manual Mode)
  elements.form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const payload = extractFormData();
    if (payload) {
      syncProfileFromForm();
      runPrediction(payload);
    }
  });

  // Reset Form
  elements.resetBtn.addEventListener("click", () => {
    elements.form.reset();
    setActiveState("idle");
  });

  // Retry Inference
  elements.retryBtn.addEventListener("click", () => {
    if (lastSubmittedPayload) {
      runPrediction(lastSubmittedPayload);
    } else {
      const payload = extractFormData();
      if (payload) runPrediction(payload);
    }
  });

  // Initialize synced patient profile
  syncProfileFromForm();

  // Health check on launch
  checkBackendHealth();
});

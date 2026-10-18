/**
 * =========================================================================
 * DiaWatch AI — Frontend Client Application
 * =========================================================================
 * Configuration:
 * Replace YOUR_RENDER_BACKEND_URL below with your deployed Render service URL.
 * Example: const API_BASE_URL = "https://diawatch-ai-backend.onrender.com";
 *
 * For local development:
 * When running locally on localhost or 127.0.0.1, the application will
 * automatically connect to http://localhost:8000 if YOUR_RENDER_BACKEND_URL is unchanged.
 * =========================================================================
 */

const API_BASE_URL = "YOUR_RENDER_BACKEND_URL";

// -----------------------------------------------------------------------------
// Effective Base URL Resolution (with Localhost & Custom Storage Fallback)
// -----------------------------------------------------------------------------
function getEffectiveApiBaseUrl() {
  // Check if user set a custom URL via the in-app settings modal
  const storedOverride = window.localStorage.getItem("diawatch_api_url");
  if (storedOverride && storedOverride.trim().length > 0) {
    return storedOverride.trim().replace(/\/+$/, "");
  }

  // If placeholder remains, auto-detect local testing environment
  if (API_BASE_URL === "YOUR_RENDER_BACKEND_URL") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "") {
      return "http://localhost:8000";
    }
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

// -----------------------------------------------------------------------------
// DOM Element Cache
// -----------------------------------------------------------------------------
const elements = {
  form: document.getElementById("diabetes-form"),
  submitBtn: document.getElementById("btn-submit-predict"),
  btnContentDefault: document.querySelector(".btn-content-default"),
  btnContentLoading: document.querySelector(".btn-content-loading"),
  resetBtn: document.getElementById("btn-reset-form"),
  retryBtn: document.getElementById("btn-retry-inference"),

  // Status Badges & Modals
  backendStatusBadge: document.getElementById("backend-status-badge"),
  backendStatusText: document.getElementById("backend-status-text"),
  btnApiConfig: document.getElementById("btn-api-config"),
  modalApiConfig: document.getElementById("modal-api-config"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  inputApiUrl: document.getElementById("input-api-url"),
  btnTestSaveApi: document.getElementById("btn-test-save-api"),
  btnResetApiUrl: document.getElementById("btn-reset-api-url"),

  // Presets
  btnPresetPrompt: document.getElementById("btn-preset-prompt"),
  btnPresetHealthy: document.getElementById("btn-preset-healthy"),
  btnPresetElevated: document.getElementById("btn-preset-elevated"),

  // BMI Helper
  btnToggleBmiCalc: document.getElementById("btn-toggle-bmi-calc"),
  bmiCalculatorDrawer: document.getElementById("bmi-calculator-drawer"),
  calcHeight: document.getElementById("calc-height"),
  calcWeight: document.getElementById("calc-weight"),
  btnApplyCalcBmi: document.getElementById("btn-apply-calc-bmi"),

  // Result States
  stateIdle: document.getElementById("state-idle"),
  stateLoading: document.getElementById("state-loading"),
  stateSuccess: document.getElementById("state-success"),
  stateError: document.getElementById("state-error"),
  loadingStageText: document.getElementById("loading-stage-text"),

  // Outcome Elements
  predictionBadge: document.getElementById("prediction-badge"),
  outcomeIcon: document.getElementById("outcome-icon"),
  outcomeLabel: document.getElementById("outcome-label"),
  probabilityBlock: document.getElementById("probability-block"),
  metricProbabilityVal: document.getElementById("metric-probability-val"),
  gaugeBarFill: document.getElementById("gauge-bar-fill"),
  probabilityNote: document.getElementById("probability-note"),
  auditSummaryGrid: document.getElementById("audit-summary-grid"),
  metaTimestamp: document.getElementById("meta-timestamp"),

  // Error Elements
  errorTitle: document.getElementById("error-title"),
  errorMessage: document.getElementById("error-message"),
  errorSuggestion: document.getElementById("error-suggestion"),

  // Form Inputs
  gender: document.getElementById("gender"),
  age: document.getElementById("age"),
  smokingHistory: document.getElementById("smoking_history"),
  bmi: document.getElementById("bmi"),
  hbA1c: document.getElementById("HbA1c_level"),
  glucose: document.getElementById("blood_glucose_level"),
};

// Store last submitted payload for easy retries
let lastSubmittedPayload = null;

// -----------------------------------------------------------------------------
// UI State Switcher
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
    elements.btnContentDefault.setAttribute("hidden", "true");
    elements.btnContentLoading.removeAttribute("hidden");
  } else {
    elements.submitBtn.disabled = false;
    elements.btnContentDefault.removeAttribute("hidden");
    elements.btnContentLoading.setAttribute("hidden", "true");
  }
}

// -----------------------------------------------------------------------------
// Backend Health Check
// -----------------------------------------------------------------------------
async function checkBackendHealth() {
  const baseUrl = getEffectiveApiBaseUrl();

  // If using unchanged placeholder and not on localhost, prompt configuration
  if (baseUrl === "YOUR_RENDER_BACKEND_URL") {
    updateBackendStatus("offline", "Backend URL Not Configured");
    return false;
  }

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
// Form Handling & Validation
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
  };
}

// -----------------------------------------------------------------------------
// Model Inference Request
// -----------------------------------------------------------------------------
async function runPrediction(payload) {
  lastSubmittedPayload = payload;
  const baseUrl = getEffectiveApiBaseUrl();

  if (baseUrl === "YOUR_RENDER_BACKEND_URL") {
    showError(
      "Backend URL Not Configured",
      "Please configure your deployed Render URL in app.js or click 'API Settings' to enter your backend URL.",
      "In frontend/app.js, set: const API_BASE_URL = 'https://your-service.onrender.com';"
    );
    return;
  }

  setActiveState("loading");
  elements.loadingStageText.textContent = `Connecting to ${baseUrl}...`;

  // Dynamic progress indicators for cold-starts on Render free tier
  const coldStartTimer = setTimeout(() => {
    if (elements.loadingStageText) {
      elements.loadingStageText.textContent = "Server is waking up from cold sleep (Render free tier may take 30–50s)...";
    }
  }, 5000);

  const controller = new AbortController();
  // 60-second timeout to handle Render cold-start instances comfortably
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
        // Fallback to generic status text
      }
      throw new Error(errorDetail);
    }

    const data = await response.json();
    renderPredictionSuccess(data, payload);
    // Refresh backend badge
    updateBackendStatus("online", "Backend Online");
  } catch (err) {
    clearTimeout(coldStartTimer);
    clearTimeout(timeoutId);
    console.error("Prediction error:", err);

    let title = "Inference Request Failed";
    let message = err.message || "An unexpected network error occurred.";
    let hint = "If hosted on Render free tier, the backend spins down after inactivity. Please wait a moment and click Retry.";

    if (err.name === "AbortError") {
      title = "Request Timed Out (60s)";
      message = "The backend service took too long to respond.";
      hint = "Render free services typically require 30–60 seconds to boot on the initial request. Retrying now will likely succeed.";
    } else if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      message = `Cannot reach backend at ${baseUrl}. Ensure the service is active and CORS allows this domain.`;
    }

    showError(title, message, hint);
  }
}

// -----------------------------------------------------------------------------
// Render Outcome Display
// -----------------------------------------------------------------------------
function renderPredictionSuccess(result, inputs) {
  setActiveState("success");

  const isPositive = result.prediction === 1;

  // Set outcome badge theme and label
  elements.predictionBadge.className = `outcome-badge ${
    isPositive ? "outcome-positive" : "outcome-negative"
  }`;
  elements.outcomeLabel.textContent = result.label || (isPositive ? "Positive model classification" : "Negative model classification");

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

  // Timestamp
  const now = new Date();
  elements.metaTimestamp.textContent = `Evaluated: ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
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
  });
}

// -----------------------------------------------------------------------------
// Settings Modal (API URL Configuration)
// -----------------------------------------------------------------------------
function setupSettingsModal() {
  elements.btnApiConfig.addEventListener("click", () => {
    elements.inputApiUrl.value = getEffectiveApiBaseUrl();
    elements.modalApiConfig.showModal();
  });

  elements.btnCloseModal.addEventListener("click", () => {
    elements.modalApiConfig.close();
  });

  elements.btnResetApiUrl.addEventListener("click", () => {
    window.localStorage.removeItem("diawatch_api_url");
    elements.inputApiUrl.value = API_BASE_URL === "YOUR_RENDER_BACKEND_URL" ? "http://localhost:8000" : API_BASE_URL;
    checkBackendHealth();
    elements.modalApiConfig.close();
  });

  elements.btnTestSaveApi.addEventListener("click", async () => {
    const entered = elements.inputApiUrl.value.trim().replace(/\/+$/, "");
    if (!entered) {
      alert("Please enter a valid URL.");
      return;
    }
    window.localStorage.setItem("diawatch_api_url", entered);
    elements.modalApiConfig.close();
    await checkBackendHealth();
  });
}

// -----------------------------------------------------------------------------
// Application Initialization & Event Listeners
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Setup interactive helpers
  setupBmiCalculator();
  setupSettingsModal();

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

  // Form Submission
  elements.form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const payload = extractFormData();
    if (payload) {
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

  // Automatic Health Check on Launch
  checkBackendHealth();
});

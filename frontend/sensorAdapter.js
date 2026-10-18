/**
 * =========================================================================
 * CuraTwin — Sensor Adapter & Streaming Architecture
 * =========================================================================
 * Implements an extensible sensor adapter interface allowing physical
 * wearables (e.g., Web Bluetooth / BLE, WebSockets) or deterministic simulated
 * telemetry to supply real-time physiological biomarkers to the dashboard.
 * =========================================================================
 */

// Connection States as specified in project requirements
const SensorState = {
  DISCONNECTED: "Disconnected",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  STREAMING: "Streaming",
  PAUSED: "Paused",
  ERROR: "Error",
};

/**
 * Validates incoming sensor measurement payload against physiological plausibility ranges.
 * Ensures the ML pipeline never ingests corrupted or out-of-range sensor packets.
 */
function validateIncomingMeasurement(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Empty or invalid sensor payload structure." };
  }

  // Validate glucose (if present)
  if (data.blood_glucose_level !== undefined && data.blood_glucose_level !== null) {
    const g = Number(data.blood_glucose_level);
    if (isNaN(g) || g < 40 || g > 500) {
      return { valid: false, error: `Blood glucose value ${data.blood_glucose_level} mg/dL is outside physiological limits (40-500).` };
    }
  }

  // Validate heart rate (if present)
  if (data.heart_rate !== undefined && data.heart_rate !== null) {
    const hr = Number(data.heart_rate);
    if (isNaN(hr) || hr < 30 || hr > 240) {
      return { valid: false, error: `Heart rate ${data.heart_rate} BPM is outside plausible range (30-240).` };
    }
  }

  // Validate steps (if present)
  if (data.steps !== undefined && data.steps !== null) {
    const s = Number(data.steps);
    if (isNaN(s) || s < 0) {
      return { valid: false, error: `Steps counter cannot be negative.` };
    }
  }

  return { valid: true, error: null };
}

/**
 * Base Sensor Adapter Interface
 * All physical and simulated sensor implementations must adhere to this contract.
 */
class SensorAdapter {
  constructor(deviceId = "Generic-Sensor") {
    this.deviceId = deviceId;
    this.state = SensorState.DISCONNECTED;
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter((h) => h !== handler);
    this.listeners.set(event, filtered);
  }

  emit(event, payload) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`Error in sensor event handler for '${event}':`, err);
      }
    });
  }

  setState(newState, details = null) {
    const oldState = this.state;
    this.state = newState;
    this.emit("stateChange", { oldState, newState, details, deviceId: this.deviceId });
  }

  // Lifecycle methods to be overridden
  async connect() { throw new Error("connect() not implemented."); }
  async disconnect() { throw new Error("disconnect() not implemented."); }
  startStreaming() { throw new Error("startStreaming() not implemented."); }
  pauseStreaming() { throw new Error("pauseStreaming() not implemented."); }
  resumeStreaming() { throw new Error("resumeStreaming() not implemented."); }
  stopStreaming() { throw new Error("stopStreaming() not implemented."); }
  reset() { throw new Error("reset() not implemented."); }
}

/**
 * Deterministic Simulated Sensor Stream
 * Emulates a combined Continuous Glucose Monitor (CGM) and smartwatch telemetry
 * with realistic physiological drift, step increments, and heart rate variance.
 */
class SimulatedSensorAdapter extends SensorAdapter {
  constructor(options = {}) {
    super(options.deviceId || "CuraWatch-B12");
    this.sensorType = "Simulated CGM & Wearable";
    this.intervalMs = options.intervalMs || 4000;
    this.timerId = null;

    // Simulation baseline values
    this.baseGlucose = options.initialGlucose || 112.0;
    this.currentGlucose = this.baseGlucose;
    this.previousGlucose = this.baseGlucose;
    this.currentHeartRate = options.initialHeartRate || 74;
    this.currentSteps = options.initialSteps || 3840;
    this.stepDelta = 0;
    this.stepTrendCounter = 0;
  }

  async connect() {
    this.setState(SensorState.CONNECTING);
    // Emulate realistic BLE handshake latency
    await new Promise((resolve) => setTimeout(resolve, 800));
    this.setState(SensorState.CONNECTED, {
      deviceId: this.deviceId,
      sensorType: this.sensorType,
      capabilities: ["blood_glucose_level (CGM)", "heart_rate (PPG)", "steps (IMU)"],
    });
  }

  async disconnect() {
    this.stopStreaming();
    this.setState(SensorState.DISCONNECTED);
  }

  startStreaming() {
    if (this.state !== SensorState.CONNECTED && this.state !== SensorState.PAUSED) {
      if (this.state === SensorState.DISCONNECTED) {
        // Auto-connect before starting stream
        this.connect().then(() => this.startStreaming());
        return;
      }
    }

    if (this.timerId) clearInterval(this.timerId);
    this.setState(SensorState.STREAMING);

    // Emit initial reading immediately
    this._generateAndEmitReading();

    // Schedule regular telemetry intervals
    this.timerId = setInterval(() => {
      this._generateAndEmitReading();
    }, this.intervalMs);
  }

  pauseStreaming() {
    if (this.state === SensorState.STREAMING) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.setState(SensorState.PAUSED);
    }
  }

  resumeStreaming() {
    if (this.state === SensorState.PAUSED) {
      this.startStreaming();
    }
  }

  stopStreaming() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.state === SensorState.STREAMING || this.state === SensorState.PAUSED) {
      this.setState(SensorState.CONNECTED);
    }
  }

  reset() {
    this.stopStreaming();
    this.currentGlucose = this.baseGlucose;
    this.previousGlucose = this.baseGlucose;
    this.currentHeartRate = 74;
    this.currentSteps = 3840;
    this.stepTrendCounter = 0;
    this.emit("reset", { deviceId: this.deviceId });
  }

  setIntervalMs(newIntervalMs) {
    this.intervalMs = Math.max(1000, Number(newIntervalMs) || 4000);
    if (this.state === SensorState.STREAMING) {
      clearInterval(this.timerId);
      this.timerId = setInterval(() => {
        this._generateAndEmitReading();
      }, this.intervalMs);
    }
  }

  /**
   * Internal deterministic physiological simulation engine.
   * Generates realistic, non-random continuous glucose kinetics
   * with smooth bounded drift and trend direction indicators.
   */
  _generateAndEmitReading() {
    this.stepTrendCounter += 1;
    this.previousGlucose = this.currentGlucose;

    // Physiological glucose dynamics (sinusoidal diurnal wave + subtle micro-variation)
    const timeFactor = this.stepTrendCounter * 0.15;
    const wave = Math.sin(timeFactor) * 8 + Math.cos(timeFactor * 0.5) * 4;
    const microDrift = (Math.sin(this.stepTrendCounter * 1.3) * 1.8);
    const newGlucose = Math.round((this.baseGlucose + wave + microDrift) * 10) / 10;
    this.currentGlucose = Math.max(75, Math.min(260, newGlucose));

    // Determine glucose trend
    let glucoseTrend = "stable";
    const delta = this.currentGlucose - this.previousGlucose;
    if (delta > 1.2) glucoseTrend = "rising";
    else if (delta < -1.2) glucoseTrend = "falling";

    // Realistic heart rate variation (68 - 84 BPM)
    const hrNoise = Math.round(Math.sin(this.stepTrendCounter * 0.8) * 5);
    this.currentHeartRate = 74 + hrNoise;

    // Steps increment (simulate physical activity)
    const addedSteps = Math.floor(Math.abs(Math.sin(this.stepTrendCounter)) * 8) + 2;
    this.currentSteps += addedSteps;

    const now = new Date();
    const rawData = {
      blood_glucose_level: this.currentGlucose,
      heart_rate: this.currentHeartRate,
      steps: this.currentSteps,
    };

    // Validate
    const validation = validateIncomingMeasurement(rawData);
    if (!validation.valid) {
      this.emit("error", { error: validation.error, rawData });
      return;
    }

    // Normalized event structure
    const reading = {
      deviceId: this.deviceId,
      sensorType: this.sensorType,
      timestamp: now.getTime(),
      isoTimestamp: now.toISOString(),
      timeFormatted: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      glucose: this.currentGlucose,
      glucoseTrend: glucoseTrend,
      heartRate: this.currentHeartRate,
      steps: this.currentSteps,
      isSimulated: true,
      label: "Simulated Sensor Reading (Demo CGM + Wearable)",
    };

    this.emit("measurement", reading);
  }
}

// -----------------------------------------------------------------------------
// Patient Measurement State Manager
// -----------------------------------------------------------------------------
class PatientStateManager {
  constructor(initialProfile = null) {
    this.profile = initialProfile || {
      gender: "Female",
      age: 45,
      hypertension: 0,
      heart_disease: 0,
      smoking_history: "never",
      bmi: 27.5,
      HbA1c_level: 5.8,
    };

    this.latestMeasurement = null;
    this.measurementHistory = [];
    this.maxHistoryLength = 25;

    this.latestPrediction = null;
    this.lastPredictedMeasurementTimestamp = null;
  }

  setProfile(updatedProfile) {
    this.profile = { ...this.profile, ...updatedProfile };
  }

  addMeasurement(reading) {
    this.latestMeasurement = reading;
    this.measurementHistory.unshift(reading);
    if (this.measurementHistory.length > this.maxHistoryLength) {
      this.measurementHistory.pop();
    }
  }

  clearHistory() {
    this.measurementHistory = [];
    this.latestMeasurement = null;
    this.latestPrediction = null;
    this.lastPredictedMeasurementTimestamp = null;
  }

  recordPrediction(predictionResult, measurementTimestamp = null) {
    this.latestPrediction = predictionResult;
    this.lastPredictedMeasurementTimestamp = measurementTimestamp || (this.latestMeasurement ? this.latestMeasurement.timestamp : null);
  }

  /**
   * Checks if the currently displayed prediction was calculated from an older measurement.
   */
  isPredictionStale() {
    if (!this.latestPrediction || !this.latestMeasurement) return false;
    if (!this.lastPredictedMeasurementTimestamp) return false;
    return this.latestMeasurement.timestamp > this.lastPredictedMeasurementTimestamp;
  }

  /**
   * Constructs the complete 8-feature payload required by the backend ML model
   * combining the fixed patient clinical profile with the latest live glucose reading.
   * Enforces zero fabricated clinical features.
   */
  buildInferencePayload(source = "sensor") {
    const p = this.profile;
    const m = this.latestMeasurement;

    if (!m || m.glucose === undefined || m.glucose === null) {
      return {
        ready: false,
        error: "No sensor glucose measurement available. The trained ML model requires blood glucose concentration.",
        missingFields: ["blood_glucose_level"],
      };
    }

    const missing = [];
    if (!p.gender) missing.push("gender");
    if (p.age === undefined || p.age === null) missing.push("age");
    if (p.hypertension === undefined || p.hypertension === null) missing.push("hypertension");
    if (p.heart_disease === undefined || p.heart_disease === null) missing.push("heart_disease");
    if (!p.smoking_history) missing.push("smoking_history");
    if (!p.bmi) missing.push("bmi");
    if (!p.HbA1c_level) missing.push("HbA1c_level");

    if (missing.length > 0) {
      return {
        ready: false,
        error: `Incomplete Patient Profile: Missing ${missing.join(", ")}. A wearable stream does not measure baseline clinical features. Please complete the patient profile.`,
        missingFields: missing,
      };
    }

    return {
      ready: true,
      payload: {
        gender: p.gender,
        age: Number(p.age),
        hypertension: Number(p.hypertension),
        heart_disease: Number(p.heart_disease),
        smoking_history: p.smoking_history,
        bmi: Number(p.bmi),
        HbA1c_level: Number(p.HbA1c_level),
        blood_glucose_level: Number(m.glucose),
        source: source,
        device_id: m.deviceId || "CuraWatch-B12",
        measurement_timestamp: m.isoTimestamp || new Date(m.timestamp).toISOString(),
      },
    };
  }
}

// Export to window for browser use
window.SensorState = SensorState;
window.SensorAdapter = SensorAdapter;
window.SimulatedSensorAdapter = SimulatedSensorAdapter;
window.PatientStateManager = PatientStateManager;
window.validateIncomingMeasurement = validateIncomingMeasurement;

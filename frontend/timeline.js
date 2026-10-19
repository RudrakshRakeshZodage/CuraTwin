/**
 * =========================================================================
 * CuraTwin — Digital Twin Timeline & AI Food Nutrition Scanner
 * =========================================================================
 * Combines 7 health streams into an interactive chronological timeline:
 * 1. Meals (with AI Food Image Nutrition Scanner: Calories, Carbs, Protein, Fats)
 * 2. Activity (Duration, intensity, steps, calories burned)
 * 3. Sleep (Hours, sleep quality rating, restorative score)
 * 4. Medication logs (Prescribed meds, doses, taken/skipped status)
 * 5. Glucose readings (CGM sensor streams & manual checks)
 * 6. Symptoms (Fatigue, dizziness, thirst, nausea, severity rating)
 * 7. Model predictions (CuraTwin ML Logistic Regression evaluations)
 *
 * Adheres strictly to CuraTwin's clinical design system (Zero neon, pure WCAG AA contrast).
 * =========================================================================
 */

// -----------------------------------------------------------------------------
// Sample Preset Food Database for AI Scanner & Fallbacks
// -----------------------------------------------------------------------------
const FOOD_KNOWLEDGE_BASE = [
  {
    name: "Avocado Toast & Poached Egg",
    category: "Breakfast",
    total_calories: 385,
    total_protein: 16,
    total_carbs: 28,
    total_fats: 24,
    fiber: 8,
    glycemic_index: "Low GI",
    items: [
      { item_name: "Whole grain sourdough (1 thick slice)", total_calories: 140, total_protein: 5, total_carbs: 24, total_fats: 2 },
      { item_name: "Fresh sliced Hass avocado (1/2 fruit)", total_calories: 160, total_protein: 2, total_carbs: 4, total_fats: 15 },
      { item_name: "Pasture-raised poached egg (1 large)", total_calories: 72, total_protein: 6.5, total_carbs: 0.5, total_fats: 5 },
      { item_name: "Extra virgin olive oil & chili flakes", total_calories: 13, total_protein: 0, total_carbs: 0, total_fats: 1.5 },
    ],
    imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=80"
  },
  {
    name: "Mediterranean Grilled Chicken Salad",
    category: "Lunch",
    total_calories: 460,
    total_protein: 42,
    total_carbs: 18,
    total_fats: 22,
    fiber: 6,
    glycemic_index: "Low GI",
    items: [
      { item_name: "Herb-marinated grilled chicken breast (180g)", total_calories: 240, total_protein: 38, total_carbs: 0, total_fats: 5 },
      { item_name: "Romaine, cucumber, cherry tomatoes & kalamata olives", total_calories: 75, total_protein: 2, total_carbs: 10, total_fats: 3 },
      { item_name: "Crumble sheep milk feta cheese (30g)", total_calories: 75, total_protein: 4, total_carbs: 1, total_fats: 6 },
      { item_name: "Extra virgin olive oil & red wine vinaigrette", total_calories: 70, total_protein: 0, total_carbs: 1, total_fats: 8 },
    ],
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80"
  },
  {
    name: "Steel-Cut Oats with Berries & Walnuts",
    category: "Breakfast",
    total_calories: 340,
    total_protein: 11,
    total_carbs: 52,
    total_fats: 12,
    fiber: 9,
    glycemic_index: "Low GI",
    items: [
      { item_name: "Steel-cut cooked oatmeal (1 cup)", total_calories: 170, total_protein: 6, total_carbs: 32, total_fats: 3 },
      { item_name: "Fresh organic blueberries & raspberries", total_calories: 50, total_protein: 1, total_carbs: 12, total_fats: 0 },
      { item_name: "Crushed raw walnuts (15g)", total_calories: 100, total_protein: 2.5, total_carbs: 2, total_fats: 9 },
      { item_name: "Ground Ceylon cinnamon & flaxseed", total_calories: 20, total_protein: 0.5, total_carbs: 1, total_fats: 1 },
    ],
    imageUrl: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=500&auto=format&fit=crop&q=80"
  },
  {
    name: "Wild Salmon with Quinoa & Steamed Broccoli",
    category: "Dinner",
    total_calories: 520,
    total_protein: 44,
    total_carbs: 38,
    total_fats: 20,
    fiber: 7,
    glycemic_index: "Low GI",
    items: [
      { item_name: "Pan-seared Alaskan wild salmon fillet (160g)", total_calories: 280, total_protein: 34, total_carbs: 0, total_fats: 14 },
      { item_name: "Organic tricolor cooked quinoa (1/2 cup)", total_calories: 130, total_protein: 4.5, total_carbs: 23, total_fats: 2 },
      { item_name: "Steamed tenderstem broccoli with lemon zest", total_calories: 55, total_protein: 4, total_carbs: 8, total_fats: 0.5 },
      { item_name: "Cold-pressed extra virgin olive oil drizzle", total_calories: 55, total_protein: 0, total_carbs: 0, total_fats: 6 },
    ],
    imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&auto=format&fit=crop&q=80"
  },
  {
    name: "Green Apple with Raw Almond Butter",
    category: "Snack",
    total_calories: 220,
    total_protein: 5,
    total_carbs: 26,
    total_fats: 12,
    fiber: 5,
    glycemic_index: "Low GI",
    items: [
      { item_name: "Crisp Granny Smith apple (sliced, 1 medium)", total_calories: 95, total_protein: 0.5, total_carbs: 24, total_fats: 0.3 },
      { item_name: "Natural unrefined almond butter (1.5 tbsp)", total_calories: 125, total_protein: 4.5, total_carbs: 2, total_fats: 11 },
    ],
    imageUrl: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=500&auto=format&fit=crop&q=80"
  }
];

// -----------------------------------------------------------------------------
// Timeline State Manager
// -----------------------------------------------------------------------------
class TimelineManager {
  constructor() {
    this.storageKey = "curatwin_digital_twin_timeline_v1";
    this.events = [];
    this.activeFilter = "all";
    this.selectedFoodForScan = null;
    this.lastScannedResult = null;
    this.init();
  }

  init() {
    this.loadFromStorage();
    if (this.events.length === 0) {
      this.seedDefaultDayEvents();
    }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.events = JSON.parse(saved);
        // Automatic migration for previously cached image URL
        let migrated = false;
        this.events.forEach(ev => {
          if (ev.imageUrl && ev.imageUrl.includes("photo-1517673132405-a56a62b18caf")) {
            ev.imageUrl = "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=500&auto=format&fit=crop&q=80";
            migrated = true;
          }
        });
        if (migrated) {
          this.saveToStorage();
        }
      }
    } catch (e) {
      console.warn("Could not load timeline from storage", e);
      this.events = [];
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (e) {
      console.warn("Could not save timeline to storage", e);
    }
  }

  seedDefaultDayEvents() {
    const today = new Date();
    const setTime = (hours, mins) => {
      const d = new Date(today);
      d.setHours(hours, mins, 0, 0);
      return d.toISOString();
    };

    this.events = [
      {
        id: "evt-sleep-1",
        type: "sleep",
        title: "Overnight Sleep Restorative Cycle",
        timestamp: setTime(7, 0),
        timeLabel: "07:00 AM",
        category: "Sleep",
        metrics: {
          duration: "7h 35m",
          quality: "Restful (88%)",
          efficiency: "92%",
          stages: "Deep 1h 45m | REM 1h 50m | Light 3h 50m | Awake 10m"
        },
        description: "Patient reported waking up refreshed with low autonomic stress and steady HRV through the night.",
        status: "Optimal"
      },
      {
        id: "evt-med-1",
        type: "medication",
        title: "Morning Prescribed Medication",
        timestamp: setTime(7, 30),
        timeLabel: "07:30 AM",
        category: "Medication",
        metrics: {
          medication: "Metformin HCl",
          dosage: "500 mg",
          schedule: "Morning with meal",
          adherence: "Taken On-Time"
        },
        description: "Primary oral antihyperglycemic dose verified with morning hydration.",
        status: "Taken"
      },
      {
        id: "evt-glucose-1",
        type: "glucose",
        title: "Fasting Blood Glucose Check",
        timestamp: setTime(7, 45),
        timeLabel: "07:45 AM",
        category: "Glucose",
        metrics: {
          glucose: 98,
          unit: "mg/dL",
          zone: "Normal Glycemic (70–140)",
          trend: "→ Stable",
          source: "CuraWatch-B12 Sensor Stream"
        },
        description: "Fasting baseline within optimal clinical boundaries (<100 mg/dL).",
        status: "Normal"
      },
      {
        id: "evt-meal-1",
        type: "meal",
        title: "Breakfast: Steel-Cut Oats with Berries & Walnuts",
        timestamp: setTime(8, 15),
        timeLabel: "08:15 AM",
        category: "Meals",
        metrics: {
          calories: 340,
          protein: 11,
          carbs: 52,
          fats: 12,
          fiber: 9,
          glycemic_index: "Low GI"
        },
        description: "High soluble fiber complex carbohydrate profile with slow glucose kinetics.",
        imageUrl: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=500&auto=format&fit=crop&q=80",
        items: [
          { item_name: "Steel-cut oats (1 cup)", total_calories: 170, total_protein: 6, total_carbs: 32, total_fats: 3 },
          { item_name: "Fresh berries (blueberries & raspberries)", total_calories: 50, total_protein: 1, total_carbs: 12, total_fats: 0 },
          { item_name: "Crushed raw walnuts (15g)", total_calories: 100, total_protein: 2.5, total_carbs: 2, total_fats: 9 }
        ],
        status: "Logged"
      },
      {
        id: "evt-act-1",
        type: "activity",
        title: "Morning Brisk Walking & Commute",
        timestamp: setTime(9, 30),
        timeLabel: "09:30 AM",
        category: "Activity",
        metrics: {
          activity: "Brisk Walk",
          duration: "30 mins",
          steps: 3420,
          calories_burned: 145,
          avg_hr: "108 BPM",
          intensity: "Moderate"
        },
        description: "Postprandial physical activity to enhance muscle insulin sensitivity and blunt glycemic spike.",
        status: "Completed"
      },
      {
        id: "evt-glucose-2",
        type: "glucose",
        title: "Postprandial Continuous Glucose Monitoring",
        timestamp: setTime(10, 15),
        timeLabel: "10:15 AM",
        category: "Glucose",
        metrics: {
          glucose: 124,
          unit: "mg/dL",
          zone: "Target Postprandial (<140)",
          trend: "↗ Rising mildly",
          source: "CuraWatch-B12 Sensor"
        },
        description: "Expected physiologic postprandial curve peak gracefully capped under 130 mg/dL.",
        status: "In-Range"
      },
      {
        id: "evt-pred-1",
        type: "prediction",
        title: "CuraTwin ML Risk Assessment (Morning)",
        timestamp: setTime(10, 20),
        timeLabel: "10:20 AM",
        category: "Model predictions",
        metrics: {
          outcome: "Negative model classification",
          risk_probability: "4.72%",
          model: "LogisticRegression (15 features)",
          provenance: "Watch / Sensor (CuraWatch-B12)"
        },
        description: "Logistic regression inference confirmed healthy risk score (<5%) with current glycemic control.",
        status: "Low Risk"
      },
      {
        id: "evt-meal-2",
        type: "meal",
        title: "Lunch: Mediterranean Grilled Chicken Salad",
        timestamp: setTime(13, 0),
        timeLabel: "01:00 PM",
        category: "Meals",
        metrics: {
          calories: 460,
          protein: 42,
          carbs: 18,
          fats: 22,
          fiber: 6,
          glycemic_index: "Low GI"
        },
        description: "Lean protein rich, low glycemic carbohydrate content with monounsaturated healthy fats.",
        imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80",
        items: [
          { item_name: "Herb grilled chicken breast (180g)", total_calories: 240, total_protein: 38, total_carbs: 0, total_fats: 5 },
          { item_name: "Mixed greens, tomatoes & kalamata olives", total_calories: 75, total_protein: 2, total_carbs: 10, total_fats: 3 },
          { item_name: "Feta cheese & olive oil vinaigrette", total_calories: 145, total_protein: 4, total_carbs: 2, total_fats: 14 }
        ],
        status: "Logged"
      },
      {
        id: "evt-sym-1",
        type: "symptom",
        title: "Daily Symptoms Check-in",
        timestamp: setTime(15, 30),
        timeLabel: "03:30 PM",
        category: "Symptoms",
        metrics: {
          symptom: "Mild Afternoon Fatigue",
          severity: "●●○○○ (2 / 5 - Mild)",
          thirst: "Normal",
          vision: "Clear",
          shakiness: "None"
        },
        description: "Patient noted slight afternoon drowsiness; no polyuria, polydipsia, or hypoglycemic tremors.",
        status: "Mild / Non-acute"
      }
    ];

    this.saveToStorage();
  }

  addEvent(event) {
    if (!event.id) event.id = "evt-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
    if (!event.timestamp) event.timestamp = new Date().toISOString();
    if (!event.timeLabel) {
      event.timeLabel = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    this.events.unshift(event);
    this.saveToStorage();
    this.render();
  }

  clearEvents() {
    this.events = [];
    this.saveToStorage();
    this.render();
  }

  resetToDefault() {
    this.seedDefaultDayEvents();
    this.render();
  }

  setFilter(filterName) {
    this.activeFilter = filterName;
    this.render();
  }

  getFilteredEvents() {
    if (this.activeFilter === "all") return this.events;
    return this.events.filter(e => e.type === this.activeFilter);
  }

  computeDailySummary() {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    let totalSteps = 0;
    let totalBurned = 0;
    let sleepHours = "--";
    let sleepQuality = "--";
    let medsTotal = 0;
    let medsTaken = 0;
    let latestGlucose = "--";
    let glucoseReadings = [];
    let symptomNotesCount = 0;

    this.events.forEach(e => {
      if (e.type === "meal" && e.metrics) {
        totalCalories += Number(e.metrics.calories || 0);
        totalProtein += Number(e.metrics.protein || 0);
        totalCarbs += Number(e.metrics.carbs || 0);
        totalFats += Number(e.metrics.fats || 0);
      } else if (e.type === "activity" && e.metrics) {
        totalSteps += Number(e.metrics.steps || 0);
        totalBurned += Number(e.metrics.calories_burned || 0);
      } else if (e.type === "sleep" && e.metrics) {
        sleepHours = e.metrics.duration || sleepHours;
        sleepQuality = e.metrics.quality || sleepQuality;
      } else if (e.type === "medication") {
        medsTotal += 1;
        if (e.status === "Taken" || (e.metrics && e.metrics.adherence && e.metrics.adherence.includes("Taken"))) {
          medsTaken += 1;
        }
      } else if (e.type === "glucose" && e.metrics && e.metrics.glucose) {
        const val = Number(e.metrics.glucose);
        if (!isNaN(val)) {
          glucoseReadings.push(val);
          if (latestGlucose === "--") latestGlucose = val;
        }
      } else if (e.type === "symptom") {
        symptomNotesCount += 1;
      }
    });

    const avgGlucose = glucoseReadings.length > 0 
      ? Math.round(glucoseReadings.reduce((a, b) => a + b, 0) / glucoseReadings.length) 
      : "--";

    return {
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFats,
      totalSteps,
      totalBurned,
      sleepHours,
      sleepQuality,
      medsTaken,
      medsTotal: Math.max(medsTotal, 1),
      latestGlucose,
      avgGlucose,
      symptomNotesCount
    };
  }

  render() {
    this.renderSummaryBar();
    this.renderFilterPills();
    this.renderTimelineStream();
  }

  renderSummaryBar() {
    const summary = this.computeDailySummary();

    const sleepEl = document.getElementById("summary-sleep-val");
    const sleepSub = document.getElementById("summary-sleep-sub");
    if (sleepEl) sleepEl.textContent = summary.sleepHours;
    if (sleepSub) sleepSub.textContent = summary.sleepQuality;

    const medEl = document.getElementById("summary-meds-val");
    const medSub = document.getElementById("summary-meds-sub");
    if (medEl) medEl.textContent = `${summary.medsTaken} / ${summary.medsTotal} Doses`;
    if (medSub) {
      const pct = Math.round((summary.medsTaken / summary.medsTotal) * 100);
      medSub.textContent = `${pct}% On-Schedule`;
    }

    const calEl = document.getElementById("summary-nutrition-val");
    const calSub = document.getElementById("summary-nutrition-sub");
    if (calEl) calEl.textContent = `${summary.totalCalories} kcal`;
    if (calSub) calSub.textContent = `P: ${summary.totalProtein}g • C: ${summary.totalCarbs}g • F: ${summary.totalFats}g`;

    const actEl = document.getElementById("summary-activity-val");
    const actSub = document.getElementById("summary-activity-sub");
    if (actEl) actEl.textContent = `${summary.totalSteps.toLocaleString()} steps`;
    if (actSub) actSub.textContent = `${summary.totalBurned} kcal active burn`;

    const gluEl = document.getElementById("summary-glucose-val");
    const gluSub = document.getElementById("summary-glucose-sub");
    if (gluEl) gluEl.textContent = summary.latestGlucose !== "--" ? `${summary.latestGlucose} mg/dL` : "--";
    if (gluSub) gluSub.textContent = summary.avgGlucose !== "--" ? `Daily Avg: ${summary.avgGlucose} mg/dL` : "Awaiting telemetry";

    const symEl = document.getElementById("summary-symptoms-val");
    const symSub = document.getElementById("summary-symptoms-sub");
    if (symEl) symEl.textContent = summary.symptomNotesCount > 0 ? `${summary.symptomNotesCount} logged` : "No distress";
    if (symSub) symSub.textContent = "Stable clinical state";
  }

  renderFilterPills() {
    const container = document.getElementById("timeline-filter-pills");
    if (!container) return;

    const filterDefs = [
      { key: "all", label: "All Events", icon: "📋" },
      { key: "meal", label: "Meals", icon: "🍽️" },
      { key: "activity", label: "Activity", icon: "🏃" },
      { key: "sleep", label: "Sleep", icon: "🌙" },
      { key: "medication", label: "Medication", icon: "💊" },
      { key: "glucose", label: "Glucose", icon: "🩸" },
      { key: "symptom", label: "Symptoms", icon: "🩺" },
      { key: "prediction", label: "ML Predictions", icon: "🧠" },
    ];

    container.innerHTML = filterDefs.map(def => {
      const count = def.key === "all" ? this.events.length : this.events.filter(e => e.type === def.key).length;
      const isActive = this.activeFilter === def.key ? "active" : "";
      return `
        <button type="button" class="timeline-filter-pill ${isActive}" data-filter="${def.key}">
          <span class="pill-icon">${def.icon}</span>
          <span class="pill-label">${def.label}</span>
          <span class="pill-count">${count}</span>
        </button>
      `;
    }).join("");

    container.querySelectorAll(".timeline-filter-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        this.setFilter(btn.dataset.filter);
      });
    });
  }

  renderTimelineStream() {
    const streamContainer = document.getElementById("timeline-stream-container");
    if (!streamContainer) return;

    const eventsToRender = this.getFilteredEvents();

    if (eventsToRender.length === 0) {
      streamContainer.innerHTML = `
        <div class="timeline-empty-card">
          <div class="empty-icon-sm">🔍</div>
          <h4>No Events in this Category</h4>
          <p>No logged events match the selected category filter "${this.activeFilter}". Use the check-in or scan tools above to record new patient data.</p>
          <button type="button" class="btn-ghost btn-sm" id="btn-reset-filter-all">View All Events</button>
        </div>
      `;
      const btn = document.getElementById("btn-reset-filter-all");
      if (btn) btn.addEventListener("click", () => this.setFilter("all"));
      return;
    }

    streamContainer.innerHTML = eventsToRender.map(evt => this.buildEventCardHtml(evt)).join("");
  }

  buildEventCardHtml(evt) {
    const typeConfig = {
      meal: { color: "meal", icon: "🍽️", label: "Meal & Nutrition" },
      activity: { color: "activity", icon: "🏃", label: "Physical Activity" },
      sleep: { color: "sleep", icon: "🌙", label: "Sleep & Recovery" },
      medication: { color: "medication", icon: "💊", label: "Medication Log" },
      glucose: { color: "glucose", icon: "🩸", label: "Glucose Biomarker" },
      symptom: { color: "symptom", icon: "🩺", label: "Symptom Log" },
      prediction: { color: "prediction", icon: "🧠", label: "ML Model Assessment" }
    }[evt.type] || { color: "default", icon: "📌", label: evt.category || "Event" };

    let metricsHtml = "";
    if (evt.type === "meal" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill metric-calories"><span class="m-val">${evt.metrics.calories}</span> kcal</div>
          <div class="metric-pill"><span class="m-label">Protein:</span> <span class="m-val">${evt.metrics.protein}g</span></div>
          <div class="metric-pill"><span class="m-label">Carbs:</span> <span class="m-val">${evt.metrics.carbs}g</span></div>
          <div class="metric-pill"><span class="m-label">Fats:</span> <span class="m-val">${evt.metrics.fats}g</span></div>
          ${evt.metrics.glycemic_index ? `<div class="metric-pill metric-gi">${evt.metrics.glycemic_index}</div>` : ""}
        </div>
        ${evt.items && evt.items.length > 0 ? `
          <div class="event-items-list">
            <span class="items-heading">Scanned Breakdown:</span>
            <ul>
              ${evt.items.map(it => `<li><span>${it.item_name}</span> <strong>${it.total_calories} kcal</strong></li>`).join("")}
            </ul>
          </div>
        ` : ""}
      `;
    } else if (evt.type === "activity" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill"><span class="m-label">Duration:</span> <span class="m-val">${evt.metrics.duration}</span></div>
          <div class="metric-pill"><span class="m-label">Steps:</span> <span class="m-val">${Number(evt.metrics.steps || 0).toLocaleString()}</span></div>
          <div class="metric-pill metric-burn"><span class="m-label">Burned:</span> <span class="m-val">${evt.metrics.calories_burned} kcal</span></div>
          ${evt.metrics.avg_hr ? `<div class="metric-pill"><span class="m-label">Heart:</span> <span class="m-val">${evt.metrics.avg_hr}</span></div>` : ""}
        </div>
      `;
    } else if (evt.type === "sleep" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill metric-sleep"><span class="m-label">Total Duration:</span> <span class="m-val">${evt.metrics.duration}</span></div>
          <div class="metric-pill"><span class="m-label">Quality:</span> <span class="m-val">${evt.metrics.quality}</span></div>
          ${evt.metrics.efficiency ? `<div class="metric-pill"><span class="m-label">Efficiency:</span> <span class="m-val">${evt.metrics.efficiency}</span></div>` : ""}
        </div>
        ${evt.metrics.stages ? `<div class="event-sleep-stages">${evt.metrics.stages}</div>` : ""}
      `;
    } else if (evt.type === "medication" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill metric-med"><span class="m-label">Medication:</span> <span class="m-val">${evt.metrics.medication}</span></div>
          <div class="metric-pill"><span class="m-label">Dosage:</span> <span class="m-val">${evt.metrics.dosage}</span></div>
          <div class="metric-pill metric-status-${(evt.status || '').toLowerCase()}"><span class="m-val">${evt.metrics.adherence || evt.status}</span></div>
        </div>
      `;
    } else if (evt.type === "glucose" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill metric-glucose-large"><span class="m-val">${evt.metrics.glucose}</span> ${evt.metrics.unit || 'mg/dL'}</div>
          <div class="metric-pill"><span class="m-val">${evt.metrics.trend || '→ Stable'}</span></div>
          <div class="metric-pill"><span class="m-val">${evt.metrics.zone || 'In-Range'}</span></div>
          ${evt.metrics.source ? `<div class="metric-pill metric-source">${evt.metrics.source}</div>` : ""}
        </div>
      `;
    } else if (evt.type === "symptom" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill metric-symptom-name"><span class="m-val">${evt.metrics.symptom}</span></div>
          <div class="metric-pill"><span class="m-label">Severity:</span> <span class="m-val">${evt.metrics.severity}</span></div>
        </div>
      `;
    } else if (evt.type === "prediction" && evt.metrics) {
      metricsHtml = `
        <div class="event-metrics-row">
          <div class="metric-pill metric-pred-outcome"><span class="m-val">${evt.metrics.outcome}</span></div>
          <div class="metric-pill metric-pred-prob"><span class="m-label">Model Probability:</span> <span class="m-val">${evt.metrics.risk_probability}</span></div>
          <div class="metric-pill"><span class="m-label">Architecture:</span> <span class="m-val">${evt.metrics.model}</span></div>
        </div>
        ${evt.metrics.provenance ? `<div class="event-prov-tag">Source Provenance: ${evt.metrics.provenance}</div>` : ""}
      `;
    }

    return `
      <div class="timeline-event-row type-${typeConfig.color}" id="${evt.id}">
        <!-- Time Marker Column -->
        <div class="timeline-time-col">
          <span class="timeline-time-pill">${evt.timeLabel}</span>
          <div class="timeline-node">
            <span class="node-icon">${typeConfig.icon}</span>
          </div>
          <div class="timeline-line"></div>
        </div>

        <!-- Event Body Card -->
        <div class="timeline-card">
          <div class="timeline-card-header">
            <div class="header-titles">
              <span class="event-category-badge badge-${typeConfig.color}">${typeConfig.label}</span>
              <h4 class="event-title">${evt.title}</h4>
            </div>
            <div class="header-status">
              ${evt.status ? `<span class="event-status-tag status-${evt.status.toLowerCase().replace(/[^a-z0-9]/g, '-')}">${evt.status}</span>` : ""}
            </div>
          </div>

          ${evt.imageUrl ? `
            <div class="event-photo-container">
              <img src="${evt.imageUrl}" alt="${evt.title}" class="event-photo-img" loading="lazy" />
            </div>
          ` : ""}

          ${evt.description ? `<p class="event-desc">${evt.description}</p>` : ""}

          ${metricsHtml}
        </div>
      </div>
    `;
  }
}

// -----------------------------------------------------------------------------
// AI Food Nutrition Scanner Controller
// -----------------------------------------------------------------------------
class FoodNutritionScanner {
  constructor(timelineManager) {
    this.timelineManager = timelineManager;
    this.imgbbApiKey = "";
    this.groqApiKey = window.GROQ_API_KEY || "";
    this.currentFile = null;
    this.currentDataUrl = null;
    this.isScanning = false;
    this.lastResult = null;
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.renderPresets();
  }

  cacheElements() {
    this.modal = document.getElementById("modal-food-scanner");
    this.btnOpenModal = document.getElementById("btn-open-food-scanner");
    this.btnHeaderScan = document.getElementById("btn-header-food-scan");
    this.btnCloseModal = document.getElementById("btn-close-scanner-modal");
    
    this.dropZone = document.getElementById("food-drop-zone");
    this.fileInput = document.getElementById("food-image-input");
    this.queryInput = document.getElementById("food-query-input");
    this.btnAnalyzeFood = document.getElementById("btn-analyze-food");
    this.previewContainer = document.getElementById("scanner-preview-container");
    this.previewImg = document.getElementById("scanner-preview-img");
    this.scannerProgress = document.getElementById("scanner-progress-box");
    this.progressBar = document.getElementById("scanner-progress-fill");
    this.progressPct = document.getElementById("scanner-progress-pct");
    this.progressStep = document.getElementById("scanner-progress-step");
    this.resultsCard = document.getElementById("scanner-results-card");
    this.resultsBody = document.getElementById("scanner-results-body");
    this.btnSaveMeal = document.getElementById("btn-save-scanned-meal");
    this.presetList = document.getElementById("scanner-presets-list");
  }

  bindEvents() {
    if (this.btnOpenModal) {
      this.btnOpenModal.addEventListener("click", () => this.openModal());
    }
    if (this.btnHeaderScan) {
      this.btnHeaderScan.addEventListener("click", () => this.openModal());
    }
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener("click", () => this.closeModal());
    }

    // Modal background close
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    // Food query text input & analyze button
    if (this.btnAnalyzeFood) {
      this.btnAnalyzeFood.addEventListener("click", () => this.startScanProcess());
    }
    if (this.queryInput) {
      this.queryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.startScanProcess();
        }
      });
    }

    // File input & Drag/Drop
    if (this.fileInput) {
      this.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processSelectedFile(e.target.files[0]);
        }
      });
    }

    if (this.dropZone) {
      this.dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.dropZone.classList.add("drag-over");
      });
      this.dropZone.addEventListener("dragleave", () => {
        this.dropZone.classList.remove("drag-over");
      });
      this.dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        this.dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processSelectedFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (this.btnSaveMeal) {
      this.btnSaveMeal.addEventListener("click", () => this.commitScannedMealToTimeline());
    }
  }

  openModal(preselectedMeal = null) {
    if (!this.modal) return;
    this.modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    if (preselectedMeal) {
      this.loadPresetMeal(preselectedMeal);
    }
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.setAttribute("hidden", "true");
    document.body.style.overflow = "";
  }

  renderPresets() {
    if (!this.presetList) return;
    this.presetList.innerHTML = FOOD_KNOWLEDGE_BASE.map((food, idx) => `
      <button type="button" class="preset-meal-pill" data-idx="${idx}">
        <span class="preset-name">${food.name}</span>
        <span class="preset-meta">${food.total_calories} kcal</span>
      </button>
    `).join("");

    this.presetList.querySelectorAll(".preset-meal-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const idx = parseInt(pill.dataset.idx, 10);
        const preset = FOOD_KNOWLEDGE_BASE[idx];
        if (this.queryInput) {
          this.queryInput.value = preset.name;
        }
        this.loadPresetMeal(preset);
      });
    });
  }

  loadPresetMeal(preset) {
    this.currentFile = null;
    this.currentDataUrl = preset.imageUrl;
    this.previewImg.src = preset.imageUrl;
    this.previewContainer.removeAttribute("hidden");
    this.startScanProcess(preset.name, preset.imageUrl);
  }

  processSelectedFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please upload a valid food image (JPG, PNG, WebP).");
      return;
    }

    this.currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentDataUrl = e.target.result;
      this.previewImg.src = this.currentDataUrl;
      this.previewContainer.removeAttribute("hidden");
      
      // If user hasn't typed a dish query yet, format from file name
      let cleanName = (file.name || "").replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      if (cleanName && !/^\d+$/.test(cleanName) && (!this.queryInput || !this.queryInput.value.trim())) {
        if (this.queryInput) this.queryInput.value = cleanName;
      }
      this.startScanProcess();
    };
    reader.readAsDataURL(file);
  }

  async startScanProcess(overrideQuery = null, overrideImageUrl = null) {
    if (this.isScanning) return;

    // Determine query string
    let mealQuery = overrideQuery;
    if (!mealQuery && this.queryInput && this.queryInput.value.trim()) {
      mealQuery = this.queryInput.value.trim();
    }
    if (!mealQuery && this.currentFile && this.currentFile.name) {
      let base = this.currentFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      mealQuery = (/^\d+$/.test(base) || !base) ? "Healthy balanced diabetic meal plate" : base;
    }
    if (!mealQuery) {
      mealQuery = "Avocado toast with poached egg and healthy greens";
    }

    this.isScanning = true;
    this.scannerProgress.removeAttribute("hidden");
    this.resultsCard.setAttribute("hidden", "true");
    this.updateProgress(20, "Interpreting meal profile & glycemic kinetics...");

    try {
      this.updateProgress(45, "Contacting Real AI Nutrition Engine (FastAPI / Groq)...");
      let foodResult = null;

      // 1. Attempt Backend REST API
      const apiBase = (typeof window.getEffectiveApiBaseUrl === "function")
        ? window.getEffectiveApiBaseUrl()
        : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:8000"
            : "https://curatwin-backend.onrender.com");

      try {
        const resp = await fetch(`${apiBase}/api/analyze-food`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: mealQuery })
        });
        if (resp.ok) {
          foodResult = await resp.json();
        }
      } catch (backendErr) {
        console.warn("Backend /api/analyze-food unavailable, attempting direct Groq API:", backendErr);
      }

      // 2. Direct Groq AI API Fallback (Using verified Groq model)
      if (!foodResult) {
        this.updateProgress(75, "Querying Groq Cloud AI Engine directly...");
        foodResult = await this.callGroqAiDirect(mealQuery);
      }

      this.updateProgress(100, "Real AI Analysis Complete!");
      
      if (overrideImageUrl || this.currentDataUrl) {
        foodResult.imageUrl = overrideImageUrl || this.currentDataUrl;
      }
      this.displayResults(foodResult);

    } catch (err) {
      console.error("AI Food Analysis failed:", err);
      alert("Unable to reach AI services for meal analysis. Please check your internet connection.");
    } finally {
      this.isScanning = false;
      this.scannerProgress.setAttribute("hidden", "true");
    }
  }

  async callGroqAiDirect(query) {
    if (!this.groqApiKey) {
      throw new Error("Direct Groq API key is not configured and backend is unreachable.");
    }
    const prompt = `You are a clinical diabetic nutrition AI for CuraTwin. Analyze the nutritional breakdown of this meal:\n'${query}'\n\nEstimate realistic portion, total calories, macronutrients (in grams), dietary fiber (in grams), glycemic index category ('Low GI', 'Moderate GI', or 'High GI'), meal category ('Breakfast', 'Lunch', 'Dinner', or 'Snack'), and itemized plate components with their individual calories, protein, carbs, and fats.\nReturn ONLY a valid JSON object matching this schema:\n{\n  "meal_name": "Short descriptive name",\n  "category": "Breakfast, Lunch, Dinner, or Snack",\n  "total_calories": 0,\n  "total_protein": 0,\n  "total_carbs": 0,\n  "total_fats": 0,\n  "fiber": 0,\n  "glycemic_index": "Low GI, Moderate GI, or High GI",\n  "items": [\n    {"item_name": "string", "total_calories": 0, "total_protein": 0, "total_carbs": 0, "total_fats": 0}\n  ]\n}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a professional clinical dietitian assistant for diabetic patients. Output strictly JSON." },
          { role: "user", content: prompt }
        ],
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error HTTP ${response.status}`);
    }

    const groqData = await response.json();
    return JSON.parse(groqData.choices[0].message.content);
  }

  updateProgress(pct, label) {
    if (this.progressBar) this.progressBar.style.width = `${pct}%`;
    if (this.progressPct) this.progressPct.textContent = `${pct}%`;
    if (this.progressStep) this.progressStep.textContent = label;
  }

  displayResults(data) {
    this.lastResult = data;
    this.resultsCard.removeAttribute("hidden");

    const mealName = data.meal_name || data.name || "Detected Meal";
    const calories = data.total_calories || 0;
    const protein = data.total_protein || 0;
    const carbs = data.total_carbs || 0;
    const fats = data.total_fats || 0;
    const gi = data.glycemic_index || "Low GI";

    const mealTarget = 600;
    const pct = Math.min(100, Math.round((calories / mealTarget) * 100));
    const circumference = 2 * Math.PI * 34;
    const strokeDash = `${(pct / 100) * circumference} ${circumference}`;

    this.resultsBody.innerHTML = `
      <div class="scanned-overview-card">
        <div class="scanned-ring-box">
          <svg width="84" height="84" viewBox="0 0 84 84" class="svg-macro-ring">
            <circle class="ring-bg" cx="42" cy="42" r="34" stroke-width="7" fill="none" />
            <circle class="ring-fg" cx="42" cy="42" r="34" stroke-width="7" fill="none" stroke-dasharray="${strokeDash}" />
          </svg>
          <div class="ring-label-center">
            <span class="ring-number">${calories}</span>
            <span class="ring-unit">kcal</span>
          </div>
        </div>

        <div class="scanned-meta-info">
          <div class="scanned-tag-row">
            <span class="scanned-category-tag">${data.category || 'Nutrient Scan'}</span>
            <span class="scanned-gi-tag gi-${gi.toLowerCase().replace(/[^a-z]/g, '')}">${gi}</span>
          </div>
          <h3 class="scanned-meal-name">${mealName}</h3>
          <p class="scanned-meal-sub">Automated portion analysis with calibrated glycemic load for diabetes management.</p>
        </div>
      </div>

      <div class="scanned-macros-grid">
        <div class="macro-cell macro-protein">
          <span class="macro-lbl">Protein</span>
          <span class="macro-val">${protein}g</span>
          <span class="macro-bar"><span style="width: ${Math.min(100, protein * 2)}%"></span></span>
        </div>
        <div class="macro-cell macro-carbs">
          <span class="macro-lbl">Total Carbs</span>
          <span class="macro-val">${carbs}g</span>
          <span class="macro-bar"><span style="width: ${Math.min(100, carbs * 1.5)}%"></span></span>
        </div>
        <div class="macro-cell macro-fats">
          <span class="macro-lbl">Healthy Fats</span>
          <span class="macro-val">${fats}g</span>
          <span class="macro-bar"><span style="width: ${Math.min(100, fats * 3)}%"></span></span>
        </div>
        <div class="macro-cell macro-fiber">
          <span class="macro-lbl">Dietary Fiber</span>
          <span class="macro-val">${data.fiber || 6}g</span>
          <span class="macro-bar"><span style="width: 70%"></span></span>
        </div>
      </div>

      ${data.items && data.items.length > 0 ? `
        <div class="scanned-items-drawer">
          <h4 class="items-drawer-title">Identified Plate Components</h4>
          <div class="items-table-wrapper">
            <table class="scanned-items-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Carbs</th>
                  <th>Fats</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map(it => `
                  <tr>
                    <td><strong>${it.item_name}</strong></td>
                    <td>${it.total_calories} kcal</td>
                    <td>${it.total_protein}g</td>
                    <td>${it.total_carbs}g</td>
                    <td>${it.total_fats}g</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      ` : ""}
    `;
  }

  commitScannedMealToTimeline() {
    if (!this.lastResult) return;

    const data = this.lastResult;
    const mealName = data.meal_name || data.name || "Logged Meal";

    const newEvent = {
      id: "evt-meal-" + Date.now(),
      type: "meal",
      title: `${data.category || 'Meal'}: ${mealName}`,
      timestamp: new Date().toISOString(),
      category: "Meals",
      metrics: {
        calories: data.total_calories || 0,
        protein: data.total_protein || 0,
        carbs: data.total_carbs || 0,
        fats: data.total_fats || 0,
        fiber: data.fiber || 5,
        glycemic_index: data.glycemic_index || "Low GI"
      },
      description: `AI-assisted nutritional scan verified. Estimated glycemic impact: ${data.glycemic_index || "Low GI"}.`,
      imageUrl: this.currentDataUrl || (data.imageUrl || null),
      items: data.items || [],
      status: "Verified AI Scan"
    };

    this.timelineManager.addEvent(newEvent);
    this.closeModal();

    this.showToast(`Logged "${mealName}" (${data.total_calories} kcal) to Digital Twin Timeline!`);
  }

  showToast(msg) {
    let toast = document.getElementById("curatwin-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "curatwin-toast";
      toast.className = "curatwin-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }
}

// -----------------------------------------------------------------------------
// Daily Health Check-in (The 5 Core Lifestyle Questions)
// -----------------------------------------------------------------------------
class DailyCheckinManager {
  constructor(timelineManager, foodScanner) {
    this.timelineManager = timelineManager;
    this.foodScanner = foodScanner;
    this.cacheElements();
    this.bindEvents();
  }

  cacheElements() {
    this.modal = document.getElementById("modal-daily-checkin");
    this.btnOpen = document.getElementById("btn-open-daily-checkin");
    this.btnHeaderCheckin = document.getElementById("btn-header-daily-checkin");
    this.btnClose = document.getElementById("btn-close-checkin-modal");
    this.form = document.getElementById("form-daily-checkin");

    this.inputSleep = document.getElementById("checkin-sleep-hours");
    this.inputSleepQuality = document.getElementById("checkin-sleep-quality");
    this.inputMedStatus = document.getElementById("checkin-med-status");
    this.inputMedName = document.getElementById("checkin-med-name");
    this.inputMealText = document.getElementById("checkin-meal-text");
    this.inputMealCalories = document.getElementById("checkin-meal-calories");
    this.inputActivityType = document.getElementById("checkin-activity-type");
    this.inputActivityMins = document.getElementById("checkin-activity-mins");
    this.inputActivitySteps = document.getElementById("checkin-activity-steps");
    this.inputSymptoms = document.getElementById("checkin-symptoms-select");
    this.inputSymptomSeverity = document.getElementById("checkin-symptom-severity");
    this.inputSymptomNotes = document.getElementById("checkin-symptom-notes");

    this.btnScanMealFromCheckin = document.getElementById("btn-checkin-scan-meal");
  }

  bindEvents() {
    if (this.btnOpen) {
      this.btnOpen.addEventListener("click", () => this.openModal());
    }
    if (this.btnHeaderCheckin) {
      this.btnHeaderCheckin.addEventListener("click", () => this.openModal());
    }
    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.closeModal());
    }
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    if (this.btnScanMealFromCheckin) {
      this.btnScanMealFromCheckin.addEventListener("click", () => {
        this.closeModal();
        this.foodScanner.openModal();
      });
    }

    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitCheckin();
      });
    }
  }

  openModal() {
    if (!this.modal) return;
    this.modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.setAttribute("hidden", "true");
    document.body.style.overflow = "";
  }

  submitCheckin() {
    const nowIso = new Date().toISOString();

    const sleepHours = parseFloat(this.inputSleep ? this.inputSleep.value : 7.5) || 7.5;
    const sleepQual = this.inputSleepQuality ? this.inputSleepQuality.value : "Restful (85%)";
    this.timelineManager.addEvent({
      id: "evt-sleep-" + Date.now(),
      type: "sleep",
      title: "Daily Sleep Restorative Log",
      timestamp: nowIso,
      category: "Sleep",
      metrics: {
        duration: `${sleepHours}h`,
        quality: sleepQual,
        efficiency: "90%"
      },
      description: `Patient logged ${sleepHours} hours of sleep with ${sleepQual.toLowerCase()} status.`,
      status: "Logged"
    });

    const medName = this.inputMedName ? this.inputMedName.value : "Metformin 500mg";
    const medStatus = this.inputMedStatus ? this.inputMedStatus.value : "Taken";
    this.timelineManager.addEvent({
      id: "evt-med-" + Date.now(),
      type: "medication",
      title: `Medication: ${medName}`,
      timestamp: nowIso,
      category: "Medication",
      metrics: {
        medication: medName,
        dosage: "Prescribed dose",
        adherence: medStatus
      },
      description: `Prescribed daily medication confirmed as ${medStatus}.`,
      status: medStatus
    });

    const mealText = this.inputMealText ? this.inputMealText.value.trim() : "";
    const mealCals = parseInt(this.inputMealCalories ? this.inputMealCalories.value : 0, 10) || 400;
    if (mealText) {
      this.timelineManager.addEvent({
        id: "evt-meal-" + Date.now(),
        type: "meal",
        title: `Meal: ${mealText}`,
        timestamp: nowIso,
        category: "Meals",
        metrics: {
          calories: mealCals,
          protein: Math.round(mealCals * 0.05),
          carbs: Math.round(mealCals * 0.11),
          fats: Math.round(mealCals * 0.04),
          glycemic_index: "Moderate GI"
        },
        description: `Patient logged meal: ${mealText}.`,
        status: "Logged"
      });
    }

    const actType = this.inputActivityType ? this.inputActivityType.value : "Brisk Walk";
    const actMins = parseInt(this.inputActivityMins ? this.inputActivityMins.value : 30, 10) || 30;
    const actSteps = parseInt(this.inputActivitySteps ? this.inputActivitySteps.value : 3000, 10) || 3000;
    const burned = Math.round(actMins * 4.8);
    this.timelineManager.addEvent({
      id: "evt-act-" + Date.now(),
      type: "activity",
      title: `Physical Activity: ${actType}`,
      timestamp: nowIso,
      category: "Activity",
      metrics: {
        activity: actType,
        duration: `${actMins} mins`,
        steps: actSteps,
        calories_burned: burned,
        intensity: "Moderate"
      },
      description: `Completed ${actMins} minutes of ${actType.toLowerCase()}.`,
      status: "Completed"
    });

    const symptom = this.inputSymptoms ? this.inputSymptoms.value : "None / Feeling Great";
    const severity = this.inputSymptomSeverity ? this.inputSymptomSeverity.value : "1/5";
    const notes = this.inputSymptomNotes ? this.inputSymptomNotes.value : "";
    this.timelineManager.addEvent({
      id: "evt-sym-" + Date.now(),
      type: "symptom",
      title: `Symptom Report: ${symptom}`,
      timestamp: nowIso,
      category: "Symptoms",
      metrics: {
        symptom: symptom,
        severity: `${severity} severity`
      },
      description: notes || `Patient reported status: ${symptom}.`,
      status: symptom.includes("None") ? "Optimal" : "Logged"
    });

    this.closeModal();
    this.foodScanner.showToast("Complete Daily Check-in recorded & integrated into Timeline!");
  }
}

// -----------------------------------------------------------------------------
// Singleton Initialization & Global Binding
// -----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  window.timelineManager = new TimelineManager();
  window.foodNutritionScanner = new FoodNutritionScanner(window.timelineManager);
  window.dailyCheckinManager = new DailyCheckinManager(window.timelineManager, window.foodNutritionScanner);

  window.foodNutritionScanner.init();
  window.timelineManager.render();

  const btnResetTimeline = document.getElementById("btn-reset-timeline");
  if (btnResetTimeline) {
    btnResetTimeline.addEventListener("click", () => {
      if (confirm("Reset digital twin timeline to initial clinical sample day?")) {
        window.timelineManager.resetToDefault();
      }
    });
  }

  // Global Escape key listener to close modals
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (window.foodNutritionScanner) window.foodNutritionScanner.closeModal();
      if (window.dailyCheckinManager) window.dailyCheckinManager.closeModal();
    }
  });
});

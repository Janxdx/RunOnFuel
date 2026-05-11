/**
 * RunOnFuel — Calculation Engine
 * Implements all physiological algorithms from the scientific analysis:
 * - Intestinal transport kinetics (SGLT1/GLUT5)
 * - Glucose:Fructose ratio selection (1:0, 2:1, 1:0.8 paradigm)
 * - Sucrose/Maltodextrin recipe synthesis
 * - Osmolality control
 * - Sport-specific GI tolerance caps
 * - Tennis changeover protocol
 * - HR zone mapping (Tanaka formula)
 */

'use strict';

const Engine = (() => {

  // ── Constants ────────────────────────────────────────────────────────────

  const ZONE_DEFS = [
    { zone: 1, label: 'Zone 1 — Regeneration',          hrMin: 0,   hrMax: 60,  choMin: 0,   choMax: 30  },
    { zone: 2, label: 'Zone 2 — Grundlagenausdauer',    hrMin: 60,  hrMax: 70,  choMin: 0,   choMax: 30  },
    { zone: 3, label: 'Zone 3 — Tempo / GA2',           hrMin: 70,  hrMax: 80,  choMin: 30,  choMax: 60  },
    { zone: 4, label: 'Zone 4 — Anaerobe Schwelle',     hrMin: 80,  hrMax: 90,  choMin: 60,  choMax: 90  },
    { zone: 5, label: 'Zone 5 — VO₂max-Intervalle',    hrMin: 90,  hrMax: 100, choMin: 90,  choMax: 120 },
  ];

  // Gut-training multiplier on GI cap
  const GUT_TRAINING_FACTOR = {
    none:     1.0,
    moderate: 1.15,
    advanced: 1.30,
  };

  // Osmolality reference (mOsm/kg) per g/L concentration
  // Sucrose: ~3.3 mOsm per g/L; Maltodextrin DE<12: ~1.2 mOsm per g/L
  const OSMO_PER_G_SUCROSE      = 3.3;
  const OSMO_PER_G_MALTODEXTRIN = 1.2;

  // ── Tanaka HR Formula ────────────────────────────────────────────────────

  function hrMax(age) {
    return Math.round(208 - 0.7 * age);
  }

  // ── Zone Detection ────────────────────────────────────────────────────────

  function getZone(intensityPct) {
    for (let z of ZONE_DEFS) {
      if (intensityPct >= z.hrMin && intensityPct < z.hrMax) return z;
    }
    return ZONE_DEFS[ZONE_DEFS.length - 1];
  }

  // ── Target CHO Rate ──────────────────────────────────────────────────────

  /**
   * Step A: Determine base CHO rate from duration + zone,
   *         then apply sport-specific hard caps.
   */
  function targetCHORate({ sport, duration, intensityPct, gutTraining }) {
    const zone = getZone(intensityPct);

    // Duration-based window (minutes → category)
    let durationCategory;
    if (duration < 60)       durationCategory = 'very_short';
    else if (duration < 90)  durationCategory = 'short';
    else if (duration < 150) durationCategory = 'medium';
    else if (duration < 180) durationCategory = 'long';
    else                     durationCategory = 'extreme';

    // Base rate from duration
    const durationBaseMap = {
      very_short: { min: 0,  max: 0   }, // mouth rinse only
      short:      { min: 0,  max: 30  },
      medium:     { min: 30, max: 60  },
      long:       { min: 60, max: 90  },
      extreme:    { min: 90, max: 120 },
    };
    const durationBase = durationBaseMap[durationCategory];

    // Interpolate within window using zone position
    const zoneNorm = (intensityPct - zone.hrMin) / Math.max(zone.hrMax - zone.hrMin, 1);
    let targetRate = durationBase.min + (durationBase.max - durationBase.min) * Math.min(zoneNorm, 1);

    // Clamp to zone's own CHO range as lower bound guide
    // (zone provides physiological minimum floor)
    if (duration >= 90) {
      targetRate = Math.max(targetRate, zone.choMin);
    }

    // Round to nearest 5 for cleanliness
    targetRate = Math.round(targetRate / 5) * 5;

    // ── Sport-specific hard caps ──────────────────────────────────────────
    const gutFactor = GUT_TRAINING_FACTOR[gutTraining] || 1.0;

    if (sport === 'cycling') {
      targetRate = Math.min(targetRate, 120);
    } else if (sport === 'running') {
      // Running GI cap: max 60 g/h without gut training, up to 90 with advanced
      const runningCap = Math.round(60 * gutFactor);
      targetRate = Math.min(targetRate, Math.min(runningCap, 90));
    } else if (sport === 'tennis') {
      // Tennis max 90 g/h for very long matches
      targetRate = Math.min(targetRate, 90);
    }

    return { targetRate, zone, durationCategory, gutFactor };
  }

  // ── Ratio Selection (Step B) ─────────────────────────────────────────────

  /**
   * Returns ratio descriptor and exact glucose/fructose split in grams/h.
   * < 60 g/h  → pure glucose (1:0)
   * 60–90 g/h → classic 2:1 (Glc:Frc)
   * >90 g/h   → modern 1:0.8 (Glc:Frc) — elite cycling paradigm
   */
  function ratioForRate(targetRate) {
    if (targetRate <= 0) {
      return {
        label: 'Mouthrinse',
        ratioStr: '—',
        glucose: 0,
        fructose: 0,
        glucosePct: 100,
        fructosePct: 0,
        paradigm: 'mouthrinse',
      };
    }
    if (targetRate <= 60) {
      return {
        label: 'Reine Glukose / Maltodextrin',
        ratioStr: '1:0',
        glucose: targetRate,
        fructose: 0,
        glucosePct: 100,
        fructosePct: 0,
        paradigm: 'glucose_only',
      };
    }
    if (targetRate <= 90) {
      // 2:1 → 66.67% glucose, 33.33% fructose
      const fructose = Math.round(targetRate / 3);
      const glucose  = targetRate - fructose;
      return {
        label: 'Multiple Transportable CHO',
        ratioStr: '2:1',
        glucose,
        fructose,
        glucosePct: Math.round((glucose / targetRate) * 100),
        fructosePct: Math.round((fructose / targetRate) * 100),
        paradigm: '2_to_1',
      };
    }
    // 1:0.8 → 55.56% glucose, 44.44% fructose
    const fructose = Math.round(targetRate * 0.444);
    const glucose  = targetRate - fructose;
    return {
      label: 'Elite 1:0.8 — Maximale Oxidationsrate',
      ratioStr: '1:0.8',
      glucose,
      fructose,
      glucosePct: Math.round((glucose / targetRate) * 100),
      fructosePct: Math.round((fructose / targetRate) * 100),
      paradigm: '1_to_0_8',
    };
  }

  // ── Recipe Synthesis (Module 4) ──────────────────────────────────────────

  /**
   * Converts glucose/fructose targets into Sucrose + Maltodextrin amounts.
   *
   * Algorithm:
   *   Sucrose = fructose_needed × 2  (sucrose is 50/50 Glc+Frc)
   *   Maltodextrin = glucose_needed − (sucrose / 2)
   */
  function synthesizeRecipe({ glucose, fructose, targetRate }) {
    if (targetRate <= 0) {
      return {
        sucrose: 0, maltodextrin: 0, totalCheck: 0,
        sucroseGlucose: 0, sucroseFructose: 0,
        note: 'Mouthrinse: 6%-Lösung, kein Schlucken erforderlich.',
      };
    }

    if (fructose <= 0) {
      // Pure glucose / maltodextrin — no sucrose needed
      return {
        sucrose:      0,
        maltodextrin: Math.round(glucose * 10) / 10,
        totalCheck:   Math.round(glucose * 10) / 10,
        sucroseGlucose:  0,
        sucroseFructose: 0,
      };
    }

    const sucrose      = fructose * 2;                    // covers all fructose + equal glucose from sucrose
    const maltodextrin = Math.max(0, glucose - fructose); // fills remaining glucose gap

    const totalCheck = sucrose + maltodextrin;

    return {
      sucrose:      Math.round(sucrose * 10) / 10,
      maltodextrin: Math.round(maltodextrin * 10) / 10,
      totalCheck:   Math.round(totalCheck * 10) / 10,
      sucroseGlucose:   Math.round((sucrose / 2) * 10) / 10,
      sucroseFructose:  Math.round((sucrose / 2) * 10) / 10,
    };
  }

  // ── Osmolality Check (Module 3) ──────────────────────────────────────────

  /**
   * Estimates solution osmolality from sucrose + maltodextrin per litre.
   * Returns status: 'hypo' | 'iso' | 'hyper'
   */
  function checkOsmolality({ sucrose, maltodextrin, fluidLitres }) {
    if (fluidLitres <= 0) return { mOsm: 0, status: 'hypo', pct: 0 };

    const gPerL_sucrose      = sucrose      / fluidLitres;
    const gPerL_maltodextrin = maltodextrin / fluidLitres;
    const concentration_pct  = (sucrose + maltodextrin) / (fluidLitres * 10);

    const mOsm = Math.round(
      gPerL_sucrose      * OSMO_PER_G_SUCROSE +
      gPerL_maltodextrin * OSMO_PER_G_MALTODEXTRIN
    );

    let status;
    if (mOsm < 280)       status = 'hypo';
    else if (mOsm <= 320) status = 'iso';
    else                  status = 'hyper';

    return { mOsm, status, concentration_pct: Math.round(concentration_pct * 10) / 10 };
  }

  // ── Fluid & Sodium (Module 3) ────────────────────────────────────────────

  function fluidNeeds({ sweatRate, duration, temperature, humidity }) {
    const durationH = duration / 60;
    let rate = sweatRate || 1.2; // default 1.2 L/h

    // Adjust for heat + humidity
    if (temperature > 27) {
      rate += 0.3;
      if (temperature > 33) rate += 0.3;
    }
    if (humidity > 70) rate += 0.2;

    const totalFluid = Math.round(rate * durationH * 10) / 10;
    const sodiumGPerH = rate >= 2 ? 1.5 : (rate >= 1.5 ? 1.2 : 0.8);
    const sodiumTotal = Math.round(sodiumGPerH * durationH * 10) / 10;

    return { rate: Math.round(rate * 10) / 10, totalFluid, sodiumGPerH, sodiumTotal };
  }

  // ── Tennis Changeover Protocol (Step C) ──────────────────────────────────

  function tennisProtocol({ targetRate, duration, fluidPerHour, temperature }) {
    const changeoverPerHour = 6;
    const changeoverInterval_min = 60 / changeoverPerHour; // 10 min

    const carbsPerChangeover = Math.round((targetRate / changeoverPerHour) * 10) / 10;

    let fluidPerChangeover;
    if (temperature > 27) {
      fluidPerChangeover = 400; // ml
    } else {
      fluidPerChangeover = Math.round((fluidPerHour / changeoverPerHour) * 1000);
    }

    const totalChangeovers = Math.ceil((duration / 60) * changeoverPerHour);

    const rows = [];
    for (let i = 1; i <= totalChangeovers; i++) {
      rows.push({
        num: i,
        elapsed_min: Math.round(i * changeoverInterval_min),
        carbs_g: carbsPerChangeover,
        fluid_ml: fluidPerChangeover,
        cumCarbs: Math.round(carbsPerChangeover * i * 10) / 10,
      });
    }

    return { carbsPerChangeover, fluidPerChangeover, totalChangeovers, rows };
  }

  // ── Carbo-Loading Plan ────────────────────────────────────────────────────

  function carbLoadingPlan({ weight, sport }) {
    // 7–12 g/kg depending on sport intensity
    const high   = Math.round(weight * 12);
    const medium = Math.round(weight * 9);
    const pre    = Math.round(weight * 3); // 1–4 g/kg, 1–4h pre-event

    return {
      day2_before: { min: Math.round(weight * 7), max: high },
      day1_before: { min: Math.round(weight * 8), max: high },
      morning_of:  { g: pre, timing: '1–4 Stunden vor Belastungsbeginn' },
    };
  }

  // ── Caffeine Advisory ─────────────────────────────────────────────────────

  function caffeineAdvisory({ weight, level }) {
    if (level === 'none') return null;
    const mg_per_kg = level === 'low' ? 3 : 6;
    const totalMg   = Math.round(weight * mg_per_kg);
    return {
      totalMg,
      mg_per_kg,
      espressoEquiv: Math.round(totalMg / 65),
      timing: level === 'low'
        ? '60 Minuten vor Belastung, einmalig'
        : '60 Minuten vor Belastung; optionale 1–2 mg/kg mid-race möglich',
    };
  }

  // ── Master Calculate ──────────────────────────────────────────────────────

  function calculate(inputs) {
    const {
      age, weight, sweatRate,
      gutTraining,
      sport, duration, intensityPct,
      temperature, humidity,
      carbLoading, caffeine,
    } = inputs;

    const hrMaxVal = hrMax(age);

    // Step A
    const { targetRate, zone, durationCategory, gutFactor } = targetCHORate({
      sport, duration, intensityPct, gutTraining,
    });

    // Step B
    const ratio = ratioForRate(targetRate);

    // Recipe
    const recipe = synthesizeRecipe({
      glucose: ratio.glucose,
      fructose: ratio.fructose,
      targetRate,
    });

    // Fluid
    const fluid = fluidNeeds({ sweatRate, duration, temperature, humidity });

    // Osmolality
    const osmo = checkOsmolality({
      sucrose:      recipe.sucrose,
      maltodextrin: recipe.maltodextrin,
      fluidLitres:  fluid.rate,
    });

    // Tennis
    const tennis = sport === 'tennis'
      ? tennisProtocol({
          targetRate,
          duration,
          fluidPerHour: fluid.rate * 1000,
          temperature,
        })
      : null;

    // Carb loading
    const carbLoadingData = carbLoading === 'show'
      ? carbLoadingPlan({ weight, sport })
      : null;

    // Caffeine
    const caffeineData = caffeineAdvisory({ weight, level: caffeine });

    // Gut training advisory
    const needsGutTraining = (sport === 'running' && targetRate > 50 && gutTraining === 'none');

    // Total carbs for event
    const totalCarbs = Math.round((targetRate * duration) / 60);
    const totalSucrose      = Math.round((recipe.sucrose      * duration) / 60 * 10) / 10;
    const totalMaltodextrin = Math.round((recipe.maltodextrin * duration) / 60 * 10) / 10;

    return {
      // Inputs echo
      sport, duration, intensityPct, temperature,
      weight, age,

      // Core results
      hrMax: hrMaxVal,
      zone,
      durationCategory,
      targetRate,

      // Ratio
      ratio,

      // Recipe (per hour)
      recipe,

      // Event totals
      totals: {
        carbs:       totalCarbs,
        sucrose:     totalSucrose,
        maltodextrin: totalMaltodextrin,
        fluid:       fluid.totalFluid,
        sodium:      fluid.sodiumTotal,
      },

      // Fluid
      fluid,

      // Osmolality
      osmo,

      // Tennis
      tennis,

      // Extras
      carbLoadingData,
      caffeineData,
      needsGutTraining,
      gutFactor,
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return { calculate, hrMax, getZone, ZONE_DEFS };

})();

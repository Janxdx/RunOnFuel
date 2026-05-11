/**
 * RunOnFuel — UI Controller
 * Manages step navigation, live zone display, temperature alerts,
 * form validation, and scroll behavior.
 */

'use strict';

let currentStep = 1;
const TOTAL_STEPS = 4;

// ── Step Navigation ───────────────────────────────────────────────────────

function showStep(n) {
  document.querySelectorAll('.form-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });

  document.querySelectorAll('.step[data-step]').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (s === n) el.classList.add('active');
    if (s < n)  el.classList.add('completed');
  });

  document.querySelectorAll('.step-line').forEach((el, i) => {
    el.classList.toggle('filled', i + 1 < n);
  });

  currentStep = n;
}

function nextStep(from) {
  if (!validateStep(from)) return;
  showStep(from + 1);
  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prevStep(from) {
  showStep(from - 1);
  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Validation ────────────────────────────────────────────────────────────

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    const age    = document.getElementById('age');
    const weight = document.getElementById('weight');
    [age, weight].forEach(el => {
      const v = parseFloat(el.value);
      const ok = !isNaN(v) && v >= parseFloat(el.min) && v <= parseFloat(el.max);
      el.classList.toggle('invalid', !ok);
      if (!ok) valid = false;
    });
  }

  if (step === 2) {
    const dur = document.getElementById('duration');
    const int = document.getElementById('intensity');
    [dur, int].forEach(el => {
      const v = parseFloat(el.value);
      const ok = !isNaN(v) && v >= parseFloat(el.min) && v <= parseFloat(el.max);
      el.classList.toggle('invalid', !ok);
      if (!ok) valid = false;
    });
  }

  if (step === 3) {
    const temp = document.getElementById('temperature');
    const v    = parseFloat(temp.value);
    const ok   = !isNaN(v) && v >= -5 && v <= 45;
    temp.classList.toggle('invalid', !ok);
    if (!ok) valid = false;
  }

  return valid;
}

// ── Live Zone Display ─────────────────────────────────────────────────────

function updateZoneDisplay() {
  const el    = document.getElementById('intensity');
  const disp  = document.getElementById('zone-display');
  if (!el || !disp) return;

  const val = parseFloat(el.value);
  if (isNaN(val)) return;

  const zone = Engine.getZone(val);
  const zClass = `zone-${zone.zone}`;

  const badgeEl = disp.querySelector('.zone-badge');
  const reqEl   = disp.querySelector('.zone-req');

  if (badgeEl) {
    badgeEl.className = `zone-badge ${zClass}`;
    badgeEl.textContent = zone.label;
  }
  if (reqEl) {
    reqEl.textContent = `→ ${zone.choMin}–${zone.choMax} g/h empfohlen`;
  }
}

// ── Temperature Alert ─────────────────────────────────────────────────────

function updateTempAlert() {
  const el    = document.getElementById('temperature');
  const alert = document.getElementById('temp-alert');
  if (!el || !alert) return;

  const val = parseFloat(el.value);
  alert.style.display = (!isNaN(val) && val > 27) ? 'flex' : 'none';
}

// ── Clear Validation on Input ─────────────────────────────────────────────

function clearInvalid(el) {
  el.classList.remove('invalid');
}

// ── Init ──────────────────────────────────────────────────────────────────

function initUI() {
  showStep(1);

  const intensityInput = document.getElementById('intensity');
  if (intensityInput) {
    intensityInput.addEventListener('input', updateZoneDisplay);
    updateZoneDisplay();
  }

  const tempInput = document.getElementById('temperature');
  if (tempInput) {
    tempInput.addEventListener('input', updateTempAlert);
  }

  // Clear invalid state on any input change
  document.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', () => clearInvalid(el));
  });
}

/**
 * RunOnFuel — Tweaks Panel
 * Theme toggle (dark/light), accent swatches, randomize.
 * Persists to localStorage.
 */

'use strict';

(function () {

  const ACCENT_PRESETS = {
    electric: { l: 0.68, c: 0.18, h: 250, l2: 0.72 },
    cyan:     { l: 0.80, c: 0.15, h: 200, l2: 0.85 },
    lime:     { l: 0.86, c: 0.21, h: 130, l2: 0.90 },
    coral:    { l: 0.72, c: 0.19, h: 15,  l2: 0.78 },
  };

  const state = {
    theme:  localStorage.getItem('rof-theme')  || 'dark',
    accent: localStorage.getItem('rof-accent') || 'electric',
  };

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function applyAccent() {
    const p = ACCENT_PRESETS[state.accent] || ACCENT_PRESETS.electric;
    document.documentElement.style.setProperty('--accent',   `oklch(${p.l} ${p.c} ${p.h})`);
    document.documentElement.style.setProperty('--accent-2', `oklch(${p.l2} ${p.c} ${p.h})`);
  }

  function persist() {
    localStorage.setItem('rof-theme',  state.theme);
    localStorage.setItem('rof-accent', state.accent);
  }

  function syncUI() {
    document.querySelectorAll('[data-tweak="theme"]').forEach(b => {
      b.dataset.on = (b.dataset.value === state.theme).toString();
    });
    document.querySelectorAll('[data-tweak="accent"]').forEach(b => {
      b.dataset.on = (b.dataset.value === state.accent).toString();
    });
  }

  function init() {
    applyTheme();
    applyAccent();
    syncUI();

    const trigger = document.getElementById('tweaks-trigger');
    const panel   = document.getElementById('tweaks-panel');

    if (trigger && panel) {
      trigger.addEventListener('click', e => {
        e.stopPropagation();
        panel.classList.toggle('open');
      });
      document.addEventListener('click', e => {
        if (!panel.contains(e.target) && e.target !== trigger) {
          panel.classList.remove('open');
        }
      });
    }

    document.querySelectorAll('[data-tweak]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const key = btn.dataset.tweak;
        const val = btn.dataset.value;
        state[key] = val;
        if (key === 'theme')  applyTheme();
        if (key === 'accent') applyAccent();
        persist();
        syncUI();
      });
    });

    const rnd = document.getElementById('tweaks-random');
    if (rnd) {
      rnd.addEventListener('click', e => {
        e.stopPropagation();
        const keys = Object.keys(ACCENT_PRESETS);
        state.accent = keys[Math.floor(Math.random() * keys.length)];
        state.theme  = Math.random() < 0.5 ? 'dark' : 'light';
        applyTheme();
        applyAccent();
        persist();
        syncUI();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

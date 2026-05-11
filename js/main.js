/**
 * RunOnFuel — Main Entry + Results Renderer
 * Collects form inputs, calls Engine.calculate(), and renders
 * all result panels into the DOM.
 */

'use strict';

// ── Form Collection ───────────────────────────────────────────────────────

function collectInputs() {
  const get    = id => document.getElementById(id);
  const radio  = name => document.querySelector(`input[name="${name}"]:checked`)?.value;
  const num    = id => parseFloat(get(id)?.value) || 0;

  return {
    age:          num('age'),
    weight:       num('weight'),
    sweatRate:    num('sweat-rate') || 1.2,
    gutTraining:  radio('gutTraining') || 'none',
    sport:        radio('sport')       || 'cycling',
    duration:     num('duration'),
    intensityPct: num('intensity'),
    temperature:  num('temperature'),
    humidity:     num('humidity') || 50,
    carbLoading:  radio('carbLoading') || 'none',
    caffeine:     radio('caffeine')    || 'none',
  };
}

// ── Calculate & Show ──────────────────────────────────────────────────────

function calculateAndShow() {
  if (!validateStep(3)) return;

  const inputs  = collectInputs();
  const results = Engine.calculate(inputs);

  renderResults(results, inputs);
  nextStep(3);
}

// ── Render ────────────────────────────────────────────────────────────────

function renderResults(r, inputs) {
  const container = document.getElementById('results-container');
  container.innerHTML = '';

  const sportLabels = { cycling: 'Radsport', running: 'Laufsport', tennis: 'Tennis' };
  const durationLabel = formatDuration(r.duration);

  // ── 1. Header ────────────────────────────────────────────────────────────
  container.appendChild(el('div', { className: 'results-header' }, `
    <div class="results-profile">
      <h2>Fueling-Plan — ${sportLabels[r.sport]}</h2>
      <p>${r.weight} kg · ${r.age} Jahre · ${durationLabel} · ${r.intensityPct}% HR<sub>max</sub> · ${r.temperature}°C</p>
    </div>
    <div class="results-hr-info">
      <div class="hr-max-value">${r.hrMax} bpm</div>
      <div class="hr-max-label">HR<sub>max</sub> (Tanaka)</div>
      <div style="margin-top:4px;font-size:var(--text-xs);color:var(--c-text-muted);">${r.zone.label}</div>
    </div>
  `));

  // ── 2. KPI Grid ──────────────────────────────────────────────────────────
  const isMouthRinse = r.durationCategory === 'very_short';

  let kpiRows;
  if (isMouthRinse) {
    kpiRows = [
      { label: 'Empfehlung',      value: 'Mouthrinse', sub: 'Keine Aufnahme nötig',        cls: '' },
      { label: 'Konzentration',   value: '6 %',         sub: '~50 ml in Mund, ausspucken',   cls: '' },
      { label: 'Fluid / Stunde',  value: r.fluid.rate + ' L', sub: 'Hydratation aufrechterhalten', cls: '' },
    ];
  } else {
    kpiRows = [
      { label: 'CHO-Zielrate',    value: r.targetRate + ' g/h',    sub: 'Pro Stunde Belastung',           cls: 'highlight' },
      { label: 'Glk:Frc Ratio',   value: r.ratio.ratioStr,         sub: r.ratio.label,                    cls: '' },
      { label: 'Saccharose/h',    value: r.recipe.sucrose + ' g',  sub: 'Haushaltszucker',                cls: 'success' },
      { label: 'Maltodextrin/h',  value: r.recipe.maltodextrin + ' g', sub: 'DE <12 empfohlen',           cls: 'success' },
      { label: 'Fluid / Stunde',  value: r.fluid.rate + ' L',      sub: 'Schweißraten-angepasst',         cls: r.temperature > 27 ? 'warning' : '' },
      { label: 'Natrium / h',     value: r.fluid.sodiumGPerH + ' g', sub: 'Als NaCl für Elektrolyte',     cls: '' },
    ];
  }

  container.appendChild(buildKPIGrid(kpiRows));

  if (isMouthRinse) {
    container.appendChild(buildInfoPanel(
      'Belastung < 60 Minuten: Mouthrinse-Protokoll',
      'Bei Belastungen unter 60 Minuten sind exogene Kohlenhydrate metabolisch nicht zwingend notwendig. Eine 6%-Kohlenhydratlösung im Mund aktiviert Rezeptoren im Oropharynx und stimuliert das ZNS nachweislich performancesteigernd — ohne GI-Belastung.',
      'info'
    ));
    return;
  }

  // ── 3. Recipe Panel ──────────────────────────────────────────────────────
  container.appendChild(buildRecipePanel(r));

  // ── 4. Ratio Visualization ────────────────────────────────────────────────
  container.appendChild(buildRatioPanel(r));

  // ── 5. Hydration & Osmolality ─────────────────────────────────────────────
  container.appendChild(buildHydrationPanel(r));

  // ── 6. Tennis Changeover (conditional) ───────────────────────────────────
  if (r.sport === 'tennis' && r.tennis) {
    container.appendChild(buildTennisPanel(r));
  }

  // ── 7. Timing & Totals ────────────────────────────────────────────────────
  container.appendChild(buildTimingPanel(r));

  // ── 8. Gut Training Advisory ──────────────────────────────────────────────
  if (r.needsGutTraining) {
    container.appendChild(buildGutAdvisory(r));
  }

  // ── 9. Carbo-Loading (conditional) ───────────────────────────────────────
  if (r.carbLoadingData) {
    container.appendChild(buildCarbLoadingPanel(r));
  }

  // ── 10. Caffeine (conditional) ────────────────────────────────────────────
  if (r.caffeineData) {
    container.appendChild(buildCaffeinePanel(r));
  }
}

// ── Panel Builders ────────────────────────────────────────────────────────

function buildKPIGrid(rows) {
  const grid = el('div', { className: 'kpi-grid' });
  rows.forEach(({ label, value, sub, cls }) => {
    grid.appendChild(el('div', { className: `kpi-card ${cls}` }, `
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    `));
  });
  return grid;
}

function buildRecipePanel(r) {
  const hasMaltodextrin = r.recipe.maltodextrin > 0;

  return buildPanel(
    'Rezeptur-Generator',
    'Pro Stunde Belastung — auf Basis von Haushaltszucker & Maltodextrin',
    panelIconFlask(),
    `
    <div class="recipe-card">
      <div class="recipe-title">Zubereitung pro Stunde Belastung</div>
      <div class="recipe-ingredients">
        <div class="ingredient-row">
          <div>
            <div class="ingredient-amount">${r.recipe.sucrose} <span class="ingredient-unit">g</span></div>
          </div>
          <div>
            <div class="ingredient-name">Haushaltszucker (Saccharose)</div>
            <div class="ingredient-detail">Liefert ${r.recipe.sucroseGlucose} g Glukose + ${r.recipe.sucroseFructose} g Fruktose · 1:1 inhärentes Verhältnis</div>
          </div>
        </div>
        ${hasMaltodextrin ? `
        <div class="recipe-plus">+</div>
        <div class="ingredient-row">
          <div>
            <div class="ingredient-amount">${r.recipe.maltodextrin} <span class="ingredient-unit">g</span></div>
          </div>
          <div>
            <div class="ingredient-name">Maltodextrin (DE &lt;12 empfohlen)</div>
            <div class="ingredient-detail">Reine Glukosequelle · Nahezu geschmacksneutral · Niedrige Osmolalität</div>
          </div>
        </div>
        ` : ''}
        <div class="recipe-plus">+</div>
        <div class="ingredient-row">
          <div>
            <div class="ingredient-amount">${Math.round(r.fluid.rate * 1000)} <span class="ingredient-unit">ml</span></div>
          </div>
          <div>
            <div class="ingredient-name">Wasser</div>
            <div class="ingredient-detail">Schweißraten-angepasst · Mit ${r.fluid.sodiumGPerH} g NaCl/h für Elektrolyte</div>
          </div>
        </div>
      </div>
      <div class="recipe-result">
        <div class="recipe-result-label">Resultat (pro Stunde)</div>
        <div class="recipe-result-values">
          <div class="result-val">
            <strong>${r.targetRate} g</strong>
            <span>Kohlenhydrate</span>
          </div>
          <div class="result-val">
            <strong>${r.ratio.glucose} g</strong>
            <span>Glukose total</span>
          </div>
          <div class="result-val">
            <strong>${r.ratio.fructose} g</strong>
            <span>Fruktose (GLUT5)</span>
          </div>
          <div class="result-val">
            <strong>${r.recipe.totalCheck} g</strong>
            <span>CHO-Substrat gesamt</span>
          </div>
        </div>
      </div>
    </div>
    `
  );
}

function buildRatioPanel(r) {
  const gPct = r.ratio.glucosePct;
  const fPct = r.ratio.fructosePct;

  return buildPanel(
    'Transporter-Ratio',
    'Intestinale Transportauslastung: SGLT1 (Glukose) vs. GLUT5 (Fruktose)',
    panelIconTransport(),
    `
    <div class="ratio-visual">
      <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--c-text-muted);margin-bottom:var(--sp-2);">
        <span>Glukose: ${r.ratio.glucose} g/h (${gPct}%)</span>
        <span>Fruktose: ${r.ratio.fructose} g/h (${fPct}%)</span>
      </div>
      <div class="ratio-bar">
        <div class="ratio-bar-glucose" style="width:${gPct}%"></div>
        <div class="ratio-bar-fructose" style="width:${fPct}%"></div>
      </div>
      <div class="ratio-legend">
        <div class="legend-item"><div class="legend-dot glucose"></div><span>Glukose → SGLT1</span></div>
        <div class="legend-item"><div class="legend-dot fructose"></div><span>Fruktose → GLUT5</span></div>
      </div>
    </div>
    <div style="margin-top:var(--sp-4);">
      ${buildRatioExplanation(r)}
    </div>
    `
  );
}

function buildRatioExplanation(r) {
  const paradigm = r.ratio.paradigm;
  if (paradigm === 'glucose_only') {
    return `<p style="font-size:var(--text-sm);color:var(--c-text-secondary);line-height:1.65">
      Bei ≤60 g/h ist der SGLT1-Transporter nicht gesättigt. Reine Glukose / Maltodextrin
      genügt vollständig. Fruktose ist metabolisch nicht notwendig, da kein Transporter-Engpass entsteht.
    </p>`;
  }
  if (paradigm === '2_to_1') {
    return `<p style="font-size:var(--text-sm);color:var(--c-text-secondary);line-height:1.65">
      Das klassische <strong style="color:var(--c-text-primary)">2:1-Verhältnis</strong> sättigt SGLT1 optimal bei ~60 g/h Glukose
      und ergänzt via GLUT5 mit 30 g/h Fruktose — Gesamtrate bis 90 g/h. Hoher Maltodextrin-Anteil
      sorgt für niedrige Osmolalität und neutrale Süße (Palatability).
    </p>`;
  }
  if (paradigm === '1_to_0_8') {
    return `<p style="font-size:var(--text-sm);color:var(--c-text-secondary);line-height:1.65">
      Das moderne <strong style="color:var(--c-text-primary)">1:0.8-Paradigma</strong> (Rowlands, Podlogar et al.) maximiert bei
      90–120 g/h die exogene Oxidationsrate auf bis zu 1.51 g/min. Höherer Fruktoseanteil (~44.5%)
      verhindert SGLT1-Überladung bei gleichzeitig maximaler GLUT5-Auslastung.
    </p>`;
  }
  return '';
}

function buildHydrationPanel(r) {
  const osmo = r.osmo;
  const osmoWidth = Math.min(100, Math.max(5, (osmo.mOsm / 500) * 100));

  return buildPanel(
    'Hydration & Osmolalitätskontrolle',
    'Physikalische Lösungsqualität — Magenentleerungs-Optimierung',
    panelIconDroplet(),
    `
    <div class="osmo-indicator">
      <div class="osmo-bar-wrapper">
        <div class="osmo-bar-track">
          <div class="osmo-bar-fill ${osmo.status}" style="width:${osmoWidth}%"></div>
          <div class="osmo-marker ${osmo.status}"></div>
        </div>
      </div>
      <div class="osmo-labels">
        <span>Hypoton &lt;280</span>
        <span>Isoton 280–320</span>
        <span>Hyperton &gt;320</span>
      </div>
      <div class="osmo-status ${osmo.status}">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          ${osmo.status !== 'hyper'
            ? '<path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<path d="M7 2v5M7 10v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/>'}
        </svg>
        <span>~${osmo.mOsm} mOsm/kg · ${osmoStatus(osmo.status)} · Konzentration: ${osmo.concentration_pct}%</span>
      </div>
    </div>
    <div style="margin-top:var(--sp-5);display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--sp-3);">
      <div class="kpi-card">
        <div class="kpi-label">Flüssigkeit / h</div>
        <div class="kpi-value" style="font-size:var(--text-xl)">${r.fluid.rate} L</div>
        <div class="kpi-sub">Schweißraten-Schätzung</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Natrium / h</div>
        <div class="kpi-value" style="font-size:var(--text-xl)">${r.fluid.sodiumGPerH} g</div>
        <div class="kpi-sub">Als NaCl — gegen Krämpfe/Hyponatriämie</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Lösungskonzentration</div>
        <div class="kpi-value" style="font-size:var(--text-xl)">${osmo.concentration_pct} %</div>
        <div class="kpi-sub">${osmo.concentration_pct <= 8 ? 'Optimal (≤8% = isoton)' : 'Achtung: Magenentleerung verzögert'}</div>
      </div>
    </div>
    ${r.temperature > 27 ? `
    <div class="temp-alert" style="margin-top:var(--sp-4);display:flex">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-top:1px">
        <path d="M7 1L13 13H1L7 1z" stroke="currentColor" stroke-width="1.2"/>
        <path d="M7 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="7" cy="11" r="0.5" fill="currentColor"/>
      </svg>
      Hitzebedingungen (&gt;27°C): Konzentration auf ≤6% begrenzen. Verteile die Kohlenhydrate auf ein größeres Trinkvolumen,
      um die intestinale Wasserresorption nicht zu hemmen. Schweißrate wurde erhöht.
    </div>` : ''}
    `
  );
}

function buildTennisPanel(r) {
  const t = r.tennis;
  const rows = t.rows.slice(0, 12); // show max 12 changeovers

  const rowsHTML = rows.map(row => `
    <div class="changeover-row">
      <div class="changeover-num">${row.num}</div>
      <div class="changeover-carbs">${row.carbs_g} g CHO</div>
      <div class="changeover-fluid">${row.fluid_ml} ml</div>
      <div class="changeover-elapsed">${row.elapsed_min} min · kumulativ ${row.cumCarbs} g</div>
    </div>
  `).join('');

  const moreCount = t.rows.length - 12;

  return buildPanel(
    'Tennis-Changeover-Protokoll',
    'Regelkonformes 90-Sekunden-Fenster — Kohlenhydrat- und Flüssigkeitszufuhr pro Seitenwechsel',
    panelIconTennis(),
    `
    <div style="margin-bottom:var(--sp-5);display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--sp-3);">
      <div class="kpi-card highlight">
        <div class="kpi-label">CHO pro Changeover</div>
        <div class="kpi-value">${t.carbsPerChangeover} g</div>
        <div class="kpi-sub">Alle ~10 Minuten</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Fluid pro Changeover</div>
        <div class="kpi-value">${t.fluidPerChangeover} ml</div>
        <div class="kpi-sub">${r.temperature > 27 ? 'Hitzeangepasst' : 'Standardbedingungen'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Seitenwechsel gesamt</div>
        <div class="kpi-value">${t.totalChangeovers}</div>
        <div class="kpi-sub">Bei ${r.duration} min Matchdauer</div>
      </div>
    </div>
    <div class="changeover-protocol">
      <div class="changeover-header">
        <span>#</span>
        <span>Kohlenhydrate</span>
        <span>Flüssigkeit</span>
        <span>Zeitpunkt / Kumulativ</span>
      </div>
      ${rowsHTML}
    </div>
    ${moreCount > 0 ? `<div style="text-align:center;padding:var(--sp-3);font-size:var(--text-xs);color:var(--c-text-muted)">… + ${moreCount} weitere Seitenwechsel im gleichen Schema</div>` : ''}
    <div style="margin-top:var(--sp-4);padding:var(--sp-4);background:var(--c-accent-dim);border-radius:var(--r-md);border:1px solid rgba(59,158,255,0.2);font-size:var(--text-xs);color:var(--c-text-secondary);line-height:1.65">
      <strong style="color:var(--c-accent)">Darreichungsform:</strong>
      5–7% isotonische KH-Elektrolyt-Lösung optimal. Kein festes Food während des Matches —
      Sprints belasten den Magen. Koffein (falls aktiviert) pre-Match oder im 2. Satz strategisch einsetzen.
    </div>
    `
  );
}

function buildTimingPanel(r) {
  const dH = (r.duration / 60).toFixed(1);

  return buildPanel(
    'Event-Totale & Timing',
    `Gesamtbedarf für ${formatDuration(r.duration)} Belastung`,
    panelIconClock(),
    `
    <table class="timing-table">
      <thead>
        <tr>
          <th>Zeitpunkt</th>
          <th>Maßnahme</th>
          <th>Menge</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>−4 bis −1 h</td>
          <td>Pre-Event Mahlzeit</td>
          <td><strong>${Math.round(r.weight * 2)}–${Math.round(r.weight * 4)} g CHO</strong> (2–4 g/kg)</td>
        </tr>
        <tr>
          <td>0:00 Start</td>
          <td>Ersten Fueling-Block planen</td>
          <td><strong>20–30 min</strong> nach Belastungsbeginn</td>
        </tr>
        <tr>
          <td>Während (${dH} h)</td>
          <td>Kontinuierliche CHO-Zufuhr</td>
          <td><strong>${r.totals.carbs} g total</strong> (${r.targetRate} g/h)</td>
        </tr>
        <tr>
          <td>Während (${dH} h)</td>
          <td>Haushaltszucker gesamt</td>
          <td><strong>${r.totals.sucrose} g</strong></td>
        </tr>
        <tr>
          <td>Während (${dH} h)</td>
          <td>Maltodextrin gesamt</td>
          <td><strong>${r.totals.maltodextrin} g</strong></td>
        </tr>
        <tr>
          <td>Während (${dH} h)</td>
          <td>Flüssigkeit gesamt</td>
          <td><strong>${r.totals.fluid} L</strong> · Natrium: ${r.totals.sodium} g NaCl</td>
        </tr>
        <tr>
          <td>0–30 min post</td>
          <td>Sofort-Recovery (falls &lt;8 h bis nächste Session)</td>
          <td><strong>${Math.round(r.weight * 1.0)}–${Math.round(r.weight * 1.2)} g CHO/h</strong> für 4 h</td>
        </tr>
      </tbody>
    </table>
    `
  );
}

function buildGutAdvisory(r) {
  const panel = el('div', { className: 'results-panel' });
  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-icon" style="background:var(--c-warning-dim);color:var(--c-warning)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L15 14H1L8 1z" stroke="currentColor" stroke-width="1.2"/>
          <path d="M8 6v4M8 12v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <h3>Gastrointestinales Training empfohlen</h3>
        <p>Läufer ohne Gut-Training: Toleranzgrenze wurde limitiert</p>
      </div>
    </div>
    <div class="panel-body">
      <div class="gut-advisory">
        <div class="gut-advisory-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L15 14H1L8 1z" stroke="currentColor" stroke-width="1.2"/>
            <path d="M8 6v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="8" cy="12" r="0.5" fill="currentColor"/>
          </svg>
          Lauf-GI-Limitierung aktiv
        </div>
        <p>
          Beim Laufsport führen vertikale Stoßbelastungen zu intestinaler Ischämie und SGLT1-Hemmung.
          Ohne gezieltes <strong>Gut-Training</strong> (14–28 Tage Hochdosis-Exposition) ist Ihre
          Empfehlung auf ${r.targetRate} g/h begrenzt, um schwere GI-Beschwerden zu verhindern.<br/><br/>
          <strong>28-Tage-Gut-Training-Plan:</strong> Nehmen Sie in 3–4 rennnahen Trainingseinheiten pro Woche
          die Zielmenge an Gels/Lösungen ein. Beginnen Sie bei 60% der Zielmenge und steigern Sie wöchentlich
          um 10–15%. Studien belegen: 47% Reduktion der GI-Beschwerden, 54% weniger Malabsorption.
        </p>
      </div>
    </div>
  `;
  return panel;
}

function buildCarbLoadingPanel(r) {
  const cl = r.carbLoadingData;
  return buildPanel(
    'Carbo-Loading-Plan',
    'Pre-Event-Glykogensättigung — 48 Stunden vor Wettkampf',
    panelIconBolt(),
    `
    <div class="carb-loading-grid">
      <div class="carb-loading-day">
        <div class="day-label">48h vor Wettkampf</div>
        <div class="day-amount">${cl.day2_before.min}–${cl.day2_before.max} <span class="day-unit">g CHO</span></div>
        <div style="font-size:var(--text-xs);color:var(--c-text-muted);margin-top:var(--sp-1)">7–12 g/kg · Fettarm · Ballaststoffarm</div>
      </div>
      <div class="carb-loading-day">
        <div class="day-label">24h vor Wettkampf</div>
        <div class="day-amount">${cl.day1_before.min}–${cl.day1_before.max} <span class="day-unit">g CHO</span></div>
        <div style="font-size:var(--text-xs);color:var(--c-text-muted);margin-top:var(--sp-1)">8–12 g/kg · Leicht verdaulich</div>
      </div>
      <div class="carb-loading-day">
        <div class="day-label">${cl.morning_of.timing}</div>
        <div class="day-amount">${cl.morning_of.g} <span class="day-unit">g CHO</span></div>
        <div style="font-size:var(--text-xs);color:var(--c-text-muted);margin-top:var(--sp-1)">2–4 g/kg · Leberglykogen optimieren</div>
      </div>
    </div>
    <div style="margin-top:var(--sp-4);font-size:var(--text-xs);color:var(--c-text-muted);line-height:1.65;padding:var(--sp-4);background:var(--c-bg-elevated);border-radius:var(--r-md)">
      Muskelglykogen-Vollsynthese benötigt ≥24 h. Leberglykogen (depletiert über Nacht)
      braucht 4–11 h. Die Kombination aus Glukose + Fruktose (z.B. via Saccharose) beschleunigt
      die Leberspeicher-Refüllung signifikant im Vergleich zu reinen Glukosepolymeren.
    </div>
    `
  );
}

function buildCaffeinePanel(r) {
  const c = r.caffeineData;
  return buildPanel(
    'Koffein-Supplementierung',
    'Ergogene Dosierung — Reaktionszeit, Schmerztoleranz, Laktat-Pufferung',
    panelIconCoffee(),
    `
    <div class="caffeine-info">
      <div class="caff-item">
        <div class="caff-item-label">Gesamtdosis</div>
        <div class="caff-item-value">${c.totalMg} mg</div>
      </div>
      <div class="caff-item">
        <div class="caff-item-label">Pro Kilogramm</div>
        <div class="caff-item-value">${c.mg_per_kg} mg/kg</div>
      </div>
      <div class="caff-item">
        <div class="caff-item-label">Espresso-Äquivalent</div>
        <div class="caff-item-value">~${c.espressoEquiv} Tassen</div>
      </div>
    </div>
    <div style="margin-top:var(--sp-4);font-size:var(--text-sm);color:var(--c-text-secondary);line-height:1.65;padding:var(--sp-4);background:rgba(245,166,35,0.05);border:1px solid rgba(245,166,35,0.15);border-radius:var(--r-md)">
      <strong style="color:var(--c-warning)">Timing:</strong> ${c.timing}<br/>
      Koffein hemmt Adenosin-Rezeptoren, erhöht Katecholamin-Ausschüttung und verbessert die
      neuromuskuläre Rekrutierung. Im Tennis: verbesserte Reaktionszeit und kognitive Frische in späten Sätzen.
      <strong> Cave:</strong> Schlafstörungen bei Einnahme &gt;6h vor Schlafzeit. Dehydrationsrisiko moderat erhöht.
    </div>
    `
  );
}

function buildInfoPanel(title, text, type) {
  const panel = el('div', { className: 'results-panel' });
  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/>
          <path d="M8 5v5M8 11v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </div>
      <div><h3>${title}</h3></div>
    </div>
    <div class="panel-body">
      <p style="font-size:var(--text-sm);color:var(--c-text-secondary);line-height:1.65">${text}</p>
    </div>
  `;
  return panel;
}

// ── Generic Panel Builder ─────────────────────────────────────────────────

function buildPanel(title, subtitle, iconHTML, bodyHTML) {
  const panel = el('div', { className: 'results-panel' });
  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-icon">${iconHTML}</div>
      <div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
    </div>
    <div class="panel-body">${bodyHTML}</div>
  `;
  return panel;
}

// ── Icons ─────────────────────────────────────────────────────────────────

function panelIconFlask() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M5 2h6M6 2v5l-3 6h10L10 7V2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function panelIconTransport() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 8h12M10 4l4 4-4 4M6 4L2 8l4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function panelIconDroplet() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2C8 2 3 7.5 3 10.5a5 5 0 0 0 10 0C13 7.5 8 2 8 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;
}

function panelIconClock() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/>
    <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

function panelIconBolt() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M9 2L4 9h5l-2 5 7-7H9l2-5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function panelIconTennis() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/>
    <path d="M3 5.5c1.5 1 1.5 4 0 5M13 5.5c-1.5 1-1.5 4 0 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M2 8h12" stroke="currentColor" stroke-width="1.2"/>
  </svg>`;
}

function panelIconCoffee() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 7h9v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M11 8h1a2 2 0 0 1 0 4h-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M5 2c0 1.5 2 1.5 2 3M8 2c0 1.5 2 1.5 2 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function el(tag, attrs, html) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  });
  if (html) node.innerHTML = html;
  return node;
}

function formatDuration(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function osmoStatus(s) {
  return { hypo: 'Hypoton — optimale Resorption', iso: 'Isoton — optimale Balance', hyper: 'Hyperton — Magenentleerung verzögert' }[s];
}

// ── Boot ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initUI);

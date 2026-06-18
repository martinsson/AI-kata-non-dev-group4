/* Team Maturity Compass — R&D leadership team maturity tracker.
   Pure client-side. State persists in localStorage. */

(() => {
  "use strict";

  const STORAGE_KEY = "tmc.events.v1";
  const BASELINE = 50; // teams start at "Norming" (mid scale)

  // --- Maturity model ---------------------------------------------------
  const LEVELS = [
    { min: 0,  max: 20,  name: "L1 · Forming",         tag: "Low performing — unclear roles, low trust, work is reactive.",
      need: "Establish clear goals, roles, and psychological safety." },
    { min: 21, max: 40,  name: "L2 · Storming",        tag: "Surfacing conflict and friction as the team finds its footing.",
      need: "Work through conflict openly; agree on ways of working." },
    { min: 41, max: 60,  name: "L3 · Norming",         tag: "Stable, predictable delivery with shared norms.",
      need: "Increase ownership and raise the bar on quality and pace." },
    { min: 61, max: 80,  name: "L4 · Performing",      tag: "Self-organising, delivering reliably with strong trust.",
      need: "Drive continuous improvement and stretch into innovation." },
    { min: 81, max: 100, name: "L5 · High performing", tag: "High performing — adaptive, innovative, resilient under pressure.",
      need: "Sustain excellence; mentor, scale impact, avoid complacency." },
  ];

  const CATEGORIES = [
    "Conflict & trust",
    "Decision making",
    "Delivery & execution",
    "Innovation & risk-taking",
    "Communication & transparency",
    "Accountability & ownership",
    "Crisis response",
    "Feedback & learning",
  ];

  const SEV_LABEL = { 2: "Low", 4: "Medium", 6: "High" };
  const SEV_CLASS = { 2: "l", 4: "m", 6: "h" };

  // --- State ------------------------------------------------------------
  let events = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }

  // Delta a single event applies to the maturity score.
  function deltaOf(ev) { return (ev.rating - 3) * ev.severity; }

  // Replay events in chronological order to produce score trajectory.
  function trajectory() {
    const sorted = [...events].sort((a, b) =>
      a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date));
    let score = BASELINE;
    const points = [{ score, ev: null }];
    for (const ev of sorted) {
      score = clamp(score + deltaOf(ev));
      points.push({ score, ev });
    }
    return { sorted, points, score };
  }

  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
  function levelFor(score) { return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[0]; }

  // --- Rendering --------------------------------------------------------
  function render() {
    const { sorted, points, score } = trajectory();
    renderDashboard(score, points, sorted);
    renderHistory(sorted);
    renderLadder(score);
  }

  function renderDashboard(score, points, sorted) {
    const level = levelFor(score);
    el("levelName").textContent = level.name;
    el("levelTagline").textContent = level.tag;
    el("scoreValue").textContent = score;
    el("gaugeFill").style.width = (100 - score) + "%";
    el("gaugeFill").style.left = score + "%";
    el("gaugeFill").style.right = "0";
    el("gaugeMarker").style.left = score + "%";

    // Momentum: net change across last up-to-3 events.
    const recent = sorted.slice(-3);
    const net = recent.reduce((s, e) => s + deltaOf(e), 0);
    const m = el("momentum");
    m.className = "momentum " + (net > 0 ? "up" : net < 0 ? "down" : "flat");
    m.textContent = net > 0 ? `▲ +${net} recent momentum`
                  : net < 0 ? `▼ ${net} recent momentum`
                  : "● holding steady";

    renderTrend(points);
    renderAnalysis(score, level, sorted);
    renderCategoryBars(sorted);
  }

  // SVG line chart of score over events.
  function renderTrend(points) {
    const host = el("trendChart");
    const w = 600, h = 180, pad = 24;
    const n = points.length;
    const x = i => n <= 1 ? pad : pad + (i * (w - pad * 2)) / (n - 1);
    const y = s => h - pad - (s / 100) * (h - pad * 2);

    const grid = [0, 20, 40, 60, 80, 100].map(v =>
      `<line x1="${pad}" y1="${y(v)}" x2="${w - pad}" y2="${y(v)}" stroke="#2c3848" stroke-width="1"/>
       <text x="${pad - 6}" y="${y(v) + 3}" fill="#5f6e80" font-size="9" text-anchor="end">${v}</text>`).join("");

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
    const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
    const dots = points.map((p, i) =>
      `<circle cx="${x(i).toFixed(1)}" cy="${y(p.score).toFixed(1)}" r="3" fill="#4f9dff"><title>${p.ev ? p.ev.title : "Baseline"}: ${p.score}</title></circle>`).join("");

    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4f9dff" stop-opacity=".35"/>
        <stop offset="100%" stop-color="#4f9dff" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#g)"/>
      <path d="${line}" fill="none" stroke="#4f9dff" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
    </svg>`;

    el("trendCaption").textContent = n <= 1
      ? "Log events to build the trend."
      : `${n - 1} event${n - 1 === 1 ? "" : "s"} tracked · baseline ${BASELINE} → current ${points[n - 1].score}.`;
  }

  function categoryStats(sorted) {
    const stats = {};
    for (const ev of sorted) {
      (stats[ev.category] ||= { sum: 0, n: 0 });
      stats[ev.category].sum += ev.rating;
      stats[ev.category].n += 1;
    }
    return stats;
  }

  function renderCategoryBars(sorted) {
    const host = el("categoryBars");
    const stats = categoryStats(sorted);
    const active = Object.keys(stats);
    if (!active.length) { host.innerHTML = `<p class="muted small">No events logged yet.</p>`; return; }
    host.innerHTML = active.map(cat => {
      const avg = stats[cat].sum / stats[cat].n;
      const pct = (avg / 5) * 100;
      return `<div class="catbar-row">
        <span>${cat}</span>
        <div class="catbar-track"><div class="catbar-fill" style="width:${pct}%"></div></div>
        <span class="val">${avg.toFixed(1)}</span>
      </div>`;
    }).join("");
  }

  // Analysis + recommendation engine.
  function renderAnalysis(score, level, sorted) {
    const host = el("analysis");
    const items = [];

    if (!sorted.length) {
      host.innerHTML = `<div class="insight info"><span class="ic">🧭</span><div>
        <h4>Start by logging events</h4>
        <p>Record the real situations your team faces — incidents, decisions, conflicts, launches. Each one nudges the maturity level based on how well the team handled it.</p></div></div>`;
      return;
    }

    // 1. Where the team sits + what it takes to level up.
    items.push(insight("info", "📍", `You are at ${level.name}`,
      `${level.tag} <b>To progress:</b> ${level.need}`));

    // 2. Momentum / trajectory.
    const recent = sorted.slice(-3);
    const net = recent.reduce((s, e) => s + deltaOf(e), 0);
    if (net > 0) items.push(insight("good", "📈", "Positive momentum",
      `The team's last ${recent.length} event${recent.length === 1 ? "" : "s"} added <b>+${net}</b> points. Keep reinforcing what's working and name it explicitly in retros.`));
    else if (net < 0) items.push(insight("bad", "📉", "Losing ground",
      `Recent events cost <b>${net}</b> points. Pause and run a focused retro on the last few situations before they compound.`));
    else items.push(insight("warn", "➡️", "Plateau",
      `The team is holding steady. Deliberately take on a stretch challenge to break out of the plateau.`));

    // 3. Weakest capability area → targeted recommendation.
    const stats = categoryStats(sorted);
    let weakest = null, strongest = null;
    for (const [cat, s] of Object.entries(stats)) {
      const avg = s.sum / s.n;
      if (!weakest || avg < weakest.avg) weakest = { cat, avg };
      if (!strongest || avg > strongest.avg) strongest = { cat, avg };
    }
    if (weakest) items.push(insight(weakest.avg < 3 ? "bad" : "warn", "🎯", `Focus area: ${weakest.cat}`,
      `Average handling here is <b>${weakest.avg.toFixed(1)}/5</b> — the team's weakest area. ${RECS[weakest.cat] || "Make this an explicit team goal for the next quarter."}`));
    if (strongest && strongest.avg >= 4 && strongest.cat !== (weakest && weakest.cat))
      items.push(insight("good", "💪", `Strength: ${strongest.cat}`,
        `Handling averages <b>${strongest.avg.toFixed(1)}/5</b>. Use this strength to lift weaker areas — have the team teach how they do it.`));

    // 4. High-stakes handling.
    const high = sorted.filter(e => e.severity === 6);
    if (high.length) {
      const avgHigh = high.reduce((s, e) => s + e.rating, 0) / high.length;
      items.push(insight(avgHigh >= 3.5 ? "good" : "bad", "🔥", "Under pressure",
        `Across <b>${high.length}</b> high-stakes event${high.length === 1 ? "" : "s"}, handling averaged <b>${avgHigh.toFixed(1)}/5</b>. ${avgHigh >= 3.5 ? "The team rises to the moment — a hallmark of high-performing teams." : "Pressure is exposing gaps; debrief these calmly to build resilience."}`));
    }

    host.innerHTML = items.join("");
  }

  const RECS = {
    "Conflict & trust": "Invest in psychological safety — make disagreement safe and normal. Try a team charter and regular 1:1s.",
    "Decision making": "Clarify decision rights (who decides what) and use lightweight frameworks like DACI to avoid stalls.",
    "Delivery & execution": "Tighten planning and WIP limits; review what made commitments slip and protect focus time.",
    "Innovation & risk-taking": "Create slack for experiments and celebrate intelligent failures, not just successes.",
    "Communication & transparency": "Make work and decisions visible by default; over-communicate context and the 'why'.",
    "Accountability & ownership": "Agree on clear ownership and definitions of done; follow through on commitments publicly.",
    "Crisis response": "Run blameless post-incident reviews and rehearse playbooks so the team responds calmly under pressure.",
    "Feedback & learning": "Build a regular retro and feedback habit; turn lessons into concrete, tracked actions.",
  };

  function insight(kind, ic, title, body) {
    return `<div class="insight ${kind}"><span class="ic">${ic}</span><div><h4>${title}</h4><p>${body}</p></div></div>`;
  }

  function renderLadder(score) {
    const cur = levelFor(score);
    el("ladder").innerHTML = [...LEVELS].reverse().map((l, idx) => {
      const num = LEVELS.length - idx;
      return `<div class="rung ${l === cur ? "current" : ""}">
        <span class="num">${num}</span>
        <div><h4>${l.name}</h4><p>${l.tag}</p></div>
      </div>`;
    }).join("");
  }

  function renderHistory(sorted) {
    const body = el("eventRows");
    const empty = el("emptyHistory");
    if (!sorted.length) { body.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    body.innerHTML = [...sorted].reverse().map(ev => {
      const d = deltaOf(ev);
      return `<tr>
        <td>${ev.date}</td>
        <td>${escapeHtml(ev.title)}${ev.notes ? `<br><span class="muted small">${escapeHtml(ev.notes)}</span>` : ""}</td>
        <td>${ev.category}</td>
        <td><span class="pill ${SEV_CLASS[ev.severity]}">${SEV_LABEL[ev.severity]}</span></td>
        <td>${ev.rating}/5</td>
        <td><span class="delta ${d >= 0 ? "pos" : "neg"}">${d >= 0 ? "+" : ""}${d}</span></td>
        <td><button class="rmv" data-id="${ev.id}" title="Remove">✕</button></td>
      </tr>`;
    }).join("");
  }

  // --- Form -------------------------------------------------------------
  function initForm() {
    const sel = el("evCategory");
    sel.innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join("");
    el("evDate").value = new Date().toISOString().slice(0, 10);

    const preview = () => {
      const sev = +el("evSeverity").value, rating = +el("evRating").value;
      const d = (rating - 3) * sev;
      el("impactPreview").innerHTML = d === 0
        ? `This event would be <b>neutral</b> (adequate handling holds the level steady).`
        : `This event would <b>${d > 0 ? "promote" : "demote"}</b> the team by <b>${Math.abs(d)} point${Math.abs(d) === 1 ? "" : "s"}</b>.`;
    };
    el("evSeverity").addEventListener("change", preview);
    el("evRating").addEventListener("change", preview);
    preview();

    el("eventForm").addEventListener("submit", e => {
      e.preventDefault();
      events.push({
        id: Date.now(),
        title: el("evTitle").value.trim(),
        date: el("evDate").value,
        category: el("evCategory").value,
        severity: +el("evSeverity").value,
        rating: +el("evRating").value,
        notes: el("evNotes").value.trim(),
      });
      save();
      e.target.reset();
      el("evDate").value = new Date().toISOString().slice(0, 10);
      preview();
      render();
      switchView("dashboard");
    });
  }

  // --- Events table actions --------------------------------------------
  el("eventRows").addEventListener("click", e => {
    const btn = e.target.closest(".rmv");
    if (!btn) return;
    const id = +btn.dataset.id;
    events = events.filter(ev => ev.id !== id);
    save(); render();
  });

  el("resetBtn").addEventListener("click", () => {
    if (confirm("Delete all events and reset the team to baseline?")) {
      events = []; save(); render();
    }
  });
  el("seedBtn").addEventListener("click", () => {
    if (events.length && !confirm("Add sample data on top of existing events?")) return;
    events = events.concat(SAMPLE()); save(); render(); switchView("dashboard");
  });

  // --- Tabs -------------------------------------------------------------
  function switchView(name) {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => switchView(t.dataset.view)));

  // --- Helpers ----------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function SAMPLE() {
    const mk = (daysAgo, title, category, severity, rating, notes) => {
      const d = new Date(); d.setDate(d.getDate() - daysAgo);
      return { id: Date.now() + Math.floor(Math.random() * 1e6) + daysAgo, date: d.toISOString().slice(0, 10), title, category, severity, rating, notes };
    };
    return [
      mk(120, "Reorg merged two squads with overlapping roles", "Conflict & trust", 6, 2, "Friction over ownership; no clear charter yet."),
      mk(104, "Roadmap commitment slipped two sprints", "Delivery & execution", 4, 2, "Scope crept, no WIP limits."),
      mk(88,  "Team agreed a working agreement & decision rights", "Decision making", 4, 4, "DACI adopted for big calls."),
      mk(70,  "Major prod incident over a weekend", "Crisis response", 6, 4, "Calm, blameless, fixed fast."),
      mk(55,  "Ran first blameless post-incident review", "Feedback & learning", 4, 5, "Turned lessons into tracked actions."),
      mk(40,  "Shipped a risky platform migration on time", "Delivery & execution", 6, 5, "Strong planning and ownership."),
      mk(26,  "Disagreement on architecture handled openly", "Conflict & trust", 4, 4, "Debated, decided, committed."),
      mk(12,  "Spun up a 2-week innovation experiment", "Innovation & risk-taking", 4, 4, "Created slack for exploration."),
      mk(3,   "Proactively flagged a cross-team dependency risk", "Communication & transparency", 4, 5, "Transparent and early."),
    ];
  }

  // --- Boot -------------------------------------------------------------
  initForm();
  render();
})();

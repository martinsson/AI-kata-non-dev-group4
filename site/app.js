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

    // 1. Where the team sits + what it takes to level up (framed in the
    //    team's Spotify-model + SAFe operating model).
    items.push(insight("info", "📍", `You are at ${level.name}`,
      `${level.tag} <b>To progress:</b> ${level.need}`
      + `<p class="why"><b>In your operating model:</b> ${LEVEL_ORG[levelIndex(level)]}</p>`));

    // 2. Momentum / trajectory.
    const recent = sorted.slice(-3);
    const net = recent.reduce((s, e) => s + deltaOf(e), 0);
    if (net > 0) items.push(insight("good", "📈", "Positive momentum",
      `The team's last ${recent.length} event${recent.length === 1 ? "" : "s"} added <b>+${net}</b> points. Keep reinforcing what's working and name it explicitly in retros.`));
    else if (net < 0) items.push(insight("bad", "📉", "Losing ground",
      `Recent events cost <b>${net}</b> points. Pause and run a focused retro on the last few situations before they compound.`));
    else items.push(insight("warn", "➡️", "Plateau",
      `The team is holding steady. Deliberately take on a stretch challenge to break out of the plateau.`));

    // 3. Capability spread → strongest, plus focus areas for the
    //    recommendations block below.
    const stats = categoryStats(sorted);
    const ranked = Object.entries(stats)
      .map(([cat, s]) => ({ cat, avg: s.sum / s.n }))
      .sort((a, b) => a.avg - b.avg);
    const strongest = ranked[ranked.length - 1];
    const weakest = ranked[0];

    // 4. High-stakes handling.
    const high = sorted.filter(e => e.severity === 6);
    if (high.length) {
      const avgHigh = high.reduce((s, e) => s + e.rating, 0) / high.length;
      items.push(insight(avgHigh >= 3.5 ? "good" : "bad", "🔥", "Under pressure",
        `Across <b>${high.length}</b> high-stakes event${high.length === 1 ? "" : "s"}, handling averaged <b>${avgHigh.toFixed(1)}/5</b>. ${avgHigh >= 3.5 ? "The team rises to the moment — a hallmark of high-performing teams." : "Pressure is exposing gaps; debrief these calmly to build resilience."}`));
    }

    if (strongest && strongest.avg >= 4 && (!weakest || strongest.cat !== weakest.cat))
      items.push(insight("good", "💪", `Strength: ${strongest.cat}`,
        `Handling averages <b>${strongest.avg.toFixed(1)}/5</b>. Codify it: have the relevant chapter capture the practice as a standard and share it through a guild/league so other squads inherit it.`));

    // Focus areas = the weakest area, plus a second if it's also a concern.
    const focus = ranked.filter((r, i) => i === 0 || r.avg < 3.5).slice(0, 2);

    host.innerHTML = items.join("") + renderRecsSplit(focus);
  }

  // Dedicated, prominent recommendations block. Each focus area renders its
  // guidance in TWO clearly separated columns: one for the leadership team,
  // one for the team's leader.
  function renderRecsSplit(focus) {
    if (!focus.length) return "";
    const list = items => `<ul class="rec-actions">${items.map(a => `<li>${a}</li>`).join("")}</ul>`;
    const blocks = focus.map(({ cat, avg }) => {
      const r = RECS[cat];
      if (!r) return "";
      return `<div class="rec-block">
        <div class="rec-block-head">🎯 <b>${cat}</b> <span class="muted small">— avg handling ${avg.toFixed(1)}/5</span></div>
        <p class="why">${r.why}</p>
        <div class="recs-split">
          <div class="rec-col team-col">
            <span class="rec-label">🧭 For the R&amp;D leadership team</span>
            ${list(r.team)}
          </div>
          <div class="rec-col leader-col">
            <span class="rec-label">👤 For the team's leader</span>
            ${list(r.leader)}
          </div>
        </div>
        <p class="watch"><b>Signal to watch:</b> ${r.watch}</p>
      </div>`;
    }).join("");
    return `<div class="recs-section">
      <div class="recs-heading">Recommended actions</div>
      ${blocks}
    </div>`;
  }

  // Each area carries two recommendation tracks:
  //  team   → collective actions/rituals for the R&D leadership team
  //  leader → what the individual leading that team should personally do
  const RECS = {
    "Conflict & trust": {
      why: "Trust is the foundation of autonomous squads. Where it's thin, chapters fragment and cross-squad dependencies turn political.",
      team: [
        "Agree a team charter &amp; working agreement; revisit it at every PI boundary.",
        "Practise \"disagree &amp; commit\" openly in ART Sync / Scrum-of-Scrums so squads don't carry silent conflict into PI Planning.",
        "Hold each other to the charter peer-to-peer — don't route every norm breach through the leader.",
      ],
      leader: [
        "Model vulnerability and name your own mistakes first — psychological safety starts at the top.",
        "Coach members through friction in 1:1s; tackle chronic distrust directly instead of hoping it fades.",
        "Protect dissent: make sure quieter chapter leads are heard and never penalised for raising issues.",
      ],
      watch: "Recurring cross-squad escalations landing on leadership — a sign trust between chapters is thin.",
    },
    "Decision making": {
      why: "In a Spotify/SAFe org, decisions belong at the squad while alignment stays at the tribe/ART level. Pulling them up kills autonomy.",
      team: [
        "Map decision rights with DACI/RAPID and publish which calls sit with squads, chapter leads, the RTE and Business Owners.",
        "Prioritise the backlog with <b>WSJF</b> instead of HiPPO calls, so trade-offs are transparent.",
        "Hold the line on delegating to squads — resist collectively clawing decisions back.",
      ],
      leader: [
        "Be explicit about which decisions you reserve vs delegate, and stop being the default tie-breaker.",
        "Share your opinion <i>last</i> so you don't anchor the room.",
        "Measure your success by the decisions that never need to reach you.",
      ],
      watch: "If most decisions still flow up to leadership, squad autonomy isn't real yet.",
    },
    "Delivery & execution": {
      why: "Predictable delivery is the ART's core promise. Leadership's job is to protect flow and clear impediments, not to push harder.",
      team: [
        "Treat <b>PI Planning</b> as the heartbeat — commit squad objectives and visualise dependencies on the program board.",
        "Enforce WIP limits; track flow metrics (throughput, lead time, predictability), not just output.",
        "Clear cross-squad blockers in Scrum-of-Scrums / ART Sync <i>within</i> the PI, not at its end.",
      ],
      leader: [
        "Shield the team from mid-PI scope injection and reprioritisation churn.",
        "Remove the impediments only you can — budget, cross-org dependencies, exec expectations.",
        "Hold the team to outcomes, not activity; don't demand more output when flow is the real constraint.",
      ],
      watch: "Slipping PI objectives or a growing dependency count signal mounting execution debt.",
    },
    "Innovation & risk-taking": {
      why: "High-performing R&D needs deliberate slack. SAFe's IP iteration and Spotify's hack time exist precisely for this.",
      team: [
        "Ring-fence the <b>Innovation &amp; Planning (IP) iteration</b> for spikes, experiments and hackdays.",
        "Frame bets as hypotheses with explicit kill/scale gates; share results at the System Demo / I&amp;A.",
        "Use <b>guilds/leagues</b> to incubate cross-tribe innovation no single squad owns.",
      ],
      leader: [
        "Visibly fund and defend slack time — don't claw it back at the first delivery pressure.",
        "Celebrate intelligent failures publicly so risk-taking feels safe.",
        "Set the risk appetite and guardrails, then get out of the way.",
      ],
      watch: "If the IP iteration is routinely consumed by delivery, innovation capacity is effectively zero.",
    },
    "Communication & transparency": {
      why: "Autonomy only scales on radical transparency — squads self-align when context flows freely.",
      team: [
        "Make objectives, the program board and key decisions visible by default (information radiators).",
        "Use the <b>System Demo</b> and ART Sync as honest, integrated status — no green-shifting.",
        "Reconnect squad missions to tribe/portfolio strategy every PI.",
      ],
      leader: [
        "Over-communicate the <i>why</i> behind decisions — repeat it more than feels necessary.",
        "Close the loop transparently on decisions made above the team (portfolio, budget, headcount).",
        "Tell uncomfortable truths early; your candour sets the team's ceiling for honesty.",
      ],
      watch: "Surprises at PI boundaries mean information isn't flowing during the increment.",
    },
    "Accountability & ownership": {
      why: "Squads own outcomes, not just output; chapter leads own craft, quality and people growth.",
      team: [
        "Make ownership explicit: squads own their PI objectives; chapter leads own standards and development.",
        "Align a shared <b>Definition of Done / Ready</b> across the ART so \"done\" means the same everywhere.",
        "Make commitments public at PI Planning and review them honestly at Inspect &amp; Adapt.",
      ],
      leader: [
        "Hold people to commitments fairly and consistently — and follow through on your own.",
        "Address under-performance directly rather than absorbing it or routing around it.",
        "Delegate authority to match responsibility — don't hand over ownership without the power to act.",
      ],
      watch: "Diffused ownership (\"not our squad\") on cross-cutting work is the warning sign.",
    },
    "Crisis response": {
      why: "Resilience under pressure is what separates a performing train from a high-performing one.",
      team: [
        "Run <b>blameless post-incident reviews</b>; feed actions into the next PI backlog, not a forgotten doc.",
        "Rehearse incident playbooks and on-call rotations; pre-agree who decides during an incident.",
        "Spread operational lessons across squads via an SRE guild/league.",
      ],
      leader: [
        "Stay calm and create air cover during incidents — your composure regulates the team.",
        "Protect blamelessness: make it unmistakably safe to surface bad news to you.",
        "Once the dust settles, ensure the systemic fix is funded — not just the quick patch.",
      ],
      watch: "Repeating incident classes mean lessons aren't crossing squad boundaries.",
    },
    "Feedback & learning": {
      why: "A learning organisation compounds. SAFe's Inspect &amp; Adapt and Spotify's retros are the engine that drives it.",
      team: [
        "Protect squad retros and run a tribe/ART-level <b>Inspect &amp; Adapt</b> each PI with measurable items.",
        "Use chapters and guilds/leagues to <i>spread</i> practices — not just top-down broadcasts.",
        "Track that improvement actions actually close; review them at the next I&amp;A.",
      ],
      leader: [
        "Actively seek feedback on your own leadership and act on it visibly.",
        "Invest in coaching and growth for chapter leads, not just delivery throughput.",
        "Make learning time non-negotiable — defend it when the calendar gets tight.",
      ],
      watch: "Retro actions that never close mean the learning loop is broken.",
    },
  };

  // Level-specific guidance framed in the team's operating model
  // (Spotify squads/tribes/chapters/leagues + SAFe ART/PI cadence).
  const LEVEL_ORG = [
    "Stand up clear squad missions and chapter rituals, and agree a leadership working agreement before layering on more ceremonies.",
    "Use chapter forums and ART Sync to surface and work <i>through</i> cross-squad friction — don't suppress it. Storming is healthy here.",
    "Stabilise the PI cadence and a shared Definition of Done across the ART, then start genuinely delegating decisions down to squads.",
    "Optimise for flow with metrics, deepen your guild/league communities, and let squads self-organise around PI objectives.",
    "Sustain through continuous Inspect &amp; Adapt, mentor other tribes, and contribute proven patterns to guilds/leagues — actively guard against complacency.",
  ];

  function levelIndex(level) { return LEVELS.indexOf(level); }

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

  // --- Forms ------------------------------------------------------------
  // Binds an event-entry form. `p` is the id prefix for the form's fields
  // ("ev" for the inline form, "q" for the quick-add modal).
  function bindEventForm(formId, p, previewId, onDone) {
    el(p + "Category").innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join("");
    resetForm(p);

    const preview = () => {
      const sev = +el(p + "Severity").value, rating = +el(p + "Rating").value;
      const d = (rating - 3) * sev;
      el(previewId).innerHTML = d === 0
        ? `This event would be <b>neutral</b> (adequate handling holds the level steady).`
        : `This event would <b>${d > 0 ? "promote" : "demote"}</b> the team by <b>${Math.abs(d)} point${Math.abs(d) === 1 ? "" : "s"}</b>.`;
    };
    el(p + "Severity").addEventListener("change", preview);
    el(p + "Rating").addEventListener("change", preview);
    preview();

    el(formId).addEventListener("submit", e => {
      e.preventDefault();
      events.push({
        id: Date.now(),
        title: el(p + "Title").value.trim(),
        date: el(p + "Date").value,
        category: el(p + "Category").value,
        severity: +el(p + "Severity").value,
        rating: +el(p + "Rating").value,
        notes: el(p + "Notes").value.trim(),
      });
      save();
      resetForm(p);
      preview();
      render();
      if (onDone) onDone();
    });

    return preview;
  }

  function resetForm(p) {
    el(p + "Title").value = "";
    el(p + "Notes").value = "";
    el(p + "Severity").value = "4";
    el(p + "Rating").value = "3";
    el(p + "Date").value = new Date().toISOString().slice(0, 10);
  }

  function initForms() {
    bindEventForm("eventForm", "ev", "impactPreview", () => switchView("dashboard"));

    // Quick-add modal ("prompt window").
    const modal = el("modal");
    bindEventForm("quickForm", "q", "qImpactPreview", closeModal);

    function openModal() {
      resetForm("q");
      el("qImpactPreview").innerHTML = "";
      modal.hidden = false;
      el("qTitle").focus();
    }
    function closeModal() { modal.hidden = true; }

    el("quickAddBtn").addEventListener("click", openModal);
    el("modalClose").addEventListener("click", closeModal);
    el("modalCancel").addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
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
  initForms();
  render();
})();

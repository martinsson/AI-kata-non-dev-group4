# Team Maturity Compass

A web app for an **R&D leadership team** to track and grow its maturity — from
*low performing* to *high performing*.

## What it does

- **Maturity model** — a 0–100 score across 5 levels (Forming → Storming →
  Norming → Performing → High performing).
- **Dashboard** — shows the current level, a gauge, recent momentum, and where
  the team sits on the ladder.
- **Log events** — record real situations the team faces (incidents, decisions,
  conflicts, launches). Rate the *stakes* and *how well the team handled it*.
- **Promote / demote** — each event nudges the score: well-handled, high-stakes
  events promote the team; poorly-handled ones demote it
  (`delta = (handling − 3) × stakes`).
- **Analysis & recommendations** — automatically highlights momentum, the
  weakest capability area, strengths, and behaviour under pressure, with
  concrete suggestions.
- **Trend over time** — an SVG line chart of the maturity score across all
  logged events.

## How it works

Pure static site — HTML/CSS/vanilla JS, no build step, no backend. Data is
stored in the browser via `localStorage`. Use **Load sample data** on the
History tab to explore with a worked example.

## Running / deploying

Open `site/index.html` locally, or push to `main` — GitHub Actions deploys
`site/` to GitHub Pages.

One-time per fork/clone: **Settings → Pages → Source: GitHub Actions**.

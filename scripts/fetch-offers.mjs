#!/usr/bin/env node
/**
 * Construit site/offers.json à partir des API OFFICIELLES (aucun scraping).
 *
 * Sources (chacune est optionnelle et ne s'active que si ses identifiants sont
 * présents dans l'environnement) :
 *   - France Travail  — API « Offres d'emploi v2 » (OAuth2 client_credentials)
 *       secrets : FT_CLIENT_ID, FT_CLIENT_SECRET
 *   - Adzuna          — API agrégateur officielle
 *       secrets : ADZUNA_APP_ID, ADZUNA_APP_KEY
 *   - La Bonne Alternance — API service public (alternance)
 *       variable : LBA_CALLER (une adresse e-mail de contact, requise par l'API)
 *
 * Comportement défensif : chaque source est isolée dans un try/catch. Si AUCUNE
 * source ne renvoie d'offre (identifiants absents, panne réseau…), le fichier
 * existant n'est PAS écrasé — on préserve la base précédente.
 *
 * Requiert Node >= 18 (fetch global). Lancé en CI par
 * .github/workflows/refresh-offers.yml (réseau ouvert + secrets protégés).
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site", "offers.json");
const MAX_AGE_DAYS = 7;          // uniquement les offres de moins d'une semaine
const MAX_OFFERS = 300;

// Domaines cibles (data / info / tech) + villes couvertes.
const TECH_KEYWORDS = ["data", "développeur", "data analyst", "data engineer",
  "data scientist", "devops", "cybersécurité", "ingénieur logiciel"];
const TECH_ROMES = ["M1805", "M1810", "M1802", "M1806", "M1803"]; // études & dev, prod, conseil SI…
const CITIES = [
  { name: "Paris",     insee: "75056", lat: 48.8566, lng: 2.3522 },
  { name: "Lyon",      insee: "69123", lat: 45.7640, lng: 4.8357 },
  { name: "Toulouse",  insee: "31555", lat: 43.6045, lng: 1.4440 },
  { name: "Nantes",    insee: "44109", lat: 47.2184, lng: -1.5536 },
  { name: "Lille",     insee: "59350", lat: 50.6292, lng: 3.0573 },
  { name: "Bordeaux",  insee: "33063", lat: 44.8378, lng: -0.5792 },
  { name: "Rennes",    insee: "35238", lat: 48.1173, lng: -1.6778 },
  { name: "Grenoble",  insee: "38185", lat: 45.1885, lng: 5.7245 },
];

const nowMs = Date.now();
const isFresh = (iso) => {
  const t = Date.parse(iso);
  return isFinite(t) && (nowMs - t) <= MAX_AGE_DAYS * 86400000;
};
const log = (...a) => console.log("[fetch-offers]", ...a);

/* ---------------------- France Travail (Offres d'emploi v2) --------------- */
async function ftToken(id, secret) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
    scope: "api_offresdemploiv2 o2dsoffre",
  });
  const r = await fetch(
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("FT token HTTP " + r.status);
  return (await r.json()).access_token;
}

async function fromFranceTravail() {
  const id = process.env.FT_CLIENT_ID, secret = process.env.FT_CLIENT_SECRET;
  if (!id || !secret) { log("France Travail: identifiants absents, ignoré."); return []; }
  const token = await ftToken(id, secret);
  const out = [];
  for (const city of CITIES) {
    for (const kw of TECH_KEYWORDS.slice(0, 3)) { // limite le nombre d'appels
      const p = new URLSearchParams({
        motsCles: kw, commune: city.insee, distance: "30",
        publieeDepuis: String(MAX_AGE_DAYS), range: "0-49",
      });
      const r = await fetch(
        "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?" + p,
        { headers: { Authorization: "Bearer " + token } });
      if (r.status !== 200 && r.status !== 206) continue;
      const data = await r.json();
      for (const o of (data.resultats || [])) {
        const lt = o.lieuTravail || {};
        out.push({
          title: o.intitule,
          company: (o.entreprise && o.entreprise.nom) || "Entreprise non précisée",
          domain: "Informatique / Numérique",
          contract: mapContract(o.typeContrat, o.typeContratLibelle, o.natureContrat),
          city: lt.libelle ? lt.libelle.replace(/^\d+\s*-\s*/, "") : city.name,
          lat: lt.latitude != null ? Number(lt.latitude) : city.lat,
          lng: lt.longitude != null ? Number(lt.longitude) : city.lng,
          publishedAt: o.dateCreation,
          url: (o.origineOffre && o.origineOffre.urlOrigine) ||
               "https://candidat.francetravail.fr/offres/emploi/" + o.id,
          source: "France Travail",
          description: (o.description || "").slice(0, 220),
        });
      }
    }
  }
  log("France Travail:", out.length, "offres.");
  return out;
}

function mapContract(code, label, nature) {
  const s = ((label || "") + " " + (nature || "")).toLowerCase();
  if (s.includes("alternance") || s.includes("apprentissage") || s.includes("professionnalisation"))
    return "Alternance";
  if ((code || "").toUpperCase() === "CDD" || s.includes("déterminée")) return "CDD";
  if ((code || "").toUpperCase() === "CDI" || s.includes("indéterminée")) return "CDI";
  return label || "Autre";
}

/* ------------------------------- Adzuna ----------------------------------- */
async function fromAdzuna() {
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) { log("Adzuna: identifiants absents, ignoré."); return []; }
  const out = [];
  for (const kw of ["data", "développeur", "devops"]) {
    const p = new URLSearchParams({
      app_id: id, app_key: key, results_per_page: "50",
      what: kw, max_days_old: String(MAX_AGE_DAYS), "content-type": "application/json",
    });
    const r = await fetch("https://api.adzuna.com/v1/api/jobs/fr/search/1?" + p);
    if (!r.ok) continue;
    const data = await r.json();
    for (const o of (data.results || [])) {
      out.push({
        title: o.title,
        company: (o.company && o.company.display_name) || "Entreprise non précisée",
        domain: "Informatique / Numérique",
        contract: o.contract_type === "permanent" ? "CDI"
                : o.contract_type === "contract" ? "CDD" : "Autre",
        city: (o.location && o.location.display_name) || "",
        lat: o.latitude != null ? Number(o.latitude) : null,
        lng: o.longitude != null ? Number(o.longitude) : null,
        publishedAt: o.created,
        url: o.redirect_url,
        source: "Adzuna",
        description: (o.description || "").slice(0, 220),
      });
    }
  }
  log("Adzuna:", out.length, "offres.");
  return out;
}

/* ------------------------- La Bonne Alternance ---------------------------- */
async function fromLBA() {
  const caller = process.env.LBA_CALLER;
  if (!caller) { log("La Bonne Alternance: LBA_CALLER absent, ignoré."); return []; }
  const out = [];
  for (const city of CITIES) {
    const p = new URLSearchParams({
      romes: TECH_ROMES.join(","), caller, latitude: String(city.lat),
      longitude: String(city.lng), radius: "30", insee: city.insee,
    });
    const r = await fetch(
      "https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/jobs?" + p);
    if (!r.ok) continue;
    const data = await r.json();
    const jobs = [...((data.peJobs && data.peJobs.results) || []),
                  ...((data.matchas && data.matchas.results) || [])];
    for (const o of jobs) {
      const place = o.place || {};
      out.push({
        title: (o.title || (o.job && o.job.jobTitle) || "Offre en alternance"),
        company: (o.company && o.company.name) || "Entreprise",
        domain: "Informatique / Numérique",
        contract: "Alternance",
        city: place.city || place.fullAddress || city.name,
        lat: place.latitude != null ? Number(place.latitude) : city.lat,
        lng: place.longitude != null ? Number(place.longitude) : city.lng,
        publishedAt: (o.job && o.job.creationDate) || new Date(nowMs).toISOString(),
        url: (o.url) || (o.company && o.company.url) || "https://labonnealternance.apprentissage.beta.gouv.fr/",
        source: "La Bonne Alternance",
        description: ((o.job && o.job.description) || "").slice(0, 220),
      });
    }
  }
  log("La Bonne Alternance:", out.length, "offres.");
  return out;
}

/* --------------------------------- main ----------------------------------- */
function dedupeKey(o) {
  return [o.title, o.company, o.city].map((s) => (s || "").toLowerCase().trim()).join("|");
}

async function main() {
  const collected = [];
  for (const src of [fromFranceTravail, fromAdzuna, fromLBA]) {
    try { collected.push(...(await src())); }
    catch (e) { log("Source en échec:", src.name, "-", e.message); }
  }

  const seen = new Set();
  const offers = collected
    .filter((o) => o && o.title && o.publishedAt && isFresh(o.publishedAt))
    .filter((o) => { const k = dedupeKey(o); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, MAX_OFFERS);

  if (offers.length === 0) {
    log("Aucune offre collectée — base existante conservée (pas d'écrasement).");
    if (!existsSync(OUT)) { log("ATTENTION: offers.json inexistant et aucune donnée."); process.exit(0); }
    return;
  }

  const db = {
    generatedAt: new Date(nowMs).toISOString(),
    note: "Base rafraîchie automatiquement via les API officielles (France Travail / Adzuna / La Bonne Alternance).",
    count: offers.length,
    offers,
  };
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf-8");
  log("Écrit", OUT, "avec", offers.length, "offres.");
}

main().catch((e) => { console.error(e); process.exit(1); });

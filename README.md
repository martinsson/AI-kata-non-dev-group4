# AI-kata-non-dev-group1

Edit files in `site/`, push to `main`, GitHub Actions deploys to Pages.

One-time per fork/clone: **Settings → Pages → Source: GitHub Actions**.

## Recherche d'emploi étudiant

`site/index.html` est une application de recherche d'offres (data / info / tech,
alternance / CDI / CDD) par rayon géographique. Elle lit sa base d'offres dans
`site/offers.json` et n'affiche que les offres publiées il y a **moins d'une semaine**.

### Base d'offres (`site/offers.json`)

C'est la « base de données » du site. Un seed est intégré dans la page pour un
affichage immédiat et autonome ; sur GitHub Pages, la page charge en plus
`offers.json` (base vivante) et l'utilise si elle contient des données.

### Rafraîchissement automatique (API officielles, pas de scraping)

`.github/workflows/refresh-offers.yml` exécute `scripts/fetch-offers.mjs`
toutes les 6 h (et à la demande). Le script interroge des **API officielles**,
normalise, filtre les offres de moins de 7 jours, puis commit `offers.json`
(ce qui redéclenche le déploiement Pages).

Pour activer les sources, ajouter les secrets du dépôt
(**Settings → Secrets and variables → Actions**) :

| Source | Secrets à définir | Où obtenir |
|--------|-------------------|-----------|
| France Travail (Offres d'emploi v2) | `FT_CLIENT_ID`, `FT_CLIENT_SECRET` | https://francetravail.io |
| Adzuna | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | https://developer.adzuna.com |
| La Bonne Alternance | `LBA_CALLER` (une adresse e-mail de contact) | https://labonnealternance.apprentissage.beta.gouv.fr |

Aucune source configurée ⇒ le script conserve la base existante (aucun écrasement).
Tant qu'aucun secret n'est ajouté, le site fonctionne avec le seed de démonstration.

> Note : le scraping de sites comme LinkedIn, Welcome to the Jungle, APEC ou
> Indeed est interdit par leurs conditions d'utilisation. On passe donc par les
> API officielles, qui republient légalement une grande partie de ces offres.

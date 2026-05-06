# Feature Specification: Persistance des inscriptions via service de formulaire externe

**Feature Branch**: `claude/setup-speckit-Lpug4`
**Created**: 2026-05-06
**Status**: Draft
**Input**: User description: "Intégrer Formspree au formulaire d'inscription à la Fête du quartier (site/index.html) pour que chaque soumission soit persistée et envoyée par email à l'organisateur."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un habitant soumet son inscription et reçoit une confirmation (Priority: P1)

Un habitant du quartier remplit le formulaire d'inscription et clique sur "S'inscrire à la fête". Après soumission, il voit un message lui confirmant que son inscription a bien été prise en compte. L'organisateur reçoit simultanément un email contenant toutes les informations saisies.

**Why this priority**: C'est le flux principal : sans lui, aucune inscription n'est jamais reçue par l'organisateur. Toutes les autres stories en dépendent.

**Independent Test**: Remplir tous les champs obligatoires du formulaire, soumettre, vérifier l'affichage du message de confirmation, puis vérifier la réception de l'email côté organisateur et la présence de la soumission dans l'outil de gestion en ligne.

**Acceptance Scenarios**:

1. **Given** un visiteur a rempli tous les champs obligatoires (Nom, Prénom, E-mail, Nombre de personnes), **When** il clique sur "S'inscrire à la fête", **Then** le formulaire est envoyé au service externe et l'utilisateur voit un message de confirmation à la place du formulaire.
2. **Given** le formulaire vient d'être soumis avec succès, **When** l'organisateur consulte sa boîte email, **Then** il a reçu un email contenant toutes les données saisies (nom, prénom, email, téléphone, adresse, nombre de personnes, apports, allergies, commentaire).
3. **Given** le formulaire vient d'être soumis avec succès, **When** l'organisateur se connecte à l'outil de gestion en ligne, **Then** la soumission apparaît dans la liste avec la date et l'heure de réception.

---

### User Story 2 - L'organisateur consulte la liste complète des inscrits (Priority: P2)

L'organisateur veut visualiser toutes les inscriptions reçues pour préparer la fête (nombre de personnes, apports, allergies). Il se connecte à l'outil de gestion en ligne et accède à la liste complète des soumissions.

**Why this priority**: Utile après la mise en place, mais le flux P1 doit fonctionner d'abord. Sans consultation groupée, l'organisateur peut se contenter des emails individuels.

**Independent Test**: Après plusieurs soumissions de test, se connecter à l'outil de gestion, vérifier que toutes les soumissions apparaissent avec leurs champs, et vérifier qu'un export (CSV ou équivalent) est disponible.

**Acceptance Scenarios**:

1. **Given** plusieurs inscriptions ont été soumises, **When** l'organisateur accède à l'outil de gestion en ligne, **Then** toutes les inscriptions sont listées avec au minimum : date, nom, prénom, email, nombre de personnes.
2. **Given** la liste des inscriptions est affichée, **When** l'organisateur demande un export, **Then** il obtient un fichier téléchargeable contenant toutes les données.

---

### User Story 3 - Un habitant soumet le formulaire avec un champ obligatoire manquant (Priority: P3)

Un visiteur tente de soumettre le formulaire sans remplir tous les champs obligatoires. Le formulaire lui signale les champs manquants sans envoyer les données.

**Why this priority**: La validation existante du navigateur gère déjà ce cas ; cette story vérifie qu'elle reste intacte après la modification.

**Independent Test**: Laisser vide le champ "Nom" et cliquer sur soumettre — vérifier qu'aucune soumission n'est envoyée au service externe et que le champ manquant est signalé.

**Acceptance Scenarios**:

1. **Given** un visiteur laisse un champ obligatoire vide, **When** il clique sur "S'inscrire à la fête", **Then** le formulaire signale le champ manquant et aucune donnée n'est transmise au service externe.

---

### Edge Cases

- Que se passe-t-il si le service externe est temporairement indisponible au moment de la soumission ? L'utilisateur doit voir un message d'erreur clair lui demandant de réessayer.
- Si l'utilisateur soumet plusieurs fois le même formulaire (double-clic), chaque soumission génère une entrée distincte — l'organisateur doit le savoir et peut dédoublonner via l'outil de gestion.
- Sur connexion lente, le bouton de soumission doit être désactivé pendant l'envoi pour éviter les doubles soumissions accidentelles.
- Le champ "apports" utilise des cases à cocher multiples — toutes les valeurs cochées doivent apparaître dans l'email et l'outil de gestion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Chaque soumission du formulaire DOIT être transmise à un service externe de collecte de formulaires sans nécessiter de backend hébergé par l'équipe projet.
- **FR-002**: L'organisateur DOIT recevoir un email de notification pour chaque nouvelle inscription, contenant l'ensemble des données saisies dans le formulaire.
- **FR-003**: Chaque soumission DOIT être persistée dans un espace de stockage consultable en ligne par l'organisateur (tableau de bord ou équivalent).
- **FR-004**: L'organisateur DOIT pouvoir exporter l'ensemble des inscriptions dans un format bureautique standard (ex. tableur).
- **FR-005**: Après soumission réussie, le visiteur DOIT voir un message de confirmation à la place du formulaire, indiquant que son inscription a bien été reçue.
- **FR-006**: En cas d'échec de transmission (service externe indisponible), le visiteur DOIT voir un message d'erreur lui demandant de réessayer, sans perte des données saisies.
- **FR-007**: Tous les champs actuels du formulaire (Nom, Prénom, E-mail, Téléphone, Adresse, Nombre de personnes, Apports, Allergies, Commentaire) DOIVENT être transmis intégralement au service externe.
- **FR-008**: L'adresse email de destination des notifications DOIT être configurable par l'organisateur sans modifier le code source.
- **FR-009**: Le formulaire DOIT continuer à valider les champs obligatoires avant tout envoi ; aucune soumission incomplète ne DOIT être transmise.
- **FR-010**: L'aspect visuel du formulaire (mise en page, styles, libellés, ordre des champs) NE DOIT PAS changer.

### Key Entities

- **Inscription** : une soumission complète du formulaire. Attributs : nom, prénom, email, téléphone (optionnel), adresse (optionnel), nombre de personnes, liste des apports, allergies/régimes (optionnel), commentaire (optionnel), date et heure de soumission.
- **Organisateur** : personne qui configure le service externe et reçoit les notifications. Accède aux inscriptions via l'outil de gestion en ligne.
- **Visiteur / Inscrit** : habitant du quartier qui remplit et soumet le formulaire.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des soumissions valides aboutissent à la réception d'un email de notification côté organisateur dans un délai inférieur à 2 minutes.
- **SC-002**: 100 % des données saisies dans le formulaire sont présentes et lisibles dans l'email de notification et dans l'outil de gestion.
- **SC-003**: Le visiteur voit le message de confirmation dans les 5 secondes suivant le clic sur le bouton de soumission (connexion standard).
- **SC-004**: L'organisateur peut exporter la totalité des inscriptions en moins de 3 clics depuis l'outil de gestion.
- **SC-005**: Aucune régression visuelle ou fonctionnelle n'est introduite sur le formulaire existant (0 champ modifié, 0 libellé changé, 0 comportement de validation altéré).
- **SC-006**: La mise en place ne nécessite aucun serveur ni base de données hébergés par l'équipe projet.

## Assumptions

- L'organisateur créera lui-même un compte sur le service de collecte externe (gratuit) et fournira l'identifiant unique du formulaire à intégrer dans le code.
- Le volume d'inscriptions restera inférieur à 50 par événement, ce qui est compatible avec les limites du plan gratuit du service externe envisagé.
- L'organisateur dispose d'une adresse email fonctionnelle pour recevoir les notifications.
- Le site est hébergé en HTTPS (GitHub Pages), ce qui est requis par la plupart des services de formulaire externes pour accepter les soumissions.
- L'intégration ne doit pas ajouter de dépendance à un framework JavaScript supplémentaire : la modification doit rester dans le HTML et le JavaScript natif existant.
- La conformité RGPD (mentions légales, consentement) est hors périmètre de cette spec et sera traitée séparément si nécessaire.

# Feature Specification: Inversion de l'ordre des champs Nom et Prénom

**Feature Branch**: `claude/setup-speckit-Lpug4`
**Created**: 2026-05-06
**Status**: Draft
**Input**: User description: "Inverser l'ordre des champs Prénom et Nom sur le formulaire d'inscription à la Fête du quartier (site/index.html). Actuellement Prénom apparaît à gauche et Nom à droite ; après changement, Nom doit apparaître à gauche et Prénom à droite, dans la même rangée. Aucun changement de comportement métier : les noms des champs (name=\"prenom\", name=\"nom\"), les ids, les placeholders et la validation restent identiques. Seul l'ordre visuel des deux champs dans la rangée change."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saisie de l'identité dans l'ordre Nom puis Prénom (Priority: P1)

Un habitant du quartier ouvre le formulaire d'inscription à la fête du quartier. Sur la première rangée du formulaire, il voit d'abord le champ **Nom** à gauche, puis le champ **Prénom** à droite. Il saisit naturellement son nom de famille puis son prénom, dans l'ordre qui correspond à l'usage administratif courant en France.

**Why this priority**: C'est la seule fonctionnalité de cette spec. Sans elle, la modification visuelle demandée n'est pas réalisée. C'est aussi le seul changement perceptible par l'utilisateur final.

**Independent Test**: Ouvrir `site/index.html` dans un navigateur, observer la première rangée du formulaire et vérifier que le champ étiqueté "Nom *" apparaît à gauche et le champ étiqueté "Prénom *" à droite. Remplir les deux champs, soumettre le formulaire et confirmer que le message de confirmation s'affiche normalement.

**Acceptance Scenarios**:

1. **Given** un visiteur ouvre la page d'inscription, **When** la page est rendue, **Then** la première rangée affiche le champ "Nom" à gauche et le champ "Prénom" à droite, sur la même ligne, avec le même espacement et le même rendu visuel qu'avant l'inversion.
2. **Given** la première rangée du formulaire affiche Nom puis Prénom, **When** l'utilisateur tabule depuis le titre du formulaire, **Then** le focus se place d'abord sur le champ "Nom", puis sur le champ "Prénom".
3. **Given** l'utilisateur a rempli "Nom" et "Prénom" puis le reste des champs requis, **When** il soumet le formulaire, **Then** le message de succès s'affiche et la fonctionnalité d'inscription se comporte exactement comme avant le changement.
4. **Given** l'utilisateur laisse vide le champ "Nom" ou "Prénom", **When** il soumet le formulaire, **Then** la validation native du navigateur signale le champ requis manquant, comme avant le changement.

---

### Edge Cases

- Sur écran étroit où la rangée passe en disposition empilée (si applicable), le champ "Nom" doit apparaître **au-dessus** du champ "Prénom", suivant le même ordre que sur écran large.
- Lorsqu'un utilisateur de lecteur d'écran parcourt le formulaire dans l'ordre du DOM, "Nom" doit être annoncé avant "Prénom".
- Un outil d'auto-remplissage du navigateur doit continuer à remplir correctement chaque champ grâce aux attributs `name`/`id` inchangés (`prenom` reste le prénom, `nom` reste le nom).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La première rangée du formulaire d'inscription DOIT afficher le champ "Nom" en première position (à gauche en disposition horizontale, en haut en disposition empilée) et le champ "Prénom" en seconde position.
- **FR-002**: L'ordre du DOM des deux champs DOIT correspondre à l'ordre visuel : "Nom" précède "Prénom" dans la source HTML, sans recourir à un ordre CSS qui désynchroniserait l'ordre visuel et l'ordre de tabulation.
- **FR-003**: Les attributs techniques de chaque champ (`id`, `name`, `type`, `required`, `placeholder`) DOIVENT rester identiques à leur valeur actuelle. Le champ du nom de famille conserve `id="nom"` et `name="nom"`; le champ du prénom conserve `id="prenom"` et `name="prenom"`.
- **FR-004**: Les libellés visibles ("Nom *" et "Prénom *") et leur association `<label for="...">` au champ correspondant DOIVENT être préservés.
- **FR-005**: Aucun autre champ, libellé, style, message ou comportement de soumission du formulaire NE DOIT être modifié par cette fonctionnalité.
- **FR-006**: L'ordre de tabulation clavier DOIT suivre l'ordre visuel : Nom d'abord, puis Prénom.

### Key Entities

Sans objet — la fonctionnalité ne touche ni à la donnée persistée ni à un nouveau type d'entité. Le formulaire reste local au fichier `site/index.html` et ne déclenche pas d'envoi vers un backend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des chargements de la page d'inscription présentent le champ "Nom" avant le champ "Prénom" sur la première rangée du formulaire.
- **SC-002**: La soumission du formulaire continue d'afficher le message de confirmation dans 100 % des cas où tous les champs obligatoires sont remplis (aucune régression fonctionnelle).
- **SC-003**: Aucune autre partie du formulaire (libellés, autres champs, validation, message de succès, mise en forme) n'est modifiée — vérifiable par diff visuel et par diff du fichier limité aux deux blocs `form-group` concernés.
- **SC-004**: La modification est livrée sans introduire de nouveau fichier ni de nouvelle dépendance.

## Assumptions

- L'inversion concerne uniquement le formulaire actuel `site/index.html`. Aucun autre formulaire similaire n'existe dans le projet.
- L'ordre du DOM doit être inversé (et non l'ordre CSS) afin que tabulation, lecteurs d'écran et auto-remplissage suivent le même ordre que l'affichage.
- La taille de la modification est limitée : seuls les deux blocs `<div class="form-group">` contenant respectivement "Prénom" et "Nom" voient leur position dans la rangée échangée.
- Le formulaire reste en français et respecte la convention administrative française (nom de famille avant prénom) — c'est la justification fonctionnelle de l'inversion.
- Aucune migration de données n'est requise puisque le formulaire ne persiste rien : le script existant se contente d'afficher un message de confirmation côté client.

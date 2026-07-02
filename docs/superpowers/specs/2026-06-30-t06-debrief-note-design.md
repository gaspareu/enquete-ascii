# T-06 — Débrief noté à l'accusation (design)

_Date : 2026-06-30 · Branche : `feat/t06-debrief-note`_

## Contexte & objectif

Aujourd'hui l'accusation est binaire : le joueur déclare Laurent `Coupable`/`Innocent`,
le serveur compare au verdict + aux preuves requises (`server/accusation.js`,
`scenario.solution`) et renvoie un gagné/perdu sec.

T-06 remplace cet endgame par un **débrief de 4 questions ouvertes notées selon la
précision de la réponse**. Le joueur écrit librement ; le serveur envoie ses réponses à
Claude (LLM-judge) avec un **barème secret**, récupère une note **0-5** par question et
une justification, somme le tout et renvoie un **rang d'enquêteur** sur 20.

> Ce design **réécrit** le critère d'acceptation initial de T-06
> (« l'écran d'accusation propose les indices découverts ; vérif serveur inchangée »),
> conformément à la note d'élargissement portée sur la tâche : la vérif serveur change,
> et l'écran propose des questions ouvertes, pas une sélection d'indices.

### Décisions arrêtées (brainstorming)

- **Format des réponses** : texte libre, noté par Claude (LLM-judge).
- **Rôle du verdict « qui ? »** : devient une question notée parmi les autres (la Q1).
  Plus de game-over sec ; on somme les points → rang.
- **Anti-bluff** : note libre, **sans plafond** par les flags découverts. Le juge ne note
  que la précision, indépendamment de ce qui a été fouillé.
- **Modèle du juge** : réutilise la variable `MODEL` déjà configurée (Sonnet 4.6 par
  défaut). Pas de second modèle à gérer.
- **Nombre de questions** : 4 (`qui` / `comment` / `mobile` / `surprise`), score sur 20.

## Architecture

Le backend reste **sans état** et **détient tout le secret** (barème, rangs, réponses
idéales) — exactement comme `scenario.solution`. Le front ne reçoit que les **textes des
questions**.

### Flux d'un débrief

```
game.js (formulaire : 1 textarea / question)
  → POST /api/debrief { reponses: [{ id, reponse }] }
    → validate.js  : valideDebrief (ids connus, longueurs bornées, nb ≤ nb questions)
    → scoring.js   : construitPromptJuge(scenario, reponses)  (barèmes secrets + réponses)
    → juge.js      : noterDebrief(client, …)  → client.messages.create (structured output)
    → scoring.js   : agregeScore(notes, rangs) → { total, max, rang, details[] }
  ← { total, max, rang, details: [{ id, note, justification }] }
game.js → écran de score (total /20, rang, note+justification par question, « Rejouer »)
```

Plus de journal de gestes envoyé à `/api/debrief` : le scoring est sans plafond, il ne
dépend que des réponses écrites.

## Données — `data/scenario.js`

Nouveau bloc **secret** `debrief`, au même niveau que `solution` :

```js
debrief: {
  questions: [
    {
      id: "qui",
      question: "Qui a tué Hélène — et était-ce vraiment un suicide ?",
      bareme: [
        { note: 1, critere: "Nomme Laurent OU dit que ce n'est pas un suicide." },
        { note: 3, critere: "Laurent, et ce n'est pas un suicide : un tiers était présent." },
        { note: 5, critere: "Laurent l'a empoisonnée puis a maquillé un suicide ; étayé par les deux tasses / le fait qu'il lui montait la tisane." },
      ],
    },
    {
      id: "comment",
      question: "Comment Laurent s'y est-il pris ?",
      bareme: [
        { note: 1, critere: "Empoisonnement / somnifères, sans précision." },
        { note: 3, critere: "Surdose de somnifères dans la tisane du soir." },
        { note: 5, critere: "Somnifères (achetés à son nom) dissous dans la tisane qu'il lui montait lui-même ; double tasse + reçu de pharmacie." },
      ],
    },
    {
      id: "mobile",
      question: "Quel était son mobile ?",
      bareme: [
        { note: 1, critere: "Jalousie OU argent, isolément." },
        { note: 3, critere: "Il la croyait infidèle (rendez-vous secrets) — jalousie possessive." },
        { note: 5, critere: "Jalousie (il prenait les rendez-vous secrets pour une liaison) ET dettes (il convoitait le montant de son prix) ; il ne supportait pas de la perdre." },
      ],
    },
    {
      id: "surprise",
      question: "Que cachait réellement Hélène ?",
      bareme: [
        { note: 1, critere: "Une fête / une surprise." },
        { note: 3, critere: "Une fête surprise pour Laurent (pas un amant)." },
        { note: 5, critere: "Les rendez-vous secrets étaient les préparatifs d'une fête surprise pour Laurent (traiteur Maurel, cadeau, mot) — l'ironie tragique : elle ne le trompait pas." },
      ],
    },
  ],
  // Rangs par seuil de score total (tri décroissant à l'usage).
  rangs: [
    { seuil: 19, titre: "Maître enquêteur" },
    { seuil: 15, titre: "Fin limier" },
    { seuil: 9,  titre: "Enquêteur compétent" },
    { seuil: 0,  titre: "Affaire classée sans suite" },
  ],
}
```

- Note `0` possible (réponse hors-sujet ou vide) → le palier minimal du barème est `1` ;
  `0` est attribué par le juge quand rien ne correspond.
- **Sécurité** : `debrief.questions[].bareme` et `debrief.rangs` ne quittent **jamais** le
  serveur. `vuePublique` n'expose que `{ id, question }`.

`ciblesConnues()` est inchangé (les ids de débrief ne sont pas des cibles de gestes) ;
on exposera plutôt un helper `idsDebrief(scenario)` pour la validation.

## Serveur

### `server/scoring.js` (pur, sans réseau)

- `construitPromptJuge(scenario, reponses)` → `{ system, message }` : `system` = consigne
  de notation (rôle de juge, échelle 0-5, exiger une note par question) ; `message` =
  contenu du tour utilisateur listant, pour chaque question, son barème **et** la réponse
  du joueur. La réponse joueur est encadrée comme **donnée à noter**, jamais comme
  instruction (robuste à l'injection : on ne lui fait rien faire, on la note).
- `agregeScore(notes, rangs)` → `{ total, max, rang, details }` :
  - coerce chaque note en entier, **clamp 0-5**, défaut `0` si un id manque (on ne fait
    jamais confiance à la sortie du modèle) ;
  - `total = somme`, `max = 5 × nb questions` ;
  - `rang` = premier `rangs` (tri décroissant par seuil) dont `seuil ≤ total`.

### `server/juge.js`

- `noterDebrief(client, { scenario, reponses, model })` → `[{ id, note, justification }]`.
- Appel **non-streamé** `client.messages.create` (sortie courte).
- **Sortie structurée** via `output_config.format` (`type: "json_schema"`). `note` en
  `enum [0,1,2,3,4,5]` (les bornes numériques `minimum`/`maximum` ne sont pas supportées
  en structured outputs ; l'enum l'est). Schéma : tableau d'objets
  `{ id: string, note: enum, justification: string }`, `additionalProperties: false`.
- `effort: "low"` (tâche de notation légère).
- Client **injecté** (comme `repondreEnFlux`) → testable sans réseau.
- Erreur d'appel → propagée pour que la route réponde proprement (502).

### `server/chat.js`

- Nouvelle route `POST /api/debrief` (remplace `/api/accuser`), fonction de notation
  **injectée** (`noterFn = noterDebrief`) pour les tests.
  - `valideDebrief` au boundary → 400 si invalide.
  - `503` si pas de client (clé absente), comme `/chat`.
  - try/catch autour de l'appel juge → `502` « juge injoignable » en cas d'échec.
  - réponse : `{ total, max, rang, details }`.
- `server/accusation.js` supprimé ; `evaluerAccusation` retiré de l'import.

### Modèle du juge

Réutilise le `model` déjà injecté dans `creerRouteur` (variable d'env `MODEL`,
Sonnet 4.6 par défaut). Aucune nouvelle dépendance modèle.

## Validation — `server/validate.js`

`valideDebrief(body, idsConnus)` :

- `body.reponses` : tableau, longueur ≤ nombre d'ids connus.
- chaque entrée : `{ id }` ∈ `idsConnus`, `reponse` string `≤ MAX_REPONSE` (~1000 car.),
  normalisée (champs parasites écartés). Réponse vide tolérée (notée 0).
- Renvoie `{ ok, valeur }` ou `{ ok: false, erreur }`. Fail-fast, messages clairs.

## Front — `public/`

### `game.js`
- Le bouton « Accuser » ouvre désormais un **formulaire de débrief** : un `textarea` par
  `vue.debrief.questions` (label = `question`).
- À la soumission → `POST /api/debrief` avec `{ reponses: [{ id, reponse }] }`.
- Affiche l'**écran de score** (via `render.js`) : total `/20`, rang, et note +
  justification par question. Bouton « Rejouer » (`location.reload()`).
- Gestion d'erreur réseau / 4xx-5xx alignée sur l'existant (`narration` / modale).

### `render.js`
- Nouveau rendu **pur** `rendreDebrief(resultat)` → chaîne ASCII style terminal
  (en-tête rang, barre de score, blocs par question). Le DOM reste dans `game.js`
  (séparation existante pur ↔ câblage).

### Design System
- Formulaire + écran de score stylés **uniquement** via les tokens de `tokens.css`.
- Mettre `public/DESIGN-SYSTEM.md` à jour si nouveaux composants (champ texte multi-ligne,
  écran de fin, barre de score). Animations neutralisées sous
  `@media (prefers-reduced-motion: reduce)`.

## Tests (TDD, couverture ≥ 80 %)

| Fichier | Cas |
|---|---|
| `scoring.test.js` | `agregeScore` : somme, clamp 0-5, défaut 0 si id manquant, choix du rang par seuil. `construitPromptJuge` : barèmes + réponses présents, structure attendue. |
| `juge.test.js` | faux `client.messages.create` → parse de la sortie structurée, propagation d'erreur. |
| `validate.test.js` | `valideDebrief` : bornes, id inconnu, réponse non-string / trop longue, nb excédentaire, réponse vide tolérée. |
| `chat.test.js` (ou `debrief.test.js`) | route `/api/debrief` avec faux `noterFn` injecté : 200 + forme `{ total, max, rang, details }` ; 400 entrée invalide ; 503 sans client ; 502 si juge échoue. |
| `vuePublique` (test sécurité) | la vue publique contient `debrief.questions[].question` mais **aucun** `bareme` ni `rangs`. |
| `render.test.js` | `rendreDebrief` : sortie déterministe, contient rang + notes. |

## Sécurité / RGPD

- Barème, rangs et réponses idéales restent serveur ; jamais dans `vuePublique`
  (test dédié). Le front reste non fiable.
- Les réponses du joueur transitent vers Claude (LLM-judge) : **fiction**, pas de PII
  attendue ; longueur bornée au boundary ; encadrées comme données à noter (pas
  d'instruction exécutée → robuste à l'injection de prompt). Pas de log de contenu joueur.

## Hors périmètre (YAGNI)

- Pas de persistance des scores / classement.
- Pas de plafonnement par flags (décision : note libre).
- Pas de second modèle dédié au juge (réutilisation de `MODEL`).
- Pas de barème configurable par question au-delà des paliers 1/3/5.

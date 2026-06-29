# Backlog

File d'améliorations pour le projet. Conçu pour que des agents (ou toi) enchaînent
les tâches une à une.

**Mode d'emploi**
- Chaque tâche est autonome et porte un identifiant (`T-xx`), une priorité et un
  critère d'acceptation vérifiable.
- Pour traiter une tâche : suivre le **Flow de contribution** de [CLAUDE.md](CLAUDE.md)
  (branche → TDD → tests/couverture → `/code-review` → `/simplify` → `/security-review`
  → PR).
- En commençant, déplacer la tâche dans **En cours** ; une fois la PR ouverte, la
  déplacer dans **Fait** avec le lien de la PR.
- Priorités : 🔴 haute · 🟠 moyenne · 🟢 basse.

---

## À faire

### T-04 · 🟢 Couverture du front `game.js`
Tester l'orchestration DOM avec un environnement `jsdom` (clics plan/sac, envoi,
écran de fin).
**Acceptation** : `public/game.js` entré dans le périmètre de couverture, ≥ 70 %.

### T-05 · 🟢 Streaming des réponses du personnage
Diffuser la réponse du LLM en flux (SSE) pour un affichage progressif.
**Acceptation** : le texte s'affiche au fil de l'eau ; dégradation propre si erreur.

### T-06 · 🟢 Sélection explicite de la preuve à l'accusation
Lors de l'accusation, laisser le joueur désigner la preuve décisive (pas seulement
le verdict).
**Acceptation** : l'écran d'accusation propose les indices découverts ; vérif serveur inchangée.

### T-07 · 🟢 Enrichir le contenu / scénarios multiples
Étoffer `data/scenario.js` (plus de zones, d'objets, de connaissances) ou permettre
de charger plusieurs scénarios.
**Acceptation** : au moins un 2ᵉ scénario jouable, sélectionnable.

---

## En cours

_(rien pour l'instant)_

---

## Fait

- **T-03 · Conditionner le déblocage du tableau au dialogue** — examiner le tableau
  ne révèle plus le code « à froid ». Un déclencheur ne pose son flag que si ses
  `preconditions` de flags sont réunies (`server/etat.js`, point fixe ensembliste, le
  sac reste order-strict) ; `examiner:tableau` exige `chocolats_donnes` (l'indice
  soufflé par Victor). `/examiner` dérive les flags du journal et ne sert la révélation
  (code + fiole) que si `code_coffre_lu` est gagné ; sinon un `apercu` non-spoiler.
  Anti-triche renforcé : examen à froid → ni flag, ni preuve à l'accusation. 80 tests,
  couverture ≥ seuils.
  ([PR #14](https://github.com/gaspareu/enquete-ascii/pull/14))
- **T-01 · Dériver l'état de jeu côté serveur (anti-triche)** — le client n'envoie
  plus ses flags mais son *journal de gestes* ; le serveur le rejoue (`server/etat.js`
  → `deriverFlags()`) et dérive les flags en imposant les préconditions (« donner »
  exige l'objet ramassé). `vuePublique` ne publie plus `declencheurs` (secret serveur).
  Un flag forgé sur `/accuser` est ignoré ; un journal incomplet ne débloque pas la
  connaissance sur `/chat`. 74 tests, couverture ≥ seuils.
  ([PR #13](https://github.com/gaspareu/enquete-ascii/pull/13))
- **T-02 · Tests d'intégration des routes Express** — `/scenario`, `/examiner`,
  `/chat`, `/accuser` couverts via `supertest` (client/`repondreFn` injectés, sans
  réseau) : gardes 400/503/502 et filtrage des flags forgés sur `/accuser`.
  `server/chat.js` passe à 100 %. 55 tests.
  ([PR #10](https://github.com/gaspareu/enquete-ascii/pull/10))
- **Dépendances à jour (Dependabot)** — montée de `vitest` + `@vitest/coverage-v8`
  3 → 4 (combinées), `@anthropic-ai/sdk` 0.70 → 0.106, et actions CI `checkout`/`setup-node`.
  Config de couverture adaptée à vitest 4 (`all: true` ; cf. note dans `vitest.config.js`
  sur les fichiers 100 % masqués du rapport).
  ([PR #11](https://github.com/gaspareu/enquete-ascii/pull/11))
- **Polish terminal + Design System** — ambiance CRT subtile (scanlines, lueur
  phosphore, vignette, curseur), effet machine à écrire interruptible + indicateur
  « …réfléchit », visages ASCII par personnage (donnée publique), et mise en place
  des design tokens (`public/tokens.css`) + `DESIGN-SYSTEM.md` pour itérer via
  Claude Design. 45 tests. ([PR #3](https://github.com/gaspareu/enquete-ascii/pull/3))
- **Mise en place du projet** — squelette, jeu jouable, 37 tests, CI, CLAUDE.md, backlog.

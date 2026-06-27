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

### T-01 · 🟠 Dériver l'état de jeu côté serveur (anti-triche)
Aujourd'hui le client tient les `flags`/`sac` et les envoie ; un joueur peut les
forger. Faire calculer/valider la progression côté serveur à partir des gestes.
**Acceptation** : un flag non gagné légitimement ne peut pas être obtenu en
falsifiant la requête ; tests couvrant le rejet.

### T-02 · 🔴 Tests d'intégration des routes Express
`server/chat.js` (routes `/scenario`, `/examiner`, `/chat`, `/accuser`) n'est
couvert qu'à ~38 %. Ajouter des tests d'intégration (p. ex. `supertest`), client
Claude mocké pour `/chat`.
**Acceptation** : couverture de `server/chat.js` ≥ 80 % ; suite verte.

### T-03 · 🟠 Conditionner le déblocage du tableau au dialogue
Examiner le tableau révèle le code même sans avoir parlé au personnage. Lier la
révélation à l'indice donné dans le dialogue (le perso doit avoir indiqué où chercher).
**Acceptation** : examiner le tableau avant l'indice ne pose pas `code_coffre_lu`.

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

- **Mise en place du projet** — squelette, jeu jouable, 37 tests, CI, CLAUDE.md, backlog.

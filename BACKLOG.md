# Backlog

File d'améliorations pour le projet. Conçu pour que des agents (ou toi) enchaînent
les tâches une à une.

**Mode d'emploi**
- Chaque tâche est autonome et porte un identifiant (`T-xx`), une priorité et un
  critère d'acceptation vérifiable.
- Pour traiter une tâche : suivre le **Flow de contribution** de [CLAUDE.md](CLAUDE.md)
  (branche → TDD → tests/couverture → `/code-review` → `/simplify` → `/security-review`
  → PR).
- En commençant, déplacer la tâche dans **En cours**. Une fois livrée (PR mergée),
  la **retirer du backlog** : on garde « Fait » purgé — l'historique vit dans git
  et les PR fermées.
- Priorités : 🔴 haute · 🟠 moyenne · 🟢 basse.

---

## À faire

### T-07 · 🟢 Intégrer ElevenLab pour activer le mode vocal

### T-08 · 🟢 Améliorer le design des pièces et plus se rapprocher de pixel art plutot que d'ASCII
---

## En cours

### T-06 · 🟢 Débrief noté à l'accusation
Remplacer l'accusation binaire par un débrief de 4 questions ouvertes (qui / comment /
mobile / surprise) notées 0-5 par un LLM-judge selon la précision de la réponse ; score
sur 20 + rang d'enquêteur.
**Acceptation** : `POST /api/debrief` valide les réponses, appelle le juge (barème secret),
agrège en `{ total, max, rang, details }` ; le front affiche formulaire puis écran de
score ; le barème ne quitte jamais le serveur.

---

## Fait

_(historique purgé — voir l'historique git / les PR fermées)_

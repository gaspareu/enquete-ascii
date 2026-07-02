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

### T-08 · 🟢 Améliorer le design des pièces et plus se rapprocher de pixel art plutot que d'ASCII
---

## En cours

### T-07 · 🟢 Intégrer ElevenLabs pour activer le mode vocal

Voix du personnage (ElevenLabs TTS, opt-in + lecture auto) + entrée micro joueur
(Web Speech API navigateur). Conception : [docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md](docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md).

---

## Fait

_(historique purgé — voir l'historique git / les PR fermées)_

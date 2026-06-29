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

### T-05 · 🟢 Streaming des réponses du personnage
Diffuser la réponse du LLM en flux (SSE) pour un affichage progressif.
**Acceptation** : le texte s'affiche au fil de l'eau ; dégradation propre si erreur.

### T-06 · 🟢 Sélection explicite de la preuve à l'accusation
Lors de l'accusation, laisser le joueur désigner la preuve décisive (pas seulement
le verdict).
**Acceptation** : l'écran d'accusation propose les indices découverts ; vérif serveur inchangée.
J'aimerai ajouter un système de point. Le joueur ne doit pas simplement repondre sur le verdict, il doit répondre à une série de questions (3 à 5). En fonction de la précision de la réponse, il gagne des points. Exemple sans lien avec le scénario actuel: "Pourquoi il l'a tué ?", s'il dit que c'est pour le vol du tableau, c'est 1 point. S'il trouve que le tueur a accumulé des dettes et que la victime voulait le dénoncer à sa femme, et donc le tuer puis volé le tableau résolvait tout, c'est 5 points. 

### T-07 · 🟢 Enrichir le contenu / scénarios multiples
Étoffer `data/scenario.js` (plus de zones, d'objets, de connaissances). On brainstorm ensemble. Pour le scénario 1, je pensais développer quelque chose sur les feminicides. Un mari, successful qui se révèle être au fur et mesure des échanges et des découvertes jaloux de la réussite de sa femme et la suspecte de le tromper. Et on peut découvrir qu'elle était en train de préparer une surprise pour lui. 

---

## En cours

_(rien pour l'instant)_

---

## Fait

_(historique purgé — voir l'historique git / les PR fermées)_

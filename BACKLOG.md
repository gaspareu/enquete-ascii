# Backlog

Ce fichier décrit uniquement le travail produit encore ouvert. Les décisions
livrées sont conservées dans `docs/superpowers/`, git et les pull requests, afin
que ce backlog reste lisible.

## Cible

Finaliser une enquête web courte et immersive, où l'exploration, le dialogue et
le débrief récompensent une vraie déduction. L'expérience doit rester fluide au
clavier et lisible, tout en faisant progressivement évoluer l'esthétique terminal
vers un pixel art rétro assumé.

## À faire

### T-08 · 🟢 Décors pixel art pour la pièce

Faire évoluer les pièces et les zones fouillables vers des décors pixel art, sans
régression fonctionnelle ni perte de l'identité rétro du jeu.

Critères d'acceptation :

- le plan et la scène restent immédiatement lisibles sur ordinateur et mobile ;
- les interactions existantes (zones, inventaire, dialogue, modale) sont intactes ;
- les nouveaux styles respectent `public/tokens.css`,
  `public/DESIGN-SYSTEM.md` et `prefers-reduced-motion` ;
- les tests et le rapport de couverture restent verts.

## En cours

### T-07 · 🟢 Mode vocal

La synthèse ElevenLabs et la saisie micro sont implémentées sur la branche active.
La tâche reste ici jusqu'à sa revue, sa fusion et son retrait conformément au
processus de contribution. Référence :
[spec](docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md).

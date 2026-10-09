# Backlog

Ce fichier décrit uniquement le travail produit encore ouvert. Les décisions
livrées sont conservées dans `docs/superpowers/`, git et les pull requests, afin
que ce backlog reste lisible.

## Cible

Finaliser une enquête web courte et immersive, où l'exploration, le dialogue et
le débrief récompensent une vraie déduction. L'expérience doit rester fluide au
clavier et lisible, tout en faisant progressivement évoluer l'esthétique terminal
vers un pixel art rétro assumé.

## En cours

### T-13 · Agents par scène — V1 à livrer

Le chat utilise `/tour`, un contexte local et une mémoire signée par scène.
Sonnet 5.5 pour le personnage, Haiku 4.5 configurable pour les zones en attendant
Haiku 5.5. Hooks privés adressés et contrôles dans l’atelier. Le moteur des
capacités et des reçus reste l’autorité. Référence :
[plan](docs/plan-agents-par-scene.md).

La PR conserve cette tâche ouverte jusqu’à sa fusion. La validation comparative
coût/latence reste à faire ; les
vraies pièces, personnages multiples et simulation dédiée des hooks dans
l’atelier restent des extensions ultérieures. Tester les hooks dans l’aperçu
de partie actuel. Retirer cette tâche uniquement après fusion.

### T-11 · Observations d'objets immersives

Une question portant sur un objet trouvé doit ouvrir son examen et donner une
description propre à cet objet. Chaque objet possède des détails d'ambiance sans
effet sur les indices. Les réponses à une date ou une cause inconnue doivent
rester prudentes ; les révélations restent sous le contrôle du serveur.

Critères d'acceptation :

- les précisions courtes (« du téléphone », « oui ») reprennent la question initiale ;
- les messages du joueur apparaissent dès l’envoi et les changements de zone sont annoncés ;
- les questions sur la distinction et la plante ne retombent plus sur la table ;
- tous les objets trouvés ont des détails d'ambiance, sans révélation à la fouille ;
- l'examen répété peut varier le détail tout en conservant les faits établis ;
- tests, couverture, accessibilité et parcours mobile restent verts.

### T-07 · 🟢 Mode vocal

La synthèse ElevenLabs et la saisie micro sont implémentées sur la branche active.
La tâche reste ici jusqu'à sa revue, sa fusion et son retrait conformément au
processus de contribution. Référence :
[spec](docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md).

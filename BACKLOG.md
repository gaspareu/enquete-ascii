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

### T-10 · Agent d'interprétation des actions libres

Permettre au joueur de décrire naturellement une observation, une action ou une
demande à Laurent, sans apprendre de mots-clés. Un agent distinct de Laurent
renvoie une décision structurée et le serveur conserve l'autorité exclusive sur
les actions, la progression et les révélations.

Critères d'acceptation :

- aucune intention visible n'est déterminée par regex ou dictionnaire de verbes ;
- l'interprète ne reçoit que des zones publiques et des objets déjà rencontrés ;
- chaque décision est validée, puis une action reste contrôlée par les capacités
  et les reçus HMAC côté serveur ;
- les ambiguïtés deviennent des précisions locales, sans fuite ni appel à Laurent ;
- les tests, la couverture, le rendu mobile et l'accessibilité restent verts.

### T-07 · 🟢 Mode vocal

La synthèse ElevenLabs et la saisie micro sont implémentées sur la branche active.
La tâche reste ici jusqu'à sa revue, sa fusion et son retrait conformément au
processus de contribution. Référence :
[spec](docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md).

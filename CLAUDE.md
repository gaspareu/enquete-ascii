# Enquête ASCII — guide projet

Jeu d'enquête web rétro en huis clos. Une pièce en plan 3 × 3 place Laurent au
centre et huit zones à fouiller autour de lui. Le joueur rassemble des indices,
fait évoluer ce que le personnage accepte de révéler, puis répond à un débrief
noté. Le dialogue et le juge utilisent `@anthropic-ai/sdk` (Sonnet 4.6 par défaut).

Stack : Node + Express côté serveur, JavaScript ESM vanilla sans build côté front,
Vitest pour les tests. Le mode vocal optionnel combine ElevenLabs (TTS, serveur)
et Web Speech API (micro, navigateur).

## Commandes

| Commande | Usage |
|---|---|
| `npm install` | Installer les dépendances |
| `npm start` | Lancer le serveur sur `http://localhost:3000` |
| `npm test` | Lancer la suite Vitest |
| `npm run coverage` | Tests et rapport de couverture avec seuils |
| `npm run test:watch` | Tests en mode watch |

Copier `.env.example` vers `.env`, puis renseigner `ANTHROPIC_API_KEY` (et, si
souhaité, la configuration ElevenLabs). Les secrets restent uniquement côté serveur.

## Architecture

```
server/
  index.js         bootstrap Express, environnement, clients Claude/ElevenLabs
  chat.js          routes : scenario, examiner, chat SSE, debrief, voix
  prompt.js        prompt système avec connaissances légitimement débloquées
  etat.js          dérivation serveur des flags à partir du journal de gestes
  validate.js      validation de toutes les entrées HTTP
  claude.js        client Claude et réponse en flux
  juge.js          appel du modèle pour noter le débrief
  scoring.js       agrégation du score et du rang
  voix.js          proxy minimal ElevenLabs TTS
data/scenario.js   scénario complet, secrets, déclencheurs, débrief et barème
public/
  index.html       panneaux de jeu, dialogue, modale et boutons voix/micro
  tokens.css       source de vérité des tokens visuels
  style.css        thème terminal/CRT qui consomme les tokens
  state.js         état front immuable et journal de gestes
  render.js        rendu ASCII pur
  game.js          orchestration DOM, API, SSE et écran de débrief
  sse.js           lecture du flux Server-Sent Events
  voix.js          état et lecture du mode vocal
  micro.js         wrapper Web Speech API
test/              tests unitaires et de routes
```

### Flux et sécurité

`game.js` envoie `{ message, gestes, historique, note }` à `/api/chat`.
`validate.js` valide la requête, puis `etat.js` rejoue le journal pour en dériver
les flags. `prompt.js` ne transmet à Claude que les connaissances dont les flags
sont débloqués. La réponse revient en SSE et est rendue progressivement.

Le backend est sans état : le navigateur ne transmet jamais de flags. Pour poser
un flag, le serveur exige un journal cohérent : « donner » suppose que l'objet a
été ramassé ; les préconditions de scénario sont résolues à point fixe. Une
révélation, la solution et le barème ne quittent pas le serveur avant le moment
autorisé.

Après l'enquête, `/api/debrief` valide les réponses et demande au juge de les
noter, avant que `scoring.js` calcule le total et le rang. Le bouton voix ne
transmet que la réplique déjà visible à `/api/voix`; le micro alimente simplement
le champ de texte local.

## Conventions

- JavaScript ESM, Node 18+ et aucune étape de build.
- Immutabilité : pas de mutation en place, notamment dans `public/state.js`.
- Un fichier, une responsabilité ; garder les fichiers sous 400 lignes.
- Toute valeur visuelle de `style.css` passe par un token de `tokens.css` ; les
  animations sont neutralisées sous `prefers-reduced-motion`.
- UI, commentaires et messages de commit en français.
- TDD : test rouge, implémentation minimale, refactor ; couverture minimale 80 %
  (75 % pour les branches).
- Le front est non fiable : valider chaque entrée `/api/*` et ne jamais lui confier
  une décision de jeu ni un secret.

## Flow de contribution

1. Choisir une tâche dans [BACKLOG.md](BACKLOG.md).
2. Partir d'un `main` à jour sur une branche `feat/...` ou `fix/...`.
3. Écrire le test avant le code, puis vérifier `npm test` et `npm run coverage`.
4. Relire le diff (qualité et sécurité), créer une PR, puis retirer la tâche du
   backlog après sa fusion.
5. Mettre ce guide à jour quand l'architecture change.

## Voir aussi

- [README.md](README.md) — cible produit, état et démarrage.
- [BACKLOG.md](BACKLOG.md) — travail ouvert.
- [data/scenario.js](data/scenario.js) — contenu de l'enquête.

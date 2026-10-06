# Enquête ASCII — guide projet

Jeu d'enquête web rétro en huis clos. Une pièce en plan 3×3 : au centre un
interlocuteur (joué par Codex), autour des zones à fouiller. Le joueur confond
le meurtrier via les indices et le dialogue. Originalité : la connaissance du
personnage évolue selon les actions du joueur (système de *flags*).

Stack : Node + Express (serveur), JavaScript ESM vanilla (front, sans build),
Vitest (tests). Dialogue via `@anthropic-ai/sdk` (modèle Sonnet 5.5 par défaut).

## Commandes

| Commande | Usage |
|---|---|
| `npm install` | Installer les dépendances |
| `npm start` | Lancer le serveur → http://localhost:3000 (nécessite `.env`) |
| `npm test` | Lancer la suite Vitest |
| `npm run coverage` | Tests + rapport de couverture (seuils appliqués) |
| `npm run test:watch` | Tests en mode watch |

Config : `cp .env.example .env` puis renseigner `ANTHROPIC_API_KEY` (+ `MODEL`,
`PORT`). La clé reste **côté serveur**, jamais envoyée au navigateur.

## Architecture (codemap)

```
server/            # Backend Node/Express (détient le scénario complet)
  index.js         #   bootstrap : .env, static public/, monte /api, client Claude
  chat.js          #   routeur : GET /scenario, POST /tour et routes de compatibilité
                   #   + vuePublique() : strippe les secrets avant envoi au front
  prompt.js        #   construitPrompt() : système = perso + connaissances DÉBLOQUÉES
  etat.js          #   deriverEtat()/deriverFlagsVisibles() : rejoue les reçus → flags, en imposant sac + préconditions (autorité)
  validate.js      #   valideRequeteChat()/valideRequeteInterprete() : validation au boundary HTTP
  juge.js          #   évaluation du débrief avec les critères privés
  claude.js        #   wrapper SDK Anthropic (client injecté → testable)
data/
  scenario.js      # LE contenu de l'enquête (données) + ciblesConnues()
public/            # Front statique ASCII (servi tel quel)
  index.html       #   structure en panneaux (lie tokens.css puis style.css)
  tokens.css       #   design tokens (source de vérité du DS) — voir DESIGN-SYSTEM.md
  DESIGN-SYSTEM.md #   doc du Design System « terminal/CRT » (ingéré par Codex Design)
  style.css        #   thème terminal (grille CSS) — consomme uniquement les tokens
  state.js         #   état immutable : sac, historique, reçus signés (pur, sans DOM)
  render.js        #   rendu ASCII pur : artInterlocuteur(), rendreDialogue(), dialoguePartiel()
  game.js          #   orchestration DOM : événements, fetch, frappe, écran de fin
  journal-scroll.js #  suivi du journal, relecture et retour à la nouvelle réponse
  saisie-chat.js    #   clavier multiligne, Entrée/Maj+Entrée et composition
test/              # Tests Vitest (un fichier par module de logique)
```

**Flux d’un tour** : `game.js` affiche le joueur puis envoie
`{message, contexte, recus, memoireConversation}` à `/tour`. `tour.js` valide
les entrées et authentifie les reçus et la mémoire. `orchestrateur.js` fournit
une projection locale à l’agent de scène, arbitre sa décision via les capacités,
puis diffuse les résultats signés en SSE. Le dialogue reçoit le seul canal du
personnage et ses connaissances débloquées. Les anciennes routes restent
compatibles. Le serveur conserve sa clé en mémoire ; chaque requête porte la
chaîne de reçus et le jeton authentifié, sans flags fournis par le navigateur.

**Mécanique des flags (anti-triche)** : le client conserve des *reçus signés*
(fouiller / examiner / ramasser / donner / dialogue). Le serveur vérifie leur
chaîne, rejoue les événements (`server/etat.js`) puis mappe geste→flag via
`data/scenario.js` → `declencheurs` (**secret serveur**, hors vue
publique). Avant de poser un flag, il impose deux familles de préconditions :
- **sac** (order-strict) : « donner » exige l'objet préalablement « ramassé » dans le
  journal ;
- **flags** (ensembliste, `scenario.preconditions`) : un déclencheur ne pose son flag que
  si d'autres flags sont déjà acquis — ex. `examiner:plaquette_somniferes` exige `double_tasse`
  (la 2e tasse), ou `examiner:mot_manuscrit` exige `fete_decouverte`.
  Résolu à point fixe : l'ordre dans le journal (idempotent) n'importe pas.

Une connaissance (`connaissances[].requiert`) n'entre dans le prompt que si ses flags
sont débloqués ; de même, `/examiner` ne sert la *description-révélation* d'une cible que
si son flag d'examen est légitimement dérivé, sinon un `apercu` non-spoiler. Comme le
client n’envoie que des reçus authentifiés (jamais de flags), un flag non gagné légitimement ne peut
pas être forgé via la requête.

## Contexte conversationnel de l’interprète

`POST /interpreter` reçoit aussi les douze derniers tours visibles du journal
(rôles et tailles validés), pour rattacher les pronoms et les réponses de précision
aux demandes précédentes. Ce texte n’accorde aucun droit de jeu. Le catalogue
contient la dernière interaction publique issue des reçus vérifiés ; les secrets
et conditions restent exclus. Une observation de portée `piece` décrit les zones
publiques sans sélectionner de zone ni effectuer de fouille.

## Conventions

- **JS ESM**, aucune étape de build. Node 18+.
- **Immutabilité** : jamais de mutation en place (cf. `public/state.js`).
- **Fichiers courts** (< 400 lignes), une responsabilité par fichier.
- **Design System** : tout style passe par un token de `public/tokens.css` (aucune
  valeur brute de couleur, typographie, espacement ou durée dans `style.css` ; seules
  les dimensions structurelles de la grille — `rem`/`vh` — restent inline). Tenir
  `public/DESIGN-SYSTEM.md` à jour — c'est ce que **Codex Design** ingère pour itérer
  sur le front en restant fidèle à l'identité terminal. Animations toujours
  neutralisées sous `@media (prefers-reduced-motion: reduce)`.
- **TDD obligatoire** : test d'abord (RED) → minimal (GREEN) → refactor. Couverture ≥ 80 %.
- **Français** pour l'UI, les commentaires et les messages de commit.
- **Sécurité d'abord** : le coupable, les connaissances secrètes et les descriptions
  de révélation ne quittent jamais le serveur. Toujours valider les entrées de `/api/*`.
  Le front est non fiable : ne jamais lui faire confiance pour une décision de jeu.

## Flow de contribution (à suivre pour CHAQUE tâche)

1. **Choisir** une tâche dans [BACKLOG.md](BACKLOG.md).
2. **Brancher** : `git fetch && git status` (partir d'un `main` à jour) → `git checkout -b feat/...` ou `fix/...`.
3. **TDD** : écrire le test, le voir échouer, implémenter, refactorer.
4. **Vérifier** : `npm test` puis `npm run coverage` (doit rester ≥ seuils).
5. **Qualité** : `/code-review` puis `/simplify` sur le diff.
6. **Sécurité** : `/security-review`.
7. **Livrer** : commit conventionnel (`feat|fix|chore|docs|test|refactor: …`), `git push -u`, puis `gh pr create`.
8. **Tenir à jour** : une fois la tâche livrée (PR mergée), la **retirer de `BACKLOG.md`** — sortie de « À faire », et « Fait » gardé **purgé** (l'historique vit dans git et les PR fermées, on n'accumule pas de journal des tâches finies). Mettre à jour ce fichier si l'architecture change.

> Un hook `Stop` lance les tests à la fin de chaque tour (filet anti-régression).
> Attribution git désactivée globalement (pas de `Co-Authored-By`).

## Voir aussi

- [README.md](README.md) — installation et règles du jeu.
- [BACKLOG.md](BACKLOG.md) — tâches priorisées pour enchaîner les améliorations.
- [data/scenario.js](data/scenario.js) — éditer l'enquête sans toucher au code.

## Chat orchestré par scène (V1)

`game.js` affiche le joueur puis appelle `/tour` (`server/tour.js`).
`orchestrateur.js` sélectionne `agents/scene.js`, valide les actions via
`capacites.js`/`interactions.js`, signe la progression et émet SSE.
`scenes.js` adapte les zones actuelles ; `projection-scene.js` limite les faits
locaux, `hooks-histoire.js` applique les effets auteur adressés,
`memoire-scene.js` authentifie les conversations publiques séparées par scène
et rôle. Sonnet pour le personnage, Haiku configurable pour les zones.
`schema-agents.js` valide les extensions facultatives du scénario.
Les anciennes routes restent des adaptateurs de compatibilité ; aucun historique
brut du navigateur n’entre dans le nouveau dialogue. Les vraies pièces sont différées.

Un événement SSE `progression` fournit atomiquement les nouveaux reçus et
`memoireConversation` lié à leur chaîne. Mettre à jour les deux ensemble côté
front, même si le flux coupe avant le jeton final. Les renommages de l’atelier
mettent à jour les références d’objets et de flags dans les hooks.

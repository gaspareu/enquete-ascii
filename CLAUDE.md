# Enquête ASCII — guide projet

Jeu d'enquête web rétro en huis clos. Une pièce en plan 3×3 : au centre un
interlocuteur (joué par Claude), autour des zones à fouiller. Le joueur confond
le meurtrier via les indices et le dialogue. Originalité : la connaissance du
personnage évolue selon les actions du joueur (système de *flags*).

Stack : Node + Express (serveur), JavaScript ESM vanilla (front, sans build),
Vitest (tests). Dialogue via `@anthropic-ai/sdk` (modèle Sonnet 4.6 par défaut).

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
  chat.js          #   routeur : GET /scenario, POST /examiner /chat /accuser
                   #   + vuePublique() : strippe les secrets avant envoi au front
  prompt.js        #   construitPrompt() : système = perso + connaissances DÉBLOQUÉES
  validate.js      #   valideRequeteChat() : validation au boundary HTTP
  accusation.js    #   evaluerAccusation() : verdict + preuves vs solution (serveur)
  claude.js        #   wrapper SDK Anthropic (client injecté → testable)
data/
  scenario.js      # LE contenu de l'enquête (données) + flagsConnus()
public/            # Front statique ASCII (servi tel quel)
  index.html       #   structure en panneaux (lie tokens.css puis style.css)
  tokens.css       #   design tokens (source de vérité du DS) — voir DESIGN-SYSTEM.md
  DESIGN-SYSTEM.md #   doc du Design System « terminal/CRT » (ingéré par Claude Design)
  style.css        #   thème terminal (grille CSS) — consomme uniquement les tokens
  state.js         #   état immutable : flags, sac, historique (pur, sans DOM)
  render.js        #   rendu ASCII pur : artInterlocuteur(), rendreDialogue(), dialoguePartiel()
  game.js          #   orchestration DOM : événements, fetch, frappe, écran de fin
test/              # Tests Vitest (un fichier par module de logique)
```

**Flux d'un tour de dialogue** : `game.js` envoie `{message, flags, historique, note}`
→ `validate.js` (rejette message trop long / flag inconnu) → `prompt.js` reconstruit
le système avec **seulement** les connaissances dont les flags requis sont présents →
`claude.js` appelle le modèle → réponse rendue. Le backend est **sans état**.

**Mécanique des flags** : examiner / ramasser / donner posent des flags
(`data/scenario.js` → `declencheurs`). Une connaissance (`connaissances[].requiert`)
n'entre dans le prompt que si ses flags sont débloqués → secret impossible à soutirer.

## Conventions

- **JS ESM**, aucune étape de build. Node 18+.
- **Immutabilité** : jamais de mutation en place (cf. `public/state.js`).
- **Fichiers courts** (< 400 lignes), une responsabilité par fichier.
- **Design System** : tout style passe par un token de `public/tokens.css` (aucune
  valeur brute de couleur, typographie, espacement ou durée dans `style.css` ; seules
  les dimensions structurelles de la grille — `rem`/`vh` — restent inline). Tenir
  `public/DESIGN-SYSTEM.md` à jour — c'est ce que **Claude Design** ingère pour itérer
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
8. **Tenir à jour** : cocher la tâche dans `BACKLOG.md` ; mettre à jour ce fichier si l'architecture change.

> Un hook `Stop` lance les tests à la fin de chaque tour (filet anti-régression).
> Attribution git désactivée globalement (pas de `Co-Authored-By`).

## Voir aussi

- [README.md](README.md) — installation et règles du jeu.
- [BACKLOG.md](BACKLOG.md) — tâches priorisées pour enchaîner les améliorations.
- [data/scenario.js](data/scenario.js) — éditer l'enquête sans toucher au code.

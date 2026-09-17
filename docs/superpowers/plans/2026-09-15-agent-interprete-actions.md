# T-10 — Agent d’interprétation des actions libres

## Statut et décision

**Plan uniquement — aucune implémentation dans ce document.**

Le champ de saisie devient l’unique manière de décrire une intention. Le joueur
ne doit plus apprendre des mots-clés comme « fouiller », « examiner » ou
« ramasser », ni devoir revenir manuellement au centre du plan pour parler à
Laurent. Le plan 3 × 3 reste disponible comme raccourci visuel et conserve sa
case active verte, mais il n’est plus une condition pour formuler une action.

La solution retenue est un **agent d’interprétation** distinct de Laurent : il
classe une phrase libre dans une décision structurée et bornée. Il n’invente ni
narration, ni indice, ni condition de progression. Laurent reste le seul agent
qui interprète un personnage et le serveur reste le seul arbitre de l’enquête.

La migration retire le parser par expressions régulières ; il n’y aura pas de
repli par mots-clés. Sans API Anthropic, l’interface affiche donc une erreur
claire d’indisponibilité de l’interprète, au même titre que le dialogue et le
débrief déjà indisponibles dans ce cas.

## Expérience cible

Le joueur peut toujours cliquer sur le plan, mais peut aussi écrire directement :

- « Qu’est-ce qu’il y a sur le bureau ? » → ouvre le secrétaire puis le fouille.
- « Regardons les étagères. » → affiche la bibliothèque, sans signer de reçu.
- « Je prends le grand cru. » → le ramasse si Laurent a réellement fouillé le
  meuble-bar et si l’action est autorisée.
- « Demandez à Laurent pourquoi il ment. » → revient face à Laurent puis lance
  le dialogue habituel.
- « Regardez ça. » → pose une question de précision, sans appeler Laurent et
  sans révéler d’information.

Une phrase déclenche au plus **une** observation, interaction, demande à Laurent
ou clarification. L’agent ne planifie jamais une suite d’actions, ne fouille pas
et n’examine pas automatiquement en cascade.

Le placeholder devient universel, par exemple : « Décrivez ce que vous observez,
faites ou demandez… ». Pendant l’interprétation, un état d’attente accessible
est affiché. Seul un dialogue ensuite classé pour Laurent affiche l’attente
actuelle « Laurent réfléchit… » et son flux SSE.

## Contrat de décision

Créer un unique outil Claude `resoudre_intention`, forcé par `tool_choice`, avec
un schéma fermé (`additionalProperties: false`). L’agent retourne une des quatre
décisions suivantes :

```json
{
  "type": "observer | interagir | dialoguer | clarifier",
  "contexte": { "type": "zone | personnage", "id": "…" },
  "action": "fouiller | examiner | ramasser | donner",
  "cibleId": "…",
  "choix": [{ "type": "zone | objet | personnage", "id": "…" }]
}
```

Champs attendus :

- `observer` : un contexte de destination public, sans `action` ni reçu ;
- `interagir` : un contexte de destination, une action et une cible canonique ;
- `dialoguer` : uniquement le contexte `{ type: "personnage", id: "laurent" }` ;
- `clarifier` : zéro à deux `choix` publics. Le serveur construit la question à
  partir de leurs libellés ; le modèle ne fournit jamais de texte libre visible.

Le serveur valide intégralement ce résultat avant de le rendre au navigateur. Une
sortie sans appel d’outil, malformée, hors catalogue ou incohérente devient une
clarification générique. La validation de `/api/interagir` et
`evaluerCapacite()` est conservée et s’exécute après la décision : l’agent ne
peut pas autoriser une action ni signer un reçu.

## Cloisonnement des données

L’interprète reçoit seulement :

- le message courant ;
- le contexte courant validé ;
- les zones publiques (id, nom, alias et description d’ambiance) ;
- le sac et les objets que le joueur a déjà rencontrés, dérivés **côté serveur**
  depuis les reçus HMAC vérifiés.

Il ne reçoit jamais `objetsCaches`, descriptions et aperçus d’objets non lus,
conditions, déclencheurs, flags, connaissances, solution, barème, historique de
Laurent ou reçus bruts. Il n’a aucun outil externe.

Une fouille ajoute tous les objets de sa zone à l’ensemble serveur des
`objetsConnus`, mais ne les examine pas. Un examen, ramassage ou don ajoute aussi
sa cible si elle est déjà autorisée. La projection publique de cet ensemble ne
contient que `{ id, nom, aliases, ramassable }`. Elle permet d’afficher le sac et
d’interpréter « le grand cru » après sa découverte, sans exposer dès le chargement
les noms de tous les objets cachés.

`GET /api/scenario` cesse donc d’envoyer `objets`. Les réponses réussies de
`/api/interagir` renvoient à la place `etatPublic: { sac, objetsConnus }`, issu
des reçus vérifiés. Le navigateur n’est jamais une source d’autorité : il ne fait
qu’afficher cette projection.

## Architecture proposée

```text
champ unique
  -> POST /api/interpreter { message, contexte, recus }
  -> validation + vérification des reçus
  -> projection publique minimale + agent d’interprétation
  -> décision validée
  -> navigateur
       observer    : ouvre la scène sans reçu
       interagir   : place le contexte demandé puis POST /api/interagir
       dialoguer   : place Laurent puis POST /api/chat (SSE existant)
       clarifier   : journalise une demande de précision locale
```

Le second appel pour une interaction ou un dialogue est volontaire : il garde
`/api/interagir` et `/api/chat` comme boundaries indépendants, déjà protégés et
testés. Une requête forgée directement vers ces routes reste donc inoffensive.

Créer `server/interprete.js` pour :

1. construire le catalogue public dérivé des reçus ;
2. construire le prompt fixe de l’interprète ;
3. appeler `client.messages.create()` sans streaming, avec 128 tokens maximum,
   l’outil forcé `resoudre_intention` et le modèle `INTERPRETER_MODEL ?? MODEL` ;
4. extraire et valider la décision, sans exposer de raisonnement ni de texte du
   modèle.

Le modèle d’interprétation est configurable séparément dans `.env.example`. Par
défaut, il réutilise `MODEL`; une installation pourra fournir un modèle plus
rapide ou moins coûteux sans modifier l’autorité applicative.

## Étapes TDD

1. **Écrire les tests de contrat avant le code.** Créer
   `test/interprete.test.js` avec un faux client Anthropic. Couvrir le schéma
   forcé, les quatre décisions, l’absence de texte libre, le rejet d’un id hors
   catalogue et l’absence de tout secret dans le prompt. Ajouter aux tests de
   routes les réponses 400 (requête ou reçus invalides), 503 (agent absent), 502
   (appel invalide/indisponible) et une réponse de clarification sûre.

2. **Créer la projection des objets connus.** Dans `server/etat.js`, ajouter une
   fonction pure dédiée qui parcourt les événements vérifiés et produit les
   objets connus. Ajouter la projection publique associée. Tester une partie
   vide, une fouille, un ramassage, un don et le fait qu’aucune description,
   précondition ou cible jamais rencontrée n’apparaît.

3. **Ajouter l’agent et sa route.** Créer `server/interprete.js`, compléter
   `server/validate.js` pour la requête d’interprétation, puis monter
   `POST /api/interpreter` dans `server/chat.js`. Injecter la fonction
   d’interprétation dans `creerRouteur()` comme les dépendances IA existantes,
   afin que les tests restent sans réseau. Garder l’appel Anthropic strictement
   non streamé et borné.

4. **Réduire la vue initiale et enrichir l’état public.** Retirer `objets` de
   `vuePublique()`. Faire produire `etatPublic: { sac, objetsConnus }` par
   `server/interactions.js` depuis l’état après signature. Mettre à jour
   `public/state.js` de manière immutable afin qu’il conserve les noms publics
   reçus et que `rendreSac()` ne dépende plus de `vue.objets`.

5. **Remplacer le routage du navigateur.** Dans `public/game.js`, remplacer
   `traiterEntreeChat()` par l’appel à `/api/interpreter`, appliquer d’abord le
   contexte rendu par la décision (ce qui synchronise aussi la case verte), puis
   déléguer aux fonctions existantes d’interaction ou de dialogue. Ajouter une
   attente dédiée et une narration locale pour `observer` et `clarifier` ; ne
   jamais transmettre ces tours au canal Laurent. Les pistes d’interrogatoire
   continuent seulement à préremplir le champ.

6. **Supprimer le mécanisme devenu obsolète.** Supprimer
   `public/intention.js` et `test/intention.test.js`; retirer leur import,
   `intentionDepuisTexte()` et les tests de regex du navigateur. Supprimer le
   message « Vous êtes loin de Laurent. Fouillez cette zone… », puisque l’agent
   choisit une observation, un dialogue ou une clarification. Conserver
   `/api/interagir`, `server/capacites.js`, les reçus et les tests de refus : ils
   ne sont pas du parsing par mots-clés et restent indispensables.

7. **Mettre à jour l’interface et la documentation.** Modifier
   `public/index.html`, `public/game.js`, `public/DESIGN-SYSTEM.md` et
   `README.md` pour décrire le champ libre, l’attente et l’indisponibilité de
   l’interprète. Ajouter `INTERPRETER_MODEL=` à `.env.example`. Dans
   `BACKLOG.md`, créer T-10 pendant le travail, puis retirer T-08 et T-09 déjà
   livrées et T-10 après sa fusion ; actualiser le README qui présente encore
   T-08 comme chantier restant.

## Fichiers attendus

| Action | Fichiers |
| --- | --- |
| Créer | `server/interprete.js`, `test/interprete.test.js` |
| Modifier | `server/chat.js`, `server/validate.js`, `server/etat.js`, `server/interactions.js`, `public/game.js`, `public/state.js`, `public/index.html`, `README.md`, `.env.example`, `BACKLOG.md`, `public/DESIGN-SYSTEM.md` |
| Mettre à jour les tests | `test/routes.test.js`, `test/public-view.test.js`, `test/etat.test.js`, `test/state.test.js`, `test/game.test.js`, `test/validate.test.js`, `test/interactions.test.js` |
| Supprimer | `public/intention.js`, `test/intention.test.js` |

## Critères d’acceptation

- Aucune formulation visible n’est traitée par un dictionnaire de verbes ou des
  regex ; le joueur peut décrire librement une action, un déplacement ou une
  demande à Laurent.
- Une action nommée pour une autre zone déplace d’abord la vue sur cette zone et
  ne réussit que si `/api/interagir` l’autorise.
- Une ambiguïté produit une clarification courte et locale, sans erreur « loin de
  Laurent », sans appel à Laurent et sans révélation.
- Laurent, les pistes, le SSE, la voix, le débrief et la mise en évidence de la
  case active restent fonctionnels.
- L’interprète et le navigateur ne reçoivent aucun objet non rencontré, aucune
  description verrouillée ni règle secrète. Les requêtes forgées, décisions IA
  invalides et reçus altérés sont refusés sans détail indiscret.
- Les tests ciblés, `npm test`, `npm run coverage` (seuils maintenus),
  `git diff --check` et une vérification navigateur couvrent les parcours :
  fouille libre, déplacement libre, inventaire, dialogue, clarification,
  indisponibilité de l’agent et non-régression mobile/accessibilité.

## Hors périmètre

- Pas d’agent autonome, de planification multi-étapes ou d’exécution automatique
  de plusieurs gestes.
- Pas de vision des images pixel art, de reconnaissance vocale supplémentaire ni
  de changement de scénario.
- Pas de modification des règles de capacité, de la signature HMAC, de la
  progression ou de la logique de débrief, hors projections publiques nécessaires.

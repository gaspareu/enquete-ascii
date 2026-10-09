# Chat contextuel et capacités conditionnées — Plan d'implémentation

**Objectif :** Cloisonner la saisie conversationnelle par contexte observé, rendre
les actions conditionnelles à une progression secrète et autoritative, conserver
l'historique global et empêcher toute fuite de règles verrouillées vers Claude.

**Architecture :** Le navigateur produit des intentions, mais `server/capacites.js`
est l'unique arbitre. Chaque interaction acceptée produit un reçu HMAC chaîné que le
client conserve ; le serveur vérifie ces reçus et dérive sac + flags sans état
partagé. Le prompt ne reçoit que les connaissances débloquées et les tours du canal
Laurent.

**Stack :** JavaScript ESM, Node `node:crypto`, Express 5, SSE, Vitest, supertest et
jsdom. Aucune nouvelle dépendance npm n'est nécessaire.

**Spécification :**
[`docs/superpowers/specs/2026-09-08-chat-contextuel-capacites-progression-design.md`](../specs/2026-09-08-chat-contextuel-capacites-progression-design.md)

**Conventions :** TDD strict pour chaque tâche, état front immutable, fichiers de
moins de 400 lignes, messages français, secrets et décisions de jeu côté serveur.
Le stylo et l'encre restent des fixtures de test et ne sont pas ajoutés au scénario.

---

## Structure de fichiers cible

**Nouveaux modules**

- `server/progression.js` — signer et vérifier les reçus chaînés.
- `server/capacites.js` — évaluer une intention contre contexte, sac et flags.
- `server/interactions.js` — exécuter une intention autorisée et construire sa
  réponse publique.
- `public/intention.js` — reconnaître une intention depuis le texte et les alias
  publics, sans prendre de décision de jeu.
- `test/progression.test.js` — intégrité des reçus.
- `test/capacites.test.js` — matrice spatiale et conditions `requiertTous`.
- `test/intention.test.js` — reconnaissance linguistique pure.

**Modules modifiés**

- `data/scenario.js` — contrat optionnel `conditionsActions` et événements de
  connaissances ; aucun contenu « stylo » réel.
- `server/etat.js` — dérivation complète du sac et des flags depuis les événements
  vérifiés.
- `server/validate.js` — contexte, intention et liste de reçus.
- `server/prompt.js` — projection IA minimale et événements exprimables.
- `server/claude.js` — collecte structurée des événements de dialogue pendant le
  flux.
- `server/chat.js` — route `/interagir`, contrôle contextuel de `/chat`, trames SSE
  `progression`, retrait de `note`.
- `server/index.js` — création et injection de la clé HMAC éphémère.
- `public/state.js` — contexte courant, reçus et historique canalisé.
- `public/game.js` — capture, routage et rendu des intentions/refus.
- `public/sse.js` — prise en charge de la trame `progression` si nécessaire.
- `public/index.html` — placeholder contextuel, sans nouveau composant.
- `test/etat.test.js`, `test/validate.test.js`, `test/prompt.test.js`,
  `test/claude.test.js`, `test/routes.test.js`, `test/state.test.js`,
  `test/game.test.js`, `test/sse.test.js`, `test/public-view.test.js` — contrats et
  régressions.
- `README.md` — règles du chat et architecture autoritative.
- `BACKLOG.md` — ajouter T-09 au démarrage de l'implémentation ; la retirer après
  fusion conformément au workflow du projet.

---

## Task 0 — Préparer la contribution sans toucher au travail existant

**Fichiers :**

- Modifier au début de l'implémentation : `BACKLOG.md`

- [ ] Vérifier `git status --short --branch` et classer les fichiers non suivis.
- [ ] Faire `git fetch`, puis partir d'un `main` à jour dans une branche dédiée,
  par exemple `feat/chat-contextuel-progression`.
- [ ] Préserver strictement `.codex/`, `AGENTS.md` et toute autre modification sans
  rapport avec T-09.
- [ ] Ajouter T-09 à « À faire » avec les critères d'acceptation de la spec.
- [ ] Exécuter `npm test` et `npm run coverage` pour fixer la baseline.

Résultat attendu : branche isolée, baseline verte, aucun fichier étranger au diff.

---

## Task 1 — Formaliser le contexte et l'historique dans l'état front

**Fichiers :**

- Modifier : `public/state.js`
- Modifier : `test/state.test.js`

- [ ] Écrire les tests rouges pour `etatInitial()` : contexte Laurent, sac,
  historique et reçus vides.
- [ ] Tester `observerZone(etat, "N")` et `observerPersonnage(etat)` : nouvel objet,
  aucune mutation de l'origine.
- [ ] Étendre `ajouterDialogue()` pour enregistrer `canal` et `contexte`.
- [ ] Ajouter et tester `historiquePourLaurent()` : conserver uniquement les tours
  `canal: "laurent"`, sans modifier l'historique affiché.
- [ ] Ajouter `ajouterRecus()` avec déduplication opaque et immuable.
- [ ] Implémenter le minimum puis exécuter :

```bash
npx vitest run test/state.test.js
```

Résultat attendu : le contexte et les deux mémoires sont des concepts explicites et
testés avant toute modification DOM.

---

## Task 2 — Isoler la reconnaissance linguistique

**Fichiers :**

- Créer : `public/intention.js`
- Créer : `test/intention.test.js`
- Modifier ensuite : `public/game.js`

- [ ] Extraire la normalisation, les verbes, les noms et les alias de
  `gesteDemande()` dans un module pur.
- [ ] Tester les intentions `fouiller`, `examiner`, `ramasser` et `donner`.
- [ ] Vérifier la priorité du nom ou de l'alias le plus long.
- [ ] Faire retourner la cible et, pour une fouille, l'identifiant de zone reconnu.
- [ ] Tester qu'une phrase sans action renvoie `null` sans décider qu'il s'agit d'un
  dialogue.
- [ ] Ne filtrer aucune action par progression dans ce module.
- [ ] Exécuter :

```bash
npx vitest run test/intention.test.js
```

Résultat attendu : le front comprend une intention, mais ne peut jamais l'autoriser.

---

## Task 3 — Créer et vérifier les reçus de progression

**Fichiers :**

- Créer : `server/progression.js`
- Créer : `test/progression.test.js`

- [ ] Écrire les tests rouges pour une chaîne vide et une chaîne valide.
- [ ] Définir un format versionné, borné et stable pour les événements signés.
- [ ] Signer avec `createHmac("sha256", secret)` et encoder le reçu dans une chaîne
  opaque adaptée au JSON.
- [ ] Vérifier la signature avec `timingSafeEqual` après contrôle des longueurs.
- [ ] Chaîner `partie`, `sequence` et empreinte `precedent`.
- [ ] Rejeter les altérations de payload, signature, ordre, partie et version.
- [ ] Tester que renvoyer la même chaîne complète est idempotent, qu'un reçu dupliqué
  dans une chaîne est rejeté et que la limite maximale du journal est appliquée.
- [ ] Ne jamais logger les reçus ou le secret.
- [ ] Exécuter :

```bash
npx vitest run test/progression.test.js
```

Résultat attendu : seul le serveur peut produire un événement accepté par une
requête ultérieure.

---

## Task 4 — Centraliser la matrice des capacités

**Fichiers :**

- Créer : `server/capacites.js`
- Créer : `test/capacites.test.js`
- Modifier : `data/scenario.js` pour ajouter le contrat vide ou optionnel
  `conditionsActions`

- [ ] Construire une fixture minimale avec deux zones, Laurent, un sac et plusieurs
  objets.
- [ ] Tester la matrice spatiale complète : Laurent, zone courante, autre zone,
  inventaire et remise d'objet.
- [ ] Ajouter une fixture « stylo » avec deux événements requis, uniquement dans le
  test.
- [ ] Tester les quatre états : aucun, A seul, B seul, A+B.
- [ ] Implémenter `evaluerCapacite()` comme fonction pure et exhaustive.
- [ ] Retourner uniquement un code générique en cas de refus, jamais la liste des
  préconditions manquantes.
- [ ] Vérifier que l'absence de `conditionsActions` conserve le comportement normal
  des objets existants.
- [ ] Exécuter :

```bash
npx vitest run test/capacites.test.js test/scenario.test.js
```

Résultat attendu : toutes les décisions de droit passent par un seul module serveur.

---

## Task 5 — Dériver sac et flags depuis les événements vérifiés

**Fichiers :**

- Modifier : `server/etat.js`
- Modifier : `test/etat.test.js`

- [ ] Introduire `deriverEtat(scenario, evenements)` retournant `sac`, `flags` et
  `actionsEffectuees`.
- [ ] Conserver les règles actuelles : ramassable, donner après ramasser,
  préconditions de flags résolues au point fixe.
- [ ] Conserver temporairement `deriverFlags()` comme wrapper si cela réduit le diff
  de migration.
- [ ] Tester qu'un événement non vérifié ne peut pas entrer dans la dérivation ; le
  module reçoit uniquement la sortie de `verifierRecus()`.
- [ ] Tester les gestes répétés, l'ordre strict du sac et l'ordre ensembliste des
  flags.
- [ ] Exécuter :

```bash
npx vitest run test/etat.test.js test/progression.test.js
```

Résultat attendu : l'inventaire utilisé par les capacités n'est plus affirmé par le
navigateur.

---

## Task 6 — Valider le nouveau contrat HTTP

**Fichiers :**

- Modifier : `server/validate.js`
- Modifier : `test/validate.test.js`

- [ ] Ajouter `valideContexte()` : type connu, personnage connu ou direction
  réellement présente dans le scénario.
- [ ] Ajouter `valideIntention()` : action connue, cible chaîne et cible serveur
  connue ; champs parasites supprimés.
- [ ] Ajouter `valideRecus()` : tableau de chaînes, nombre et taille bornés.
- [ ] Ajouter `valideRequeteInteraction()`.
- [ ] Étendre `valideRequeteChat()` avec contexte et reçus.
- [ ] Retirer progressivement `gestes` et `note` du contrat chat.
- [ ] Tester champs absents, types invalides, cibles inconnues et dépassements de
  limites.
- [ ] Exécuter :

```bash
npx vitest run test/validate.test.js
```

Résultat attendu : aucun payload arbitraire n'atteint la progression, les capacités
ou le prompt.

---

## Task 7 — Ajouter l'API centralisée `/api/interagir`

**Fichiers :**

- Créer : `server/interactions.js`
- Modifier : `server/chat.js`
- Modifier : `server/index.js`
- Modifier : `test/routes.test.js`

- [ ] Écrire les tests de route avant l'implémentation.
- [ ] Générer une clé HMAC aléatoire au démarrage, l'injecter dans le routeur et
  utiliser une clé fixe dans les tests.
- [ ] Vérifier reçus, dériver l'état, puis appeler `evaluerCapacite()` avant toute
  lecture de description ou émission de reçu.
- [ ] Implémenter `examiner`, `ramasser` et `donner` via le même exécuteur.
- [ ] Implémenter `fouiller` comme lot serveur : limiter à la zone courante, produire
  les événements autorisés, puis calculer les révélations sur l'état final du lot.
- [ ] Retourner narration, nouveaux reçus et sac public dérivé.
- [ ] Retourner `400` pour la forme et `403` pour une capacité refusée.
- [ ] Vérifier que les réponses `403` ne contiennent ni flag, ni précondition, ni
  description verrouillée.
- [ ] Garder `/api/examiner` comme adaptateur pendant la migration front ; ajouter un
  test assurant qu'il appelle le moteur central au lieu de contourner les règles.
- [ ] Exécuter :

```bash
npx vitest run test/routes.test.js test/capacites.test.js test/etat.test.js
```

Résultat attendu : aucune interaction de progression ne peut être exécutée hors du
moteur central.

---

## Task 8 — Produire les événements structurés du dialogue

**Fichiers :**

- Modifier : `server/prompt.js`
- Modifier : `server/claude.js`
- Modifier : `server/chat.js`
- Modifier : `test/prompt.test.js`
- Modifier : `test/claude.test.js`
- Modifier : `test/routes.test.js`

- [ ] Étendre le contrat d'une connaissance avec l'option
  `evenementQuandExprime`, sans en ajouter au scénario courant.
- [ ] Faire retourner au constructeur de prompt la liste des seules connaissances
  exprimables dans l'état dérivé.
- [ ] Ajouter au wrapper Claude un outil structuré `signaler_evenement`, limité
  dynamiquement aux identifiants actuellement autorisés.
- [ ] Continuer à diffuser uniquement les deltas textuels vers le front.
- [ ] Lire le message final du SDK, extraire les appels d'outil et les retourner à la
  route.
- [ ] Ignorer tout identifiant hors liste, sans l'inclure dans une réponse publique.
- [ ] Signer les événements validés et émettre une trame SSE
  `event: progression` avant `event: fin`.
- [ ] Ne signer aucun événement si le flux est interrompu ou si la réponse ne se
  termine pas normalement.
- [ ] Tester que les définitions d'outil n'énumèrent jamais un événement futur.
- [ ] Tester que zéro ou un seul événement requis ne débloque pas la fixture stylo.
- [ ] Tester que le prompt ne contient jamais `conditionsActions`, les flags manquants
  ou les textes verrouillés.
- [ ] Exécuter :

```bash
npx vitest run test/prompt.test.js test/claude.test.js test/routes.test.js
```

Résultat attendu : un fait de dialogue devient un événement seulement lorsqu'il est
effectivement exprimé et validé, sans montrer au modèle le graphe futur.

---

## Task 9 — Protéger `/api/chat` par le contexte et la progression

**Fichiers :**

- Modifier : `server/chat.js`
- Modifier : `test/routes.test.js`
- Modifier : `test/public-view.test.js`

- [ ] Refuser `/api/chat` avec `403` si le contexte n'est pas Laurent, avant
  l'ouverture du flux et avant tout appel Claude.
- [ ] Vérifier les reçus et dériver les flags avant de construire le prompt.
- [ ] Retirer la `note` libre ; dériver toute action pertinente depuis les événements
  signés.
- [ ] Conserver les erreurs pré-vol JSON et les erreurs en cours de flux SSE.
- [ ] Vérifier que `vuePublique()` exclut `conditionsActions`, événements futurs,
  descriptions, aperçus, déclencheurs et préconditions.
- [ ] Exécuter :

```bash
npx vitest run test/routes.test.js test/public-view.test.js
```

Résultat attendu : Claude ne peut être appelé ni hors contexte, ni avec une
progression inventée par le navigateur.

---

## Task 10 — Router toutes les saisies dans `public/game.js`

**Fichiers :**

- Modifier : `public/game.js`
- Modifier : `public/sse.js`
- Modifier : `public/index.html`
- Modifier : `test/game.test.js`
- Modifier : `test/sse.test.js`

- [ ] Remplacer les appels directs `rendrePerso`/`ouvrirZone` par une transition
  d'état d'observation suivie du rendu.
- [ ] Créer un point d'entrée unique `traiterEntreeChat(message)`.
- [ ] Si une intention est reconnue, appeler `/api/interagir` avec le contexte et les
  reçus ; appliquer uniquement la réponse acceptée du serveur.
- [ ] Si aucune intention n'est reconnue, appeler `/api/chat` uniquement face à
  Laurent ; dans une zone, ajouter une aide locale au canal `scene`.
- [ ] Sur `403`, afficher une narration neutre sans tentative de repli vers Claude.
- [ ] Ajouter les nouveaux reçus et remplacer le sac par `etatPublic.sac`.
- [ ] Consommer la trame SSE `progression` sans l'afficher comme texte.
- [ ] Adapter le placeholder au contexte et conserver l'accessibilité du formulaire.
- [ ] Vérifier que refus et interactions locales ne déclenchent ni voix, ni attente,
  ni émotion de Laurent.
- [ ] Exécuter :

```bash
npx vitest run test/game.test.js test/sse.test.js test/state.test.js test/intention.test.js
```

Résultat attendu : le comportement visible suit le contexte, tandis que le serveur
reste l'autorité finale.

---

## Task 11 — Préserver l'historique global et isoler la mémoire IA

**Fichiers :**

- Modifier : `public/game.js`
- Modifier : `server/claude.js` si le contrat des messages doit être durci
- Modifier : `test/game.test.js`
- Modifier : `test/claude.test.js`

- [ ] Ajouter un scénario de test `N -> Laurent -> S -> Laurent`.
- [ ] Vérifier que le DOM conserve tous les tours dans l'ordre.
- [ ] Vérifier que la requête Claude ne contient que les tours du canal Laurent.
- [ ] Vérifier qu'une commande d'exploration, un refus et une narration système ne
  sont jamais présents dans `messages`.
- [ ] Vérifier que la conversation précédente avec Laurent est restaurée au retour
  au centre.
- [ ] Vérifier que le message courant n'est pas dupliqué dans l'historique envoyé.
- [ ] Exécuter :

```bash
npx vitest run test/game.test.js test/claude.test.js
```

Résultat attendu : une histoire visible unique, mais aucune « écoute à distance » de
Laurent.

---

## Task 12 — Supprimer les anciens chemins de confiance client

**Fichiers :**

- Modifier : `public/state.js`
- Modifier : `public/game.js`
- Modifier : `server/chat.js`
- Modifier : `server/validate.js`
- Modifier : `server/etat.js`
- Modifier : tests associés

- [ ] Retirer l'ancien journal `gestes` en clair une fois tous les appels migrés.
- [ ] Retirer `noteEnAttente` et le champ HTTP `note`.
- [ ] Retirer `/api/examiner` si aucun consommateur ne subsiste.
- [ ] Rechercher les références mortes :

```bash
rg -n "gestes|noteEnAttente|/api/examiner|valideGestes|deriverFlags" public server test README.md
```

- [ ] Conserver un wrapper seulement s'il existe encore un consommateur légitime et
  documenté.
- [ ] Exécuter les tests ciblés après chaque suppression.

Résultat attendu : aucun ancien endpoint ou payload ne contourne les reçus et le
moteur de capacités.

---

## Task 13 — Documentation et validation finale

**Fichiers :**

- Modifier : `README.md`
- Modifier : `BACKLOG.md` après fusion uniquement
- Mettre à jour le codemap suivi par le dépôt si l'architecture y est documentée

- [ ] Documenter le contexte du chat, l'inventaire global, `/api/interagir`, les
  reçus opaques et la différence entre historique visible et mémoire Laurent.
- [ ] Documenter comment un auteur de scénario ajoute une `conditionsActions` et un
  `evenementQuandExprime`, avec un exemple fictif non intégré aux données de jeu.
- [ ] Vérifier qu'aucune condition secrète n'apparaît dans les exemples de réponse
  publique ou dans le navigateur.
- [ ] Lancer séparément :

```bash
npm test
npm run coverage
git diff --check
```

- [ ] Vérifier les seuils de couverture et les régressions du streaming, de la voix,
  des émotions, du débrief et des révélations conditionnelles actuelles.
- [ ] Effectuer `/code-review`, `/simplify` puis `/security-review` sur le diff.
- [ ] Inspecter `git status` et le diff final pour exclure les fichiers étrangers.
- [ ] Préparer commit, push et PR en français seulement après autorisation explicite.
- [ ] Après fusion, retirer T-09 de `BACKLOG.md` sans ajouter de journal « Fait ».

Résultat attendu : suite complète verte, couverture au-dessus des seuils, règles
documentées et aucun secret nouveau exposé.

---

## Matrice de validation finale

| Parcours | Réseau attendu | Résultat |
|---|---|---|
| Centre, « Bonjour Laurent » | `/api/chat` | réponse SSE et mémoire Laurent |
| Centre, fouille d'une zone | `/api/interagir` puis `403`, jamais Claude | refus spatial neutre |
| Zone N, objet de N | `/api/interagir` | action autorisée selon progression |
| Zone N, objet de S absent du sac | `/api/interagir` puis `403` | aucune description |
| Zone N, objet déjà dans le sac | `/api/interagir` | interaction d'inventaire autorisée |
| Zone N, question à Laurent | aucun appel Claude | aide locale dans l'historique |
| Action conditionnée, zéro/A/B | `/api/interagir` puis `403` | aucun indice sur le verrou |
| Action conditionnée, A+B signés | `/api/interagir` | succès et nouveau reçu |
| A+B fournis sans signature valide | `/api/interagir` puis `400` | progression rejetée |
| Retour à Laurent | `/api/chat` | seulement l'ancien canal Laurent est transmis |

## Point d'arrêt avant livraison

L'implémentation est terminée lorsque tous les critères de la spécification et la
matrice ci-dessus sont couverts. La création d'un commit, le push, la PR et la fusion
restent des actions séparées ; aucune n'est implicite dans ce plan.

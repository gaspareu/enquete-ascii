# T-09 · Chat contextuel et capacités conditionnées par la progression

_Spécification de conception — 2026-09-08_

## Contexte

La même zone de saisie sert aujourd'hui à parler à Laurent et à décrire des actions
d'exploration. Le rendu change lorsque le joueur sélectionne Laurent ou une zone du
plan, mais cette observation n'est pas enregistrée dans l'état. L'analyseur cherche
par ailleurs une cible dans toutes les zones du scénario. Une action hors champ peut
donc être exécutée et un message libre envoyé à Laurent alors que le joueur regarde
ailleurs.

Le moteur possède déjà deux mécanismes utiles :

- le serveur rejoue un journal de gestes pour dériver les flags ;
- le prompt de Laurent ne contient que les connaissances dont tous les flags requis
  sont acquis.

La présente évolution généralise ces principes aux capacités du chat, sans ajouter
le stylo, l'encre ou tout autre contenu d'exemple au scénario courant.

## Objectifs

1. Limiter chaque entrée du chat au contexte réellement observé : Laurent ou une
   seule zone.
2. Autoriser l'interaction avec l'inventaire depuis tous les contextes, tout en
   réservant les actions qui ciblent Laurent au face-à-face central.
3. Permettre au scénario de conditionner une action à zéro, un ou plusieurs
   événements de progression, avec une sémantique `ET` explicite.
4. Garder les conditions, les événements futurs et les révélations verrouillées
   inconnus du navigateur et du modèle de dialogue.
5. Conserver un historique visuel global, tout en donnant à Laurent uniquement la
   mémoire des échanges qui ont eu lieu face à lui.
6. Centraliser la décision d'autorisation côté serveur et conserver un backend sans
   état partagé.

## Non-objectifs

- Ajouter au scénario le stylo, l'encre ou les événements utilisés comme exemples.
- Utiliser le LLM pour décider si une action de jeu est légitime.
- Réinitialiser ou séparer visuellement l'historique à chaque déplacement.
- Cacher automatiquement tous les noms d'objets existants. La visibilité d'une cible
  et l'autorisation de l'examiner sont deux mécanismes distincts.
- Persister une partie après un rechargement de page. Le jeu actuel repart déjà de
  zéro après un rechargement.

## Vocabulaire

| Terme | Définition |
|---|---|
| Contexte | Ce que le joueur observe : `{ type: "personnage", id: "laurent" }` ou `{ type: "zone", id: "N" }`. |
| Intention | Action comprise depuis la saisie : dialoguer, fouiller, examiner, ramasser ou donner. |
| Événement canonique | Fait de progression accepté ou produit par le serveur. |
| Reçu | Représentation opaque et signée d'un événement canonique, conservée par le navigateur. |
| Flag | État dérivé des événements validés ; jamais fourni directement par le client. |
| Capacité | Droit d'effectuer une intention sur une cible dans un contexte et un état donnés. |
| Canal | Origine d'une entrée d'historique : `scene` ou `laurent`. |

## Règles fonctionnelles

### Matrice spatiale

| Contexte | Autorisé | Interdit |
|---|---|---|
| Laurent | dialoguer ; examiner/manipuler un objet du sac ; donner à Laurent un objet du sac | fouiller une zone ; examiner ou ramasser un objet qui n'est pas dans le sac |
| Zone `X` | fouiller `X` ; examiner/manipuler les objets de `X` ou du sac ; ramasser un objet ramassable de `X` | dialoguer avec Laurent ; agir sur une autre zone ; donner un objet à Laurent |

Une cible du sac reste accessible après un changement de zone. Une cible qui n'est
ni dans la zone observée ni dans le sac est hors de portée.

### Matrice de progression

Après la règle spatiale, le serveur applique les conditions de progression propres
à l'action. La forme de données retenue est :

```js
conditionsActions: {
  "examiner:stylo": {
    requiertTous: [
      "laurent_demande_stylo",
      "encre_tasse_identifiee",
    ],
  },
}
```

Cet exemple illustre le contrat et ne doit pas être ajouté au scénario réel. Avec
`requiertTous`, zéro ou un seul événement ne suffit pas ; l'action est autorisée
uniquement lorsque les deux reçus correspondants ont été vérifiés.

Trois niveaux restent indépendants :

1. **Visibilité** : le joueur sait-il que la cible existe ?
2. **Actionnabilité** : peut-il effectuer cette action sur cette cible maintenant ?
3. **Révélation** : quel texte ou quelle connaissance peut être montré après une
   action autorisée ?

Une future cible réellement cachée pourra utiliser `visibilite.requiertTous`. Une
cible visible mais encore inexploitable utilisera seulement `conditionsActions`.
Les `preconditions` actuelles continuent pour leur part à choisir entre `apercu` et
`description` après un examen légitime ; elles ne deviennent pas implicitement des
interdictions d'examiner.

## Source de vérité centralisée

### Données secrètes : `data/scenario.js`

Le scénario complet reste chargé uniquement par le serveur. Il porte :

- les zones et leur liste d'objets ;
- les déclencheurs et préconditions de flags existants ;
- les nouvelles `conditionsActions` ;
- les éventuels événements émis lorsqu'une connaissance est effectivement exprimée ;
- les descriptions, connaissances et règles de visibilité secrètes.

`vuePublique()` ne doit exposer ni ces conditions, ni les identifiants d'événements
futurs, ni les textes verrouillés.

### Moteur d'autorisation : `server/capacites.js`

Un nouveau module pur devient le seul arbitre des interactions :

```js
evaluerCapacite(scenario, etatDerive, { contexte, action, cible })
  -> { ok: true }
  | { ok: false, code: "CONTEXTE_INTERDIT" }
  | { ok: false, code: "CIBLE_HORS_PORTEE" }
  | { ok: false, code: "PROGRESSION_INSUFFISANTE" }
```

Le résultat ne contient jamais les flags manquants. Les routes HTTP et les tests
utilisent cette fonction ; aucune route ne réimplémente la matrice à la main.

### Choix d'autorité

Trois options ont été comparées :

- conserver le journal client non signé : trop facile à fabriquer ;
- conserver l'état de chaque partie dans une session serveur : simple, mais rompt le
  modèle sans état et ajoute nettoyage, expiration et cohérence des sessions ;
- faire porter l'état au client sous forme de reçus signés : retenu, car il conserve
  l'architecture actuelle sans nouvelle dépendance ni stockage partagé.

### Analyse de la saisie : `public/intention.js`

Le navigateur peut reconnaître les verbes, noms et alias publics afin de produire
une intention structurée. Ce module améliore l'expérience, mais n'accorde aucun
droit. Une intention reconnue est toujours contrôlée par le serveur.

Une entrée non reconnue :

- devient un dialogue uniquement dans le contexte Laurent ;
- produit une narration d'aide dans une zone, sans appel à Claude.

## Événements autoritatifs sans état serveur

Le journal de gestes actuel est fourni en clair par le navigateur. En vérifier la
forme ne prouve pas que les gestes ont été acceptés par le serveur. Pour rendre les
conditions de progression autoritatives tout en conservant le backend sans état, le
serveur émet un reçu signé après chaque interaction acceptée.

Le reçu contient au minimum, sous forme opaque pour le front :

```js
{
  version: 1,
  partie: "identifiant-aléatoire",
  sequence: 4,
  precedent: "empreinte-du-recu-3",
  evenement: {
    type: "examiner",
    cible: "theiere",
    contexte: { type: "zone", id: "E" },
  },
}
```

Le contenu est encodé et signé par HMAC avec une clé aléatoire créée au démarrage du
serveur. Le navigateur conserve la chaîne de reçus et la renvoie aux interactions
suivantes. Le serveur vérifie :

- signature, version et taille ;
- identifiant de partie identique ;
- séquence continue ;
- empreinte du reçu précédent ;
- absence de duplication ou de mélange de deux chaînes.

Supprimer un reçu ne donne aucun avantage : la progression régresse. Renvoyer la
même chaîne complète reste idempotent ; insérer deux fois un reçu dans une chaîne est
invalide. Fabriquer, modifier ou réordonner un événement invalide la chaîne.

La clé peut rester éphémère puisque la partie front n'est pas persistée. Une future
persistance nécessiterait une clé stable et une stratégie de reprise distincte.

## État dérivé

`server/etat.js` évolue de `deriverFlags()` vers une dérivation complète :

```js
deriverEtat(scenario, evenementsVerifies)
  -> { sac, flags, actionsEffectuees }
```

La compatibilité peut être conservée avec un petit wrapper `deriverFlags()` pendant
la migration des tests. Le sac utilisé pour autoriser `donner` ou une interaction
d'inventaire est celui dérivé côté serveur, jamais `etat.sac` envoyé par le front.

## API d'interaction

### `POST /api/interagir`

Requête :

```js
{
  contexte: { type: "zone", id: "N" },
  intention: { action: "examiner", cible: "distinction" },
  recus: ["recu-opaque-1", "recu-opaque-2"]
}
```

Traitement : validation de forme, vérification des reçus, dérivation de l'état,
évaluation de la capacité, exécution, émission d'un nouveau reçu et réponse publique.

Une fouille de zone est développée côté serveur en examens autorisés. Les reçus de
tous les examens sont produits avant de calculer les descriptions conditionnelles,
afin de préserver la résolution ensembliste déjà utilisée par les préconditions.

Réponse de succès :

```js
{
  narration: "…",
  recus: ["nouveau-recu-3"],
  etatPublic: { sac: ["grand_cru"] }
}
```

Réponses d'échec :

- `400` : requête, contexte, intention ou chaîne de reçus malformés ;
- `403` : action bien formée mais non autorisée ;
- `404` n'est pas utilisé pour distinguer une cible cachée d'une cible verrouillée.

Le texte associé à un `403` est volontairement neutre. Le code interne peut être
journalisé côté serveur, mais les flags manquants ne sortent pas.

`POST /api/examiner` devient un adaptateur temporaire puis est supprimé lorsque le
front utilise intégralement `/api/interagir`.

### `POST /api/chat`

La requête ajoute `contexte` et `recus`. Le serveur :

1. vérifie que le contexte cible Laurent ;
2. vérifie la chaîne et dérive les flags ;
3. construit une projection minimale pour le modèle ;
4. diffuse la réponse en SSE ;
5. signe les éventuels événements de dialogue validés ;
6. émet une trame `progression` avant `fin`.

Le champ libre `note` est retiré. Une action passée au prompt doit être dérivée d'un
reçu validé, pas affirmée par le navigateur.

## Événements provenant du dialogue

Un événement tel que « Laurent a effectivement demandé le stylo » ne doit pas être
déduit par une expression régulière sur son texte. Une connaissance de dialogue peut
déclarer un événement à émettre lorsqu'elle est exprimée :

```js
{
  id: "souhait_stylo",
  texte: "…",
  requiert: ["condition_dialogue_precedente"],
  evenementQuandExprime: "laurent_demande_stylo",
}
```

Cet exemple reste une fixture de test. Le serveur ne fournit au modèle que les
connaissances déjà débloquées et, parmi elles, les seuls événements qu'il peut
actuellement signaler. Le wrapper Claude collecte une sortie structurée ou un appel
d'outil `signaler_evenement`; la route valide l'identifiant contre cette liste avant
de signer le reçu.

Les définitions d'outil ne doivent jamais énumérer les événements futurs. Une sortie
non autorisée est ignorée et journalisée de manière neutre.

Un événement de dialogue n'est acquis qu'après une réponse terminée et après
réception de la trame `progression`. Une réponse interrompue conserve son texte
partiel dans l'historique, mais ne modifie pas la progression.

Cette protection garantit l'absence de fuite du scénario dans le prompt. Elle ne
peut pas garantir qu'un modèle probabiliste n'inventera jamais par hasard un détail ;
le prompt conserve donc aussi l'interdiction explicite d'inventer des faits.

## Historique et mémoire de Laurent

Le front conserve une seule liste visible :

```js
{
  role: "joueur" | "personnage" | "systeme",
  texte: "…",
  canal: "scene" | "laurent",
  contexte: { type: "zone", id: "N" },
}
```

- Changer de zone ne supprime rien.
- Les actions et narrations restent visibles dans le journal général.
- `historiquePourLaurent()` ne conserve que les tours `canal: "laurent"`.
- Les erreurs, refus et commandes de fouille ne sont jamais envoyés au modèle.
- Revenir au centre restaure la continuité des échanges précédents avec Laurent.

## Expérience utilisateur sans spoiler

Le placeholder et une courte aide peuvent refléter la matrice spatiale publique :

- face à Laurent : « Interrogez Laurent ou utilisez un objet du sac… » ;
- dans une zone : « Fouillez cette zone ou examinez votre sac… ».

Un refus de progression reste vague. Un refus spatial peut être précis sans révéler
de secret : « Cet objet n'est pas dans la zone que vous observez. »

Les refus sont ajoutés à l'historique comme narration `scene`; ils ne déclenchent ni
appel Claude, ni synthèse vocale, ni changement d'émotion de Laurent.

## Sécurité

- Le front ne soumet jamais de flags ni d'événements canoniques non signés.
- Toute interaction qui modifie la progression passe par le serveur.
- `conditionsActions`, déclencheurs, préconditions et événements futurs sont exclus
  de `vuePublique()`.
- Les refus n'expliquent pas les conditions manquantes.
- Le prompt ne reçoit que les connaissances débloquées et le canal Laurent.
- Les reçus sont bornés en taille et en nombre pour éviter l'abus de parsing.
- La comparaison HMAC utilise `timingSafeEqual` après contrôle de longueur.
- Les logs n'incluent ni prompt complet, ni historique, ni reçus bruts.

## Tests attendus

### Autorisation spatiale

- Laurent : dialogue et inventaire acceptés ; cible de zone refusée.
- Zone N : objets N et inventaire acceptés ; objets S et dialogue refusés.
- Donner à Laurent depuis une zone est refusé.
- Un objet ramassé légitimement reste accessible depuis toute zone.

### Progression conditionnelle

À partir d'une fixture « stylo » uniquement dans les tests :

- aucun événement : refus ;
- premier événement seulement : refus ;
- second événement seulement : refus ;
- les deux événements : succès ;
- le refus public ne contient ni nom de flag ni indice sur la condition.

### Reçus

- chaîne valide acceptée ;
- signature, contenu, ordre ou partie modifiés : rejet ;
- mélange de chaînes : rejet ;
- même chaîne complète renvoyée : état idempotent ;
- reçu dupliqué à l'intérieur d'une chaîne : rejet ;
- journal trop long : rejet.

### Isolation du modèle

- le prompt avant déblocage ne contient aucun texte, flag ou condition futur ;
- un seul des deux événements ne suffit pas ;
- seuls les événements de dialogue actuellement proposés peuvent être signés ;
- les entrées `scene` sont absentes des messages Anthropic ;
- un dialogue depuis une zone n'appelle jamais le client Claude.

### Historique

- parcours `N -> Laurent -> S -> Laurent` : toutes les entrées restent affichées ;
- Laurent retrouve uniquement ses échanges précédents ;
- refus et actions de zone restent hors de sa mémoire et de la voix.

## Critères d'acceptation

1. Le contexte observé est explicite, immutable et mis à jour par chaque clic du plan.
2. Aucune action ne porte sur une cible hors zone et hors inventaire.
3. `/api/chat` n'est accessible fonctionnellement que face à Laurent.
4. Une action à `requiertTous: [A, B]` est refusée jusqu'à validation de A **et** B.
5. Le navigateur ne peut pas forger A ou B et ne reçoit jamais leurs préconditions.
6. Claude ne reçoit ni actions futures, ni conditions, ni révélations verrouillées.
7. L'historique visuel est continu ; la mémoire Claude est limitée au canal Laurent.
8. Les règles sont décidées par un seul moteur serveur, utilisé par toutes les routes.
9. Tests et couverture restent au-dessus des seuils existants ; aucune régression de
   streaming, voix, émotions, débrief ou préconditions actuelles.

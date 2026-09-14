# Immersion de l'interrogatoire — Plan d'implémentation

**Objectif :** Corriger la lisibilité de l'interrogatoire et de l'exploration :
portraits de Laurent à pleine hauteur sans recadrage, tours de parole distincts,
fouille naturelle des zones, didascalies non indiciaires, débrief réactif,
vouvoiement et pistes de questions sans divulgâcher l'enquête.

**Décisions actées :**

| Sujet | Décision |
|---|---|
| Portraits | L'image entière est visible, conserve son ratio et est agrandie jusqu'à remplir la hauteur disponible de la scène. Aucun recadrage ni déformation. |
| Feedback des hypothèses | Il concerne les quatre réponses du débrief final. |
| Questions suggérées | Elles apparaissent pendant l'interrogatoire, pas dans le débrief. |

**Architecture :** Les actions d'exploration et les suggestions restent dérivées
côté serveur à partir de la progression vérifiée. Le navigateur peut reconnaître
une formulation naturelle et afficher une suggestion, mais ne décide ni d'un
indice, ni d'une révélation, ni de la justesse d'une hypothèse. Les didascalies
sont un élément décoratif filtré, jamais un canal d'indice.

**Prérequis d'intégration :** le checkout local est en retard sur `origin/main`
et contient les fichiers non suivis `.codex/`, `AGENTS.md` et les documents T-09.
Au démarrage de l'implémentation, mettre à jour une branche isolée et comparer la
branche cible au plan T-09. Les contrats de contexte, reçus et `/api/interagir` de
T-09 doivent être réutilisés s'ils sont déjà intégrés ; ne pas créer en parallèle
une seconde autorité d'exploration dans `game.js`.

**Conventions :** TDD, JS ESM, aucune dépendance supplémentaire, rendu par nœuds
DOM et `textContent` (jamais `innerHTML`). Les indices, flags, préconditions et
suggestions à venir ne quittent pas le serveur.

---

## Structure de fichiers cible

**Nouveaux modules pressentis**

- `public/intention.js` — analyse pure des verbes et alias publics de zone/objet.
- `server/replique.js` — normalisation sûre de la réplique : didascalie décorative
  optionnelle et parole séparée.

**Modules modifiés**

- `data/scenario.js` — alias publics des zones et banque de pistes conditionnées.
- `server/prompt.js`, `server/claude.js` — contrat de vouvoiement et flux de
  réplique filtrée.
- `server/chat.js` ou `server/interactions.js` — projection publique d'une fouille
  autorisée et des pistes déjà débloquées.
- `public/game.js`, `public/render.js`, `public/state.js`, `public/index.html`,
  `public/style.css`, `public/tokens.css`, `public/DESIGN-SYSTEM.md` — affichage
  de la scène, tours sémantiques, exploration, débrief et suggestions.
- `test/game.test.js`, `test/render.test.js`, `test/prompt.test.js`,
  `test/routes.test.js`, `test/state.test.js` et les nouveaux tests unitaires —
  contrats et régressions.

---

## Task 0 — Isoler la contribution et choisir le contrat d'exploration

- [ ] Vérifier et classer l'état Git ; préserver strictement les fichiers non liés.
- [ ] Partir d'un `main` à jour dans une branche dédiée après validation de la
  baseline (`npm test`, `npm run coverage`).
- [ ] Comparer la cible obtenue aux documents T-09 : s'ils sont intégrés, compléter
  leur pipeline `intention → serveur → reçu → état public` ; sinon, intégrer ce
  pipeline avant d'ajouter une fouille de zone.
- [ ] Ajouter une tâche dédiée au backlog avec les critères de ce document ; ne pas
  retirer T-08 ni T-09 avant leur livraison effective.

Résultat attendu : un unique pipeline autoritatif et aucun conflit avec les notes
non suivies déjà présentes.

## Task 1 — Mettre les portraits à pleine hauteur sans les recadrer

**Fichiers :** `public/style.css`, `public/tokens.css`,
`public/DESIGN-SYSTEM.md`, `test/game.test.js`.

- [ ] Écrire le test DOM rouge qui vérifie que le conteneur de portrait reste la
  scène entière lorsque Laurent est sélectionné et après un changement d'émotion.
- [ ] Donner au `figure` et à l'image la hauteur disponible de `#scene` ; supprimer
  la limite spécifique qui réduit actuellement les portraits.
- [ ] Employer un affichage proportionnel sans recadrage (`contain`) : l'image doit
  remplir la hauteur dès que sa largeur le permet, rester entièrement visible et ne
  jamais être étirée. Les éventuelles marges latérales appartiennent au fond de la
  scène, pas à une carte ou à une bordure.
- [ ] Conserver le comportement des illustrations de zones et le repli ASCII si un
  portrait est absent.
- [ ] Documenter ce contrat dans le Design System et ajouter les tokens nécessaires
  au lieu de valeurs CSS brutes.

Résultat attendu : les quatre expressions de Laurent utilisent tout le panneau de
scène tout en montrant l'image complète.

## Task 2 — Rendre le journal comme des tours sémantiques

**Fichiers :** `public/render.js`, `public/game.js`, `public/index.html`,
`public/style.css`, `test/render.test.js`, `test/game.test.js`.

- [ ] Écrire les tests rouges décrivant les trois variantes : joueur aligné à droite,
  Laurent à gauche, narration système centrée et atténuée.
- [ ] Faire retourner au rendu une représentation structurée des tours au lieu de
  peindre tout l'historique dans un unique `<pre>`.
- [ ] Construire explicitement les éléments DOM avec les classes de rôle, des noms
  accessibles et `textContent`. Le défilement automatique doit rester au dernier tour.
- [ ] Adapter le rendu SSE : pendant le flux, seul le tour temporaire de Laurent est
  mis à jour ; le tour du joueur reste à droite et aucun message n'est dupliqué à la
  trame `fin` ou en cas d'erreur.
- [ ] Conserver les séparations de paragraphes, le contraste et
  `prefers-reduced-motion`.

Résultat attendu : l'origine de chaque propos est immédiatement compréhensible, y
compris pendant une réponse streamée.

## Task 3 — Rendre la fouille naturelle, contextuelle et non-spoilante

**Fichiers :** `public/intention.js`, `public/game.js`, `public/state.js`,
`data/scenario.js`, route d'interaction serveur, tests d'intention, de route,
d'état et `test/game.test.js`.

- [ ] Écrire les tests rouges pour « je fouille la corbeille », « je cherche dans le
  placard », « je fouille ici » et « j'inspecte la pièce à l'est » après sélection
  de la zone correspondante.
- [ ] Définir pour chaque zone un nom, un article et des alias naturels publics
  (`corbeille`, `poubelle`, `placard`, etc.). L'analyseur reconnaît l'intention
  et la cible ; il ne vérifie aucune précondition secrète.
- [ ] Lorsque le contexte est une zone, router une fouille reconnue vers le serveur
  plutôt que vers Laurent. Sans zone sélectionnée ou en cas de zone ambiguë, rendre
  une aide neutre sans appel au modèle.
- [ ] Faire autoriser la fouille par le serveur, puis développer la zone uniquement
  en examens légitimes. Les descriptions conditionnelles restent choisies après
  dérivation des flags ; aucun aperçu ne devient une révélation par le seul fait de
  fouiller.
- [ ] Ajouter au journal une narration concrète des éléments trouvés, puis conserver
  les commandes d'examen, de ramassage et de remise existantes. Une fouille ne doit
  ni appeler Claude ni agir sur une autre zone.
- [ ] Tester les zones hors contexte, les alias, la persistance du journal, les
  préconditions de la plaquette/mot/agenda et l'absence de fuite dans la vue publique.

Résultat attendu : la fouille d'une zone fonctionne avec les mots du joueur, mais le
serveur reste seul à décider ce qui a effectivement été découvert.

## Task 4 — Séparer parole, didascalie et ton de Laurent

**Fichiers :** `server/replique.js`, `server/prompt.js`, `server/claude.js`,
`public/render.js`, `public/game.js`, `test/replique.test.js`,
`test/prompt.test.js`, `test/game.test.js`.

- [ ] Écrire les tests rouges : une didascalie autorisée est en italiques ; toute
  didascalie liée à un objet, une accusation, une émotion probante, une intention
  ou un fait est retirée ; la parole reste visible et destinée à la voix.
- [ ] Définir un petit répertoire fermé de gestes neutres et observables. Une
  didascalie optionnelle ne peut être conservée que si elle en fait partie ; sinon
  la réplique est affichée sans didascalie. Elle ne nomme ni indice, ni hypothèse,
  ni état intérieur de Laurent.
- [ ] Modifier le prompt afin que Laurent vouvoie sans exception le joueur et que
  toute information de jeu figure dans la parole, jamais dans la didascalie.
- [ ] Conserver le flux : le serveur retient seulement la première ligne éventuelle
  jusqu'à sa validation, puis diffuse la parole sans HTML. La synthèse vocale reçoit
  la parole seule.
- [ ] Ajouter des fixtures de réplique contenant tutoiement, didascalie invalide,
  absence de didascalie et parole multi-phrases ; le contrat de prompt doit être
  explicitement testé.

Résultat attendu : les didascalies créent de l'ambiance sans informer la déduction,
et Laurent vouvoie de façon cohérente.

## Task 5 — Donner un retour fiable lors du débrief

**Fichiers :** `public/game.js`, `public/render.js`, `public/style.css`,
`test/game.test.js`, `test/render.test.js`.

- [ ] Écrire les tests rouges pour l'état « Analyse des hypothèses… », la prévention
  d'un double envoi et la conservation des quatre réponses après une erreur réseau.
- [ ] Au clic sur « Rendre mon verdict », désactiver temporairement l'action,
  exposer un état accessible (`aria-live`) et conserver les réponses en mémoire.
- [ ] À la réponse, afficher le rang, le score et un retour par question : note,
  justification et élément manquant lorsque le juge le fournit. Le résultat doit
  être lisible comme un débrief, pas comme un bloc technique brut.
- [ ] Sur rejet ou erreur, afficher le problème sans détruire le formulaire ni les
  hypothèses déjà saisies ; réactiver l'envoi.

Résultat attendu : le joueur sait immédiatement que son verdict est évalué et peut
comprendre son résultat ou réessayer sans ressaisie.

## Task 6 — Proposer des pistes d'interrogatoire non-spoilantes

**Fichiers :** `data/scenario.js`, projection serveur, `public/state.js`,
`public/game.js`, `public/index.html`, `public/style.css`, tests de route/d'état/DOM.

- [ ] Définir côté serveur une banque de questions courtes, chacune associée à des
  flags déjà acquis. Une piste ne peut être projetée que si tous ses prérequis sont
  réellement dérivés ; aucune condition ou piste future ne sort dans la réponse.
- [ ] Après une découverte autorisée, retourner au plus trois questions ouvertes
  correspondant aux fils encore à approfondir. Elles guident l'interrogatoire, mais
  ne donnent ni le coupable, ni une preuve, ni une formulation de réponse au débrief.
- [ ] Afficher ces pistes près de la saisie comme aides textuelles accessibles. Un
  clic ou une activation clavier préremplit et focalise le champ ; il ne soumet pas
  le message et n'exécute aucune action automatiquement.
- [ ] Actualiser les pistes après la progression, supprimer celles devenues obsolètes
  et vérifier qu'elles n'apparaissent pas quand Laurent n'est pas le contexte actif.

Résultat attendu : les suggestions relancent une enquête bloquée sans transformer le
jeu en questionnaire à choix ni révéler l'étape suivante.

## Task 7 — Vérification complète et documentation

- [ ] Exécuter les tests ciblés au fil des tâches, puis `npm test` et
  `npm run coverage` ; conserver ou dépasser le seuil de couverture du projet.
- [ ] Vérifier `git diff --check` et que le diff ne contient aucun fichier non lié.
- [ ] Tester manuellement le parcours complet : portrait neutre → zone → fouille par
  alias → objet conditionnel → retour à Laurent → suggestion → débrief, y compris
  l'erreur réseau du débrief.
- [ ] Vérifier le rendu sur bureau et sur iPhone 15 (`393 × 852`) : image entière à
  pleine hauteur, pas de débordement horizontal, tours alignés, saisie et suggestions
  accessibles au clavier.
- [ ] Mettre à jour `README.md`, `DESIGN-SYSTEM.md` et `BACKLOG.md` lorsque le
  changement est effectivement livré, puis suivre le processus de revue, sécurité,
  commit et PR décrit dans `AGENTS.md`.

Résultat attendu : une évolution testée de bout en bout, sans fuite de scénario ni
régression de l'exploration, du flux SSE ou du mode vocal.

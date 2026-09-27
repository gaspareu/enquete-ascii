# Observations d'objets immersives et réponses aux questions de détail

## Statut

Plan initialement établi sur `origin/main` au commit `f4abec0` (suite de T-10),
puis implémentation rebasée sur `bd178b8` et adaptée au format multi-enquête.
Branche : `codex/plan-immersion-objets`, suivie dans T-11 jusqu’à livraison.
Suite complète : 280 tests réussis sur 33 fichiers ; couverture des lignes :
94,48 %. Les trois phrases de l’extrait ont été rejouées avec le vrai interprète
dans le navigateur, ainsi qu’un second examen mobile.

## Problème observé

Après « Qu'est-ce qu'il y a sur cette table ? », la fouille de la table à dessin
énumère correctement quatre objets. Les deux questions suivantes visent pourtant
un objet connu, mais aboutissent à « Vous observez : table à dessin. »

Deux mécanismes expliquent ce résultat :

1. `server/interprete.js` peut classer une question sur un objet comme `observer`
   avec la zone pour contexte. `public/game.js` répond alors avec le seul nom de
   la zone. Le contrat de décision ne désigne aucune cible pour `observer`.
2. Même quand l'interprète choisit `examiner`, `server/interactions.js` renvoie
   toujours le même `apercu` ou la même `description`. `/api/interagir` ne reçoit
   pas la question qui permettrait de choisir un détail pertinent.

Le scénario possède déjà des objets d'ambiance, mais une question telle que
« Depuis quand la plante semble fanée ? » n'a aucune réponse fiable sur sa date.
La réponse doit décrire ce qui est visible et reconnaître cette limite, sans
inventer une chronologie.

## Expérience cible

| Question du joueur | Résultat attendu |
| --- | --- |
| « Qu'y a-t-il sur la table ? » | Fouille de la zone : courte ambiance, puis noms des objets trouvés. Aucun indice propre à un objet n'est lu. |
| « Observez plus en détail la distinction d'architecture » | Examen de la distinction connue : détail matériel anodin et texte de l'indice autorisé. Aucune réponse sur la seule table. |
| « Depuis quand la plante semble fanée ? » | Examen de la plante connue : feuilles et terre décrites ; durée exacte déclarée indéterminable si le scénario ne la fixe pas. |
| « Examinez encore la maquette » | Un autre détail d'ambiance pertinent peut être choisi ; le résultat ne répète pas mécaniquement le nom de la zone. |
| Question sur un objet jamais découvert | Précision locale ou refus neutre ; aucun nom caché ni description n'est révélé. |

Les objets utiles et les objets d'ambiance reçoivent tous une observation
intéressante à lire. « Sans intérêt » désigne ici des détails sans effet sur la
déduction, pas une réponse vide. Les faits établis par le scénario restent
stables d'une visite à l'autre.

## Décisions de conception

### 1. Désigner l'objet avant de choisir l'action

Faire évoluer l'outil `resoudre_intention` : une question qui nomme un objet
connu, demande ce qu'on peut en voir, son état, son origine ou sa date vise cet
objet et produit `interagir/examiner`. `observer` reste réservé à une zone ou au
personnage. Donner à la décision une cible explicite, puis valider côté serveur
que cette cible provient du catalogue dérivé des reçus vérifiés. Le serveur
déduit la zone d'un objet connu, ou conserve le contexte courant s'il est dans
le sac ; la décision du modèle ne confère jamais un droit spatial.

Ajouter au prompt des exemples proches des trois phrases rapportées, dont la
question sur la plante. La validation refuse une cible absente, ambiguë ou hors
portée. La capacité de `/api/interagir` reste l'arbitre final. Garder une seule
action par phrase : une fouille ne déclenche aucun examen automatique.

### 2. Donner une matière descriptive sûre à chaque objet

Ajouter à chaque objet de `data/scenario.js` deux ou trois observations
sensorielles brèves et non décisives, avec des identifiants stables. Les faire
proposer par l'IA pendant l'écriture du scénario, puis les relire et les stocker
comme données validées. Exemples à affiner : une fine poussière sur le cadre de
la distinction ; la terre sèche et les feuilles courbées de la plante. Réviser
les formulations qui affirment sans preuve une date ou une cause, notamment
« faute d'arrosage ces derniers jours » pour la plante.

Noter explicitement les limites utiles par objet, par exemple `date`
pour la plante, plutôt que demander au modèle de décider seul qu'une date est
absente. Une information déjà écrite dans le texte visible reste prioritaire.

Séparer ces observations de `apercu` et `description`, qui portent parfois des
indices. Une fouille conserve uniquement les noms des objets et l'ambiance
publique de la zone. L'examen seul ouvre le texte d'objet autorisé. Pour un
objet à bascule, conserver l'`apercu` avant sa précondition et la révélation
après ; aucun détail d'ambiance ne doit paraphraser la révélation verrouillée.

### 3. Répondre à la question sans laisser l'IA inventer des faits

L'interprète existant choisit aussi un angle borné (`aspect`, `date`, `cause`,
`identite`, `autre`) depuis la phrase du joueur, sans recevoir le
texte des objets. Après vérification des reçus, contrôle de capacité et examen
autorisé, le serveur compose une réponse avec le texte actuellement visible,
un détail sûr de **cet objet** et, si le scénario l'autorise pour l'angle, une
phrase d'incertitude approuvée. Les examens répétés alternent entre les détails
selon les reçus signés. L'indice autorisé reste tel quel dans chaque réponse.

La revue automatique a refusé le second appel IA envisagé, car il aurait envoyé
des descriptions du scénario à un service externe. La composition locale évite
cet envoi : l'IA ne choisit que la cible et l'angle à partir du catalogue public
déjà utilisé. Les détails sont proposés lors de l'écriture du scénario, relus,
puis stockés comme données ; aucun modèle ne rédige la réponse au joueur.

### 4. Présenter la découverte dans le journal

Remplacer l'introduction uniforme de la fouille par une courte phrase d'ambiance
propre à la zone, suivie d'une liste lisible des objets. Afficher la réponse à
un examen une fois dans le journal de scène ; éviter que la modale répète aussitôt
le même texte et interrompe la conversation. Conserver un accès clavier et un
retour accessible pour chaque réponse. Les observations n'entrent jamais dans
l'historique envoyé à Laurent.

## Séquence TDD proposée

1. **RED — intention et contexte.** Dans `test/interprete.test.js` et
   `test/game.test.js`, couvrir les trois formulations de l'extrait : fouille,
   examen de la distinction, question temporelle sur la plante. Tester le cas
   d'un objet non découvert, d'un objet connu dans une autre zone et d'un objet
   dans le sac. Tester les décisions IA incohérentes. Vérifier par un court essai
   avec le vrai modèle que ces formulations aboutissent aux cibles attendues ;
   les tests unitaires seuls ne garantissent pas son choix sémantique.
2. **GREEN — ciblage.** Ajuster `server/interprete.js`, la projection publique
   de `server/etat.js` si la zone d'origine est nécessaire, puis `public/game.js`.
   La phrase continue vers l'examen, sans accéder à Laurent.
3. **RED — visibilité.** Dans `test/interactions.test.js`, `test/routes.test.js`
   et `test/scenario.test.js`, prouver que la fouille n'expose que noms et ambiance
   publique, que chaque objet possède des détails sans indice, et qu'un objet à
   bascule ne révèle rien avant un nouvel examen légitime. Rejeter une question
   trop longue et des reçus falsifiés avant tout appel de description.
4. **GREEN — données et réponse.** Compléter les objets et les zones de
   `data/scenario.js`, valider l'angle dans `server/validate.js`,
   puis ajouter la composition locale dans `server/observations.js` et sa route.
   Garder la signature des gestes et
   `evaluerCapacite()` comme source de vérité.
5. **RED/GREEN — présentation.** Dans `test/game.test.js`, vérifier la réponse
   dans le journal, l'absence de modale doublon, le focus clavier et l'absence
   de ces tours dans `historiquePourLaurent()` ; adapter `public/game.js`.
6. **Relecture.** Relire tous les détails proposés contre les révélations et
   l'ambiance de l'enquête. Compléter `BACKLOG.md`, `README.md` et, si le rendu
   change, `public/DESIGN-SYSTEM.md`. Lancer `npm test`, `npm run coverage`
   (seuil ≥ 80 %), `git diff --check`, puis un parcours navigateur des trois
   phrases sur ordinateur et mobile avec la clé API configurée.

## Critères d'acceptation

- Chaque objet trouvé répond à une demande de détail par une description propre
  à l'objet, y compris les objets sans rôle dans l'enquête.
- Les trois phrases de l'extrait suivent le parcours décrit plus haut ; la
  plante ne reçoit aucune date inventée.
- Une question répétée peut montrer un autre détail, sans changer les faits ni
  signer un indice qui n'est pas débloqué.
- Fouille, catalogue de l'interprète, vue initiale et refus n'exposent ni
  description verrouillée, ni flag, ni solution. Toute narration d'objet suit
  une capacité autorisée et des reçus valides.
- La réponse d'examen n'a pas besoin d'un second appel IA ; les détails et
  incertitudes restent lisibles depuis le scénario approuvé.
- Tests, couverture, accessibilité du journal et parcours mobile validés.

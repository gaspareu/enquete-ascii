# Enquête ASCII — framework d'enquêtes conversationnelles

Framework local d'enquêtes web rétro en français. Chaque enquête définit une
pièce en plan 3 × 3, huit zones, un interlocuteur, des objets, des faits de
progression et un débrief. L'affaire d'Hélène reste l'exemple fourni. Le
dialogue est généré par Claude et le personnage ne reçoit que les connaissances
que les actions du joueur ont réellement révélées.

## Cible du projet

Permettre à un auteur de créer localement une enquête indépendante, de la
prévisualiser, de vérifier ses règles et de la proposer au joueur. Le moteur
garde les secrets et la progression côté serveur. Cette première version accepte
une pièce et un interlocuteur central par enquête.

## État actuel

Le socle jouable et l'atelier local sont en place :

- exploration de huit zones autour d'un interlocuteur central, objets examinables
  et inventaire, décrits en langage libre à un agent d'interprétation dédié ;
- scénario à embranchements : les interactions acceptées produisent des reçus
  HMAC chaînés ; le serveur en dérive inventaire, flags et révélations sans
  exposer les secrets au navigateur ;
- dialogue Claude en streaming, contextuel : l'interlocuteur ne reçoit que les
  échanges tenus face à lui ;
- débrief final noté par un second appel au modèle, avec score, rang et retours ;
- mode vocal optionnel : synthèse ElevenLabs pour les réponses et saisie par
  micro quand le navigateur propose Web Speech API ;
- sélection des enquêtes prêtes et atelier de création pour les brouillons ;
- tests automatisés et seuils de couverture appliqués.

Le chantier produit en cours est **T-10** : rendre toutes les interactions
naturelles, sans imposer de mots-clés au joueur. Son cadrage et son critère
d'acceptation vivent dans le [backlog](BACKLOG.md).

## Prérequis

- [Node.js](https://nodejs.org) 18 ou plus (testé sur Node 22) ;
- une clé API Anthropic pour le dialogue et le débrief ;
- facultativement, un compte ElevenLabs pour la voix du personnage.

## Installation et lancement

```bash
npm install
cp .env.example .env
npm start
```

Ouvrez ensuite <http://localhost:3000> pour choisir une enquête prête.

### Créer une enquête localement

```bash
npm run editor
```

Ouvrez <http://127.0.0.1:3000/editeur/>. Créez un brouillon ou dupliquez
l'exemple d'Hélène, renseignez les sections de l'atelier, puis utilisez
**Enregistrer**, **Vérifier l'enquête** et **Prévisualiser la partie**.
Une enquête complète peut être marquée **prête** ; elle apparaît alors dans la
sélection du jeu. Hélène est en lecture seule, mais duplicable.
Les portraits et les illustrations sont facultatifs : sans image, le jeu affiche
le visage ASCII et la description de la zone.

Dans **Pièce**, choisissez une zone puis **Ajouter des éléments avec l’IA**.
Indiquez de 1 à 8 objets et, si besoin, une instruction particulière. Anthropic
utilise le titre, l'introduction, le nom du personnage et le contexte de cette
zone pour proposer des objets avec leur description et leur caractère ramassable.
Relisez les propositions dans **Objets**, puis enregistrez le brouillon. La
génération nécessite `ANTHROPIC_API_KEY` et ne crée pas de règles de progression.

Les scénarios sont enregistrés sous `data/enquetes/<id>/scenario.json` et les
images importées sous `public/images/enquetes/<id>/`. L'API d'écriture n'existe
que dans le mode éditeur lié à `127.0.0.1`. Les brouillons et les secrets ne
sont pas servis dans le catalogue public. Une partie de prévisualisation utilise
la révision enregistrée : après une modification, relancez une nouvelle partie.
Le [format des enquêtes](docs/FORMAT-ENQUETE.md) explique chaque objet et le
graphe de progression ; le [plan de l'atelier](docs/superpowers/plans/2026-09-17-editeur-local-enquetes.md)
décrit les choix de cette première version.

Complétez au minimum ce fichier `.env` :

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
MODEL=claude-sonnet-4-6
PORT=3000
```

Sans `ANTHROPIC_API_KEY`, l'interface et les décors démarrent quand même, mais
l'interprète d'actions, le dialogue et le débrief indiquent qu'ils sont
indisponibles. La clé reste côté serveur et `.env` est ignoré par git.

### Voix et micro (facultatifs)

Ajoutez ces variables pour activer la synthèse vocale de l'interlocuteur :

```dotenv
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL=eleven_multilingual_v2
```

La voix est activée volontairement par le joueur ; sans cette configuration, le
jeu texte fonctionne normalement. Le bouton micro utilise Web Speech API et est
masqué quand elle n'est pas disponible. L'audio du joueur ne passe jamais par ce
serveur, mais certains navigateurs peuvent l'envoyer à leur propre service de
transcription : vérifiez leur politique avant de l'utiliser.

## Jouer

- Écrivez simplement ce que vous observez, faites ou demandez : « Qu'est-ce qu'il
  y a sur le bureau ? », « Je prends le grand cru » ou « Demandez à Laurent
  pourquoi il ment. » L'interprète ouvre la bonne scène, déclenche une action ou
  revient à Laurent ; en cas d'ambiguïté, il vous demande de préciser.
- Le plan reste un raccourci pour observer une zone. Sa case verte indique toujours
  la scène affichée.
- Laurent ne reçoit que les demandes qui lui sont destinées. Ses réponses
  apparaissent en streaming et il retrouve uniquement vos précédents échanges
  avec lui.
- Prenez vos notes au fur et à mesure, puis choisissez `⚖ ACCUSER` pour répondre
  au débrief final et obtenir votre score.

Indice de départ : Laurent tient à ses grands crus. Trouvez sa bouteille et voyez
ce qu'il laisse échapper.

## Architecture

```
data/enquetes/      scénarios JSON privés et versionnés ; Hélène est l'exemple fourni
data/scenario.js    scénario historique conservé pour les anciennes routes
editeur/            atelier local de création (HTML/CSS/JS ESM)
server/             dépôt, validation, Express, reçus HMAC, progression et dialogue
public/             jeu et sélection des enquêtes (HTML/CSS/JS ESM, sans build)
test/               tests Vitest unitaires et de routes
docs/superpowers/   décisions de conception et plans historiques
```

Le navigateur conserve un contexte observé, un journal visuel et une chaîne de
reçus opaques. Un agent serveur dédié traduit le langage libre en une décision
structurée, sans recevoir les indices ou règles secrets. Après chaque action
autorisée, le serveur signe un événement HMAC chaîné. À chaque requête suivante,
il vérifie la chaîne puis dérive le sac, les objets déjà rencontrés, les flags et
les actions effectivement réalisées. `server/capacites.js` est l'unique arbitre
des règles spatiales et des conditions de progression ; une cible hors zone ou
hors inventaire ne peut donc pas être lue.

Le journal affiché reste global, mais le navigateur ne transmet à Claude que les
tours canalisés vers l'interlocuteur courant, et la route de dialogue exige le contexte central. Le scénario
complet, la solution, les conditions, les événements futurs, le barème et les
révélations restent côté serveur.

Les routes publiques sont :

- `GET /api/scenario` : vue sans secret du scénario ;
- `POST /api/interpreter` : transforme un message libre en observation,
  interaction, dialogue ou demande de précision ;
- `POST /api/interagir` : exécute une intention autorisée dans le contexte observé
  et renvoie narration, nouveaux reçus, sac et objets déjà rencontrés ;
- `POST /api/chat` : réponse Claude en Server-Sent Events ;
- `POST /api/debrief` : notation finale ;
- `POST /api/voix` : MP3 ElevenLabs, si configuré.

## Modifier l'enquête

Le contenu est centralisé dans [`data/scenario.js`](data/scenario.js) : personnage,
zones, objets, connaissances conditionnelles, déclencheurs, préconditions,
conditions d'action et questions de débrief. Gardez les secrets dans ce fichier et
ajoutez les tests qui garantissent qu'ils ne figurent ni dans la vue publique ni
dans un prompt trop tôt.

Le [format détaillé de l'enquête](docs/FORMAT-ENQUETE.md) décrit les types,
les interactions et le graphe de progression de l'enquête actuelle, ainsi que
les éléments à généraliser pour accueillir plusieurs enquêtes.

Pour verrouiller une action, ajoutez une condition secrète utilisant tous les
événements canoniques nécessaires, par exemple fictif :

```js
conditionsActions: {
  "examiner:objet_fictif": {
    requiertTous: ["personnage_a_demande_objet", "indice_fictif_identifie"],
  },
}
```

Une connaissance déjà débloquée peut déclarer l'événement qu'elle produit si le
personnage l'exprime réellement :

```js
{
  id: "fait_fictif",
  texte: "…",
  requiert: ["indice_deja_acquis"],
  evenementQuandExprime: "personnage_a_demande_objet",
}
```

Ces exemples ne sont pas intégrés à l'enquête. Claude ne reçoit que les événements
attachés aux connaissances déjà injectées dans son prompt ; le serveur ignore tout
autre identifiant.

Les règles de contribution, le codemap détaillé et les conventions de sécurité
sont dans [CLAUDE.md](CLAUDE.md). Le design system est décrit dans
[public/DESIGN-SYSTEM.md](public/DESIGN-SYSTEM.md).

## Qualité

```bash
npm test
npm run coverage
npm run test:watch
```

La configuration applique des seuils de couverture de 80 % (lignes, fonctions et
instructions) et 75 % (branches).

## Feuille de route

La source de vérité est [BACKLOG.md](BACKLOG.md). Les specs et plans livrés sont
archivés dans `docs/superpowers/`; l'historique des changements reste dans git et
les pull requests.

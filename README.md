# Enquête ASCII — huis clos conversationnel

Jeu d'enquête web rétro en français. Le joueur explore une pièce en plan 3 × 3,
collecte des indices et interroge Laurent, le seul témoin de la mort d'Hélène.
Le dialogue est généré par Claude et le personnage ne révèle que ce que les
actions du joueur lui permettent réellement de savoir.

## Cible du projet

Proposer une enquête courte, rejouable et entièrement jouable au clavier : une
scène unique dense, un dialogue crédible, des révélations progressives et un
débrief final qui évalue le raisonnement plutôt qu'un simple choix de coupable.
L'identité recherchée reste celle d'un huis clos rétro ; la prochaine évolution
visuelle vise des pièces davantage proches du pixel art, sans perdre la lisibilité
ni l'accessibilité du terminal actuel.

## État actuel

Le socle jouable est en place :

- exploration de huit zones autour d'un interlocuteur central, objets examinables
  et inventaire ;
- scénario à embranchements : les interactions acceptées produisent des reçus
  HMAC chaînés ; le serveur en dérive inventaire, flags et révélations sans
  exposer les secrets au navigateur ;
- dialogue Claude en streaming, contextuel : Laurent ne reçoit que les échanges
  tenus face à lui ;
- débrief final noté par un second appel au modèle, avec score, rang et retours ;
- mode vocal optionnel : synthèse ElevenLabs pour les réponses et saisie par
  micro quand le navigateur propose Web Speech API ;
- tests automatisés et seuils de couverture appliqués.

Le chantier produit restant est **T-08** : faire évoluer les décors du rendu
ASCII vers une direction pixel art cohérente. Son cadrage et son critère
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

Ouvrez ensuite <http://localhost:3000>.

Complétez au minimum ce fichier `.env` :

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
MODEL=claude-sonnet-4-6
PORT=3000
```

Sans `ANTHROPIC_API_KEY`, le serveur et l'exploration démarrent quand même, mais
le dialogue et le débrief indiquent qu'ils sont indisponibles. La clé reste côté
serveur et `.env` est ignoré par git.

### Voix et micro (facultatifs)

Ajoutez ces variables pour activer la synthèse vocale de Laurent :

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

- Cliquez une direction du plan pour observer une zone. Dans une zone, décrivez une
  action locale, par exemple : « Je fouille dans la corbeille à papier »,
  « J'examine la plaquette de somnifères » ou « Je ramasse le grand cru ».
- Un objet du sac reste examinable depuis toute zone. Pour donner un objet ou
  parler à Laurent, revenez au centre du plan, par exemple : « Je lui tends le
  grand cru. »
- Une phrase libre envoyée depuis une zone affiche une aide locale : Laurent n'est
  jamais appelé à distance. Au centre, ses réponses apparaissent en streaming et
  il retrouve uniquement vos précédents échanges avec lui.
- Prenez vos notes au fur et à mesure, puis choisissez `⚖ ACCUSER` pour répondre
  au débrief final et obtenir votre score.

Indice de départ : Laurent tient à ses grands crus. Trouvez sa bouteille et voyez
ce qu'il laisse échapper.

## Architecture

```
data/scenario.js    scénario complet, indices, règles et barème (serveur uniquement)
server/             Express, reçus HMAC, capacités, interactions, prompts, streaming, débrief et voix
public/             interface statique ASCII (HTML/CSS/JS ESM, sans étape de build)
test/               tests Vitest unitaires et de routes
docs/superpowers/   décisions de conception et plans historiques
```

Le navigateur conserve un contexte observé, un journal visuel et une chaîne de
reçus opaques. Après chaque action autorisée, le serveur signe un événement HMAC
chaîné. À chaque requête suivante, il vérifie la chaîne puis dérive le sac, les
flags et les actions effectivement réalisées. `server/capacites.js` est l'unique
arbitre des règles spatiales et des conditions de progression ; une cible hors zone
ou hors inventaire ne peut donc pas être lue.

Le journal affiché reste global, mais le navigateur ne transmet à Claude que les
tours canalisés `laurent`, et `/api/chat` exige le contexte central. Le scénario
complet, la solution, les conditions, les événements futurs, le barème et les
révélations restent côté serveur.

Les routes publiques sont :

- `GET /api/scenario` : vue sans secret du scénario ;
- `POST /api/interagir` : exécute une intention autorisée dans le contexte observé
  et renvoie narration, nouveaux reçus et sac dérivé ;
- `POST /api/chat` : réponse Claude en Server-Sent Events ;
- `POST /api/debrief` : notation finale ;
- `POST /api/voix` : MP3 ElevenLabs, si configuré.

## Modifier l'enquête

Le contenu est centralisé dans [`data/scenario.js`](data/scenario.js) : personnage,
zones, objets, connaissances conditionnelles, déclencheurs, préconditions,
conditions d'action et questions de débrief. Gardez les secrets dans ce fichier et
ajoutez les tests qui garantissent qu'ils ne figurent ni dans la vue publique ni
dans un prompt trop tôt.

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

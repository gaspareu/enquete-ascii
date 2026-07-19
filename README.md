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
- scénario à embranchements : les gestes du joueur débloquent des connaissances
  et des descriptions sans jamais exposer les secrets au navigateur ;
- dialogue Claude en streaming, avec historique et note d'enquête personnelle ;
- débrief final noté par un second appel au modèle, avec score, rang et retours ;
- mode vocal optionnel : synthèse ElevenLabs pour les réponses et saisie par
  micro quand le navigateur propose Web Speech API ;
- 157 tests automatisés et des seuils de couverture appliqués.

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

- Cliquez une direction du plan pour fouiller une zone, examiner ou ramasser un
  objet.
- Dans le sac, examinez un indice ou donnez un objet à Laurent.
- Posez vos questions dans le dialogue ; les réponses apparaissent au fil de leur
  génération.
- Prenez vos notes au fur et à mesure, puis choisissez `⚖ ACCUSER` pour répondre
  au débrief final et obtenir votre score.

Indice de départ : Laurent tient à ses grands crus. Trouvez sa bouteille et voyez
ce qu'il laisse échapper.

## Architecture

```
data/scenario.js    scénario complet, indices, déclencheurs et barème (serveur uniquement)
server/             Express, validation, flags, prompts, streaming, débrief et voix
public/             interface statique ASCII (HTML/CSS/JS ESM, sans étape de build)
test/               tests Vitest unitaires et de routes
docs/superpowers/   décisions de conception et plans historiques
```

Le navigateur envoie un journal de gestes, pas des droits ou des flags. Le serveur
rejoue ce journal, applique les préconditions d'inventaire et de scénario, puis
construit le prompt avec les seules connaissances légitimement débloquées. Le
scénario complet, la solution, le barème et les révélations restent donc côté
serveur.

Les routes publiques sont :

- `GET /api/scenario` : vue sans secret du scénario ;
- `POST /api/examiner` : description contextualisée d'un objet ;
- `POST /api/chat` : réponse Claude en Server-Sent Events ;
- `POST /api/debrief` : notation finale ;
- `POST /api/voix` : MP3 ElevenLabs, si configuré.

## Modifier l'enquête

Le contenu est centralisé dans [`data/scenario.js`](data/scenario.js) : personnage,
zones, objets, connaissances conditionnelles, déclencheurs, préconditions et
questions de débrief. Gardez les secrets dans ce fichier et ajoutez les tests qui
garantissent qu'ils ne figurent pas dans la vue publique ni dans un prompt trop tôt.

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
instructions) et 75 % (branches). La dernière vérification locale a passé les 157
tests, avec 94,79 % de lignes et 84,55 % de branches couvertes.

## Feuille de route

La source de vérité est [BACKLOG.md](BACKLOG.md). Les specs et plans livrés sont
archivés dans `docs/superpowers/`; l'historique des changements reste dans git et
les pull requests.

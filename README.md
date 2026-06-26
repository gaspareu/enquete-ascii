# Enquête ASCII — huis clos alimenté par un LLM

Petit jeu d'enquête web rétro. Une pièce vue en plan 3×3 : au centre, un
interlocuteur ; autour, des zones à fouiller. Le but est de **confondre le
meurtrier** grâce aux indices trouvés et au dialogue. La particularité : ce que
le personnage « sait » évolue selon vos actions. Tant que vous ne lui avez pas
offert les chocolats, il ignore où se cache le code du coffre ; une fois amadoué,
il peut vous aiguiller.

Le dialogue est joué par Claude (modèle Sonnet 4.6 par défaut).

## Prérequis

- [Node.js](https://nodejs.org) 18 ou plus (testé sur Node 22).
- Une clé API Anthropic (pour le dialogue) : <https://console.anthropic.com>.

## Installation

```bash
npm install
```

## Configuration

Copiez le modèle d'environnement et renseignez votre clé :

```bash
cp .env.example .env
```

Puis ouvrez `.env` et complétez :

```
ANTHROPIC_API_KEY=sk-ant-...   # votre clé
MODEL=claude-sonnet-4-6        # modèle utilisé (modifiable)
PORT=3000
```

La clé reste **côté serveur** : elle n'est jamais envoyée au navigateur.
Le fichier `.env` est ignoré par git (voir `.gitignore`).

> Sans clé, le jeu se lance quand même : vous pouvez fouiller la pièce, mais le
> personnage répondra par un message d'erreur tant que la clé n'est pas configurée.

## Lancer le jeu

```bash
npm start
```

Ouvrez ensuite <http://localhost:3000>.

## Comment jouer

- **Plan (à droite)** : cliquez une direction (N, E, S, O…) pour fouiller cette
  zone. Vous pouvez y *examiner* ou *ramasser* des objets.
- **Sac (à droite)** : cliquez un objet pour l'*examiner* ou le *donner* au
  personnage.
- **Dialogue (en bas)** : tapez vos questions. Le personnage reste dans son rôle.
- **Accuser** : quand vous pensez tenir le coupable et la preuve, cliquez
  `⚖ ACCUSER`.

Indice : le personnage cherche ses chocolats. Trouvez-les, donnez-les-lui, et
écoutez ce qu'il laisse échapper…

## Modifier l'enquête

Tout le scénario est dans [`data/scenario.js`](data/scenario.js), éditable à la
main, sans toucher au reste du code :

- `personnage` : nom, personnalité, faits connus de tous.
- `zones` : les 8 directions et les objets qu'elles contiennent.
- `objets` : nom, description (révélée à l'examen), ramassable ou non.
- `connaissances` : ce que le personnage ne dit que sous condition (`requiert`).
- `declencheurs` : quel geste (`ramasser`/`donner`/`examiner` + cible) débloque
  quel flag.
- `solution` : qui est coupable et quelles preuves valident l'accusation.

## Tests

```bash
npm test
```

Couvre la logique d'état, la construction du prompt (un secret verrouillé n'y
apparaît jamais), la validation des entrées, l'accusation et le rendu.

## Architecture

- `server/` : serveur Node/Express. Sert le front et expose `/api/scenario`,
  `/api/examiner`, `/api/chat`, `/api/accuser`. Reconstruit le prompt à chaque
  tour avec **uniquement** les connaissances débloquées (un secret non débloqué
  n'est jamais envoyé au modèle).
- `public/` : front statique en ASCII (HTML/CSS/JS, sans build).
- `data/scenario.js` : le contenu de l'enquête.

# T-05 · Streaming SSE des réponses du personnage — design

Statut : validé (design). Branche : `feat/streaming-sse-t05`.

## Objectif

Diffuser la réponse du LLM en flux (SSE) pour un affichage progressif, au lieu
d'attendre la réponse complète. Critère d'acceptation du backlog : le texte
s'affiche au fil de l'eau ; dégradation propre si erreur.

Choix d'affichage retenu : **streaming brut** — le texte apparaît par à‑coups au
rythme du flux, avec un caret `▌`. L'effet « machine à écrire » simulé est
supprimé (il devient du code mort).

## Transport

**SSE sur POST.** `/api/chat` reste un POST (son corps porte `message`, `gestes`,
`historique`, `note` — l'historique est trop volumineux pour une query string, et
le backend doit rester sans état, ce qui exclut `EventSource`/GET + store de jobs).
Le serveur répond en `text/event-stream` et émet des trames à événements nommés :

- `event: delta` + `data: {"texte": "<morceau>"}` — incrément de texte.
- `event: fin` + `data: {}` — fin normale.
- `event: erreur` + `data: {"erreur": "<message neutre>"}` — erreur survenue
  **pendant** le flux.

Le `data:` est toujours du JSON (les sauts de ligne du texte sont alors échappés,
donc une trame tient sur une ligne).

## Découpage des erreurs (dégradation propre)

- **Pré‑vol** (avant tout octet streamé) → codes HTTP + corps JSON, comme
  aujourd'hui :
  - requête invalide → `400 {erreur}` ;
  - client Claude absent → `503 {erreur}` (message mentionnant `ANTHROPIC_API_KEY`) ;
  - échec de dérivation des flags / construction du prompt → `502 {erreur}`.
- **En cours de flux** (en‑têtes 200 déjà envoyées) → trame `event: erreur` puis
  `res.end()`. Le serveur loggue sans secret ; le client garde le texte partiel et
  ajoute une note discrète.

## Backend

### `server/claude.js`
- Factoriser le mapping `historique → messages` (helper commun à `repondre`).
- Nouvelle fonction :
  ```js
  export async function repondreEnFlux(
    client,
    { system, historique = [], message, model, maxTokens = 512 },
    onTexte,
  ) { /* client.messages.stream(...) → onTexte(delta.text) → await stream.finalMessage() */ }
  ```
  Itère les événements du flux ; sur chaque `content_block_delta` de type
  `text_delta`, appelle `onTexte(event.delta.text)`. Termine par
  `await stream.finalMessage()` (clôt proprement et fait remonter les erreurs).
- `/chat` étant le seul consommateur de `repondre`, celui‑ci devient mort après la
  migration : on **retire `repondre` et ses tests** dans ce lot (règle « pas de code
  mort »). On retire aussi `texteDeReponse` s'il n'est plus référencé.

### `server/chat.js`
- `/chat` injecte `repondreFluxFn = repondreEnFlux` (comme `repondreFn` aujourd'hui).
- Séquence :
  1. `valideRequeteChat` → 400 JSON si KO.
  2. `client` null → 503 JSON.
  3. `deriverFlags(scenario, gestes)` + `construitPrompt(scenario, flags, note)`
     (anti‑triche **inchangé**) ; échec → 502 JSON.
  4. `res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" })`
     + `res.flushHeaders()`.
  5. `await repondreFluxFn(client, { system, historique, message, model }, (texte) =>
     res.write('event: delta\ndata: ' + JSON.stringify({ texte }) + '\n\n'))`,
     puis `event: fin`.
  6. `catch` → log neutre + `event: erreur` ; `finally` → `res.end()`.
  7. `req.on("close", …)` → abort du flux SDK (évite une fuite si le client part).

L'anti‑triche est intact : le client n'envoie que des gestes, le serveur dérive
les flags avant de streamer.

## Frontend

### `public/sse.js` (pur, testable, sans DOM)
- `decoupeTrames(tampon) → { trames, reste }` : découpe sur `\n\n`, parse les
  lignes `event:` / `data:` de chaque trame complète, renvoie les trames `{ event,
  data }` et le reste non terminé à reporter sur le prochain chunk.

### `public/game.js`
- Handler `submit` :
  - `fetch("/api/chat", …)` ; si `!rep.ok` → `await rep.json()` → narration `{erreur}`.
  - Sinon lecture en flux : `rep.body.getReader()` + `TextDecoder`, accumulation
    via `decoupeTrames`. Tampon de texte local `tampon`.
    - 1er `delta` : arrêter l'indicateur « réfléchit… ».
    - chaque `delta` : `tampon += texte` ; peindre
      `rendreDialogue([...etat.historique, { role:"personnage", texte: tampon }], nom) + "▌"`
      + scroll. (Immuable : on ne commit pas encore dans `etat`.)
    - `fin` : `etat = ajouterDialogue(etat, "personnage", tampon)` ; rendu sans caret.
    - `erreur` : conserver le partiel + note discrète (ex. « (communication interrompue) »).
  - `catch` réseau : narration « injoignable (réseau) ».
- **Code mort retiré** : `animerDernierTour`, `minuteurFrappe`, `annulerFrappe`,
  `dureeFrappeMs`, le handler « clic pour sauter la frappe ».

### `public/render.js`
- Retirer `dialoguePartiel` (servait uniquement la frappe simulée) et réimplémenter
  `rendreDialogue` directement (sans paramètre de troncature).

### Design System
- Retirer le token `--duree-frappe-ms` de `public/tokens.css` (devenu inutilisé) et
  mettre à jour `public/DESIGN-SYSTEM.md` en conséquence.
- Aucune animation CSS nouvelle (le caret `▌` est un caractère statique repeint) →
  rien à neutraliser sous `prefers-reduced-motion` ; l'affichage progressif découle
  naturellement de l'arrivée des chunks.

## Tests (TDD, ≥ seuils de couverture)

- `test/claude.test.js` : faux client dont `messages.stream` renvoie un objet
  itérable async + `finalMessage()` ; vérifier les appels `onTexte` (par morceau) et
  le texte assemblé.
- `test/sse.test.js` : `decoupeTrames` — trame complète, trame partielle reportée,
  plusieurs trames dans un chunk, `data:` JSON avec saut de ligne échappé.
- `test/routes.test.js` :
  - `/chat` valide → `200`, `content-type` contient `text/event-stream`, corps
    contient les trames `data:` puis `event: fin` (`repondreFluxFn` injecté qui
    appelle `onTexte` avec des morceaux) ;
  - 400 (requête invalide) et 503 (client null) **inchangés** (JSON) ;
  - anti‑triche : `args.system` passé à `repondreFluxFn` (dé)verrouille la
    connaissance selon le journal de gestes ;
  - erreur du `repondreFluxFn` → `200` + corps contenant `event: erreur` (le flux
    est déjà ouvert), log non avalé.
- `test/render.test.js` : adapter aux signatures simplifiées (`dialoguePartiel`
  retiré).
- `test/game.test.js` : `fetch` mocké renvoyant `{ ok:true, body: <ReadableStream> }`
  qui émet des trames SSE encodées ; vérifier l'affichage progressif (peinture du
  partiel) et l'état final commit après `fin` ; cas `erreur` en flux (partiel
  conservé + note).

## Hors périmètre

- Pas de reconnexion automatique ni de fallback non‑streamé.
- Aucun changement du contenu du scénario (`data/scenario.js`).

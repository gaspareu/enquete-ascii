# T-07 · Mode vocal (ElevenLabs TTS + micro navigateur)

_Spec de conception — 2026-07-02_

## Contexte

Le jeu est un huis clos texte : le joueur tape au clavier, le personnage (Claude)
répond en **streaming** via `POST /api/chat` (deltas SSE peints au fil de l'eau,
cf. `public/game.js`). On veut un « mode vocal » : entendre le personnage **et**
pouvoir lui parler au micro, sans remettre en cause l'architecture actuelle
(backend sans état, secrets côté serveur, front non fiable).

## Décisions de cadrage

| Sujet | Décision |
|---|---|
| Périmètre | **Sortie voix (perso) + entrée micro (joueur)**. |
| Synthèse (TTS) | **ElevenLabs**, via un proxy serveur qui détient la clé. |
| Transcription (STT) | **Web Speech API** du navigateur — gratuite, aucun audio ne quitte le navigateur. |
| Déclenchement voix | **Opt-in** : bouton « Voix » éteint par défaut ; une fois activé, **lecture auto** de chaque réplique. |
| Latence TTS | **Réplique complète** puis synthèse (approche A). Pas de streaming audio pour le MVP. |

## Approche retenue — A : réplique complète, proxy serveur → audio unique

Le front attend la trame `fin` du flux SSE, envoie le texte complet de la réplique
à un nouvel endpoint `POST /api/voix`, reçoit un MP3 et le joue. Simple, testable
(wrapper mockable comme `claude.js`), sans état, coûts lisibles (1 appel = 1 réplique).

Alternatives écartées (évolutions possibles, pas pour le MVP) :
- **B — streaming audio au fil de l'eau** : latence perçue minimale mais complexité
  forte (découpage en phrases, file audio, synchro texte/voix).
- **C — trames audio dans le flux `/api/chat`** : couple synthèse et dialogue,
  alourdit le routeur aujourd'hui purement texte.

## Architecture & composants

### Backend

- **`server/voix.js`** *(nouveau)* — wrapper mince autour de l'API ElevenLabs TTS.
  Le client HTTP (`fetch`) est **injecté** pour rester testable sans réseau, comme
  `server/claude.js`. Signature : `synthetiser(client, { texte, voiceId, model }) → mp3 (Buffer/stream)`.
- **`server/chat.js`** — nouvelle route `POST /api/voix` :
  1. `valideRequeteVoix(req.body)` → 400 si invalide ;
  2. config voix absente (pas de clé) → 503 avec message clair (comme `/chat`) ;
  3. appel wrapper → renvoie `Content-Type: audio/mpeg` ;
  4. erreur upstream → 502 « voix indisponible ».
- **`server/validate.js`** — `valideRequeteVoix()` : `texte` est une string non vide,
  **longueur plafonnée** (garde-fou coût/abus ; plafond ≈ 1000 caractères, cohérent
  avec `max_tokens: 512` du dialogue).
- **`server/index.js` + `.env.example`** — nouvelles variables d'environnement.
  La config voix (client + `voiceId` + `model`) n'est construite **que si**
  `ELEVENLABS_API_KEY` est présente ; sinon `/api/voix` répond 503. Injection dans
  `creerRouteur` sur le même modèle que `client`/`model` Anthropic.

### Frontend

- **`public/micro.js`** *(nouveau)* — wrapper Web Speech API (`SpeechRecognition`) :
  détection de support, `demarrer()/arreter()`, callback de transcription, langue
  `fr-FR`. Partie décisionnelle pure isolée du DOM autant que possible.
- **`public/voix.js`** *(nouveau)* — logique du mode vocal : état on/off, construction
  de la requête `/api/voix`, décision de lecture. Le `play` audio est le **seul**
  side-effect, isolé pour rester fidèle au découpage pur (`state.js`/`render.js`) vs
  câblage (`game.js`).
- **`public/game.js`** — câblage DOM :
  - bouton **« 🔊 Voix »** (off par défaut) qui bascule le mode ;
  - à la trame `fin` de `consommerFlux`, si mode vocal actif → synthèse + lecture ;
  - bouton **« 🎙 Parler »** qui remplit `elInput` via `micro.js` (le joueur relit/édite
    avant d'envoyer ; la soumission passe par le formulaire **existant**).
- **`public/index.html` + `tokens.css`/`style.css` + `DESIGN-SYSTEM.md`** — les deux
  boutons et leurs états (actif / inactif / en écoute), stylés **via tokens
  uniquement** ; l'indicateur « en écoute » (animation) est neutralisé sous
  `@media (prefers-reduced-motion: reduce)`. Doc DS tenue à jour.

## Flux de données

**Voix (sortie)**
```
game.js (trame « fin ») → POST /api/voix { texte }
  → valideRequeteVoix → voix.js → ElevenLabs → mp3
  → réponse audio/mpeg → new Audio(url).play()
```
Le texte envoyé est la réplique du personnage, **déjà affichée et publique** :
aucun secret de scénario ne sort par ce canal.

**Micro (entrée)**
```
bouton « Parler » → SpeechRecognition (navigateur) → transcript
  → elInput.value → soumission du formulaire existant → /api/chat
```
Aucun nouvel endpoint : le STT n'est qu'une source de saisie pour le champ message.

## Configuration

`.env.example` complété (clé côté serveur uniquement) :

| Variable | Rôle | Défaut |
|---|---|---|
| `ELEVENLABS_API_KEY` | Clé API ElevenLabs (serveur) | _(absent → voix désactivée, 503)_ |
| `ELEVENLABS_VOICE_ID` | Voix utilisée pour le personnage | à fixer (voix FR) |
| `ELEVENLABS_MODEL` | Modèle TTS | valeur multilingue FR, **à confirmer via la doc ElevenLabs en phase plan** |

## Sécurité & RGPD

- **Secrets** : `ELEVENLABS_API_KEY` reste côté serveur, jamais envoyée au navigateur
  (comme `ANTHROPIC_API_KEY`).
- **Audio joueur** : la Web Speech API traite l'audio dans le navigateur ; il **ne
  transite pas par notre serveur**. Nuance à documenter honnêtement dans le README :
  certains navigateurs (Chrome) routent l'audio via les serveurs de l'éditeur —
  hors de notre contrôle, à signaler à l'utilisateur.
- **Anti-abus / coût** : `/api/voix` accepte un texte arbitraire (pas de secret
  exposé), mais la longueur est plafonnée pour éviter de vider le quota ElevenLabs.
- **Front non fiable** : aucune décision de jeu ne dépend de la voix.

## Gestion d'erreurs & dégradation gracieuse

La voix est un **plus, jamais un bloquant**. Le jeu reste entièrement jouable au
clavier + texte si :
- `ELEVENLABS_API_KEY` absente → `/api/voix` 503, le bouton Voix affiche un état
  indisponible ;
- synthèse KO (502) → on log côté serveur, le tour continue en texte seul ;
- Web Speech non supporté ou permission micro refusée → bouton « Parler » caché ou
  désactivé avec message clair ; le clavier reste disponible.

## Tests (TDD, couverture ≥ seuils)

- **`test/voix.test.js`** — wrapper `synthetiser` avec client injecté mocké : succès
  (renvoie l'audio), erreur upstream (propage/échoue proprement).
- **`test/chat.test.js`** *(extension)* — route `/api/voix` : 400 (texte invalide),
  503 (config absente), 200 + `audio/mpeg` (succès), 502 (upstream KO).
- **`test/validate.test.js`** *(extension)* — `valideRequeteVoix` : rejette
  non-string, vide, trop long ; accepte un texte valide.
- **Front** — logique pure de `micro.js`/`voix.js` (détection support, décision de
  lecture, construction de requête). L'API `Audio`/`SpeechRecognition` du navigateur
  est mockée ; le side-effect `play` n'est pas testé unitairement.

## Hors périmètre (YAGNI)

- Streaming audio au fil de l'eau (approches B/C).
- STT côté serveur (ElevenLabs Scribe).
- Sélecteur de voix ou multi-voix côté joueur.
- Cache des audios déjà synthétisés.

## Critère d'acceptation

1. Sans `ELEVENLABS_API_KEY`, le jeu démarre et se joue au clavier ; le bouton Voix
   signale l'indisponibilité, `/api/voix` répond 503.
2. Avec la clé, activer « Voix » fait lire chaque nouvelle réplique du personnage ;
   la désactiver rétablit le silence. Aucun appel ElevenLabs tant que le mode est off.
3. Le bouton « Parler » (sur navigateur compatible) transcrit la parole du joueur
   dans le champ message ; le joueur valide l'envoi via le formulaire existant.
4. Sur navigateur sans Web Speech, le bouton « Parler » est masqué/désactivé sans
   casser le reste de l'UI.
5. Tests verts, couverture ≥ seuils, aucune valeur brute de style hors tokens.

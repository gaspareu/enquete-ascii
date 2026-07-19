# Mode vocal (ElevenLabs TTS + micro navigateur) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner une voix au personnage (ElevenLabs TTS, opt-in + lecture auto) et permettre au joueur de lui parler au micro (Web Speech API navigateur), sans casser le jeu clavier existant.

**Architecture:** Un nouvel endpoint `POST /api/voix` proxie ElevenLabs (clé côté serveur) et renvoie un MP3 pour la réplique complète du personnage (approche A de la spec). Le front ajoute un mode vocal opt-in qui, une fois activé, lit chaque réplique à la trame `fin` du flux SSE, et un bouton micro qui remplit le champ message via Web Speech. Toutes les briques réseau/DOM restent isolées derrière des wrappers injectables, comme `server/claude.js`.

**Tech Stack:** Node 18+ / Express 5 (ESM), Vitest + supertest + jsdom, API REST ElevenLabs `text-to-speech`, Web Speech API (`SpeechRecognition`).

**Spec de référence :** `docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md`

**Conventions rappelées :** immutabilité, fichiers courts (< 400 lignes), français partout, tout style via un token de `tokens.css`, TDD strict (test rouge → minimal → refactor), commits conventionnels.

---

## File Structure

**Backend**
- Create `server/voix.js` — wrapper mince ElevenLabs TTS (`fetch` injecté). Une responsabilité : transformer un texte en audio MP3.
- Modify `server/validate.js` — ajoute `valideRequeteVoix(body)` (boundary HTTP).
- Modify `server/chat.js` — route `POST /api/voix` + nouveaux paramètres injectés (`voix`, `synthetiserFn`).
- Modify `server/index.js` — construit la config `voix` depuis l'environnement, l'injecte dans le routeur.
- Modify `.env.example` — nouvelles variables ElevenLabs.

**Frontend**
- Create `public/micro.js` — wrapper Web Speech API (détection + reconnaissance), sans dépendance au reste.
- Create `public/voix.js` — logique du mode vocal (état on/off, appel `/api/voix`, décision de lecture) ; le `play` est le seul side-effect, injecté.
- Modify `public/index.html` — boutons micro + voix dans le formulaire de saisie.
- Modify `public/game.js` — câblage : toggle voix, déclenchement à la trame `fin`, bouton micro.
- Modify `public/style.css` + `public/DESIGN-SYSTEM.md` — styles des deux boutons (états actif/écoute) via tokens.

**Tests**
- Create `test/voix.test.js` — wrapper serveur.
- Create `test/micro.test.js` — wrapper Web Speech.
- Create `test/voix-front.test.js` — logique du mode vocal.
- Modify `test/validate.test.js` — `valideRequeteVoix`.
- Modify `test/routes.test.js` — route `/api/voix`.
- Modify `test/game.test.js` — câblage des boutons.

**Docs**
- Modify `README.md` — note RGPD sur le micro + config des variables.

---

## Task 1 : Wrapper serveur ElevenLabs (`server/voix.js`)

**Files:**
- Create: `server/voix.js`
- Test: `test/voix.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/voix.test.js
import { describe, test, expect, vi } from "vitest";
import { synthetiserVoix } from "../server/voix.js";

// Faux fetch : renvoie la réponse fournie et journalise l'appel.
function fauxFetch(reponse) {
  return vi.fn(async () => reponse);
}

describe("synthetiserVoix", () => {
  test("appelle l'endpoint ElevenLabs (voix, modèle, clé) et renvoie l'audio en Buffer", async () => {
    const fetchFn = fauxFetch({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const audio = await synthetiserVoix(fetchFn, {
      texte: "Bonjour",
      voiceId: "voix-x",
      model: "eleven_multilingual_v2",
      apiKey: "cle-x",
    });
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect([...audio]).toEqual([1, 2, 3]);

    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toContain("/v1/text-to-speech/voix-x");
    expect(opts.method).toBe("POST");
    expect(opts.headers["xi-api-key"]).toBe("cle-x");
    expect(JSON.parse(opts.body)).toEqual({
      text: "Bonjour",
      model_id: "eleven_multilingual_v2",
    });
  });

  test("statut non-OK : lève une erreur portant le code", async () => {
    const fetchFn = fauxFetch({ ok: false, status: 401 });
    await expect(
      synthetiserVoix(fetchFn, { texte: "x", voiceId: "v", model: "m", apiKey: "k" }),
    ).rejects.toThrow("401");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/voix.test.js`
Expected: FAIL — `synthetiserVoix` introuvable (module inexistant).

- [ ] **Step 3: Write minimal implementation**

```js
// server/voix.js
// Wrapper mince autour de l'API REST ElevenLabs (text-to-speech). Le `fetch` est
// injecté pour rester testable sans réseau (même esprit que server/claude.js).
// La clé API reste côté serveur : ce module n'est jamais chargé par le navigateur.

const BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const FORMAT = "mp3_44100_128";

// Transforme `texte` en audio MP3 via ElevenLabs. Renvoie un Buffer ; lève si la
// réponse HTTP n'est pas OK (la route appelante traduira en 502).
export async function synthetiserVoix(fetchFn, { texte, voiceId, model, apiKey }) {
  const rep = await fetchFn(`${BASE}/${voiceId}?output_format=${FORMAT}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: texte, model_id: model }),
  });
  if (!rep.ok) {
    throw new Error(`ElevenLabs a répondu ${rep.status}`);
  }
  const buffer = await rep.arrayBuffer();
  return Buffer.from(buffer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/voix.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/voix.js test/voix.test.js
git commit -m "feat: wrapper serveur ElevenLabs (synthèse vocale) (T-07)"
```

---

## Task 2 : Validation `valideRequeteVoix` (`server/validate.js`)

**Files:**
- Modify: `server/validate.js`
- Test: `test/validate.test.js`

- [ ] **Step 1: Write the failing test** (ajouter au fichier existant)

```js
// test/validate.test.js — ajouter ce bloc et importer valideRequeteVoix
import { valideRequeteVoix } from "../server/validate.js";

describe("valideRequeteVoix", () => {
  test("texte valide : ok + texte trimmé", () => {
    expect(valideRequeteVoix({ texte: "  Bonjour  " })).toEqual({
      ok: true,
      valeur: { texte: "Bonjour" },
    });
  });

  test("corps non-objet : refus", () => {
    expect(valideRequeteVoix(null).ok).toBe(false);
  });

  test("texte absent ou vide : refus", () => {
    expect(valideRequeteVoix({}).ok).toBe(false);
    expect(valideRequeteVoix({ texte: "   " }).ok).toBe(false);
  });

  test("texte trop long : refus", () => {
    expect(valideRequeteVoix({ texte: "a".repeat(2001) }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/validate.test.js`
Expected: FAIL — `valideRequeteVoix` n'est pas exporté.

- [ ] **Step 3: Write minimal implementation** (dans `server/validate.js`)

Ajouter la constante près des autres (ligne ~9) :

```js
const MAX_TEXTE_VOIX = 2000; // réplique bornée par max_tokens du dialogue (~512 tokens)
```

Ajouter la fonction en fin de fichier :

```js
// Valide le texte à vocaliser (T-07). Le texte est la réplique du personnage
// (déjà publique) ; on borne surtout la longueur pour éviter d'abuser du quota TTS.
export function valideRequeteVoix(body) {
  if (!estObjet(body)) {
    return { ok: false, erreur: "Requête invalide." };
  }
  const texte = typeof body.texte === "string" ? body.texte.trim() : "";
  if (texte.length === 0) {
    return { ok: false, erreur: "Le texte est vide." };
  }
  if (texte.length > MAX_TEXTE_VOIX) {
    return { ok: false, erreur: "Le texte est trop long." };
  }
  return { ok: true, valeur: { texte } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/validate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/validate.js test/validate.test.js
git commit -m "feat: validation de la requête de synthèse vocale (T-07)"
```

---

## Task 3 : Route `POST /api/voix` (`server/chat.js`)

**Files:**
- Modify: `server/chat.js`
- Test: `test/routes.test.js`

- [ ] **Step 1: Write the failing test** (ajouter à `test/routes.test.js`)

Dans `faireApp`, ajouter aux valeurs injectées par défaut (à côté de `repondreFluxFn`) :

```js
      voix: { apiKey: "k", voiceId: "v", model: "m" },
      synthetiserFn: async () => Buffer.from([9, 9, 9]),
```

Ajouter ce bloc de tests :

```js
describe("POST /voix", () => {
  test("texte valide : 200 audio/mpeg avec l'audio synthétisé", async () => {
    const res = await request(faireApp())
      .post("/api/voix")
      .send({ texte: "Bonjour à vous." });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBe(3);
  });

  test("texte invalide : 400 JSON", async () => {
    const res = await request(faireApp()).post("/api/voix").send({ texte: "" });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("voix non configurée : 503 JSON", async () => {
    const res = await request(faireApp({ voix: null }))
      .post("/api/voix")
      .send({ texte: "Bonjour" });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ELEVENLABS_API_KEY");
  });

  test("échec de synthèse : 502 (non avalé)", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const synthetiserFn = async () => {
      throw new Error("TTS HS");
    };
    const res = await request(faireApp({ synthetiserFn }))
      .post("/api/voix")
      .send({ texte: "Bonjour" });
    expect(res.status).toBe(502);
    expect(typeof res.body.erreur).toBe("string");
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });

  test("passe texte, voix, modèle et clé au wrapper", async () => {
    const synthetiserFn = vi.fn(async () => Buffer.from([1]));
    await request(faireApp({ synthetiserFn }))
      .post("/api/voix")
      .send({ texte: "  Salut  " });
    expect(synthetiserFn).toHaveBeenCalledOnce();
    const [, args] = synthetiserFn.mock.calls[0];
    expect(args).toMatchObject({ texte: "Salut", voiceId: "v", model: "m", apiKey: "k" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes.test.js`
Expected: FAIL — la route `/api/voix` renvoie 404 (non montée).

- [ ] **Step 3: Write minimal implementation** (dans `server/chat.js`)

Étendre l'import de validation :

```js
import { valideRequeteChat, valideGestes, valideDebrief, valideRequeteVoix } from "./validate.js";
```

Ajouter l'import du wrapper (près de `import { repondreEnFlux } from "./claude.js";`) :

```js
import { synthetiserVoix } from "./voix.js";
```

Étendre la signature de `creerRouteur` :

```js
export function creerRouteur({
  scenario,
  ciblesConnues,
  client,
  model,
  voix = null,
  repondreFluxFn = repondreEnFlux,
  noterFn = noterDebrief,
  synthetiserFn = synthetiserVoix,
}) {
```

Ajouter la route avant `return routeur;` :

```js
  // Synthèse vocale (T-07). Le texte reçu est la réplique du personnage, déjà
  // affichée côté client : aucun secret ne sort par ce canal. La clé ElevenLabs
  // reste côté serveur (config `voix`). Renvoie du MP3 binaire (audio/mpeg).
  routeur.post("/voix", async (req, res) => {
    const v = valideRequeteVoix(req.body);
    if (!v.ok) {
      return res.status(400).json({ erreur: v.erreur });
    }
    if (!voix) {
      return res.status(503).json({
        erreur: "Voix non configurée. Renseignez ELEVENLABS_API_KEY dans .env.",
      });
    }
    try {
      const audio = await synthetiserFn(fetch, {
        texte: v.valeur.texte,
        voiceId: voix.voiceId,
        model: voix.model,
        apiKey: voix.apiKey,
      });
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audio);
    } catch (err) {
      console.error("Erreur synthèse vocale:", err?.message ?? err);
      res.status(502).json({ erreur: "La voix est indisponible pour le moment." });
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/chat.js test/routes.test.js
git commit -m "feat: route POST /api/voix (proxy synthèse vocale) (T-07)"
```

---

## Task 4 : Câblage serveur + config d'environnement

**Files:**
- Modify: `server/index.js`
- Modify: `.env.example`

_(Pas de test unitaire dédié : `index.js` est le bootstrap ; il est couvert par le démarrage. Vérification manuelle en fin de tâche.)_

- [ ] **Step 1: Construire la config `voix` dans `server/index.js`**

Après le bloc qui initialise `client` (après la ligne ~30), ajouter :

```js
// Voix (T-07) : n'est active que si la clé ET la voix sont fournies. Sinon la
// route /api/voix renvoie 503 et le jeu reste jouable au clavier + texte.
let voix = null;
if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
  voix = {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    model: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
  };
} else {
  console.warn("ELEVENLABS_API_KEY/VOICE_ID absents : la voix sera indisponible.");
}
```

Injecter `voix` dans `creerRouteur` :

```js
  creerRouteur({
    scenario,
    ciblesConnues: ciblesConnues(),
    client,
    model: process.env.MODEL || "claude-sonnet-4-6",
    voix,
  }),
```

- [ ] **Step 2: Compléter `.env.example`**

Ajouter à la fin du fichier :

```
# Voix (optionnel) — synthèse vocale du personnage via ElevenLabs.
# Sans ces variables, le jeu se joue normalement ; seule la voix est désactivée.
# La clé reste côté serveur, jamais exposée au navigateur.
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL=eleven_multilingual_v2
```

- [ ] **Step 3: Vérifier que la suite reste verte**

Run: `npm test`
Expected: PASS (aucune régression ; les nouveaux tests des tâches 1-3 passent).

- [ ] **Step 4: Commit**

```bash
git add server/index.js .env.example
git commit -m "feat: config voix (ElevenLabs) côté serveur + .env.example (T-07)"
```

---

## Task 5 : Wrapper micro navigateur (`public/micro.js`)

**Files:**
- Create: `public/micro.js`
- Test: `test/micro.test.js`

- [ ] **Step 1: Write the failing test**

```js
// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from "vitest";
import { microDisponible, creerMicro } from "../public/micro.js";

// Faux SpeechRecognition : mémorise la config, expose start/stop et permet de
// déclencher un "result" et un "end" à la main.
function poserFauxReco() {
  const instances = [];
  class FauxReco {
    constructor() {
      this.lang = "";
      this.ecouteurs = {};
      this.start = vi.fn();
      this.stop = vi.fn();
      instances.push(this);
    }
    addEventListener(type, cb) {
      this.ecouteurs[type] = cb;
    }
  }
  window.SpeechRecognition = FauxReco;
  return instances;
}

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe("microDisponible", () => {
  test("vrai quand SpeechRecognition est présent", () => {
    poserFauxReco();
    expect(microDisponible()).toBe(true);
  });
  test("faux quand aucune API n'est disponible", () => {
    expect(microDisponible()).toBe(false);
  });
});

describe("creerMicro", () => {
  test("configure la langue et relaie la transcription puis la fin", () => {
    const instances = poserFauxReco();
    const onTexte = vi.fn();
    const onFin = vi.fn();
    const micro = creerMicro({ langue: "fr-FR", onTexte, onFin });

    micro.demarrer();
    const reco = instances[0];
    expect(reco.lang).toBe("fr-FR");
    expect(reco.start).toHaveBeenCalled();

    reco.ecouteurs.result({ results: [[{ transcript: "bonjour victor" }]] });
    expect(onTexte).toHaveBeenCalledWith("bonjour victor");

    reco.ecouteurs.end();
    expect(onFin).toHaveBeenCalled();

    micro.arreter();
    expect(reco.stop).toHaveBeenCalled();
  });

  test("renvoie null si l'API n'est pas disponible", () => {
    expect(creerMicro({})).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/micro.test.js`
Expected: FAIL — module `public/micro.js` inexistant.

- [ ] **Step 3: Write minimal implementation**

```js
// public/micro.js
// Wrapper minimal de la reconnaissance vocale du navigateur (Web Speech API).
// Aucun audio ne quitte le navigateur via NOTRE serveur (cf. note RGPD du README).
// Isolé du DOM : reçoit ses callbacks, ne connaît ni le champ de saisie ni game.js.

function ctorReco() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Le navigateur sait-il transcrire la parole ?
export function microDisponible() {
  return ctorReco() !== null;
}

// Crée un micro contrôlable. Renvoie { demarrer, arreter } ou null si non supporté.
// onTexte(transcript) est appelé au premier résultat ; onFin() à la fin d'écoute.
export function creerMicro({ langue = "fr-FR", onTexte, onFin } = {}) {
  const Ctor = ctorReco();
  if (!Ctor) return null;
  const reco = new Ctor();
  reco.lang = langue;
  reco.interimResults = false;
  reco.maxAlternatives = 1;
  reco.addEventListener("result", (e) => {
    const transcript = e.results?.[0]?.[0]?.transcript ?? "";
    if (transcript) onTexte?.(transcript);
  });
  reco.addEventListener("end", () => onFin?.());
  return {
    demarrer: () => reco.start(),
    arreter: () => reco.stop(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/micro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/micro.js test/micro.test.js
git commit -m "feat: wrapper micro navigateur (Web Speech API) (T-07)"
```

---

## Task 6 : Logique du mode vocal (`public/voix.js`)

**Files:**
- Create: `public/voix.js`
- Test: `test/voix-front.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, test, expect, vi } from "vitest";
import { creerModeVocal } from "../public/voix.js";

const repAudio = (ok = true) => ({ ok, blob: async () => new Blob(["audio"]) });

describe("creerModeVocal", () => {
  test("inactif par défaut : dire() ne fetch pas et ne joue pas", async () => {
    const fetchFn = vi.fn(async () => repAudio());
    const jouer = vi.fn();
    const mv = creerModeVocal({ fetchFn, jouer });
    expect(mv.estActif()).toBe(false);
    await mv.dire("Bonjour");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(jouer).not.toHaveBeenCalled();
  });

  test("basculer active/désactive et renvoie le nouvel état", () => {
    const mv = creerModeVocal({ fetchFn: vi.fn(), jouer: vi.fn() });
    expect(mv.basculer()).toBe(true);
    expect(mv.estActif()).toBe(true);
    expect(mv.basculer()).toBe(false);
  });

  test("actif : dire() poste le texte à /api/voix puis joue le blob", async () => {
    const fetchFn = vi.fn(async () => repAudio());
    const jouer = vi.fn();
    const mv = creerModeVocal({ fetchFn, jouer });
    mv.basculer();
    await mv.dire("Bonjour à vous.");
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/voix");
    expect(JSON.parse(opts.body)).toEqual({ texte: "Bonjour à vous." });
    expect(jouer).toHaveBeenCalledOnce();
  });

  test("actif mais texte vide : no-op", async () => {
    const fetchFn = vi.fn(async () => repAudio());
    const mv = creerModeVocal({ fetchFn, jouer: vi.fn() });
    mv.basculer();
    await mv.dire("");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("réponse non-OK : dégradation silencieuse (pas de lecture, pas de throw)", async () => {
    const fetchFn = vi.fn(async () => repAudio(false));
    const jouer = vi.fn();
    const mv = creerModeVocal({ fetchFn, jouer });
    mv.basculer();
    await expect(mv.dire("Bonjour")).resolves.toBeUndefined();
    expect(jouer).not.toHaveBeenCalled();
  });

  test("panne réseau : avalée (le texte reste affiché, pas de throw)", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("réseau");
    });
    const mv = creerModeVocal({ fetchFn, jouer: vi.fn() });
    mv.basculer();
    await expect(mv.dire("Bonjour")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/voix-front.test.js`
Expected: FAIL — module `public/voix.js` inexistant.

- [ ] **Step 3: Write minimal implementation**

```js
// public/voix.js
// Mode vocal du personnage (T-07) : récupère l'audio de la réplique via /api/voix
// et le joue. La voix est un PLUS, jamais un bloquant : toute erreur est avalée
// silencieusement (le texte reste affiché). Le `play` audio est injecté (`jouer`)
// pour garder ce module testable sans API navigateur.

export function creerModeVocal({ fetchFn = fetch, jouer } = {}) {
  let actif = false;
  return {
    estActif: () => actif,
    // Bascule l'état et renvoie la nouvelle valeur (pour mettre à jour le bouton).
    basculer() {
      actif = !actif;
      return actif;
    },
    // Vocalise `texte` si le mode est actif. No-op si inactif ou texte vide.
    async dire(texte) {
      if (!actif || !texte) return;
      try {
        const rep = await fetchFn("/api/voix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texte }),
        });
        if (!rep.ok) return; // dégradation silencieuse
        const blob = await rep.blob();
        jouer(blob);
      } catch {
        // Réseau/TTS indisponible : on garde le texte, sans bruit.
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/voix-front.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/voix.js test/voix-front.test.js
git commit -m "feat: logique front du mode vocal (T-07)"
```

---

## Task 7 : Câblage DOM (`public/index.html` + `public/game.js`)

**Files:**
- Modify: `public/index.html`
- Modify: `public/game.js`
- Test: `test/game.test.js`

- [ ] **Step 1: Write the failing test** (modifier `test/game.test.js`)

Enrichir la constante `MARKUP` — remplacer la ligne du formulaire de saisie par :

```js
  <form id="saisie">
    <input id="message" type="text" />
    <button id="btn-micro" type="button">🎙</button>
    <button id="btn-voix" type="button" aria-pressed="false">🔊</button>
  </form>
```

Dans `monterFetch`, ajouter une route audio avant le `throw` final :

```js
    if (url === "/api/voix") {
      return { ok: true, blob: async () => new Blob(["audio"]) };
    }
```

Ajouter ce bloc de tests (le faux SpeechRecognition est local au bloc) :

```js
describe("mode vocal (T-07)", () => {
  test("le bouton Voix bascule l'état aria-pressed", async () => {
    await charger();
    const btn = $("btn-voix");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    btn.click();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    btn.click();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  test("voix active : la réplique déclenche un appel à /api/voix", async () => {
    // Stubs audio (jsdom n'implémente pas play()).
    global.URL.createObjectURL = () => "blob:x";
    global.URL.revokeObjectURL = () => {};
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    await charger({ chatTrames: tramesDelta("Bonjour.") });
    $("btn-voix").click(); // active la voix

    $("message").value = "Salut";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() =>
      expect(global.fetch.mock.calls.some(([u]) => u === "/api/voix")).toBe(true),
    );
    const appel = global.fetch.mock.calls.find(([u]) => u === "/api/voix");
    expect(JSON.parse(appel[1].body).texte).toContain("Bonjour.");
  });

  test("micro indisponible : le bouton Parler est masqué", async () => {
    await charger(); // pas de SpeechRecognition sur window
    expect($("btn-micro").hidden).toBe(true);
  });

  test("micro disponible : un clic remplit le champ avec la transcription", async () => {
    let reco;
    class FauxReco {
      constructor() {
        this.ecouteurs = {};
        this.start = () => {};
        this.stop = () => {};
        reco = this;
      }
      addEventListener(type, cb) {
        this.ecouteurs[type] = cb;
      }
    }
    window.SpeechRecognition = FauxReco;

    await charger();
    $("btn-micro").click();
    reco.ecouteurs.result({ results: [[{ transcript: "où étais-tu hier soir" }]] });
    expect($("message").value).toBe("où étais-tu hier soir");

    delete window.SpeechRecognition;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/game.test.js`
Expected: FAIL — `#btn-voix`/`#btn-micro` non câblés (aria-pressed inchangé, `/api/voix` jamais appelé, bouton non masqué).

- [ ] **Step 3: Implement — `public/index.html`**

Remplacer le `<form id="saisie">…</form>` par :

```html
        <form id="saisie" autocomplete="off">
          <span class="invite">&gt;</span>
          <input
            id="message"
            type="text"
            maxlength="500"
            placeholder="Parlez à l'interlocuteur…"
          />
          <button
            id="btn-micro"
            type="button"
            class="btn-icone"
            title="Parler (micro)"
            aria-label="Parler au micro"
          >🎙</button>
          <button
            id="btn-voix"
            type="button"
            class="btn-icone"
            title="Voix du personnage"
            aria-label="Activer la voix du personnage"
            aria-pressed="false"
          >🔊</button>
        </form>
```

- [ ] **Step 4: Implement — `public/game.js`**

Étendre les imports du haut :

```js
import { creerModeVocal } from "./voix.js";
import { microDisponible, creerMicro } from "./micro.js";
```

Ajouter les références DOM près des autres `const el… = $(…)` :

```js
const elBtnVoix = $("btn-voix");
const elBtnMicro = $("btn-micro");
```

Après les déclarations d'état (près de `let noteEnAttente = "";`), instancier le mode vocal :

```js
// Mode vocal : le play audio (side-effect) est injecté ici ; la logique vit dans voix.js.
const modeVocal = creerModeVocal({
  jouer: (blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url));
    audio.play().catch(() => {}); // lecture refusée : on garde le texte
  },
});
```

Dans `consommerFlux`, à la trame `fin`, déclencher la voix après le rendu — remplacer :

```js
        } else if (event === "fin") {
          arreterAttente();
          etat = ajouterDialogue(etat, "personnage", texte);
          rendreDialogueDOM();
          return;
        }
```

par :

```js
        } else if (event === "fin") {
          arreterAttente();
          etat = ajouterDialogue(etat, "personnage", texte);
          rendreDialogueDOM();
          modeVocal.dire(texte); // no-op si la voix est désactivée
          return;
        }
```

Ajouter le câblage des boutons juste avant l'appel final `init();` :

```js
// --- Mode vocal (T-07) : toggle voix + micro (dégradation gracieuse) ---
if (elBtnVoix) {
  elBtnVoix.addEventListener("click", () => {
    const actif = modeVocal.basculer();
    elBtnVoix.setAttribute("aria-pressed", String(actif));
    elBtnVoix.classList.toggle("actif", actif);
  });
}
if (elBtnMicro) {
  if (microDisponible()) {
    const micro = creerMicro({
      onTexte: (texte) => {
        elInput.value = texte;
        elInput.focus();
      },
      onFin: () => elBtnMicro.classList.remove("ecoute"),
    });
    elBtnMicro.addEventListener("click", () => {
      elBtnMicro.classList.add("ecoute");
      micro.demarrer();
    });
  } else {
    elBtnMicro.hidden = true; // navigateur sans reconnaissance vocale
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/game.test.js`
Expected: PASS (anciens + nouveaux tests).

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/game.js test/game.test.js
git commit -m "feat: câblage des boutons voix et micro dans le jeu (T-07)"
```

---

## Task 8 : Styles + docs (DS, README)

**Files:**
- Modify: `public/style.css`
- Modify: `public/DESIGN-SYSTEM.md`
- Modify: `README.md`

_(Pas de test unitaire : styles + docs. Vérification visuelle + suite globale.)_

- [ ] **Step 1: Ajouter les styles des boutons icône dans `public/style.css`**

Après le bloc `#message { … }` (avant `/* --- Modale --- */`), ajouter :

```css
/* --- Boutons icône du dialogue : micro + voix (T-07) --- */
.btn-icone {
  padding: var(--esp-xs) var(--esp-sm);
  background: var(--c-surface);
  border: var(--trait) solid var(--c-bordure);
  line-height: 1;
}
.btn-icone:hover {
  background: var(--c-surface-survol);
}
/* Voix active : accent phosphore vert (comme le centre du plan). */
#btn-voix.actif {
  color: var(--c-vert);
  border-color: var(--c-vert);
}
/* Micro en écoute : pulsation discrète (coupée sous prefers-reduced-motion via la
   règle `*` existante en bas de fichier). */
#btn-micro.ecoute {
  color: var(--c-erreur);
  border-color: var(--c-erreur);
  animation: pulser var(--duree-clignotement) ease-in-out infinite;
}
```

Ajouter la keyframe près des autres (`@keyframes clignoter` / `apparaitre`) :

```css
@keyframes pulser {
  50% {
    opacity: 0.4;
  }
}
```

- [ ] **Step 2: Documenter dans `public/DESIGN-SYSTEM.md`**

Ajouter une entrée décrivant les boutons icône (`.btn-icone`) et leurs états
`#btn-voix.actif` (accent `--c-vert`) et `#btn-micro.ecoute` (accent `--c-erreur`,
animation `pulser` via `--duree-clignotement`, neutralisée sous
`prefers-reduced-motion`). Rappeler qu'aucune valeur brute n'est introduite : tout
provient des tokens existants.

- [ ] **Step 3: Note RGPD + config dans `README.md`**

Ajouter, près de la section de configuration `.env`, un encart :

```markdown
### Mode vocal (optionnel)

- **Voix du personnage** : renseignez `ELEVENLABS_API_KEY` et `ELEVENLABS_VOICE_ID`
  (+ `ELEVENLABS_MODEL`, défaut `eleven_multilingual_v2`) dans `.env`. La clé reste
  côté serveur. Sans ces variables, le jeu fonctionne normalement, sans voix.
- **Parler au personnage** : le bouton 🎙 utilise la reconnaissance vocale du
  navigateur (Web Speech API). L'audio de votre voix **ne transite pas par ce
  serveur**. Attention : certains navigateurs (Chrome) l'envoient à leurs propres
  services pour la transcription — un comportement hors de notre contrôle. Le
  bouton est masqué si le navigateur ne supporte pas cette API.
```

- [ ] **Step 4: Vérifier la suite complète**

Run: `npm test`
Expected: PASS (toute la suite).

- [ ] **Step 5: Commit**

```bash
git add public/style.css public/DESIGN-SYSTEM.md README.md
git commit -m "feat: styles des boutons voix/micro + doc DS et README (T-07)"
```

---

## Task 9 : Vérification finale (couverture, revues, PR)

**Files:** aucun changement de code (sauf corrections issues des revues).

- [ ] **Step 1: Couverture**

Run: `npm run coverage`
Expected: PASS, seuils respectés (≥ 80 %). Si un nouveau module descend sous le
seuil, ajouter le test manquant (les branches d'erreur de `voix.js`/`voix-front.js`
sont déjà couvertes ; vérifier `game.js`).

- [ ] **Step 2: Revue qualité**

Lancer `/code-review` puis `/simplify` sur le diff de la branche. Traiter les
points CRITICAL/HIGH, puis MEDIUM si simples.

- [ ] **Step 3: Revue sécurité**

Lancer `/security-review`. Points d'attention : la clé ElevenLabs ne doit jamais
apparaître dans une réponse ni dans `vuePublique` ; `/api/voix` borne bien le texte ;
aucun secret n'est loggé.

- [ ] **Step 4: Mettre à jour le backlog**

Retirer T-07 de la section **En cours** de `BACKLOG.md` (elle sera livrée à la
fusion de la PR). Commit : `chore: retire T-07 du backlog (livré) (T-07)`.

- [ ] **Step 5: PR**

```bash
git push -u origin feat/t07-mode-vocal
gh pr create --fill
```

---

## Self-Review (auteur du plan)

**Couverture de la spec :**
- Sortie voix ElevenLabs, opt-in + lecture auto → Tasks 1, 3, 6, 7. ✅
- Entrée micro Web Speech, aucun audio serveur → Tasks 5, 7 + note README (Task 8). ✅
- Clé serveur uniquement, config `.env` → Tasks 3, 4. ✅
- Dégradation gracieuse (clé absente / TTS KO / micro absent) → 503 (Task 3), avale
  d'erreur (Task 6), bouton masqué (Task 7). ✅
- Anti-abus / longueur bornée → `valideRequeteVoix` (Task 2). ✅
- Tests voix.js / route / validate / micro / voix-front / game → Tasks 1-3, 5-7. ✅
- Styles via tokens, animation coupée sous reduced-motion, DS à jour → Task 8. ✅
- Hors périmètre (streaming, STT serveur, multi-voix, cache) : non implémenté. ✅

**Cohérence des types/signatures :**
- `synthetiserVoix(fetchFn, { texte, voiceId, model, apiKey }) → Buffer` : défini
  Task 1, appelé identiquement Task 3.
- `creerRouteur({ …, voix, synthetiserFn })` : signature Task 3, injection Task 4.
- `creerModeVocal({ fetchFn, jouer }) → { estActif, basculer, dire }` : défini Task 6,
  consommé Task 7 (`basculer`, `dire`).
- `creerMicro({ langue, onTexte, onFin }) → { demarrer, arreter } | null` et
  `microDisponible()` : définis Task 5, consommés Task 7.

Aucun placeholder ; chaque étape de code porte son code complet.

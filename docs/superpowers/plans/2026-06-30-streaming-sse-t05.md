# T-05 · Streaming SSE des réponses du personnage — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diffuser la réponse du LLM en flux SSE pour un affichage progressif côté front, avec dégradation propre en cas d'erreur.

**Architecture:** SSE sur POST. `/api/chat` valide la requête et dérive l'anti-triche en amont (codes HTTP + JSON), puis bascule en `text/event-stream` et émet des trames `delta`/`fin`/`erreur`. Le front lit `response.body` en flux, parse les trames via un module pur `public/sse.js`, et peint le texte par à-coups avec un caret `▌`. L'effet « machine à écrire » simulé (devenu inutile) est supprimé.

**Tech Stack:** Node 18+ / Express, ESM vanilla (front sans build), SDK `@anthropic-ai/sdk` (`messages.stream`), Vitest (+ jsdom, supertest).

**Référence design :** [docs/superpowers/specs/2026-06-29-streaming-sse-t05-design.md](../specs/2026-06-29-streaming-sse-t05-design.md)

**Conventions :** TDD strict (RED → GREEN). Commits conventionnels, **sans** `Co-Authored-By` (attribution désactivée). Français pour code/commentaires/commits.

---

### Task 1: Marquer T-05 « En cours » dans le backlog

**Files:**
- Modify: `BACKLOG.md`

- [ ] **Step 1: Déplacer T-05 de « À faire » vers « En cours »**

Dans `BACKLOG.md`, couper le bloc de la tâche T-05 (le titre `### T-05 · 🟢 Streaming des réponses du personnage` et ses 2 lignes) de la section `## À faire`, et le coller sous `## En cours` en remplaçant `_(rien pour l'instant)_`.

Résultat attendu dans `## En cours` :

```markdown
## En cours

### T-05 · 🟢 Streaming des réponses du personnage
Diffuser la réponse du LLM en flux (SSE) pour un affichage progressif.
**Acceptation** : le texte s'affiche au fil de l'eau ; dégradation propre si erreur.
```

Et dans `## À faire`, T-06 devient la première tâche.

- [ ] **Step 2: Commit**

```bash
git add BACKLOG.md
git commit -m "docs: passe T-05 en cours (streaming SSE)"
```

---

### Task 2: Parseur de trames SSE (`public/sse.js`)

Module pur, sans DOM : transforme un tampon de texte en trames `{event, data}` complètes + un reste non terminé à reporter sur le prochain chunk.

**Files:**
- Create: `public/sse.js`
- Test: `test/sse.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/sse.test.js` :

```js
import { describe, test, expect } from "vitest";
import { decoupeTrames } from "../public/sse.js";

describe("decoupeTrames", () => {
  test("trame complète : renvoie {event, data} et un reste vide", () => {
    const { trames, reste } = decoupeTrames('event: delta\ndata: {"texte":"a"}\n\n');
    expect(trames).toEqual([{ event: "delta", data: '{"texte":"a"}' }]);
    expect(reste).toBe("");
  });

  test("plusieurs trames dans un même chunk", () => {
    const chunk = 'event: delta\ndata: 1\n\nevent: fin\ndata: {}\n\n';
    const { trames, reste } = decoupeTrames(chunk);
    expect(trames).toEqual([
      { event: "delta", data: "1" },
      { event: "fin", data: "{}" },
    ]);
    expect(reste).toBe("");
  });

  test("trame partielle : reportée dans le reste, pas dans les trames", () => {
    const { trames, reste } = decoupeTrames('event: delta\ndata: 1\n\nevent: fi');
    expect(trames).toEqual([{ event: "delta", data: "1" }]);
    expect(reste).toBe("event: fi");
  });

  test("event par défaut à 'message' si absent", () => {
    const { trames } = decoupeTrames("data: salut\n\n");
    expect(trames).toEqual([{ event: "message", data: "salut" }]);
  });

  test("plusieurs lignes data jointes par un saut de ligne (spec SSE)", () => {
    const { trames } = decoupeTrames("data: ligne1\ndata: ligne2\n\n");
    expect(trames).toEqual([{ event: "message", data: "ligne1\nligne2" }]);
  });

  test("ligne de commentaire / heartbeat sans data : ignorée", () => {
    const { trames, reste } = decoupeTrames(":keepalive\n\n");
    expect(trames).toEqual([]);
    expect(reste).toBe("");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run test/sse.test.js`
Expected: FAIL — `Failed to resolve import "../public/sse.js"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `public/sse.js` :

```js
// Parseur de trames Server-Sent Events, pur (sans DOM). Le flux arrive par chunks
// arbitraires : on accumule un tampon, on en extrait les trames complètes (séparées
// par une ligne vide « \n\n ») et on renvoie le reste non terminé à reporter.

function parseTrame(bloc) {
  let event = "message";
  const datas = [];
  for (const ligne of bloc.split("\n")) {
    if (ligne.startsWith("event:")) event = ligne.slice(6).trim();
    else if (ligne.startsWith("data:")) datas.push(ligne.slice(5).replace(/^ /, ""));
  }
  if (datas.length === 0) return null; // commentaire / heartbeat : rien à livrer
  return { event, data: datas.join("\n") };
}

export function decoupeTrames(tampon) {
  const morceaux = tampon.split("\n\n");
  const reste = morceaux.pop(); // dernier segment : trame incomplète (ou "" si fin nette)
  const trames = morceaux.map(parseTrame).filter((t) => t !== null);
  return { trames, reste };
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run test/sse.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add public/sse.js test/sse.test.js
git commit -m "feat: parseur de trames SSE pur (T-05)"
```

---

### Task 3: Variante streamée du client Claude (`repondreEnFlux`)

**Files:**
- Modify: `server/claude.js`
- Test: `test/claude.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `test/claude.test.js`, modifier la ligne d'import et **ajouter** un faux client de flux + un bloc `describe` (garder le reste du fichier inchangé pour l'instant) :

Remplacer :
```js
import { repondre } from "../server/claude.js";
```
par :
```js
import { repondre, repondreEnFlux } from "../server/claude.js";
```

Ajouter à la fin du fichier :
```js
// Faux client de flux : `messages.stream` renvoie un itérable async d'événements
// content_block_delta + un finalMessage(). Si `erreur` est fourni, le flux lève.
function fauxClientFlux(morceaux, { erreur } = {}) {
  const appels = [];
  return {
    appels,
    messages: {
      stream: (params) => {
        appels.push(params);
        return {
          async *[Symbol.asyncIterator]() {
            for (const t of morceaux) {
              yield { type: "content_block_delta", delta: { type: "text_delta", text: t } };
            }
            if (erreur) throw erreur;
          },
          finalMessage: async () => ({ content: [{ type: "text", text: morceaux.join("") }] }),
        };
      },
    },
  };
}

describe("repondreEnFlux", () => {
  test("appelle onTexte pour chaque fragment de texte", async () => {
    const client = fauxClientFlux(["Bon", "jour", "."]);
    const recus = [];
    await repondreEnFlux(
      client,
      { system: "S", historique: [], message: "Salut", model: "m" },
      (t) => recus.push(t),
    );
    expect(recus).toEqual(["Bon", "jour", "."]);
  });

  test("mappe l'historique en rôles user/assistant et ajoute le message courant", async () => {
    const client = fauxClientFlux(["ok"]);
    await repondreEnFlux(
      client,
      {
        system: "S",
        historique: [
          { role: "joueur", texte: "Qui es-tu ?" },
          { role: "personnage", texte: "Victor." },
        ],
        message: "Où étais-tu ?",
        model: "claude-sonnet-4-6",
      },
      () => {},
    );
    const params = client.appels[0];
    expect(params.system).toBe("S");
    expect(params.messages).toEqual([
      { role: "user", content: "Qui es-tu ?" },
      { role: "assistant", content: "Victor." },
      { role: "user", content: "Où étais-tu ?" },
    ]);
  });

  test("propage une erreur survenue pendant le flux", async () => {
    const client = fauxClientFlux(["a"], { erreur: new Error("flux coupé") });
    await expect(
      repondreEnFlux(client, { system: "S", message: "x", model: "m" }, () => {}),
    ).rejects.toThrow("flux coupé");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run test/claude.test.js`
Expected: FAIL — `repondreEnFlux is not a function` (export manquant).

- [ ] **Step 3: Écrire l'implémentation**

Remplacer le contenu de `server/claude.js` par :

```js
// Wrapper mince autour du SDK officiel Anthropic. La clé est lue depuis
// ANTHROPIC_API_KEY par le SDK ; elle reste côté serveur. Le client est injecté
// dans `repondre`/`repondreEnFlux` pour rester testable sans appel réseau.

import Anthropic from "@anthropic-ai/sdk";

export function creerClient() {
  return new Anthropic(); // lit process.env.ANTHROPIC_API_KEY
}

function texteDeReponse(reponse) {
  return reponse.content
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("")
    .trim();
}

// Construit la liste `messages` de l'API : journal de dialogue + message courant.
function construireMessages(historique, message) {
  return [
    ...historique.map((tour) => ({
      role: tour.role === "personnage" ? "assistant" : "user",
      content: tour.texte,
    })),
    { role: "user", content: message },
  ];
}

export async function repondre(
  client,
  { system, historique = [], message, model, maxTokens = 512 },
) {
  const reponse = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: construireMessages(historique, message),
  });
  return texteDeReponse(reponse);
}

// Variante streamée : appelle `onTexte(fragment)` pour chaque text_delta reçu, puis
// attend finalMessage() (clôt le flux et fait remonter une éventuelle erreur).
export async function repondreEnFlux(
  client,
  { system, historique = [], message, model, maxTokens = 512 },
  onTexte,
) {
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    messages: construireMessages(historique, message),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      onTexte(event.delta.text);
    }
  }
  await stream.finalMessage();
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run test/claude.test.js`
Expected: PASS (anciens tests `repondre` + 3 nouveaux `repondreEnFlux`).

- [ ] **Step 5: Commit**

```bash
git add server/claude.js test/claude.test.js
git commit -m "feat: repondreEnFlux (streaming SDK Anthropic) (T-05)"
```

---

### Task 4: Endpoint `/api/chat` streamé (`server/chat.js`)

**Files:**
- Modify: `server/chat.js`
- Test: `test/routes.test.js`

- [ ] **Step 1: Réécrire les tests `/chat` (RED)**

Dans `test/routes.test.js` :

1. Remplacer le défaut injecté dans `faireApp` :
```js
      repondreFn: async () => "Réponse de test.",
```
par :
```js
      repondreFluxFn: async (_client, _args, onTexte) => onTexte("Réponse de test."),
```

2. Remplacer **tout** le bloc `describe("POST /chat", …)` par :

```js
describe("POST /chat", () => {
  test("requête invalide : 400 JSON avec message d'erreur", async () => {
    const res = await request(faireApp()).post("/api/chat").send({ message: "" });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("clé API absente (client null) : 503 JSON", async () => {
    const res = await request(faireApp({ client: null }))
      .post("/api/chat")
      .send({ message: "Bonjour" });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ANTHROPIC_API_KEY");
  });

  test("requête valide : flux SSE 200 avec trames delta puis fin", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => {
      onTexte("Bonjour");
      onTexte(" à vous.");
    });
    const res = await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Bonjour", gestes: [g("ramasser", "chocolats")] });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("event: delta");
    expect(res.text).toContain('data: {"texte":"Bonjour"}');
    expect(res.text).toContain('data: {"texte":" à vous."}');
    expect(res.text).toContain("event: fin");

    expect(repondreFluxFn).toHaveBeenCalledOnce();
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.message).toBe("Bonjour");
    expect(args.model).toBe("modele-test");
    expect(typeof args.system).toBe("string");
  });

  test("anti-triche : un journal incomplet ne débloque pas la connaissance secrète", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => onTexte("…"));
    await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Où est le code ?", gestes: [g("donner", "chocolats")] });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).not.toContain("code du coffre");
  });

  test("séquence légitime : la connaissance se débloque côté serveur", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => onTexte("…"));
    await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({
        message: "Où est le code ?",
        gestes: [g("ramasser", "chocolats"), g("donner", "chocolats")],
      });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("code du coffre");
  });

  test("erreur pendant le flux : 200 + trame erreur (non avalée)", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const repondreFluxFn = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    const res = await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Bonjour" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("event: erreur");
    expect(res.text).toContain("injoignable");
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run test/routes.test.js`
Expected: FAIL — le flux n'est pas encore implémenté (`content-type` ≠ `text/event-stream`, pas de trames `event: …`).

- [ ] **Step 3: Implémenter le routeur streamé**

Dans `server/chat.js` :

1. Changer l'import :
```js
import { repondre } from "./claude.js";
```
en :
```js
import { repondreEnFlux } from "./claude.js";
```

2. Changer la signature de `creerRouteur` :
```js
export function creerRouteur({ scenario, ciblesConnues, client, model, repondreFn = repondre }) {
```
en :
```js
export function creerRouteur({ scenario, ciblesConnues, client, model, repondreFluxFn = repondreEnFlux }) {
```

3. Remplacer **tout** le handler `routeur.post("/chat", …)` par :

```js
  routeur.post("/chat", async (req, res) => {
    const v = valideRequeteChat(req.body, ciblesConnues);
    if (!v.ok) {
      return res.status(400).json({ erreur: v.erreur });
    }
    if (!client) {
      return res.status(503).json({
        erreur: "Clé API Anthropic non configurée. Renseignez ANTHROPIC_API_KEY dans .env.",
      });
    }
    const { message, gestes, historique, note } = v.valeur;

    // Anti-triche : on dérive les flags AVANT de streamer ; toute erreur de
    // préparation reste un échec « pré-vol » avec un code HTTP propre.
    let system;
    try {
      const flags = deriverFlags(scenario, gestes);
      system = construitPrompt(scenario, flags, note);
    } catch (err) {
      console.error("Erreur préparation prompt:", err?.message ?? err);
      return res.status(502).json({ erreur: "Le personnage est injoignable pour le moment." });
    }

    // À partir d'ici les en-têtes 200 sont envoyées : une erreur en cours de flux
    // passe par une trame `erreur`, pas par un code HTTP.
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();
    const ecrire = (chunk) => {
      if (!res.writableEnded) res.write(chunk);
    };

    try {
      await repondreFluxFn(client, { system, historique, message, model }, (texte) =>
        ecrire(`event: delta\ndata: ${JSON.stringify({ texte })}\n\n`),
      );
      ecrire("event: fin\ndata: {}\n\n");
    } catch (err) {
      console.error("Erreur appel Claude (flux):", err?.message ?? err);
      ecrire(
        `event: erreur\ndata: ${JSON.stringify({
          erreur: "Le personnage est injoignable pour le moment.",
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  });
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run test/routes.test.js`
Expected: PASS (tous les blocs `/scenario`, `/examiner`, `/chat`, `/accuser`).

- [ ] **Step 5: Commit**

```bash
git add server/chat.js test/routes.test.js
git commit -m "feat: /api/chat en flux SSE, anti-triche inchangée (T-05)"
```

---

### Task 5: Consommation du flux côté front + retrait de la frappe simulée (`public/game.js`)

**Files:**
- Modify: `public/game.js`
- Test: `test/game.test.js`

- [ ] **Step 1: Adapter le mock fetch et réécrire les tests dialogue (RED)**

Dans `test/game.test.js` :

1. Ajouter ces helpers juste après la déclaration de `rep` (vers la ligne 37) :
```js
// Construit un ReadableStream qui émet les trames SSE fournies, dans l'ordre.
function fluxSSE(frames) {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < frames.length) controller.enqueue(enc.encode(frames[i++]));
      else controller.close();
    },
  });
}
// Raccourci : des trames `delta` (un fragment chacune) suivies d'une trame `fin`.
const tramesDelta = (...morceaux) => [
  ...morceaux.map((t) => `event: delta\ndata: ${JSON.stringify({ texte: t })}\n\n`),
  "event: fin\ndata: {}\n\n",
];
// Flux piloté manuellement par le test (pour observer le caret en cours de route).
function fluxManuel() {
  let ctrl;
  const stream = new ReadableStream({ start: (c) => (ctrl = c) });
  const enc = new TextEncoder();
  return {
    stream,
    push: (frame) => ctrl.enqueue(enc.encode(frame)),
    fin: () => ctrl.close(),
  };
}
```

2. Remplacer la branche `/api/chat` de `monterFetch` par :
```js
    if (url === "/api/chat") {
      if (reponses.chatErreur) throw new Error("réseau");
      if (reponses.chatOk === false) return rep(reponses.chat ?? { erreur: "Erreur." }, false);
      if (reponses.chatBody) return { ok: true, body: reponses.chatBody };
      const frames = reponses.chatTrames ?? tramesDelta(reponses.chatTexte ?? "Je n'ai rien à dire.");
      return { ok: true, body: fluxSSE(frames) };
    }
```

3. Remplacer **tout** le bloc `describe("dialogue (envoi de message)", …)` par :
```js
describe("dialogue (envoi de message)", () => {
  test("envoie le message, affiche la réponse en flux et exclut la narration de l'historique LLM", async () => {
    await charger({ chatTrames: tramesDelta("Bonjour, ", "que voulez-vous ?") });
    $("message").value = "Salut Victor";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() =>
      expect($("dialogue").textContent).toContain("Bonjour, que voulez-vous ?"),
    );
    expect($("dialogue").textContent).toContain("Vous : Salut Victor");
    expect($("message").value).toBe("");

    const appel = global.fetch.mock.calls.find(([u]) => u === "/api/chat");
    const corps = JSON.parse(appel[1].body);
    expect(corps.message).toBe("Salut Victor");
    expect(corps.historique.some((t) => t.role === "systeme")).toBe(false);
  });

  test("ignore un message vide (pas d'appel au serveur)", async () => {
    await charger();
    $("message").value = "   ";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));
    expect(global.fetch.mock.calls.some(([u]) => u === "/api/chat")).toBe(false);
  });

  test("affiche l'erreur serveur (pré-vol) quand la réponse n'est pas OK", async () => {
    await charger({ chatOk: false, chat: { erreur: "Message trop long." } });
    $("message").value = "Test";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect($("dialogue").textContent).toContain("Message trop long."));
  });

  test("signale une panne réseau", async () => {
    await charger({ chatErreur: true });
    $("message").value = "Test";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect($("dialogue").textContent).toContain("Le personnage est injoignable (réseau)."),
    );
  });

  test("erreur en cours de flux : garde le texte partiel et signale l'interruption", async () => {
    await charger({
      chatTrames: [
        `event: delta\ndata: ${JSON.stringify({ texte: "Je commence" })}\n\n`,
        `event: erreur\ndata: ${JSON.stringify({ erreur: "x" })}\n\n`,
      ],
    });
    $("message").value = "Test";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect($("dialogue").textContent).toContain("Je commence"));
    await vi.waitFor(() => expect($("dialogue").textContent).toContain("interrompue"));
  });
});
```

4. Remplacer **tout** le bloc `describe("animation de la réponse", …)` (le dernier du fichier) par :
```js
describe("flux de la réponse", () => {
  test("affiche un caret pendant le flux, retiré à la fin", async () => {
    const flux = fluxManuel();
    await charger({ chatBody: flux.stream });

    $("message").value = "Salut";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));

    flux.push(`event: delta\ndata: ${JSON.stringify({ texte: "Bonjour" })}\n\n`);
    await vi.waitFor(() => expect($("dialogue").textContent).toContain("▌"));

    flux.push("event: fin\ndata: {}\n\n");
    flux.fin();
    await vi.waitFor(() => {
      expect($("dialogue").textContent).not.toContain("▌");
      expect($("dialogue").textContent).toContain("Bonjour");
    });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run test/game.test.js`
Expected: FAIL — `game.js` lit encore `rep.json()` pour `/chat` (pas de `body.getReader()`) ; le caret n'apparaît plus comme avant.

- [ ] **Step 3: Implémenter la consommation du flux dans `game.js`**

3a. Changer les imports en tête de `public/game.js` :
```js
import { etatInitial, ramasser, donner, examiner, ajouterDialogue } from "./state.js";
import { artInterlocuteur, rendreDialogue, dialoguePartiel } from "./render.js";
```
en :
```js
import { etatInitial, ramasser, donner, examiner, ajouterDialogue } from "./state.js";
import { artInterlocuteur, rendreDialogue } from "./render.js";
import { decoupeTrames } from "./sse.js";
```

3b. Supprimer la variable `minuteurFrappe` (ligne ~23) :
```js
let minuteurFrappe = null; // intervalle de l'effet machine à écrire
```
(laisser `minuteurAttente`).

3c. Réécrire `rendreDialogueDOM` (retirer l'appel à `annulerFrappe`) :
```js
// Affiche l'historique complet du dialogue.
function rendreDialogueDOM() {
  elDialogue.textContent = rendreDialogue(etat.historique, vue.personnage.nom);
  elDialogue.scrollTop = elDialogue.scrollHeight;
}
```

3d. Supprimer entièrement les fonctions devenues mortes : `dureeFrappeMs`, `annulerFrappe`, `animerDernierTour` (le bloc allant du commentaire « Durée par caractère… » jusqu'à la fin de `animerDernierTour`). Conserver `mouvementReduit`, `arreterAttente`, `demarrerAttente`, `narration`.

3e. Ajouter, juste avant le `elForm.addEventListener("submit", …)`, la fonction de peinture en flux :
```js
// Peint l'historique + la réplique en cours de réception (avec caret), sans encore
// la committer dans l'état (immutabilité : le commit a lieu sur la trame « fin »).
function peindreFlux(texte) {
  const histo = [...etat.historique, { role: "personnage", texte }];
  elDialogue.textContent = `${rendreDialogue(histo, vue.personnage.nom)}▌`;
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

// Lit le flux SSE de /api/chat et peint la réponse au fil de l'eau.
async function consommerFlux(rep) {
  const lecteur = rep.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = ""; // trames SSE non terminées
  let texte = ""; // réplique accumulée
  let demarre = false;
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const { trames, reste } = decoupeTrames(tampon);
      tampon = reste;
      for (const { event, data } of trames) {
        if (event === "delta") {
          if (!demarre) {
            arreterAttente();
            demarre = true;
          }
          texte += JSON.parse(data).texte;
          peindreFlux(texte);
        } else if (event === "erreur") {
          arreterAttente();
          if (texte) etat = ajouterDialogue(etat, "personnage", texte);
          narration("(communication interrompue)");
          return;
        } else if (event === "fin") {
          arreterAttente();
          etat = ajouterDialogue(etat, "personnage", texte);
          rendreDialogueDOM();
          return;
        }
      }
    }
    // Flux clos sans trame « fin » : on commit ce qu'on a reçu.
    arreterAttente();
    if (texte) {
      etat = ajouterDialogue(etat, "personnage", texte);
      rendreDialogueDOM();
    }
  } catch {
    arreterAttente();
    if (texte) {
      etat = ajouterDialogue(etat, "personnage", texte);
      rendreDialogueDOM();
    }
    narration("Le personnage est injoignable (réseau).");
  }
}
```

3f. Remplacer **tout** le handler `elForm.addEventListener("submit", …)` par :
```js
elForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = elInput.value.trim();
  if (!message || !vue) return;
  elInput.value = "";

  // L'historique envoyé au LLM ne contient que les échanges (pas la narration),
  // et pas le message courant (que le serveur ajoute lui-même).
  const historiqueLLM = etat.historique.filter((t) => t.role !== "systeme");
  etat = ajouterDialogue(etat, "joueur", message);
  rendreDialogueDOM();

  const note = noteEnAttente;
  noteEnAttente = "";
  demarrerAttente();

  let rep;
  try {
    rep = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, gestes: etat.gestes, historique: historiqueLLM, note }),
    });
  } catch {
    arreterAttente();
    narration("Le personnage est injoignable (réseau).");
    return;
  }

  if (!rep.ok) {
    arreterAttente();
    const data = await rep.json().catch(() => ({}));
    narration(data.erreur ?? "Erreur de communication.");
    return;
  }

  await consommerFlux(rep);
});
```

3g. Supprimer le handler de clic « saute la frappe » (devenu sans objet) :
```js
// Un clic dans le dialogue saute l'effet de frappe et affiche la réponse entière.
elDialogue.addEventListener("click", () => {
  if (minuteurFrappe) rendreDialogueDOM();
});
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run test/game.test.js`
Expected: PASS (tous les blocs, y compris « flux de la réponse »).

- [ ] **Step 5: Commit**

```bash
git add public/game.js test/game.test.js
git commit -m "feat: affichage du dialogue en flux SSE, retrait de la frappe simulée (T-05)"
```

---

### Task 6: Simplifier `public/render.js` (retrait de `dialoguePartiel`)

`dialoguePartiel` ne servait qu'à la frappe simulée, désormais supprimée. Plus aucun module ne l'importe.

**Files:**
- Modify: `public/render.js`
- Test: `test/render.test.js`

- [ ] **Step 1: Mettre à jour les tests (RED)**

Dans `test/render.test.js` :

1. Changer l'import :
```js
import { artInterlocuteur, rendreDialogue, dialoguePartiel } from "../public/render.js";
```
en :
```js
import { artInterlocuteur, rendreDialogue } from "../public/render.js";
```

2. Supprimer entièrement le bloc `describe("dialoguePartiel", …)` (lignes ~49 à 81).

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run test/render.test.js`
Expected: FAIL — `dialoguePartiel` encore exporté/référencé selon l'état ; au minimum, l'objectif est de retirer le code mort (voir étape 3). (Si le test passe déjà, poursuivre : on retire le code mort.)

- [ ] **Step 3: Réimplémenter `rendreDialogue` sans `dialoguePartiel`**

Remplacer le contenu de `public/render.js` à partir de `// Met en forme l'historique…` (lignes ~24 à fin) par :

```js
// Met en forme l'historique du dialogue. "joueur" → "Vous", "systeme" → narration
// sans préfixe, sinon le nom du personnage.
export function rendreDialogue(historique, nomPerso) {
  return historique
    .map((tour) => {
      if (tour.role === "systeme") return `— ${tour.texte}`;
      const qui = tour.role === "joueur" ? "Vous" : nomPerso;
      return `${qui} : ${tour.texte}`;
    })
    .join("\n\n");
}
```

(Garder `artInterlocuteur` et le visage générique inchangés.)

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run test/render.test.js`
Expected: PASS (`artInterlocuteur` + `rendreDialogue`).

- [ ] **Step 5: Commit**

```bash
git add public/render.js test/render.test.js
git commit -m "refactor: retire dialoguePartiel (frappe simulée supprimée) (T-05)"
```

---

### Task 7: Retirer le token `--duree-frappe-ms` (Design System)

**Files:**
- Modify: `public/tokens.css`
- Modify: `public/DESIGN-SYSTEM.md`

- [ ] **Step 1: Supprimer le token dans `tokens.css`**

Supprimer la ligne :
```css
  --duree-frappe-ms: 18; /* ms par caractère (lu en JS pour la frappe) */
```

- [ ] **Step 2: Mettre à jour `DESIGN-SYSTEM.md`**

Dans la section « Mouvement & ambiance CRT », remplacer :
```
Subtil par défaut. Tokens : `--duree-survol` (transitions), `--duree-clignotement`
(curseur), `--duree-frappe-ms` (effet machine à écrire, lu en JS), `--crt-lueur`
(text-shadow phosphore), `--crt-scanline-*` (lignes de balayage), `--crt-vignette`
(assombrissement des bords).
```
par :
```
Subtil par défaut. Tokens : `--duree-survol` (transitions), `--duree-clignotement`
(curseur), `--crt-lueur` (text-shadow phosphore), `--crt-scanline-*` (lignes de
balayage), `--crt-vignette` (assombrissement des bords).
```

- [ ] **Step 3: Vérifier qu'aucun usage ne subsiste**

Run: `grep -rn "duree-frappe" public/`
Expected: aucune sortie (exit code 1).

- [ ] **Step 4: Lancer la suite complète (garde-fou)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/tokens.css public/DESIGN-SYSTEM.md
git commit -m "refactor: retire le token --duree-frappe-ms inutilisé (T-05)"
```

---

### Task 8: Retirer le code mort `repondre`/`texteDeReponse`

`/api/chat` étant le seul consommateur de `repondre`, il est devenu mort après la migration en flux (Task 4). `texteDeReponse` n'est plus utilisé que par `repondre`.

**Files:**
- Modify: `server/claude.js`
- Test: `test/claude.test.js`

- [ ] **Step 1: Retirer les tests de `repondre` (RED côté nettoyage)**

Dans `test/claude.test.js` :

1. Changer l'import :
```js
import { repondre, repondreEnFlux } from "../server/claude.js";
```
en :
```js
import { repondreEnFlux } from "../server/claude.js";
```

2. Supprimer le faux client non-streamé `fauxClient` (utilisé seulement par les tests `repondre`) et **tout** le bloc `describe("repondre", …)`. Conserver `fauxClientFlux` et `describe("repondre EnFlux", …)`.

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `npx vitest run test/claude.test.js`
Expected: PASS pour les tests restants (le bloc `repondre` n'existe plus). Si la suite référence encore `repondre`/`fauxClient`, corriger jusqu'à un fichier propre.

- [ ] **Step 3: Retirer `repondre` et `texteDeReponse` de `server/claude.js`**

Supprimer la fonction `texteDeReponse` et la fonction `repondre`. Le fichier final doit être :

```js
// Wrapper mince autour du SDK officiel Anthropic. La clé est lue depuis
// ANTHROPIC_API_KEY par le SDK ; elle reste côté serveur. Le client est injecté
// dans `repondreEnFlux` pour rester testable sans appel réseau.

import Anthropic from "@anthropic-ai/sdk";

export function creerClient() {
  return new Anthropic(); // lit process.env.ANTHROPIC_API_KEY
}

// Construit la liste `messages` de l'API : journal de dialogue + message courant.
function construireMessages(historique, message) {
  return [
    ...historique.map((tour) => ({
      role: tour.role === "personnage" ? "assistant" : "user",
      content: tour.texte,
    })),
    { role: "user", content: message },
  ];
}

// Variante streamée : appelle `onTexte(fragment)` pour chaque text_delta reçu, puis
// attend finalMessage() (clôt le flux et fait remonter une éventuelle erreur).
export async function repondreEnFlux(
  client,
  { system, historique = [], message, model, maxTokens = 512 },
  onTexte,
) {
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    messages: construireMessages(historique, message),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      onTexte(event.delta.text);
    }
  }
  await stream.finalMessage();
}
```

- [ ] **Step 4: Lancer la suite complète pour vérifier qu'elle passe**

Run: `npm test`
Expected: PASS (aucune référence résiduelle à `repondre`).

- [ ] **Step 5: Commit**

```bash
git add server/claude.js test/claude.test.js
git commit -m "refactor: retire repondre/texteDeReponse (code mort après flux) (T-05)"
```

---

### Task 9: Vérification finale (couverture + qualité + sécurité)

**Files:** aucun (vérification).

- [ ] **Step 1: Suite complète**

Run: `npm test`
Expected: PASS, tous fichiers.

- [ ] **Step 2: Couverture (seuils appliqués)**

Run: `npm run coverage`
Expected: PASS, couverture ≥ seuils configurés. Vérifier en particulier `public/sse.js`, `public/game.js` (`consommerFlux`), `server/chat.js`, `server/claude.js`.

- [ ] **Step 3: Revue / simplification / sécurité (flow de contribution)**

Lancer `/code-review` puis `/simplify` sur le diff, puis `/security-review`. Adresser CRITICAL/HIGH (et MEDIUM si possible). Vérifier notamment : aucun secret côté front, anti-triche inchangée (le flux n'introduit aucun flag côté client), erreurs non avalées (log serveur neutre + trame `erreur`).

- [ ] **Step 4: Livraison**

```bash
git push -u origin feat/streaming-sse-t05
gh pr create --fill
```

---

## Self-review (couverture du spec)

- **Transport SSE sur POST** → Task 4 (en-têtes `text/event-stream`, trames `delta`/`fin`/`erreur`) + Task 5 (lecture `response.body`).
- **`repondreEnFlux` + helper `construireMessages`** → Task 3.
- **Découpage des erreurs (pré-vol HTTP / en-flux trame `erreur`)** → Task 4 (400/503/502 + trame `erreur`) ; Task 5 (front : `!rep.ok` → JSON ; trame `erreur` → partiel + note ; `catch` réseau).
- **`public/sse.js` pur testable** → Task 2.
- **Front : streaming brut + caret, retrait frappe simulée** → Task 5.
- **`render.js` : retrait `dialoguePartiel`** → Task 6.
- **Token `--duree-frappe-ms` + DESIGN-SYSTEM** → Task 7.
- **Retrait code mort `repondre`/`texteDeReponse`** → Task 8.
- **Tests (claude/sse/routes/render/game) + couverture** → Tasks 2–9.
- **Hors périmètre (reconnexion auto, fallback non-streamé, scénario)** → non implémentés (conforme).

Écart assumé vs spec : l'**abort du flux SDK sur déconnexion client** (step 7 de la spec) n'est pas implémenté ; remplacé par un garde `if (!res.writableEnded)` autour des `res.write` (évite « write after end »). Réponses courtes (≤ 512 tokens) → risque négligeable. À documenter dans la PR.

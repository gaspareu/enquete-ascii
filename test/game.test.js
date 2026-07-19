// @vitest-environment jsdom
//
// Tests d'orchestration DOM de public/game.js (T-04). game.js n'exporte rien :
// il lit le DOM, attache ses écouteurs et lance init() AU CHARGEMENT du module.
// On monte donc le DOM et on mocke fetch AVANT l'import, puis on réimporte le
// module à neuf à chaque test (vi.resetModules) pour repartir d'un état vierge.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

// Structure DOM minimale attendue par game.js (calquée sur public/index.html).
const MARKUP = `
  <pre id="visuel"></pre>
  <div id="actions-zone"></div>
  <div id="plan"></div>
  <ul id="sac"></ul>
  <button id="btn-accuser" type="button"></button>
  <pre id="dialogue"></pre>
  <form id="saisie">
    <input id="message" type="text" />
    <button id="btn-micro" type="button">🎙</button>
    <button id="btn-voix" type="button" aria-pressed="false">🔊</button>
  </form>
  <div id="modale" class="cache"><div id="modale-contenu"></div></div>
`;

// Vue publique factice : la forme exacte que game.js consomme (cf. vuePublique).
const VUE = {
  intro: "Vous entrez dans le bureau.",
  personnage: { nom: "Victor", visage: "[ O _ O ]" },
  zones: {
    N: { description: "Une bibliothèque poussiéreuse.", objetsCaches: ["livre", "cle"] },
    S: { description: "Un bureau en désordre.", objetsCaches: ["lettre"] },
  },
  objets: {
    livre: { nom: "Vieux livre", ramassable: false },
    cle: { nom: "Petite clé", ramassable: true },
    lettre: { nom: "Lettre froissée", ramassable: true },
  },
  debrief: {
    questions: [
      { id: "qui", question: "Qui a tué ?" },
      { id: "mobile", question: "Pourquoi ?" },
    ],
  },
};

const rep = (data, ok = true) => ({ ok, json: async () => data });

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

// Routeur fetch par défaut, surchargeable par test via `reponses`.
function monterFetch(reponses = {}) {
  return vi.fn(async (url, opts) => {
    if (url === "/api/scenario") {
      if (reponses.scenarioErreur) throw new Error("réseau");
      return rep(reponses.scenario ?? VUE);
    }
    if (url === "/api/examiner") {
      if (reponses.examinerErreur) throw new Error("réseau");
      return rep(reponses.examiner ?? { texte: "Rien à signaler." });
    }
    if (url === "/api/chat") {
      if (reponses.chatErreur) throw new Error("réseau");
      if (reponses.chatOk === false) return rep(reponses.chat ?? { erreur: "Erreur." }, false);
      if (reponses.chatBody) return { ok: true, body: reponses.chatBody };
      const frames = reponses.chatTrames ?? tramesDelta(reponses.chatTexte ?? "Je n'ai rien à dire.");
      return { ok: true, body: fluxSSE(frames) };
    }
    if (url === "/api/debrief") {
      if (reponses.debriefErreur) throw new Error("réseau");
      if (reponses.debriefOk === false) return rep(reponses.debrief ?? { erreur: "Réponses invalides." }, false);
      return rep(
        reponses.debrief ?? {
          total: 12,
          max: 20,
          rang: "Enquêteur compétent",
          details: [{ id: "qui", question: "Qui a tué ?", note: 5, justification: "Exact." }],
        },
      );
    }
    if (url === "/api/voix") {
      return { ok: true, blob: async () => new Blob(["audio"]) };
    }
    throw new Error(`URL non mockée : ${url}`);
  });
}

// Monte le DOM, branche le fetch mock, (ré)importe game.js et attend la fin d'init.
async function charger(reponses = {}) {
  document.body.innerHTML = MARKUP;
  // Animations neutralisées par défaut : rendu immédiat, pas d'intervalles qui traînent.
  window.matchMedia = () => ({ matches: true });
  global.fetch = monterFetch(reponses);
  vi.resetModules();
  await import("../public/game.js");
  // init() est asynchrone (fetch + json) : on attend qu'il ait fini de peindre
  // (succès → intro dans le dialogue ; échec → message d'erreur dans le visuel).
  if (reponses.scenarioErreur) {
    await vi.waitFor(() =>
      expect($("visuel").textContent).toBe("Impossible de charger le scénario."),
    );
  } else {
    await vi.waitFor(() => expect($("dialogue").textContent).toContain(VUE.intro));
  }
}

const $ = (id) => document.getElementById(id);
// Cherche un bouton par son libellé (texte) dans un conteneur donné.
const boutonParTexte = (conteneur, texte) =>
  [...conteneur.querySelectorAll("button")].find((b) => b.textContent.includes(texte));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("init", () => {
  test("peint le perso, le plan, le sac et l'intro au chargement", async () => {
    await charger();
    expect($("visuel").textContent).toContain("Victor");
    expect($("dialogue").textContent).toContain("Vous entrez dans le bureau.");
    // Le plan a 9 cases (grille 3×3) ; le centre porte le nom du perso.
    const cases = $("plan").querySelectorAll("button.case");
    expect(cases.length).toBe(9);
    expect(boutonParTexte($("plan"), "Victor").disabled).toBe(true);
    // Sac vide au départ.
    expect($("sac").textContent).toContain("(vide)");
  });

  test("affiche un message d'erreur si le scénario ne se charge pas", async () => {
    await charger({ scenarioErreur: true });
    expect($("visuel").textContent).toBe("Impossible de charger le scénario.");
  });
});

// Ouvre la zone "N" du plan et renvoie ses boutons d'actions.
async function ouvrirZoneNord() {
  const caseN = [...$("plan").querySelectorAll("button.case")].find((b) => b.textContent === "N");
  caseN.click();
  return $("actions-zone");
}

describe("exploration d'une zone", () => {
  test("affiche la description et les actions (examiner / ramasser)", async () => {
    await charger();
    const actions = await ouvrirZoneNord();
    expect($("visuel").textContent).toContain("bibliothèque");
    // Le livre n'est pas ramassable : seulement « Examiner ».
    expect(boutonParTexte(actions, "Examiner Vieux livre")).toBeTruthy();
    expect(boutonParTexte(actions, "Ramasser Vieux livre")).toBeFalsy();
    // La clé est ramassable : « Examiner » + « Ramasser ».
    expect(boutonParTexte(actions, "Examiner Petite clé")).toBeTruthy();
    expect(boutonParTexte(actions, "Ramasser Petite clé")).toBeTruthy();
  });

  test("« Revenir au face-à-face » réaffiche le perso et vide les actions", async () => {
    await charger();
    const actions = await ouvrirZoneNord();
    boutonParTexte(actions, "Revenir").click();
    expect($("visuel").textContent).toContain("Victor");
    expect($("actions-zone").children.length).toBe(0);
  });

  test("ramasser un objet le met au sac, narre l'action et retire le bouton ramasser", async () => {
    await charger();
    let actions = await ouvrirZoneNord();
    boutonParTexte(actions, "Ramasser Petite clé").click();

    expect($("sac").textContent).toContain("Petite clé");
    expect($("dialogue").textContent).toContain("Vous ramassez : Petite clé.");
    // La zone est rafraîchie : la clé est encore examinable mais plus à ramasser.
    actions = $("actions-zone");
    expect(boutonParTexte(actions, "Examiner Petite clé")).toBeTruthy();
    expect(boutonParTexte(actions, "Ramasser Petite clé")).toBeFalsy();
  });
});

describe("examen d'une cible", () => {
  test("ouvre une modale avec le texte renvoyé par le serveur", async () => {
    await charger({ examiner: { texte: "Une clé ancienne, gravée d'initiales." } });
    const actions = await ouvrirZoneNord();
    boutonParTexte(actions, "Examiner Petite clé").click();

    await vi.waitFor(() => expect($("modale").classList.contains("cache")).toBe(false));
    expect($("modale-contenu").textContent).toContain("Une clé ancienne");
    // « Fermer » referme la modale.
    boutonParTexte($("modale-contenu"), "Fermer").click();
    expect($("modale").classList.contains("cache")).toBe(true);
  });

  test("« Examiner » depuis le menu du sac ouvre aussi la modale", async () => {
    await charger({ examiner: { texte: "La clé porte une trace de cire." } });
    const actions = await ouvrirZoneNord();
    boutonParTexte(actions, "Ramasser Petite clé").click();

    boutonParTexte($("sac"), "Petite clé").click();
    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("Que faire"));
    boutonParTexte($("modale-contenu"), "Examiner").click();

    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("trace de cire"));
  });

  test("retombe sur un texte par défaut si l'appel réseau échoue", async () => {
    await charger({ examinerErreur: true });
    const actions = await ouvrirZoneNord();
    boutonParTexte(actions, "Examiner Vieux livre").click();
    await vi.waitFor(() => expect($("modale").classList.contains("cache")).toBe(false));
    expect($("modale-contenu").textContent).toContain("Rien de particulier ici.");
  });
});

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

describe("donner un objet", () => {
  test("le geste narré ajoute une note transmise au message suivant", async () => {
    await charger();
    const actions = await ouvrirZoneNord();
    boutonParTexte(actions, "Ramasser Petite clé").click();

    // Ouvre le menu de l'objet depuis le sac, puis « Donner ».
    boutonParTexte($("sac"), "Petite clé").click();
    await vi.waitFor(() => expect($("modale").classList.contains("cache")).toBe(false));
    boutonParTexte($("modale-contenu"), "Donner à Victor").click();

    expect($("dialogue").textContent).toContain("Vous tendez Petite clé à Victor.");
    expect($("modale").classList.contains("cache")).toBe(true);

    // Le prochain message porte la note de remise.
    $("message").value = "Tenez.";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u === "/api/chat")).toBe(true));
    const appel = global.fetch.mock.calls.find(([u]) => u === "/api/chat");
    expect(JSON.parse(appel[1].body).note).toContain("Petite clé");
  });
});

describe("débrief", () => {
  test("ouvre un formulaire avec un champ par question", async () => {
    await charger();
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale").classList.contains("cache")).toBe(false));
    const champs = $("modale-contenu").querySelectorAll("textarea");
    expect(champs.length).toBe(2);
    expect($("modale-contenu").textContent).toContain("Qui a tué ?");
    expect($("modale-contenu").textContent).toContain("Pourquoi ?");
  });

  test("rend le verdict et affiche le score + rang", async () => {
    await charger();
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale-contenu").querySelectorAll("textarea").length).toBe(2));
    const champs = $("modale-contenu").querySelectorAll("textarea");
    champs[0].value = "Laurent.";
    champs[1].value = "Jalousie.";
    $("form-debrief").dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("Enquêteur compétent"));
    expect($("modale-contenu").textContent).toContain("12 / 20");
    expect(boutonParTexte($("modale-contenu"), "Rejouer")).toBeTruthy();

    const appel = global.fetch.mock.calls.find(([u]) => u === "/api/debrief");
    const corps = JSON.parse(appel[1].body);
    expect(corps.reponses).toEqual([
      { id: "qui", reponse: "Laurent." },
      { id: "mobile", reponse: "Jalousie." },
    ]);
  });

  test("« Annuler » referme le formulaire", async () => {
    await charger();
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale").classList.contains("cache")).toBe(false));
    boutonParTexte($("modale-contenu"), "Annuler").click();
    expect($("modale").classList.contains("cache")).toBe(true);
  });

  test("signale une panne réseau au débrief", async () => {
    await charger({ debriefErreur: true });
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale-contenu").querySelectorAll("textarea").length).toBe(2));
    $("form-debrief").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect($("modale-contenu").textContent).toContain("Impossible de soumettre le débrief"),
    );
  });
});

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

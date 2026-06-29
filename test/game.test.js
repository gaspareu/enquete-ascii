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
  <form id="saisie"><input id="message" type="text" /></form>
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
};

const rep = (data, ok = true) => ({ ok, json: async () => data });

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
      return rep(reponses.chat ?? { reponse: "Je n'ai rien à dire." }, reponses.chatOk ?? true);
    }
    if (url === "/api/accuser") {
      if (reponses.accuserErreur) throw new Error("réseau");
      return rep(reponses.accuser ?? { gagne: false, message: "Pas assez de preuves." });
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
  test("envoie le message, affiche la réponse et n'inclut pas la narration dans l'historique LLM", async () => {
    await charger({ chat: { reponse: "Bonjour, que voulez-vous ?" } });
    $("message").value = "Salut Victor";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => expect($("dialogue").textContent).toContain("Bonjour, que voulez-vous ?"));
    expect($("dialogue").textContent).toContain("Vous : Salut Victor");
    expect($("message").value).toBe("");

    const appel = global.fetch.mock.calls.find(([u]) => u === "/api/chat");
    const corps = JSON.parse(appel[1].body);
    expect(corps.message).toBe("Salut Victor");
    // L'intro système ne doit pas partir dans l'historique transmis au modèle.
    expect(corps.historique.some((t) => t.role === "systeme")).toBe(false);
  });

  test("ignore un message vide (pas d'appel au serveur)", async () => {
    await charger();
    $("message").value = "   ";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));
    expect(global.fetch.mock.calls.some(([u]) => u === "/api/chat")).toBe(false);
  });

  test("affiche l'erreur serveur quand la réponse n'est pas OK", async () => {
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

describe("accusation", () => {
  test("verdict gagnant affiche l'écran « affaire résolue »", async () => {
    await charger({ accuser: { gagne: true, message: "Vous l'avez confondu." } });
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("Coupable"));
    boutonParTexte($("modale-contenu"), "Coupable").click();

    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("AFFAIRE RÉSOLUE"));
    expect($("modale-contenu").textContent).toContain("Vous l'avez confondu.");
    expect(boutonParTexte($("modale-contenu"), "Rejouer")).toBeTruthy();
  });

  test("verdict perdant invite à poursuivre l'enquête", async () => {
    await charger({ accuser: { gagne: false, message: "Trop tôt pour accuser." } });
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("Innocent"));
    boutonParTexte($("modale-contenu"), "Innocent").click();

    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("ENQUÊTE À POURSUIVRE"));
    boutonParTexte($("modale-contenu"), "Continuer").click();
    expect($("modale").classList.contains("cache")).toBe(true);
  });

  test("« Annuler » referme la modale d'accusation", async () => {
    await charger();
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale").classList.contains("cache")).toBe(false));
    boutonParTexte($("modale-contenu"), "Annuler").click();
    expect($("modale").classList.contains("cache")).toBe(true);
  });

  test("signale une panne réseau à l'accusation", async () => {
    await charger({ accuserErreur: true });
    $("btn-accuser").click();
    await vi.waitFor(() => expect($("modale-contenu").textContent).toContain("Coupable"));
    boutonParTexte($("modale-contenu"), "Coupable").click();
    await vi.waitFor(() =>
      expect($("modale-contenu").textContent).toContain("Impossible de soumettre l'accusation"),
    );
  });
});

describe("animation de la réponse", () => {
  test("affiche un curseur pendant la frappe, qu'un clic dans le dialogue fige", async () => {
    await charger({ chat: { reponse: "Bonjour à vous, cher enquêteur." } });
    // Désactive le « mouvement réduit » : la frappe s'anime (timers réels, ~18ms/car).
    window.matchMedia = () => ({ matches: false });

    $("message").value = "Salut";
    $("saisie").dispatchEvent(new Event("submit", { cancelable: true }));

    // Le caret apparaît pendant l'animation…
    await vi.waitFor(() => expect($("dialogue").textContent).toContain("▌"));
    // …et un clic la fige sur le texte complet.
    $("dialogue").dispatchEvent(new Event("click"));
    await vi.waitFor(() => {
      expect($("dialogue").textContent).not.toContain("▌");
      expect($("dialogue").textContent).toContain("Bonjour à vous, cher enquêteur.");
    });
  });
});

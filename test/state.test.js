import { describe, test, expect } from "vitest";
import {
  etatInitial,
  ramasser,
  donner,
  examiner,
  ajouterDialogue,
} from "../public/state.js";

// Fixtures minimales — on teste la logique pure, indépendamment du vrai scénario.
// Le front ne dérive plus de flags : il tient le sac (affichage) et le JOURNAL DE
// GESTES envoyé au serveur (qui, lui, dérive les flags).
const objets = {
  chocolats: { nom: "Chocolats", ramassable: true },
  cle: { nom: "Clé", ramassable: true },
  tableau: { nom: "Tableau", ramassable: false },
};

describe("etatInitial", () => {
  test("démarre avec sac, historique et gestes vides", () => {
    expect(etatInitial()).toEqual({ sac: [], historique: [], gestes: [] });
  });
});

describe("ramasser", () => {
  test("ajoute un objet ramassable au sac et journalise le geste", () => {
    const apres = ramasser(etatInitial(), "chocolats", objets);
    expect(apres.sac).toEqual(["chocolats"]);
    expect(apres.gestes).toEqual([{ geste: "ramasser", cible: "chocolats" }]);
  });

  test("ne mute pas l'état d'origine (immutabilité)", () => {
    const avant = etatInitial();
    ramasser(avant, "chocolats", objets);
    expect(avant).toEqual({ sac: [], historique: [], gestes: [] });
  });

  test("ignore un objet non ramassable (ni sac, ni geste)", () => {
    const apres = ramasser(etatInitial(), "tableau", objets);
    expect(apres.sac).toEqual([]);
    expect(apres.gestes).toEqual([]);
  });

  test("ne duplique ni l'objet dans le sac ni le geste", () => {
    const une = ramasser(etatInitial(), "chocolats", objets);
    const deux = ramasser(une, "chocolats", objets);
    expect(deux.sac).toEqual(["chocolats"]);
    expect(deux.gestes).toEqual([{ geste: "ramasser", cible: "chocolats" }]);
  });
});

describe("donner", () => {
  test("journalise le geste si l'objet est dans le sac", () => {
    const avecSac = ramasser(etatInitial(), "chocolats", objets);
    const apres = donner(avecSac, "chocolats");
    expect(apres.gestes).toContainEqual({ geste: "donner", cible: "chocolats" });
  });

  test("ne journalise rien si l'objet n'est pas dans le sac", () => {
    const apres = donner(etatInitial(), "chocolats");
    expect(apres.gestes).toEqual([]);
  });
});

describe("examiner", () => {
  test("journalise le geste examiner:cible", () => {
    const apres = examiner(etatInitial(), "tableau");
    expect(apres.gestes).toEqual([{ geste: "examiner", cible: "tableau" }]);
  });

  test("ne duplique pas un examen répété", () => {
    const une = examiner(etatInitial(), "tableau");
    const deux = examiner(une, "tableau");
    expect(deux.gestes).toEqual([{ geste: "examiner", cible: "tableau" }]);
  });
});

describe("ajouterDialogue", () => {
  test("ajoute une réplique à l'historique sans muter l'origine", () => {
    const avant = etatInitial();
    const apres = ajouterDialogue(avant, "joueur", "Bonjour");
    expect(apres.historique).toEqual([{ role: "joueur", texte: "Bonjour" }]);
    expect(avant.historique).toEqual([]);
  });
});

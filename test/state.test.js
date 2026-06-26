import { describe, test, expect } from "vitest";
import {
  etatInitial,
  ramasser,
  donner,
  examiner,
  ajouterDialogue,
} from "../public/state.js";

// Fixtures minimales — on teste la logique pure, indépendamment du vrai scénario.
const objets = {
  chocolats: { nom: "Chocolats", ramassable: true },
  cle: { nom: "Clé", ramassable: true },
  tableau: { nom: "Tableau", ramassable: false },
};
const declencheurs = {
  "ramasser:chocolats": "chocolats_trouves",
  "donner:chocolats": "chocolats_donnes",
  "examiner:tableau": "code_lu",
};

describe("etatInitial", () => {
  test("démarre avec flags, sac et historique vides", () => {
    expect(etatInitial()).toEqual({ flags: [], sac: [], historique: [] });
  });
});

describe("ramasser", () => {
  test("ajoute un objet ramassable au sac et pose son flag", () => {
    const apres = ramasser(etatInitial(), "chocolats", objets, declencheurs);
    expect(apres.sac).toEqual(["chocolats"]);
    expect(apres.flags).toEqual(["chocolats_trouves"]);
  });

  test("ne mute pas l'état d'origine (immutabilité)", () => {
    const avant = etatInitial();
    ramasser(avant, "chocolats", objets, declencheurs);
    expect(avant).toEqual({ flags: [], sac: [], historique: [] });
  });

  test("ignore un objet non ramassable", () => {
    const apres = ramasser(etatInitial(), "tableau", objets, declencheurs);
    expect(apres.sac).toEqual([]);
  });

  test("ne duplique pas un objet déjà dans le sac", () => {
    const une = ramasser(etatInitial(), "chocolats", objets, declencheurs);
    const deux = ramasser(une, "chocolats", objets, declencheurs);
    expect(deux.sac).toEqual(["chocolats"]);
    expect(deux.flags).toEqual(["chocolats_trouves"]);
  });

  test("ramasser un objet sans déclencheur n'ajoute aucun flag", () => {
    const apres = ramasser(etatInitial(), "cle", objets, declencheurs);
    expect(apres.sac).toEqual(["cle"]);
    expect(apres.flags).toEqual([]);
  });
});

describe("donner", () => {
  test("pose le flag social si l'objet est dans le sac", () => {
    const avecSac = ramasser(etatInitial(), "chocolats", objets, declencheurs);
    const apres = donner(avecSac, "chocolats", declencheurs);
    expect(apres.flags).toContain("chocolats_donnes");
  });

  test("ne pose aucun flag si l'objet n'est pas dans le sac", () => {
    const apres = donner(etatInitial(), "chocolats", declencheurs);
    expect(apres.flags).toEqual([]);
  });
});

describe("examiner", () => {
  test("pose le flag du déclencheur examiner:cible", () => {
    const apres = examiner(etatInitial(), "tableau", declencheurs);
    expect(apres.flags).toEqual(["code_lu"]);
  });

  test("une cible sans déclencheur ne change pas les flags", () => {
    const apres = examiner(etatInitial(), "fenetre", declencheurs);
    expect(apres.flags).toEqual([]);
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

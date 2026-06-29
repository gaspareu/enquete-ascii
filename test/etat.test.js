import { describe, test, expect } from "vitest";
import { deriverFlags } from "../server/etat.js";

// Fixtures minimales — on teste la dérivation pure, indépendamment du vrai scénario.
const scenario = {
  objets: {
    chocolats: { nom: "Chocolats", ramassable: true },
    cle: { nom: "Clé", ramassable: true },
    tableau: { nom: "Tableau", ramassable: false },
  },
  declencheurs: {
    "ramasser:chocolats": "chocolats_trouves",
    "donner:chocolats": "chocolats_donnes",
    "examiner:tableau": "code_lu",
  },
};

const g = (geste, cible) => ({ geste, cible });

describe("deriverFlags", () => {
  test("un journal vide ne donne aucun flag", () => {
    expect(deriverFlags(scenario, [])).toEqual([]);
  });

  test("ramasser un objet ramassable pose son flag", () => {
    expect(deriverFlags(scenario, [g("ramasser", "chocolats")])).toEqual([
      "chocolats_trouves",
    ]);
  });

  test("ramasser un objet non ramassable ne pose aucun flag", () => {
    expect(deriverFlags(scenario, [g("ramasser", "tableau")])).toEqual([]);
  });

  test("ramasser un objet sans déclencheur reste légitime mais sans flag", () => {
    expect(deriverFlags(scenario, [g("ramasser", "cle")])).toEqual([]);
  });

  test("examiner pose le flag du déclencheur examiner:cible", () => {
    expect(deriverFlags(scenario, [g("examiner", "tableau")])).toEqual([
      "code_lu",
    ]);
  });

  // Cœur de l'anti-triche : un flag social ne peut pas être obtenu en envoyant le
  // geste « donner » sans avoir d'abord « ramassé » l'objet (précondition : sac).
  test("donner sans avoir ramassé l'objet ne pose aucun flag", () => {
    expect(deriverFlags(scenario, [g("donner", "chocolats")])).toEqual([]);
  });

  test("ramasser puis donner pose le flag social", () => {
    const flags = deriverFlags(scenario, [
      g("ramasser", "chocolats"),
      g("donner", "chocolats"),
    ]);
    expect(flags).toContain("chocolats_trouves");
    expect(flags).toContain("chocolats_donnes");
  });

  test("l'ordre compte : donner avant ramasser dans le journal n'ouvre rien", () => {
    const flags = deriverFlags(scenario, [
      g("donner", "chocolats"),
      g("ramasser", "chocolats"),
    ]);
    expect(flags).toContain("chocolats_trouves");
    expect(flags).not.toContain("chocolats_donnes");
  });

  test("les gestes répétés ne dupliquent pas les flags", () => {
    const flags = deriverFlags(scenario, [
      g("ramasser", "chocolats"),
      g("ramasser", "chocolats"),
    ]);
    expect(flags).toEqual(["chocolats_trouves"]);
  });

  test("un geste malformé est simplement ignoré (robustesse)", () => {
    const flags = deriverFlags(scenario, [
      { geste: "voler", cible: "chocolats" },
      { geste: "ramasser", cible: 42 },
      null,
      g("ramasser", "chocolats"),
    ]);
    expect(flags).toEqual(["chocolats_trouves"]);
  });
});

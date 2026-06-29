import { describe, test, expect } from "vitest";
import { scenario, ciblesConnues } from "../data/scenario.js";

describe("ciblesConnues", () => {
  test("réunit les ids d'objets et les cibles des déclencheurs", () => {
    const cibles = ciblesConnues({
      objets: { chocolats: {}, cle: {} },
      declencheurs: { "examiner:porte": "porte_vue", "ramasser:chocolats": "x" },
    });
    expect(cibles).toEqual(new Set(["chocolats", "cle", "porte"]));
  });

  test("couvre toutes les cibles du vrai scénario", () => {
    const cibles = ciblesConnues();
    expect(cibles.has("chocolats")).toBe(true);
    expect(cibles.has("cle_rouillee")).toBe(true);
    expect(cibles.has("tableau")).toBe(true);
    // Le défaut porte sur le scénario réel importé.
    expect(cibles.has("chocolats")).toBe(ciblesConnues(scenario).has("chocolats"));
  });
});

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
    expect(cibles.has("theiere")).toBe(true);
    expect(cibles.has("plaquette_somniferes")).toBe(true);
    expect(cibles.has("cadeau_cache")).toBe(true);
    expect(cibles.has("grand_cru")).toBe(true);
    // Un objet d'ambiance est lui aussi reconnu, sinon ses gestes seraient rejetés
    // à la validation HTTP.
    expect(cibles.has("photos_mariage")).toBe(true);
    expect(cibles.has("theiere")).toBe(ciblesConnues(scenario).has("theiere"));
  });
});

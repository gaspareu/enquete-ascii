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

describe("illustrations de zones", () => {
  test("associe une illustration publique à chaque zone explorée", () => {
    expect(Object.values(scenario.zones).map((zone) => zone.illustration)).toEqual([
      "/images/nord.jpeg",
      "/images/nord-est.jpeg",
      "/images/est.jpeg",
      "/images/sud-est.jpeg",
      "/images/sud.jpeg",
      "/images/sud-ouest.jpeg",
      "/images/ouest.jpeg",
      "/images/nord-ouest.jpeg",
    ]);
  });
});

describe("fouille de la corbeille", () => {
  test("propose les nouveaux documents parmi les trouvailles de la zone sud-est", () => {
    expect(scenario.zones.SE.nom).toBe("corbeille à papier");
    expect(scenario.zones.SE.objetsCaches).toEqual(
      expect.arrayContaining(["brochure_vente_appartement", "courrier_syndic_dechire"]),
    );
    expect(scenario.objets.brochure_vente_appartement.nom).toContain("vente de l'appartement");
    expect(scenario.objets.courrier_syndic_dechire.nom).toContain("syndic");
  });
});

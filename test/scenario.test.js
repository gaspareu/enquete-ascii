import { describe, test, expect } from "vitest";
import { scenario } from "../data/scenario.js";

describe("contrat de scénario", () => {
  test("déclare les conditions d'action comme un contrat secret et vide pour l'enquête actuelle", () => {
    expect(scenario.conditionsActions).toEqual({});
  });

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

  test("propose les documents de la corbeille parmi les trouvailles sud-est", () => {
    expect(scenario.zones.SE.nom).toBe("corbeille à papier");
    expect(scenario.zones.SE.objetsCaches).toEqual(
      expect.arrayContaining(["brochure_vente_appartement", "courrier_syndic_dechire"]),
    );
    expect(scenario.objets.brochure_vente_appartement.nom).toContain("vente de l'appartement");
    expect(scenario.objets.courrier_syndic_dechire.nom).toContain("syndic");
  });
});

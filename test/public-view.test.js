import { describe, test, expect } from "vitest";
import { vuePublique } from "../server/chat.js";
import { scenario } from "../data/scenario.js";

describe("vuePublique", () => {
  const vue = vuePublique(scenario);

  test("expose ce dont le frontend a besoin pour dessiner la pièce", () => {
    expect(vue.titre).toBe(scenario.titre);
    expect(vue.intro).toBe(scenario.intro);
    expect(vue.personnage.nom).toBe(scenario.personnage.nom);
    expect(vue.zones).toBeDefined();
    expect(vue.objets.chocolats.nom).toBe("Chocolats");
    expect(vue.objets.chocolats.ramassable).toBe(true);
    expect(vue.declencheurs).toBeDefined();
  });

  test("expose le visage ASCII du personnage (donnée publique pour le rendu)", () => {
    expect(vue.personnage.visage).toBeDefined();
    expect(vue.personnage.visage).toBe(scenario.personnage.visage);
  });

  test("n'expose pas les descriptions d'objets (servies à l'examen)", () => {
    expect(vue.objets.tableau.description).toBeUndefined();
  });

  test("ne fuite jamais les secrets du scénario", () => {
    expect(vue.connaissances).toBeUndefined();
    expect(vue.solution).toBeUndefined();
    expect(vue.personnage.personnalite).toBeUndefined();
    expect(vue.personnage.faitsDeBase).toBeUndefined();

    const json = JSON.stringify(vue).toLowerCase();
    expect(json).not.toContain("fiole de poison");
    expect(json).not.toContain("le code du coffre");
  });
});

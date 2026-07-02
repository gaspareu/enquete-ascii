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
    expect(vue.objets.grand_cru.nom).toBe("Grand cru");
    expect(vue.objets.grand_cru.ramassable).toBe(true);
  });

  test("expose le visage ASCII du personnage (donnée publique pour le rendu)", () => {
    expect(vue.personnage.visage).toBeDefined();
    expect(vue.personnage.visage).toBe(scenario.personnage.visage);
  });

  test("n'expose ni description ni aperçu des objets (servis à l'examen)", () => {
    expect(vue.objets.plaquette_somniferes.description).toBeUndefined();
    expect(vue.objets.plaquette_somniferes.apercu).toBeUndefined();
  });

  test("ne fuite jamais les secrets du scénario", () => {
    expect(vue.connaissances).toBeUndefined();
    expect(vue.solution).toBeUndefined();
    expect(vue.personnage.personnalite).toBeUndefined();
    expect(vue.personnage.faitsDeBase).toBeUndefined();
    // Le mapping geste→flag reste secret côté serveur (anti-triche).
    expect(vue.declencheurs).toBeUndefined();
    expect(vue.preconditions).toBeUndefined();

    const json = JSON.stringify(vue).toLowerCase();
    expect(json).not.toContain("au nom de laurent"); // révélation de la plaquette
    expect(json).not.toContain("infidèle"); // mobile / aveu
  });

  test("expose les questions du débrief (id + libellé) pour le formulaire", () => {
    expect(Array.isArray(vue.debrief.questions)).toBe(true);
    expect(vue.debrief.questions.length).toBe(4);
    const qui = vue.debrief.questions.find((q) => q.id === "qui");
    expect(typeof qui.question).toBe("string");
    expect(qui.question.length).toBeGreaterThan(0);
  });

  test("ne fuite jamais le barème ni les rangs du débrief", () => {
    for (const q of vue.debrief.questions) {
      expect(q.bareme).toBeUndefined();
    }
    expect(vue.debrief.rangs).toBeUndefined();
    const json = JSON.stringify(vue.debrief).toLowerCase();
    expect(json).not.toContain("reçu de pharmacie");
    expect(json).not.toContain("maître enquêteur");
  });
});

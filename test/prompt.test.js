import { describe, test, expect } from "vitest";
import { construitPrompt, construitProjectionPrompt } from "../server/prompt.js";
import { scenario } from "../data/scenario.js";

const fixture = {
  personnage: {
    nom: "Victor",
    personnalite: "Nerveux et évasif.",
    faitsDeBase: ["Tu es le neveu du défunt.", "Tu prétends être innocent."],
  },
  connaissances: [
    {
      id: "secret",
      texte: "Le code du coffre est derrière le tableau.",
      requiert: ["chocolats_donnes"],
      evenementQuandExprime: "victor_evoque_coffre",
    },
    {
      id: "futur",
      texte: "Le faux alibi est démonté.",
      requiert: ["preuve_future"],
      evenementQuandExprime: "victor_evoque_alibi",
    },
  ],
};

describe("construitPrompt", () => {
  test("inclut le nom, la personnalité et les faits de base", () => {
    const p = construitPrompt(fixture, []);
    expect(p).toContain("Victor");
    expect(p).toContain("Nerveux et évasif.");
    expect(p).toContain("Tu es le neveu du défunt.");
  });

  test("n'inclut pas une connaissance ni son événement tant que son flag manque", () => {
    const projection = construitProjectionPrompt(fixture, []);
    expect(projection.system).not.toContain("Le code du coffre est derrière le tableau.");
    expect(projection.system).not.toContain("victor_evoque_coffre");
    expect(projection.evenementsAutorises).toEqual([]);
  });

  test("expose seulement l'événement de la connaissance actuellement exprimable", () => {
    const projection = construitProjectionPrompt(fixture, ["chocolats_donnes"]);
    expect(projection.system).toContain("Le code du coffre est derrière le tableau.");
    expect(projection.system).not.toContain("preuve_future");
    expect(projection.evenementsAutorises).toEqual(["victor_evoque_coffre"]);
  });

  test("conserve un prompt texte pour le scénario réel sans fuite", () => {
    const p = construitPrompt(scenario, []);
    expect(p).toContain("*…*");
    expect(p).toContain("guillemets");
    expect(p.toLowerCase()).not.toContain("infidèle");
    expect(p).not.toContain("conditionsActions");
  });
});

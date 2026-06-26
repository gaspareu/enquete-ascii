import { describe, test, expect } from "vitest";
import { construitPrompt } from "../server/prompt.js";
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
    },
  ],
};

describe("construitPrompt", () => {
  test("inclut le nom et la personnalité du personnage", () => {
    const p = construitPrompt(fixture, []);
    expect(p).toContain("Victor");
    expect(p).toContain("Nerveux et évasif.");
  });

  test("inclut chaque fait de base", () => {
    const p = construitPrompt(fixture, []);
    expect(p).toContain("Tu es le neveu du défunt.");
    expect(p).toContain("Tu prétends être innocent.");
  });

  test("N'INCLUT PAS une connaissance dont le flag requis est absent", () => {
    const p = construitPrompt(fixture, []);
    expect(p).not.toContain("Le code du coffre est derrière le tableau.");
  });

  test("inclut la connaissance une fois le flag requis présent", () => {
    const p = construitPrompt(fixture, ["chocolats_donnes"]);
    expect(p).toContain("Le code du coffre est derrière le tableau.");
  });

  test("inclut la note d'action quand elle est fournie", () => {
    const p = construitPrompt(fixture, [], "Le joueur t'a donné : Chocolats");
    expect(p).toContain("Le joueur t'a donné : Chocolats");
  });

  test("scénario réel : le secret du coffre ne fuite pas sans chocolats_donnes", () => {
    const p = construitPrompt(scenario, []);
    expect(p.toLowerCase()).not.toContain("derrière le tableau");
  });
});

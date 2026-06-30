import { describe, test, expect } from "vitest";
import { artInterlocuteur, rendreDialogue } from "../public/render.js";

describe("artInterlocuteur", () => {
  test("avec un visage personnalisé, l'affiche et inclut le nom", () => {
    const art = artInterlocuteur({ nom: "Victor", visage: "[ O _ O ]" });
    expect(art).toContain("[ O _ O ]");
    expect(art).toContain("Victor");
  });

  test("sans visage, retombe sur le visage générique et inclut le nom", () => {
    const art = artInterlocuteur({ nom: "Victor" });
    expect(art).toContain("Victor");
    expect(art.split("\n").length).toBeGreaterThan(1);
  });

  test("tolère un nom passé en chaîne (rétro-compatibilité)", () => {
    expect(artInterlocuteur("Victor")).toContain("Victor");
  });
});

describe("rendreDialogue", () => {
  test("formate les répliques joueur/personnage avec les bons préfixes", () => {
    const txt = rendreDialogue(
      [
        { role: "joueur", texte: "Salut" },
        { role: "personnage", texte: "Que voulez-vous ?" },
      ],
      "Victor",
    );
    expect(txt).toContain("Vous : Salut");
    expect(txt).toContain("Victor : Que voulez-vous ?");
  });

  test("historique vide donne une chaîne vide", () => {
    expect(rendreDialogue([], "Victor")).toBe("");
  });

  test("affiche la narration système sans préfixe de personnage", () => {
    const txt = rendreDialogue(
      [{ role: "systeme", texte: "Vous ramassez les chocolats." }],
      "Victor",
    );
    expect(txt).toContain("Vous ramassez les chocolats.");
    expect(txt).not.toContain("Victor :");
  });
});

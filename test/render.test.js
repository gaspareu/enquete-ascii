import { describe, test, expect } from "vitest";
import { artInterlocuteur, rendreDialogue } from "../public/render.js";

describe("artInterlocuteur", () => {
  test("contient le nom du personnage et de l'art ASCII", () => {
    const art = artInterlocuteur("Victor");
    expect(art).toContain("Victor");
    expect(art.split("\n").length).toBeGreaterThan(1);
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

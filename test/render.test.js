import { describe, test, expect } from "vitest";
import { artInterlocuteur, rendreDialogue, rendreDebrief } from "../public/render.js";

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

describe("rendreDebrief", () => {
  const resultat = {
    total: 17,
    max: 20,
    rang: "Fin limier",
    details: [
      { id: "qui", question: "Qui ?", note: 5, justification: "Laurent, exact." },
      { id: "mobile", question: "Pourquoi ?", note: 3, justification: "Partiel." },
    ],
  };

  test("affiche le rang et le score global", () => {
    const txt = rendreDebrief(resultat);
    expect(txt).toContain("Fin limier");
    expect(txt).toContain("17 / 20");
  });

  test("affiche la note et la justification de chaque question", () => {
    const txt = rendreDebrief(resultat);
    expect(txt).toContain("Qui ?");
    expect(txt).toContain("5/5");
    expect(txt).toContain("Laurent, exact.");
    expect(txt).toContain("3/5");
  });
});

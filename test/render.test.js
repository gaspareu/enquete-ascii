import { describe, test, expect } from "vitest";
import { artInterlocuteur, rendreDialogue, dialoguePartiel } from "../public/render.js";

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

describe("dialoguePartiel", () => {
  const historique = [
    { role: "joueur", texte: "Salut" },
    { role: "personnage", texte: "Bonjour à vous" },
  ];

  test("tronque le texte du dernier tour au nombre de caractères demandé", () => {
    const txt = dialoguePartiel(historique, "Victor", 3);
    expect(txt).toContain("Victor : Bon");
    expect(txt).not.toContain("Bonjour à vous");
  });

  test("laisse les tours précédents intacts (seul le dernier est tronqué)", () => {
    const txt = dialoguePartiel(historique, "Victor", 3);
    expect(txt).toContain("Vous : Salut");
  });

  test("nCars couvrant tout le texte équivaut à rendreDialogue", () => {
    expect(dialoguePartiel(historique, "Victor", 100)).toBe(
      rendreDialogue(historique, "Victor"),
    );
  });

  test("nCars à 0 n'affiche que le préfixe du dernier tour", () => {
    const txt = dialoguePartiel(historique, "Victor", 0);
    expect(txt).toContain("Victor : ");
    expect(txt).not.toContain("Bonjour");
  });

  test("historique vide donne une chaîne vide", () => {
    expect(dialoguePartiel([], "Victor", 5)).toBe("");
  });
});

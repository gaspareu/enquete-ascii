import { describe, test, expect } from "vitest";
import {
  artInterlocuteur,
  decouperReplique,
  rendreDialogue,
  rendreDebrief,
  structurerDebrief,
  toursDialogue,
} from "../public/render.js";

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

  test("sépare la réaction initiale de la parole du personnage", () => {
    expect(decouperReplique('*Il fronce les sourcils*\n"Pourquoi tu me dis ça ?"')).toEqual({
      reaction: "Il fronce les sourcils",
      parole: '"Pourquoi tu me dis ça ?"',
    });
  });

  test("retire les astérisques de la réaction dans la représentation texte", () => {
    const txt = rendreDialogue(
      [{ role: "personnage", texte: '*Il fronce les sourcils*\n"Pourquoi tu me dis ça ?"' }],
      "Laurent",
    );
    expect(txt).toBe('Il fronce les sourcils\nLaurent : "Pourquoi tu me dis ça ?"');
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

describe("projections de rendu", () => {
  test("préserve le rôle de chaque tour pour l'alignement sémantique", () => {
    expect(toursDialogue([
      { role: "joueur", texte: "Bonjour" },
      { role: "personnage", texte: "Bonsoir." },
      { role: "systeme", texte: "Un bruit retentit." },
    ], "Laurent")).toEqual([
      { role: "joueur", auteur: "Vous", texte: "Bonjour", didascalie: "" },
      { role: "personnage", auteur: "Laurent", texte: "Bonsoir.", didascalie: "" },
      { role: "systeme", auteur: "Système", texte: "Un bruit retentit.", didascalie: "" },
    ]);
  });

  test("structure le feedback de chaque hypothèse sans exiger de conseil", () => {
    expect(structurerDebrief({
      total: 5,
      max: 20,
      rang: "À revoir",
      details: [{ question: "Qui ?", note: 1, justification: "Partiel." }],
    })).toEqual({
      total: 5,
      max: 20,
      rang: "À revoir",
      hypotheses: [{ question: "Qui ?", note: 1, justification: "Partiel.", elementManquant: "" }],
    });
  });
});

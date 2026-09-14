import { describe, expect, test } from "vitest";
import { DIDASCALIES_AUTORISEES, creerFiltreReplique } from "../server/replique.js";

function filtrer(morceaux) {
  const evenements = [];
  const filtre = creerFiltreReplique((evenement) => evenements.push(evenement));
  for (const morceau of morceaux) filtre.ajouter(morceau);
  filtre.terminer();
  return evenements;
}

describe("creerFiltreReplique", () => {
  test("n'autorise pas de geste d'assentiment dans le répertoire décoratif", () => {
    expect(DIDASCALIES_AUTORISEES).toContain("Laurent ajuste le pli de sa manche.");
    expect(DIDASCALIES_AUTORISEES).not.toContain("Laurent hoche lentement la tête.");
  });

  test("isole une didascalie canonique de la parole", () => {
    const didascalie = DIDASCALIES_AUTORISEES[0];
    expect(filtrer([`DIDASCALIE: ${didascalie}\nJe vous écoute.`])).toEqual([
      { type: "didascalie", texte: didascalie },
      { type: "delta", texte: "Je vous écoute." },
    ]);
  });

  test("attend la fin d'un en-tête fragmenté avant de diffuser la parole", () => {
    const didascalie = DIDASCALIES_AUTORISEES[1];
    expect(filtrer(["DIDASC", `ALIE: ${didascalie}\n`, "Parlez-moi de votre soirée."])).toEqual([
      { type: "didascalie", texte: didascalie },
      { type: "delta", texte: "Parlez-moi de votre soirée." },
    ]);
  });

  test("supprime une didascalie marquée mais non autorisée sans contaminer la parole", () => {
    expect(
      filtrer(["DIDASCALIE: Laurent serre la lettre contre lui.\nJe n'ai rien à ajouter."]),
    ).toEqual([{ type: "delta", texte: "Je n'ai rien à ajouter." }]);
  });

  test("supprime une variante non conforme de l'en-tête didascalie", () => {
    expect(filtrer(["Didascalie : Laurent pâlit.\nJe vous répondrai."])).toEqual([
      { type: "delta", texte: "Je vous répondrai." },
    ]);
  });

  test("supprime aussi un marqueur didascalie mal ponctué", () => {
    expect(filtrer(["DIDASCALIE - Laurent pâlit.\nJe vous répondrai."])).toEqual([
      { type: "delta", texte: "Je vous répondrai." },
    ]);
  });

  test("diffuse une parole sans saut de ligne sans lui inventer de didascalie", () => {
    expect(filtrer(["Je ", "vous écoute."])).toEqual([
      { type: "delta", texte: "Je " },
      { type: "delta", texte: "vous écoute." },
    ]);
  });

  test("omet une didascalie seule, même sans saut de ligne final", () => {
    expect(filtrer([`DIDASCALIE: ${DIDASCALIES_AUTORISEES[2]}`])).toEqual([
      { type: "didascalie", texte: DIDASCALIES_AUTORISEES[2] },
    ]);
  });

  test("ne traite jamais une didascalie après la première ligne comme décorative", () => {
    expect(filtrer(["Je vous écoute.\nDIDASCALIE: Laurent reste immobile."])).toEqual([
      { type: "delta", texte: "Je vous écoute.\n" },
      { type: "delta", texte: "DIDASCALIE: Laurent reste immobile." },
    ]);
  });
});

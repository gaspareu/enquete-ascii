import { describe, test, expect } from "vitest";
import { intentionDepuisTexte } from "../public/intention.js";

const vue = {
  zones: {
    N: { nom: "bibliothèque", aliases: ["bibliotheque"] },
    SE: { nom: "corbeille à papier", aliases: ["corbeille", "poubelle"] },
  },
  objets: {
    lettre: { nom: "Lettre", aliases: ["mot"] },
    lettre_complete: { nom: "Lettre complète" },
    cle: { nom: "Petite clé", aliases: ["clé"] },
  },
};

describe("intentionDepuisTexte", () => {
  test("reconnaît une fouille et la zone explicitement nommée", () => {
    expect(intentionDepuisTexte("Je fouille dans la corbeille.", vue)).toEqual({
      action: "fouiller",
      cible: "SE",
    });
  });

  test("reconnaît examiner, ramasser et donner sans les autoriser", () => {
    expect(intentionDepuisTexte("J'examine la Petite clé", vue)).toEqual({
      action: "examiner",
      cible: "cle",
    });
    expect(intentionDepuisTexte("Je prends la clé", vue)).toEqual({
      action: "ramasser",
      cible: "cle",
    });
    expect(intentionDepuisTexte("Je tends la lettre à Laurent", vue)).toEqual({
      action: "donner",
      cible: "lettre",
    });
  });

  test("privilégie le nom ou alias le plus long", () => {
    expect(intentionDepuisTexte("J'examine la lettre complète", vue)).toEqual({
      action: "examiner",
      cible: "lettre_complete",
    });
  });

  test("ne transforme pas une phrase libre en dialogue", () => {
    expect(intentionDepuisTexte("Pourquoi Laurent ment-il ?", vue)).toBeNull();
  });
});

import { describe, test, expect } from "vitest";
import { intentionDepuisTexte } from "../public/intention.js";

const vue = {
  zones: {
    N: { nom: "bibliothèque", aliases: ["bibliotheque"] },
    E: { nom: "plateau à tisane", aliases: ["tisanes"] },
    SE: { nom: "corbeille à papier", aliases: ["corbeille", "poubelle"] },
    O: { nom: "secrétaire", aliases: ["bureau"] },
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

  test("reconnaît les formulations naturelles et la zone observée", () => {
    expect(intentionDepuisTexte("Je cherche dans la corbeille.", vue)).toEqual({
      action: "fouiller",
      cible: "SE",
    });
    expect(intentionDepuisTexte("J'inspecte la pièce à l'est.", vue)).toEqual({
      action: "fouiller",
      cible: "E",
    });
    expect(intentionDepuisTexte("Je fouille ici.", vue, { type: "zone", id: "N" })).toEqual({
      action: "fouiller",
      cible: "N",
    });
  });

  test("reconnaît les questions sur une zone affichée ou nommée", () => {
    expect(intentionDepuisTexte("Qu'il y a t'il dans cette zone ?", vue, {
      type: "zone",
      id: "N",
    })).toEqual({
      action: "fouiller",
      cible: "N",
    });
    expect(intentionDepuisTexte("Qu'y a-t-il sur le bureau ?", vue)).toEqual({
      action: "fouiller",
      cible: "O",
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

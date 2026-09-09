import { describe, test, expect } from "vitest";
import { deriverEtat } from "../server/etat.js";

const scenario = {
  objets: {
    chocolats: { nom: "Chocolats", ramassable: true },
    cle: { nom: "Clé", ramassable: true },
    tableau: { nom: "Tableau", ramassable: false },
  },
  declencheurs: {
    "ramasser:chocolats": "chocolats_trouves",
    "donner:chocolats": "chocolats_donnes",
    "examiner:tableau": "code_lu",
  },
  preconditions: {
    "examiner:tableau": ["chocolats_donnes"],
  },
};

const contexte = { type: "zone", id: "N" };
const e = (type, cible, autreContexte = contexte) => ({ type, cible, contexte: autreContexte });

describe("deriverEtat", () => {
  test("un journal vérifié vide donne un état vide", () => {
    expect(deriverEtat(scenario, [])).toEqual({ sac: [], flags: [], actionsEffectuees: [] });
  });

  test("dérive le sac et les flags depuis les seuls événements canoniques", () => {
    const etat = deriverEtat(scenario, [e("ramasser", "chocolats"), e("ramasser", "cle")]);
    expect(etat.sac).toEqual(["chocolats", "cle"]);
    expect(etat.flags).toEqual(["chocolats_trouves"]);
    expect(etat.actionsEffectuees).toEqual(["ramasser:chocolats", "ramasser:cle"]);
  });

  test("respecte l'ordre strict du sac pour donner", () => {
    const avant = deriverEtat(scenario, [e("donner", "chocolats"), e("ramasser", "chocolats")]);
    const apres = deriverEtat(scenario, [e("ramasser", "chocolats"), e("donner", "chocolats")]);

    expect(avant.flags).not.toContain("chocolats_donnes");
    expect(apres.flags).toContain("chocolats_donnes");
  });

  test("résout les préconditions de flags au point fixe et sans doublon", () => {
    const etat = deriverEtat(scenario, [
      e("examiner", "tableau"),
      e("ramasser", "chocolats"),
      e("ramasser", "chocolats"),
      e("donner", "chocolats"),
    ]);

    expect(etat.flags).toEqual(["chocolats_trouves", "chocolats_donnes", "code_lu"]);
    expect(etat.actionsEffectuees).toEqual([
      "examiner:tableau",
      "ramasser:chocolats",
      "donner:chocolats",
    ]);
  });

  test("ignore un événement qui ne respecte pas le contrat vérifié", () => {
    const etat = deriverEtat(scenario, [
      { type: "ramasser", cible: "chocolats" },
      e("voler", "chocolats"),
      e("ramasser", "inconnu"),
    ]);

    expect(etat).toEqual({ sac: [], flags: [], actionsEffectuees: [] });
  });

  test("conserve un événement de dialogue exprimé pour les conditions d'action", () => {
    const etat = deriverEtat(scenario, [
      e("dialogue", "laurent_demande_stylo", { type: "personnage", id: "laurent" }),
    ]);

    expect(etat.actionsEffectuees).toEqual(["laurent_demande_stylo"]);
  });
});

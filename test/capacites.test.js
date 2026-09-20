import { describe, test, expect } from "vitest";
import { evaluerCapacite } from "../server/capacites.js";

const scenario = {
  personnage: { id: "laurent" },
  zones: {
    N: { objetsCaches: ["livre", "stylo"] },
    S: { objetsCaches: ["lettre"] },
  },
  objets: {
    livre: { ramassable: false },
    stylo: { ramassable: true },
    lettre: { ramassable: true },
  },
  conditionsActions: {
    "examiner:stylo": { requiertTous: ["laurent_demande_stylo", "encre_tasse_identifiee"] },
  },
};

const laurent = { type: "personnage", id: "laurent" };
const nord = { type: "zone", id: "N" };
const sud = { type: "zone", id: "S" };
const etat = (sac = [], actionsEffectuees = []) => ({ sac, flags: [], actionsEffectuees });
const demande = (action, cible) => ({ action, cible });

describe("evaluerCapacite — matrice spatiale", () => {
  test("un objet caché ne peut être examiné ou ramassé avant la fouille signée", () => {
    expect(evaluerCapacite(scenario, etat(), { contexte: nord, intention: demande("examiner", "livre") }).ok).toBe(false);
    expect(evaluerCapacite(scenario, etat(), { contexte: nord, intention: demande("ramasser", "stylo") }).ok).toBe(false);
    expect(evaluerCapacite(scenario, etat([], ["fouiller:N"]), { contexte: nord, intention: demande("examiner", "livre") })).toEqual({ ok: true });
  });
  test("dialogue avec le personnage déclaré par le scénario", () => {
    const autre = { ...scenario, personnage: { id: "camille" } };
    const contexte = { type: "personnage", id: "camille" };
    expect(evaluerCapacite(autre, etat(), { contexte, intention: demande("dialoguer", "camille") })).toEqual({ ok: true });
    expect(evaluerCapacite(autre, etat(), { contexte, intention: demande("dialoguer", "laurent") }).ok).toBe(false);
  });
  test("face à Laurent, accepte le dialogue et l'inventaire mais pas une cible de zone", () => {
    expect(evaluerCapacite(scenario, etat(["stylo"]), { contexte: laurent, intention: demande("dialoguer", "laurent") })).toEqual({ ok: true });
    expect(evaluerCapacite(scenario, etat(["lettre"]), { contexte: laurent, intention: demande("examiner", "lettre") })).toEqual({ ok: true });
    expect(evaluerCapacite(scenario, etat(["stylo"]), { contexte: laurent, intention: demande("donner", "stylo") })).toEqual({ ok: true });
    expect(evaluerCapacite(scenario, etat(), { contexte: laurent, intention: demande("examiner", "livre") })).toEqual({ ok: false, code: "CIBLE_HORS_PORTEE" });
  });

  test("dans une zone, accepte sa fouille, ses objets et le sac, mais pas Laurent ou une autre zone", () => {
    expect(evaluerCapacite(scenario, etat(), { contexte: nord, intention: demande("fouiller", "N") })).toEqual({ ok: true });
    expect(evaluerCapacite(scenario, etat([], ["fouiller:N"]), { contexte: nord, intention: demande("examiner", "livre") })).toEqual({ ok: true });
    expect(evaluerCapacite(scenario, etat(["lettre"]), { contexte: nord, intention: demande("examiner", "lettre") })).toEqual({ ok: true });
    expect(evaluerCapacite(scenario, etat(), { contexte: nord, intention: demande("examiner", "lettre") })).toEqual({ ok: false, code: "CIBLE_HORS_PORTEE" });
    expect(evaluerCapacite(scenario, etat(["stylo"]), { contexte: nord, intention: demande("donner", "stylo") })).toEqual({ ok: false, code: "CONTEXTE_INTERDIT" });
    expect(evaluerCapacite(scenario, etat(), { contexte: nord, intention: demande("dialoguer", "laurent") })).toEqual({ ok: false, code: "CONTEXTE_INTERDIT" });
    expect(evaluerCapacite(scenario, etat(), { contexte: nord, intention: demande("fouiller", "S") })).toEqual({ ok: false, code: "CONTEXTE_INTERDIT" });
  });
});

describe("evaluerCapacite — progression requiertTous", () => {
  test.each([
    [[], false],
    [["laurent_demande_stylo"], false],
    [["encre_tasse_identifiee"], false],
    [["laurent_demande_stylo", "encre_tasse_identifiee"], true],
  ])("n'autorise qu'avec tous les événements requis (%j)", (actions, attendu) => {
    const resultat = evaluerCapacite(scenario, etat([], ["fouiller:N", ...actions]), {
      contexte: nord,
      intention: demande("examiner", "stylo"),
    });
    expect(resultat).toEqual(attendu ? { ok: true } : { ok: false, code: "PROGRESSION_INSUFFISANTE" });
  });

  test("l'absence de conditions conserve le comportement existant", () => {
    expect(evaluerCapacite(scenario, etat([], ["fouiller:S"]), { contexte: sud, intention: demande("examiner", "lettre") })).toEqual({ ok: true });
  });
});

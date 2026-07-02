import { describe, test, expect } from "vitest";
import { valideRequeteChat, valideGestes, valideDebrief } from "../server/validate.js";

const ciblesConnues = new Set(["chocolats", "cle_rouillee", "tableau"]);
const g = (geste, cible) => ({ geste, cible });

describe("valideRequeteChat", () => {
  test("accepte une requête bien formée et normalise les champs", () => {
    const r = valideRequeteChat(
      {
        message: "  Bonjour  ",
        gestes: [g("ramasser", "chocolats")],
        historique: [{ role: "joueur", texte: "Salut" }],
        note: "Le joueur t'a donné : Chocolats",
      },
      ciblesConnues,
    );
    expect(r.ok).toBe(true);
    expect(r.valeur.message).toBe("Bonjour");
    expect(r.valeur.gestes).toEqual([g("ramasser", "chocolats")]);
    expect(r.valeur.note).toBe("Le joueur t'a donné : Chocolats");
  });

  test("applique des valeurs par défaut pour les champs optionnels", () => {
    const r = valideRequeteChat({ message: "Salut" }, ciblesConnues);
    expect(r.ok).toBe(true);
    expect(r.valeur.gestes).toEqual([]);
    expect(r.valeur.historique).toEqual([]);
    expect(r.valeur.note).toBe("");
  });

  test("rejette un body qui n'est pas un objet", () => {
    expect(valideRequeteChat(null, ciblesConnues).ok).toBe(false);
    expect(valideRequeteChat("x", ciblesConnues).ok).toBe(false);
  });

  test("rejette un message vide ou manquant", () => {
    expect(valideRequeteChat({ message: "   " }, ciblesConnues).ok).toBe(false);
    expect(valideRequeteChat({}, ciblesConnues).ok).toBe(false);
  });

  test("rejette un message trop long", () => {
    const r = valideRequeteChat({ message: "a".repeat(501) }, ciblesConnues);
    expect(r.ok).toBe(false);
  });

  test("rejette un geste portant sur une cible inconnue", () => {
    const r = valideRequeteChat(
      { message: "Salut", gestes: [g("ramasser", "cible_pirate")] },
      ciblesConnues,
    );
    expect(r.ok).toBe(false);
  });

  test("rejette un type de geste inconnu", () => {
    const r = valideRequeteChat(
      { message: "Salut", gestes: [g("voler", "chocolats")] },
      ciblesConnues,
    );
    expect(r.ok).toBe(false);
  });

  test("rejette des gestes qui ne sont pas un tableau", () => {
    const r = valideRequeteChat(
      { message: "Salut", gestes: "x" },
      ciblesConnues,
    );
    expect(r.ok).toBe(false);
  });
});

describe("valideGestes", () => {
  test("accepte un journal valide et normalise chaque entrée", () => {
    const r = valideGestes(
      [{ geste: "donner", cible: "chocolats", extra: "ignoré" }],
      ciblesConnues,
    );
    expect(r.ok).toBe(true);
    expect(r.valeur).toEqual([g("donner", "chocolats")]);
  });

  test("un journal absent vaut un journal vide", () => {
    const r = valideGestes(undefined, ciblesConnues);
    expect(r.ok).toBe(true);
    expect(r.valeur).toEqual([]);
  });

  test("rejette une entrée qui n'est pas un objet", () => {
    expect(valideGestes(["x"], ciblesConnues).ok).toBe(false);
  });

  test("rejette un journal trop long", () => {
    const journal = Array.from({ length: 101 }, () => g("examiner", "tableau"));
    expect(valideGestes(journal, ciblesConnues).ok).toBe(false);
  });
});

describe("valideDebrief", () => {
  const ids = new Set(["qui", "mobile"]);

  test("réponses valides : normalisées { id, reponse }", () => {
    const r = valideDebrief({ reponses: [{ id: "qui", reponse: "Laurent", extra: 1 }] }, ids);
    expect(r.ok).toBe(true);
    expect(r.valeur).toEqual([{ id: "qui", reponse: "Laurent" }]);
  });

  test("réponse vide tolérée (sera notée 0)", () => {
    const r = valideDebrief({ reponses: [{ id: "mobile", reponse: "" }] }, ids);
    expect(r.ok).toBe(true);
  });

  test("id inconnu : rejeté", () => {
    const r = valideDebrief({ reponses: [{ id: "inconnu", reponse: "x" }] }, ids);
    expect(r.ok).toBe(false);
  });

  test("réponse non-chaîne : rejetée", () => {
    const r = valideDebrief({ reponses: [{ id: "qui", reponse: 42 }] }, ids);
    expect(r.ok).toBe(false);
  });

  test("trop de réponses : rejeté", () => {
    const r = valideDebrief(
      { reponses: [{ id: "qui", reponse: "a" }, { id: "mobile", reponse: "b" }, { id: "qui", reponse: "c" }] },
      ids,
    );
    expect(r.ok).toBe(false);
  });

  test("réponse trop longue : tronquée à la borne", () => {
    const r = valideDebrief({ reponses: [{ id: "qui", reponse: "x".repeat(5000) }] }, ids);
    expect(r.ok).toBe(true);
    expect(r.valeur[0].reponse.length).toBe(1000);
  });

  test("corps invalide : rejeté", () => {
    expect(valideDebrief(null, ids).ok).toBe(false);
    expect(valideDebrief({ reponses: "non" }, ids).ok).toBe(false);
  });
});

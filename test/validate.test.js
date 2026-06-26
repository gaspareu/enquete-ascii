import { describe, test, expect } from "vitest";
import { valideRequeteChat } from "../server/validate.js";

const flagsConnus = new Set(["chocolats_trouves", "chocolats_donnes", "code_lu"]);

describe("valideRequeteChat", () => {
  test("accepte une requête bien formée et normalise les champs", () => {
    const r = valideRequeteChat(
      {
        message: "  Bonjour  ",
        flags: ["chocolats_donnes"],
        historique: [{ role: "joueur", texte: "Salut" }],
        note: "Le joueur t'a donné : Chocolats",
      },
      flagsConnus,
    );
    expect(r.ok).toBe(true);
    expect(r.valeur.message).toBe("Bonjour");
    expect(r.valeur.flags).toEqual(["chocolats_donnes"]);
    expect(r.valeur.note).toBe("Le joueur t'a donné : Chocolats");
  });

  test("applique des valeurs par défaut pour les champs optionnels", () => {
    const r = valideRequeteChat({ message: "Salut" }, flagsConnus);
    expect(r.ok).toBe(true);
    expect(r.valeur.flags).toEqual([]);
    expect(r.valeur.historique).toEqual([]);
    expect(r.valeur.note).toBe("");
  });

  test("rejette un body qui n'est pas un objet", () => {
    expect(valideRequeteChat(null, flagsConnus).ok).toBe(false);
    expect(valideRequeteChat("x", flagsConnus).ok).toBe(false);
  });

  test("rejette un message vide ou manquant", () => {
    expect(valideRequeteChat({ message: "   " }, flagsConnus).ok).toBe(false);
    expect(valideRequeteChat({}, flagsConnus).ok).toBe(false);
  });

  test("rejette un message trop long", () => {
    const r = valideRequeteChat({ message: "a".repeat(501) }, flagsConnus);
    expect(r.ok).toBe(false);
  });

  test("rejette un flag inconnu", () => {
    const r = valideRequeteChat(
      { message: "Salut", flags: ["flag_pirate"] },
      flagsConnus,
    );
    expect(r.ok).toBe(false);
  });

  test("rejette des flags qui ne sont pas un tableau", () => {
    const r = valideRequeteChat({ message: "Salut", flags: "x" }, flagsConnus);
    expect(r.ok).toBe(false);
  });
});

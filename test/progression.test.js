import { describe, test, expect } from "vitest";
import {
  creerRecu,
  verifierRecus,
  empreinteRecu,
  MAX_RECUS,
} from "../server/progression.js";

const secret = "secret-de-test-stable";
const contexte = { type: "zone", id: "N" };

function chaineValide() {
  const premier = creerRecu(secret, {
    partie: "partie-test",
    sequence: 1,
    precedent: null,
    evenement: { type: "examiner", cible: "livre", contexte },
  });
  const second = creerRecu(secret, {
    partie: "partie-test",
    sequence: 2,
    precedent: empreinteRecu(premier),
    evenement: { type: "ramasser", cible: "cle", contexte },
  });
  return [premier, second];
}

describe("reçus de progression", () => {
  test("accepte une chaîne vide et une chaîne valide", () => {
    expect(verifierRecus(secret, [])).toMatchObject({ ok: true, evenements: [] });
    const resultat = verifierRecus(secret, chaineValide());
    expect(resultat.ok).toBe(true);
    expect(resultat.partie).toBe("partie-test");
    expect(resultat.evenements.map((e) => e.type)).toEqual(["examiner", "ramasser"]);
  });

  test("rejette une altération du payload, de la signature, de l'ordre ou de la version", () => {
    const chaine = chaineValide();
    const [payload, signature] = chaine[0].split(".");
    const falsifie = `${payload.slice(0, -1)}x.${signature}`;

    expect(verifierRecus(secret, [falsifie]).ok).toBe(false);
    expect(verifierRecus(secret, [chaine[0], chaine[0]]).ok).toBe(false);
    expect(verifierRecus(secret, [chaine[1], chaine[0]]).ok).toBe(false);

    const versionInvalide = creerRecu(secret, {
      partie: "partie-test",
      sequence: 1,
      precedent: null,
      evenement: { type: "examiner", cible: "livre", contexte },
      version: 2,
    });
    expect(verifierRecus(secret, [versionInvalide]).ok).toBe(false);
  });

  test("rejette le mélange de deux parties et une chaîne trop longue", () => {
    const chaine = chaineValide();
    const autre = creerRecu(secret, {
      partie: "autre-partie",
      sequence: 1,
      precedent: null,
      evenement: { type: "examiner", cible: "livre", contexte },
    });

    expect(verifierRecus(secret, [chaine[0], autre]).ok).toBe(false);
    expect(verifierRecus(secret, Array.from({ length: MAX_RECUS + 1 }, () => chaine[0])).ok).toBe(false);
  });

  test("accepte deux fois la même chaîne complète de façon idempotente", () => {
    const chaine = chaineValide();
    expect(verifierRecus(secret, chaine)).toEqual(verifierRecus(secret, [...chaine]));
  });
});

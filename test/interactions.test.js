import { describe, test, expect } from "vitest";
import { executerInteraction } from "../server/interactions.js";
import { creerRecu, empreinteRecu, MAX_RECUS, verifierRecus } from "../server/progression.js";

const secret = "secret-interactions";
const scenario = {
  personnage: { id: "laurent", nom: "Laurent" },
  zones: {
    N: { nom: "table", objetsCaches: ["livre", "cle"] },
    S: { nom: "salon", objetsCaches: ["lettre"] },
  },
  objets: {
    livre: { nom: "Livre", description: "Un livre ouvert.", ramassable: false },
    cle: { nom: "Clé", description: "Une clé gravée.", ramassable: true },
    lettre: { nom: "Lettre", apercu: "Une enveloppe fermée.", description: "Une lettre révélatrice.", ramassable: true },
  },
  declencheurs: { "examiner:lettre": "lettre_lue" },
  preconditions: { "examiner:lettre": ["indice"] },
};

const nord = { type: "zone", id: "N" };
const laurent = { type: "personnage", id: "laurent" };
const vide = () => verifierRecus(secret, []);

function chainePleine() {
  let precedent = null;
  return Array.from({ length: MAX_RECUS }, (_v, index) => {
    const recu = creerRecu(secret, {
      partie: "partie-pleine",
      sequence: index + 1,
      precedent,
      evenement: { type: "examiner", cible: "livre", contexte: nord },
    });
    precedent = empreinteRecu(recu);
    return recu;
  });
}

describe("executerInteraction", () => {
  test("refuse une cible hors zone sans produire de reçu ni de révélation", () => {
    const resultat = executerInteraction({
      scenario,
      secret,
      verification: vide(),
      contexte: nord,
      intention: { action: "examiner", cible: "lettre" },
    });

    expect(resultat).toEqual({ ok: false, code: "CIBLE_HORS_PORTEE" });
  });

  test("examine un objet autorisé, signe l'action et renvoie le sac dérivé", () => {
    const resultat = executerInteraction({
      scenario,
      secret,
      verification: vide(),
      contexte: nord,
      intention: { action: "examiner", cible: "livre" },
    });

    expect(resultat.ok).toBe(true);
    expect(resultat.narration).toBe("Un livre ouvert.");
    expect(resultat.recus).toHaveLength(1);
    expect(resultat.etatPublic).toEqual({ sac: [] });
    expect(verifierRecus(secret, resultat.recus).evenements[0]).toMatchObject({
      type: "examiner",
      cible: "livre",
      contexte: nord,
    });
  });

  test("ramasser puis donner dérive le sac côté serveur et autorise seulement le face-à-face", () => {
    const ramassage = executerInteraction({
      scenario,
      secret,
      verification: vide(),
      contexte: nord,
      intention: { action: "ramasser", cible: "cle" },
    });
    const verification = verifierRecus(secret, ramassage.recus);
    const remise = executerInteraction({
      scenario,
      secret,
      verification,
      contexte: laurent,
      intention: { action: "donner", cible: "cle" },
    });

    expect(ramassage.etatPublic.sac).toEqual(["cle"]);
    expect(remise.ok).toBe(true);
    expect(remise.narration).toContain("Clé");
    expect(remise.etatPublic.sac).toEqual(["cle"]);
    expect(verifierRecus(secret, [...ramassage.recus, ...remise.recus]).evenements).toHaveLength(2);
  });

  test("fouiller signe tous les examens autorisés avant de calculer les descriptions", () => {
    const resultat = executerInteraction({
      scenario,
      secret,
      verification: vide(),
      contexte: nord,
      intention: { action: "fouiller", cible: "N" },
    });

    expect(resultat.ok).toBe(true);
    expect(resultat.recus).toHaveLength(2);
    expect(resultat.narration).toContain("Livre — Un livre ouvert.");
    expect(resultat.narration).toContain("Clé — Une clé gravée.");
  });

  test("fouiller n'expose pas un objet dont l'examen est bloqué par la progression", () => {
    const verrouille = {
      ...scenario,
      conditionsActions: {
        "examiner:cle": { requiertTous: ["condition_absente"] },
      },
    };
    const resultat = executerInteraction({
      scenario: verrouille,
      secret,
      verification: vide(),
      contexte: nord,
      intention: { action: "fouiller", cible: "N" },
    });

    expect(resultat.ok).toBe(true);
    expect(resultat.recus).toHaveLength(1);
    expect(resultat.narration).toContain("Livre — Un livre ouvert.");
    expect(resultat.narration).not.toContain("Clé — Une clé gravée.");
  });

  test("refuse proprement une nouvelle action quand le journal a atteint sa borne", () => {
    const resultat = executerInteraction({
      scenario,
      secret,
      verification: verifierRecus(secret, chainePleine()),
      contexte: nord,
      intention: { action: "examiner", cible: "livre" },
    });

    expect(resultat).toEqual({ ok: false, code: "PROGRESSION_INSUFFISANTE" });
  });
});

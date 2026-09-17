import { describe, test, expect } from "vitest";
import {
  valideContexte,
  valideIntention,
  valideRecus,
  valideRequeteInteraction,
  valideRequeteChat,
  valideRequeteInterprete,
  valideDebrief,
  valideRequeteVoix,
} from "../server/validate.js";

const scenario = {
  personnage: { id: "laurent" },
  zones: { N: { objetsCaches: ["tableau"] }, S: { objetsCaches: [] } },
  objets: { chocolats: { ramassable: true }, tableau: { ramassable: false } },
};

describe("validation du contexte et de l'intention", () => {
  test("normalise un contexte Laurent ou une zone existante", () => {
    expect(valideContexte({ type: "personnage", id: "laurent", cache: true }, scenario)).toEqual({
      ok: true,
      valeur: { type: "personnage", id: "laurent" },
    });
    expect(valideContexte({ type: "zone", id: "N" }, scenario)).toEqual({
      ok: true,
      valeur: { type: "zone", id: "N" },
    });
  });

  test("rejette contexte et cible inconnus", () => {
    expect(valideContexte({ type: "zone", id: "E" }, scenario).ok).toBe(false);
    expect(valideContexte({ type: "personnage", id: "victor" }, scenario).ok).toBe(false);
    expect(valideIntention({ action: "examiner", cible: "pirate" }, scenario).ok).toBe(false);
  });

  test("normalise les intentions sans champs parasites", () => {
    expect(valideIntention({ action: "examiner", cible: "tableau", flag: "forge" }, scenario)).toEqual({
      ok: true,
      valeur: { action: "examiner", cible: "tableau" },
    });
    expect(valideIntention({ action: "fouiller", cible: "N" }, scenario)).toEqual({
      ok: true,
      valeur: { action: "fouiller", cible: "N" },
    });
    expect(valideIntention({ action: "dialoguer", cible: "laurent" }, scenario).ok).toBe(false);
  });
});

describe("valideRecus", () => {
  test("accepte une liste de chaînes opaques et refuse une forme abusive", () => {
    expect(valideRecus(["recu-a", "recu-b"])).toEqual({ ok: true, valeur: ["recu-a", "recu-b"] });
    expect(valideRecus("recu-a").ok).toBe(false);
    expect(valideRecus([42]).ok).toBe(false);
    expect(valideRecus(["x".repeat(4097)]).ok).toBe(false);
  });
});

describe("valideRequeteInteraction", () => {
  test("accepte et normalise uniquement le contrat contextuel", () => {
    const r = valideRequeteInteraction(
      {
        contexte: { type: "zone", id: "N" },
        intention: { action: "examiner", cible: "tableau", secret: true },
        recus: ["opaque"],
        flags: ["forge"],
      },
      scenario,
    );
    expect(r).toEqual({
      ok: true,
      valeur: {
        contexte: { type: "zone", id: "N" },
        intention: { action: "examiner", cible: "tableau" },
        recus: ["opaque"],
      },
    });
  });

  test("rejette les champs structurants absents ou malformés", () => {
    expect(valideRequeteInteraction({}, scenario).ok).toBe(false);
    expect(valideRequeteInteraction({ contexte: { type: "zone", id: "N" }, intention: { action: "voler", cible: "tableau" } }, scenario).ok).toBe(false);
  });
});

describe("valideRequeteChat", () => {
  test("accepte une requête face à Laurent et retire les tours de scène", () => {
    const r = valideRequeteChat(
      {
        message: "  Bonjour  ",
        contexte: { type: "personnage", id: "laurent" },
        recus: ["opaque"],
        historique: [
          { role: "joueur", texte: "Salut", canal: "laurent" },
          { role: "systeme", texte: "Fouille", canal: "scene" },
        ],
        flags: ["forgés"],
      },
      scenario,
    );
    expect(r.ok).toBe(true);
    expect(r.valeur).toEqual({
      message: "Bonjour",
      contexte: { type: "personnage", id: "laurent" },
      recus: ["opaque"],
      historique: [{ role: "joueur", texte: "Salut" }],
    });
  });

  test("rejette message vide, trop long ou contexte invalide", () => {
    expect(valideRequeteChat({ message: "   " }, scenario).ok).toBe(false);
    expect(valideRequeteChat({ message: "x".repeat(501), contexte: { type: "personnage", id: "laurent" } }, scenario).ok).toBe(false);
    expect(valideRequeteChat({ message: "Bonjour", contexte: { type: "zone", id: "N" } }, scenario).ok).toBe(true);
  });
});

describe("valideRequeteInterprete", () => {
  test("normalise le texte, le contexte et les reçus sans accepter de décision cliente", () => {
    expect(
      valideRequeteInterprete(
        {
          message: "  Que voyez-vous sur la table ?  ",
          contexte: { type: "zone", id: "N" },
          recus: ["opaque"],
          decision: { type: "interagir", cibleId: "tableau" },
        },
        scenario,
      ),
    ).toEqual({
      ok: true,
      valeur: {
        message: "Que voyez-vous sur la table ?",
        contexte: { type: "zone", id: "N" },
        recus: ["opaque"],
      },
    });
  });

  test("refuse un texte vide, trop long ou un contexte invalide", () => {
    expect(valideRequeteInterprete({}, scenario).ok).toBe(false);
    expect(valideRequeteInterprete({ message: "x".repeat(501), contexte: { type: "zone", id: "N" }, recus: [] }, scenario).ok).toBe(false);
    expect(valideRequeteInterprete({ message: "Bonjour", contexte: { type: "zone", id: "E" }, recus: [] }, scenario).ok).toBe(false);
  });
});

describe("valideDebrief", () => {
  const ids = new Set(["qui", "mobile"]);

  test("réponses valides : normalisées { id, reponse }", () => {
    const r = valideDebrief({ reponses: [{ id: "qui", reponse: "Laurent", extra: 1 }] }, ids);
    expect(r.ok).toBe(true);
    expect(r.valeur).toEqual([{ id: "qui", reponse: "Laurent" }]);
  });

  test("id inconnu et réponses non textuelles : rejetés", () => {
    expect(valideDebrief({ reponses: [{ id: "inconnu", reponse: "x" }] }, ids).ok).toBe(false);
    expect(valideDebrief({ reponses: [{ id: "qui", reponse: 42 }] }, ids).ok).toBe(false);
  });
});

describe("valideRequeteVoix", () => {
  test("texte valide : ok + texte trimmé", () => {
    expect(valideRequeteVoix({ texte: "  Bonjour  " })).toEqual({
      ok: true,
      valeur: { texte: "Bonjour" },
    });
  });

  test("texte absent ou trop long : refus", () => {
    expect(valideRequeteVoix({}).ok).toBe(false);
    expect(valideRequeteVoix({ texte: "a".repeat(2001) }).ok).toBe(false);
  });
});

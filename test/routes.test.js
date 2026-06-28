import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { creerRouteur } from "../server/chat.js";
import { scenario, flagsConnus } from "../data/scenario.js";

// Monte le routeur du jeu sur une app jetable. Les dépendances sont injectées
// (client, modèle, repondreFn) pour tester sans appel réseau.
function faireApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    creerRouteur({
      scenario,
      flagsConnus: flagsConnus(scenario),
      client: {},
      model: "modele-test",
      repondreFn: async () => "Réponse de test.",
      ...overrides,
    }),
  );
  return app;
}

describe("GET /scenario", () => {
  test("renvoie la vue publique sans fuiter de secret", async () => {
    const res = await request(faireApp()).get("/api/scenario");
    expect(res.status).toBe(200);
    expect(res.body.titre).toBe(scenario.titre);
    expect(res.body.personnage.nom).toBe(scenario.personnage.nom);

    const json = JSON.stringify(res.body).toLowerCase();
    expect(json).not.toContain("fiole de poison");
    expect(res.body.connaissances).toBeUndefined();
  });
});

describe("POST /examiner", () => {
  test("cible connue : renvoie la description-révélation et le flag", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "tableau" });
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe(scenario.objets.tableau.description);
    expect(res.body.flag).toBe("code_coffre_lu");
  });

  test("cible absente ou non-chaîne : texte par défaut et flag null", async () => {
    const res = await request(faireApp()).post("/api/examiner").send({});
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe("Rien de particulier ici.");
    expect(res.body.flag).toBeNull();
  });
});

describe("POST /chat", () => {
  test("requête invalide : 400 avec message d'erreur", async () => {
    const res = await request(faireApp())
      .post("/api/chat")
      .send({ message: "" });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("clé API absente (client null) : 503", async () => {
    const res = await request(faireApp({ client: null }))
      .post("/api/chat")
      .send({ message: "Bonjour" });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ANTHROPIC_API_KEY");
  });

  test("requête valide : 200 et délègue à repondreFn avec le bon contexte", async () => {
    const repondreFn = vi.fn(async () => "Bonjour à vous.");
    const res = await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({ message: "Bonjour", flags: ["chocolats_donnes"] });

    expect(res.status).toBe(200);
    expect(res.body.reponse).toBe("Bonjour à vous.");
    expect(repondreFn).toHaveBeenCalledOnce();
    const [, args] = repondreFn.mock.calls[0];
    expect(args.message).toBe("Bonjour");
    expect(args.model).toBe("modele-test");
    expect(typeof args.system).toBe("string");
  });

  test("repondreFn échoue : 502 et l'erreur n'est pas avalée", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const repondreFn = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    const res = await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({ message: "Bonjour" });

    expect(res.status).toBe(502);
    expect(res.body.erreur).toBeDefined();
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });
});

describe("POST /accuser", () => {
  test("bon verdict et preuve réunie : partie gagnée", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, flags: ["code_coffre_lu"] });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(true);
  });

  test("ignore les flags inconnus envoyés par le client (front non fiable)", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, flags: ["code_coffre_lu", "flag_bidon_injecte"] });
    // Le flag forgé est filtré : le verdict reste calculé sur les vraies preuves.
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(true);
  });

  test("verdict et flags absents : valeurs par défaut sûres, partie perdue", async () => {
    const res = await request(faireApp()).post("/api/accuser").send({});
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });
});

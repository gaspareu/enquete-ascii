import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { creerRouteur } from "../server/chat.js";
import { scenario, ciblesConnues } from "../data/scenario.js";

// Monte le routeur du jeu sur une app jetable. Les dépendances sont injectées
// (client, modèle, repondreFn) pour tester sans appel réseau.
function faireApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    creerRouteur({
      scenario,
      ciblesConnues: ciblesConnues(scenario),
      client: {},
      model: "modele-test",
      repondreFn: async () => "Réponse de test.",
      ...overrides,
    }),
  );
  return app;
}

const g = (geste, cible) => ({ geste, cible });

describe("GET /scenario", () => {
  test("renvoie la vue publique sans fuiter de secret ni le mapping des flags", async () => {
    const res = await request(faireApp()).get("/api/scenario");
    expect(res.status).toBe(200);
    expect(res.body.titre).toBe(scenario.titre);
    expect(res.body.personnage.nom).toBe(scenario.personnage.nom);

    const json = JSON.stringify(res.body).toLowerCase();
    expect(json).not.toContain("fiole de poison");
    expect(res.body.connaissances).toBeUndefined();
    // Le mapping geste→flag est désormais un secret serveur.
    expect(res.body.declencheurs).toBeUndefined();
  });
});

describe("POST /examiner", () => {
  test("cible connue : renvoie la description-révélation (sans nom de flag)", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "tableau" });
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe(scenario.objets.tableau.description);
    expect(res.body.flag).toBeUndefined();
  });

  test("cible absente ou non-chaîne : texte par défaut", async () => {
    const res = await request(faireApp()).post("/api/examiner").send({});
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe("Rien de particulier ici.");
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
      .send({ message: "Bonjour", gestes: [g("ramasser", "chocolats")] });

    expect(res.status).toBe(200);
    expect(res.body.reponse).toBe("Bonjour à vous.");
    expect(repondreFn).toHaveBeenCalledOnce();
    const [, args] = repondreFn.mock.calls[0];
    expect(args.message).toBe("Bonjour");
    expect(args.model).toBe("modele-test");
    expect(typeof args.system).toBe("string");
  });

  test("anti-triche : un journal incomplet ne débloque pas la connaissance secrète", async () => {
    const repondreFn = vi.fn(async () => "…");
    // « donner » sans « ramasser » : la précondition (objet en sac) n'est pas remplie,
    // donc chocolats_donnes n'est pas dérivé et la connaissance reste verrouillée.
    await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({ message: "Où est le code ?", gestes: [g("donner", "chocolats")] });
    const [, args] = repondreFn.mock.calls[0];
    expect(args.system.toLowerCase()).not.toContain("code du coffre");
  });

  test("séquence légitime : la connaissance se débloque côté serveur", async () => {
    const repondreFn = vi.fn(async () => "…");
    await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({
        message: "Où est le code ?",
        gestes: [g("ramasser", "chocolats"), g("donner", "chocolats")],
      });
    const [, args] = repondreFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("code du coffre");
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
  test("séquence légitime (preuve réunie) et bon verdict : partie gagnée", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: [g("examiner", "tableau")] });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(true);
  });

  test("anti-triche : un flag forgé dans la requête est ignoré (front non fiable)", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: [], flags: ["code_coffre_lu"] });
    // Aucun geste légitime → aucune preuve dérivée → l'accusation ne tient pas.
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });

  test("verdict et gestes absents : valeurs par défaut sûres, partie perdue", async () => {
    const res = await request(faireApp()).post("/api/accuser").send({});
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });

  test("journal de gestes invalide : 400", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: [g("voler", "chocolats")] });
    expect(res.status).toBe(400);
  });
});

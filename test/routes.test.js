import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { creerRouteur } from "../server/chat.js";
import { scenario, ciblesConnues } from "../data/scenario.js";

// Monte le routeur du jeu sur une app jetable. Les dépendances sont injectées
// (client, modèle, repondreFluxFn) pour tester sans appel réseau.
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
      repondreFluxFn: async (_client, _args, onTexte) => onTexte("Réponse de test."),
      ...overrides,
    }),
  );
  return app;
}

const g = (geste, cible) => ({ geste, cible });

// Séquence d'examens qui réunit les trois preuves requises pour gagner.
const SEQUENCE_GAGNANTE = [
  g("examiner", "theiere"), // -> double_tasse
  g("examiner", "plaquette_somniferes"), // -> recu_laurent_vu (précond double_tasse)
  g("examiner", "cadeau_cache"), // -> fete_decouverte
  g("examiner", "lettre_dettes"), // -> mobile_dettes
];

describe("GET /scenario", () => {
  test("renvoie la vue publique sans fuiter de secret ni le mapping des flags", async () => {
    const res = await request(faireApp()).get("/api/scenario");
    expect(res.status).toBe(200);
    expect(res.body.titre).toBe(scenario.titre);
    expect(res.body.personnage.nom).toBe(scenario.personnage.nom);

    const json = JSON.stringify(res.body).toLowerCase();
    expect(json).not.toContain("au nom de laurent");
    expect(json).not.toContain("infidèle");
    expect(res.body.connaissances).toBeUndefined();
    expect(res.body.declencheurs).toBeUndefined();
  });
});

describe("POST /examiner", () => {
  // Bascule : la plaquette n'avoue le reçu de Laurent qu'après avoir constaté la
  // deuxième tasse (double_tasse). Avant, on ne sert que l'aperçu non-spoiler.
  test("plaquette sans l'indice : aperçu non-spoiler, pas la révélation", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "plaquette_somniferes", gestes: [] });
    expect(res.status).toBe(200);
    expect(res.body.texte.toLowerCase()).not.toContain("au nom de laurent");
    expect(res.body.texte).toBe(scenario.objets.plaquette_somniferes.apercu);
  });

  test("plaquette après la séquence légitime : la révélation complète", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({
        cible: "plaquette_somniferes",
        gestes: [g("examiner", "theiere"), g("examiner", "plaquette_somniferes")],
      });
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe(scenario.objets.plaquette_somniferes.description);
  });

  test("objet d'ambiance (photos de mariage) : toujours révélé, sans condition", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "photos_mariage", gestes: [] });
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe(scenario.objets.photos_mariage.description);
  });

  test("cible absente ou non-chaîne : texte par défaut", async () => {
    const res = await request(faireApp()).post("/api/examiner").send({});
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe("Rien de particulier ici.");
  });
});

describe("POST /chat", () => {
  test("requête invalide : 400 JSON avec message d'erreur", async () => {
    const res = await request(faireApp()).post("/api/chat").send({ message: "" });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("clé API absente (client null) : 503 JSON", async () => {
    const res = await request(faireApp({ client: null }))
      .post("/api/chat")
      .send({ message: "Bonjour" });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ANTHROPIC_API_KEY");
  });

  test("requête valide : flux SSE 200 avec trames delta puis fin", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => {
      onTexte("Bonjour");
      onTexte(" à vous.");
    });
    const res = await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Bonjour", gestes: [g("ramasser", "grand_cru")] });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("event: delta");
    expect(res.text).toContain('data: {"texte":"Bonjour"}');
    expect(res.text).toContain('data: {"texte":" à vous."}');
    expect(res.text).toContain("event: fin");

    expect(repondreFluxFn).toHaveBeenCalledOnce();
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.message).toBe("Bonjour");
    expect(args.model).toBe("modele-test");
    expect(typeof args.system).toBe("string");
  });

  test("anti-triche : un journal incomplet ne débloque pas la connaissance secrète", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => onTexte("…"));
    // « donner » sans « ramasser » : la précondition de sac n'est pas remplie,
    // donc confiance_gagnee n'est pas dérivé et la connaissance reste verrouillée.
    await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Parlez-moi de la soirée.", gestes: [g("donner", "grand_cru")] });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).not.toContain("monté toi-même");
  });

  test("séquence légitime : la connaissance se débloque côté serveur", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => onTexte("…"));
    await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({
        message: "Parlez-moi de la soirée.",
        gestes: [g("ramasser", "grand_cru"), g("donner", "grand_cru")],
      });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("monté toi-même");
  });

  test("erreur pendant le flux : 200 + trame erreur (non avalée)", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const repondreFluxFn = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    const res = await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Bonjour" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("event: erreur");
    expect(res.text).toContain("injoignable");
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });
});

describe("POST /accuser", () => {
  test("séquence légitime (3 preuves réunies) et bon verdict : partie gagnée", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: SEQUENCE_GAGNANTE });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(true);
  });

  test("anti-triche : la plaquette « à froid » (sans double_tasse) ne réunit pas la preuve", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: [g("examiner", "plaquette_somniferes")] });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });

  test("anti-triche : des flags forgés dans la requête sont ignorés (front non fiable)", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({
        verdict: true,
        gestes: [],
        flags: ["recu_laurent_vu", "fete_decouverte", "mobile_dettes"],
      });
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
      .send({ verdict: true, gestes: [g("voler", "theiere")] });
    expect(res.status).toBe(400);
  });
});

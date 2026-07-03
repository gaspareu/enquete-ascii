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
      voix: { apiKey: "k", voiceId: "v", model: "m" },
      synthetiserFn: async () => Buffer.from([9, 9, 9]),
      noterFn: async () => [
        { id: "qui", note: 5, justification: "ok" },
        { id: "comment", note: 4, justification: "ok" },
        { id: "mobile", note: 3, justification: "ok" },
        { id: "surprise", note: 5, justification: "ok" },
      ],
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

describe("POST /debrief", () => {
  const reponsesOk = [
    { id: "qui", reponse: "Laurent l'a empoisonnée." },
    { id: "mobile", reponse: "Jalousie et dettes." },
  ];

  test("réponses valides : 200 avec total, max, rang et détails", async () => {
    const res = await request(faireApp()).post("/api/debrief").send({ reponses: reponsesOk });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(17);
    expect(res.body.max).toBe(20);
    expect(typeof res.body.rang).toBe("string");
    expect(res.body.details).toHaveLength(4);
  });

  test("réponses invalides (id inconnu) : 400", async () => {
    const res = await request(faireApp())
      .post("/api/debrief")
      .send({ reponses: [{ id: "inconnu", reponse: "x" }] });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("clé API absente (client null) : 503", async () => {
    const res = await request(faireApp({ client: null }))
      .post("/api/debrief")
      .send({ reponses: reponsesOk });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ANTHROPIC_API_KEY");
  });

  test("échec du juge : 502 (non avalé)", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const noterFn = async () => {
      throw new Error("juge HS");
    };
    const res = await request(faireApp({ noterFn }))
      .post("/api/debrief")
      .send({ reponses: reponsesOk });
    expect(res.status).toBe(502);
    expect(typeof res.body.erreur).toBe("string");
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });

  test("transmet réponses et modèle au juge", async () => {
    const noterFn = vi.fn(async () => []);
    await request(faireApp({ noterFn })).post("/api/debrief").send({ reponses: reponsesOk });
    expect(noterFn).toHaveBeenCalledOnce();
    const [, args] = noterFn.mock.calls[0];
    expect(args.model).toBe("modele-test");
    expect(args.reponses).toEqual(reponsesOk);
  });
});

describe("POST /voix", () => {
  test("texte valide : 200 audio/mpeg avec l'audio synthétisé", async () => {
    const res = await request(faireApp())
      .post("/api/voix")
      .send({ texte: "Bonjour à vous." });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBe(3);
  });

  test("texte invalide : 400 JSON", async () => {
    const res = await request(faireApp()).post("/api/voix").send({ texte: "" });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("voix non configurée : 503 JSON", async () => {
    const res = await request(faireApp({ voix: null }))
      .post("/api/voix")
      .send({ texte: "Bonjour" });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ELEVENLABS_API_KEY");
  });

  test("échec de synthèse : 502 (non avalé)", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const synthetiserFn = async () => {
      throw new Error("TTS HS");
    };
    const res = await request(faireApp({ synthetiserFn }))
      .post("/api/voix")
      .send({ texte: "Bonjour" });
    expect(res.status).toBe(502);
    expect(typeof res.body.erreur).toBe("string");
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });

  test("passe texte, voix, modèle et clé au wrapper", async () => {
    const synthetiserFn = vi.fn(async () => Buffer.from([1]));
    await request(faireApp({ synthetiserFn }))
      .post("/api/voix")
      .send({ texte: "  Salut  " });
    expect(synthetiserFn).toHaveBeenCalledOnce();
    const [, args] = synthetiserFn.mock.calls[0];
    expect(args).toMatchObject({ texte: "Salut", voiceId: "v", model: "m", apiKey: "k" });
  });
});

import express from "express";
import request from "supertest";
import { describe, test, expect, vi } from "vitest";
import { creerRouteur } from "../server/chat.js";
import { creerRecu, verifierRecus } from "../server/progression.js";
import { scenario } from "../data/scenario.js";

const secret = "secret-routes";
const laurent = { type: "personnage", id: "laurent" };
const nord = { type: "zone", id: "N" };

function faireApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    creerRouteur({
      scenario,
      secret,
      client: {},
      model: "modele-test",
      repondreFluxFn: async (_client, _args, onTexte) => {
        onTexte("Réponse de test.");
        return { evenementsExprimes: [] };
      },
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

describe("GET /scenario", () => {
  test("renvoie la vue publique sans conditions, événements ni révélations", async () => {
    const res = await request(faireApp()).get("/api/scenario");
    expect(res.status).toBe(200);
    expect(res.body.objets.grand_cru).toEqual(expect.objectContaining({ nom: "Grand cru", ramassable: true }));
    const json = JSON.stringify(res.body).toLowerCase();
    expect(json).not.toContain("au nom de laurent");
    expect(json).not.toContain("conditionsactions");
    expect(json).not.toContain("declencheurs");
    expect(json).not.toContain("preconditions");
    expect(json).not.toContain("evenementquandexprime");
    expect(json).not.toContain("objetscaches");
    expect(json).not.toContain("pistesinterrogatoire");
  });
});

describe("POST /interagir", () => {
  test("rejette une requête ou une chaîne de reçus malformée avec 400", async () => {
    const invalide = await request(faireApp()).post("/api/interagir").send({});
    const falsifie = await request(faireApp()).post("/api/interagir").send({
      contexte: nord,
      intention: { action: "examiner", cible: "distinction" },
      recus: ["faux.recu"],
    });
    expect(invalide.status).toBe(400);
    expect(falsifie.status).toBe(400);
  });

  test("réserve le dialogue à /chat au lieu de l'exécuteur d'interactions", async () => {
    const res = await request(faireApp()).post("/api/interagir").send({
      contexte: laurent,
      intention: { action: "dialoguer", cible: "laurent" },
      recus: [],
    });
    expect(res.status).toBe(400);
  });

  test("refuse une cible hors contexte sans décrire de secret", async () => {
    const res = await request(faireApp()).post("/api/interagir").send({
      contexte: nord,
      intention: { action: "examiner", cible: "plaquette_somniferes" },
      recus: [],
    });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("laurent");
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("precondition");
  });

  test("exécute une interaction autorisée et fournit un reçu vérifiable", async () => {
    const res = await request(faireApp()).post("/api/interagir").send({
      contexte: nord,
      intention: { action: "examiner", cible: "distinction" },
      recus: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.narration).toBe(scenario.objets.distinction.description);
    expect(res.body.etatPublic).toEqual({ sac: [] });
    expect(verifierRecus(secret, res.body.recus).ok).toBe(true);
    expect(res.body.pistes).toEqual(["Comment avez-vous vécu la récente réussite d'Hélène ?"]);
  });

  test("le sac et la remise sont reconstruits à partir des reçus", async () => {
    const app = faireApp();
    const ramassage = await request(app).post("/api/interagir").send({
      contexte: { type: "zone", id: "NO" },
      intention: { action: "ramasser", cible: "grand_cru" },
      recus: [],
    });
    const remise = await request(app).post("/api/interagir").send({
      contexte: laurent,
      intention: { action: "donner", cible: "grand_cru" },
      recus: ramassage.body.recus,
    });
    expect(ramassage.body.etatPublic.sac).toEqual(["grand_cru"]);
    expect(remise.status).toBe(200);
    expect(remise.body.narration).toContain("Grand cru");
  });

  test("fouille une seule zone, signe l'action et ne renvoie que des noms", async () => {
    const res = await request(faireApp()).post("/api/interagir").send({
      contexte: nord,
      intention: { action: "fouiller", cible: "N" },
      recus: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.narration).toContain("Distinction d'architecture");
    expect(res.body.narration).not.toContain("ENCORE elle");
    expect(res.body.recus).toHaveLength(1);
    expect(verifierRecus(secret, res.body.recus).evenements[0].type).toBe("fouiller");
    expect(res.body.pistes).toEqual([]);
  });

  test("n'affiche pas une piste issue d'une révélation conditionnelle non relue", async () => {
    const app = faireApp();
    const plaquette = await request(app).post("/api/interagir").send({
      contexte: { type: "zone", id: "SE" },
      intention: { action: "examiner", cible: "plaquette_somniferes" },
      recus: [],
    });
    const theiere = await request(app).post("/api/interagir").send({
      contexte: { type: "zone", id: "E" },
      intention: { action: "examiner", cible: "theiere" },
      recus: plaquette.body.recus,
    });

    expect(plaquette.body.narration).toContain("la version de Laurent se tient");
    expect(theiere.body.pistes).toContain("Qui a partagé la tisane d'Hélène ce soir-là ?");
    expect(theiere.body.pistes.join(" ")).not.toContain("achat de ces somnifères à votre nom");
  });
});

describe("POST /chat", () => {
  test("refuse le dialogue hors Laurent avant tout appel Claude", async () => {
    const repondreFluxFn = vi.fn();
    const res = await request(faireApp({ repondreFluxFn })).post("/api/chat").send({
      message: "Bonjour",
      contexte: nord,
      recus: [],
      historique: [],
    });
    expect(res.status).toBe(403);
    expect(repondreFluxFn).not.toHaveBeenCalled();
  });

  test("requête valide : flux SSE delta, progression puis fin, avec mémoire Laurent seulement", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onEvenement) => {
      onEvenement({ type: "didascalie", texte: "Laurent joint les mains." });
      onEvenement({ type: "delta", texte: "Bonjour" });
      onEvenement({ type: "delta", texte: " à vous." });
      return { evenementsExprimes: [] };
    });
    const res = await request(faireApp({ repondreFluxFn })).post("/api/chat").send({
      message: "Bonjour",
      contexte: laurent,
      recus: [],
      historique: [
        { role: "joueur", texte: "Ancien échange", canal: "laurent" },
        { role: "systeme", texte: "Fouille de N", canal: "scene" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain("event: didascalie");
    expect(res.text).toContain("event: delta");
    expect(res.text).toContain("event: progression");
    expect(res.text.indexOf("event: progression")).toBeLessThan(res.text.indexOf("event: fin"));
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.historique).toEqual([{ role: "joueur", texte: "Ancien échange" }]);
    expect(args.message).toBe("Bonjour");
  });

  test("ignore un événement de dialogue non autorisé et ne signe qu'un événement proposé", async () => {
    const scenarioAvecEvenement = {
      ...scenario,
      connaissances: [
        ...scenario.connaissances,
        { id: "fait_test", texte: "Tu viens de dire un fait test.", requiert: [], evenementQuandExprime: "fait_test" },
      ],
    };
    const repondreFluxFn = async () => ({ evenementsExprimes: ["fait_test", "fait_futur"] });
    const res = await request(faireApp({ scenario: scenarioAvecEvenement, repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Parlez", contexte: laurent, recus: [], historique: [] });
    const progression = JSON.parse(res.text.match(/event: progression\ndata: (.+)\n\n/)[1]);
    expect(progression.recus).toHaveLength(1);
    expect(verifierRecus(secret, progression.recus).evenements[0].cible).toBe("fait_test");
  });

  test("ne propose ni ne re-signe un événement de dialogue déjà acquis", async () => {
    const scenarioAvecEvenement = {
      ...scenario,
      connaissances: [
        ...scenario.connaissances,
        { id: "fait_test", texte: "Tu viens de dire un fait test.", requiert: [], evenementQuandExprime: "fait_test" },
      ],
    };
    const recuDejaAcquis = creerRecu(secret, {
      partie: "partie-deja-acquise",
      sequence: 1,
      precedent: null,
      evenement: { type: "dialogue", cible: "fait_test", contexte: laurent },
    });
    const repondreFluxFn = vi.fn(async () => ({ evenementsExprimes: ["fait_test"] }));
    const res = await request(faireApp({ scenario: scenarioAvecEvenement, repondreFluxFn }))
      .post("/api/chat")
      .send({ message: "Parlez", contexte: laurent, recus: [recuDejaAcquis], historique: [] });

    const [, args] = repondreFluxFn.mock.calls[0];
    const progression = JSON.parse(res.text.match(/event: progression\ndata: (.+)\n\n/)[1]);
    expect(args.evenementsAutorises).toEqual([]);
    expect(progression.recus).toEqual([]);
  });

  test("clé API absente : 503 seulement après le contrôle de contexte", async () => {
    const res = await request(faireApp({ client: null }))
      .post("/api/chat")
      .send({ message: "Bonjour", contexte: laurent, recus: [], historique: [] });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ANTHROPIC_API_KEY");
  });

  test("erreur pendant le flux : trame erreur sans progression", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(faireApp({ repondreFluxFn: async () => { throw new Error("réseau coupé"); } }))
      .post("/api/chat")
      .send({ message: "Bonjour", contexte: laurent, recus: [], historique: [] });
    expect(res.status).toBe(200);
    expect(res.text).toContain("event: erreur");
    expect(res.text).not.toContain("event: progression");
    erreurLog.mockRestore();
  });
});

describe("POST /debrief et /voix", () => {
  test("conserve les contrats de débrief et de synthèse vocale", async () => {
    const debrief = await request(faireApp()).post("/api/debrief").send({
      reponses: [{ id: "qui", reponse: "Laurent." }],
    });
    const voix = await request(faireApp()).post("/api/voix").send({ texte: "Bonjour" });
    expect(debrief.status).toBe(200);
    expect(debrief.body.total).toBe(17);
    expect(voix.status).toBe(200);
    expect(voix.headers["content-type"]).toContain("audio/mpeg");
  });
});

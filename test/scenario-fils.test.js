import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { deriverEtat } from "../server/etat.js";
import { creerRouteur } from "../server/chat.js";
import { creerRecu, empreinteRecu } from "../server/progression.js";
import { scenario } from "../data/scenario.js";

const secret = "secret-fils";
const contexteZone = { type: "zone", id: "N" };
const contexteLaurent = { type: "personnage", id: "laurent" };
const e = (type, cible, contexte = contexteZone) => ({ type, cible, contexte });

function recusPour(evenements) {
  let precedent = null;
  return evenements.map((evenement, index) => {
    const recu = creerRecu(secret, {
      partie: "partie-fils",
      sequence: index + 1,
      precedent,
      evenement,
    });
    precedent = empreinteRecu(recu);
    return recu;
  });
}

function faireApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api", creerRouteur({
    scenario,
    secret,
    client: {},
    model: "modele-test",
    repondreFluxFn: async (_c, _a, onTexte) => {
      onTexte("…");
      return { evenementsExprimes: [] };
    },
    ...overrides,
  }));
  return app;
}

describe("dérivation des fils (vrai scénario)", () => {
  test("fil ACTE : la 2e tasse débloque la lecture du reçu de la plaquette", () => {
    const etat = deriverEtat(scenario, [e("examiner", "theiere"), e("examiner", "plaquette_somniferes")]);
    expect(etat.flags).toContain("double_tasse");
    expect(etat.flags).toContain("recu_laurent_vu");
  });

  test("fil SURPRISE : la fête découverte débloque la relecture du mot", () => {
    const etat = deriverEtat(scenario, [e("examiner", "cadeau_cache"), e("examiner", "mot_manuscrit")]);
    expect(etat.flags).toContain("fete_decouverte");
    expect(etat.flags).toContain("invitation_lue");
  });

  test("fil MOBILE : le téléphone éclaire l'agenda, même si l'examen est antérieur", () => {
    const etat = deriverEtat(scenario, [e("examiner", "agenda"), e("examiner", "telephone")]);
    expect(etat.flags).toContain("controle_vu");
    expect(etat.flags).toContain("rdv_eclaircis");
  });

  test("les remises exigent toujours le ramassage préalable dans les reçus", () => {
    const incomplet = deriverEtat(scenario, [e("donner", "grand_cru", contexteLaurent)]);
    const complet = deriverEtat(scenario, [
      e("ramasser", "grand_cru", { type: "zone", id: "NO" }),
      e("donner", "grand_cru", contexteLaurent),
    ]);
    expect(incomplet.flags).not.toContain("confiance_gagnee");
    expect(complet.flags).toContain("confiance_gagnee");
  });
});

describe("bascules HTTP /interagir", () => {
  test("le mot manuscrit reste un faux adieu avant la fête, puis se révèle avec la chaîne signée", async () => {
    const app = faireApp();
    const fouilleS = recusPour([e("fouiller", "S", { type: "zone", id: "S" })]);
    const froid = await request(app).post("/api/interagir").send({
      contexte: { type: "zone", id: "S" },
      intention: { action: "examiner", cible: "mot_manuscrit" },
      recus: fouilleS,
    });
    expect(froid.body.narration).toBe(scenario.objets.mot_manuscrit.apercu);

    const recus = recusPour([
      e("fouiller", "S", { type: "zone", id: "S" }),
      e("fouiller", "SO", { type: "zone", id: "SO" }),
      e("examiner", "cadeau_cache", { type: "zone", id: "SO" }),
    ]);
    const chaud = await request(app).post("/api/interagir").send({
      contexte: { type: "zone", id: "S" },
      intention: { action: "examiner", cible: "mot_manuscrit" },
      recus,
    });
    expect(chaud.body.narration).toBe(scenario.objets.mot_manuscrit.description);
  });

  test("l'agenda est éclairci après le téléphone dans une chaîne signée", async () => {
    const chaud = await request(faireApp()).post("/api/interagir").send({
      contexte: { type: "zone", id: "NE" },
      intention: { action: "examiner", cible: "agenda" },
      recus: recusPour([
        e("fouiller", "NE", { type: "zone", id: "NE" }),
        e("fouiller", "O", { type: "zone", id: "O" }),
        e("examiner", "telephone", { type: "zone", id: "O" }),
      ]),
    });
    expect(chaud.body.narration).toBe(scenario.objets.agenda.description);
  });
});

describe("connaissances conditionnelles dans /chat", () => {
  test("la chaîne complète du mot injecte l'effondrement sans transmettre les actions au body", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => {
      onTexte("…");
      return { evenementsExprimes: [] };
    });
    await request(faireApp({ repondreFluxFn })).post("/api/chat").send({
      message: "Vous la croyiez infidèle ?",
      contexte: contexteLaurent,
      recus: recusPour([
        e("examiner", "cadeau_cache", { type: "zone", id: "SO" }),
        e("examiner", "mot_manuscrit", { type: "zone", id: "S" }),
        e("ramasser", "mot_manuscrit", { type: "zone", id: "S" }),
        e("donner", "mot_manuscrit", contexteLaurent),
      ]),
      historique: [],
    });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("infidèle");
  });
});

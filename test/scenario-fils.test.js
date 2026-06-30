import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { deriverFlags } from "../server/etat.js";
import { creerRouteur } from "../server/chat.js";
import { scenario, ciblesConnues } from "../data/scenario.js";

const g = (geste, cible) => ({ geste, cible });

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
      repondreFluxFn: async (_c, _a, onTexte) => onTexte("…"),
      ...overrides,
    }),
  );
  return app;
}

describe("dérivation des fils (vrai scénario)", () => {
  test("fil ACTE : la 2e tasse débloque la lecture du reçu de la plaquette", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "theiere"),
      g("examiner", "plaquette_somniferes"),
    ]);
    expect(flags).toContain("double_tasse");
    expect(flags).toContain("recu_laurent_vu");
  });

  test("fil ACTE : sans la 2e tasse, la plaquette ne livre pas le reçu", () => {
    const flags = deriverFlags(scenario, [g("examiner", "plaquette_somniferes")]);
    expect(flags).not.toContain("recu_laurent_vu");
  });

  test("fil SURPRISE : la fête découverte débloque la relecture du mot", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "cadeau_cache"),
      g("examiner", "mot_manuscrit"),
    ]);
    expect(flags).toContain("fete_decouverte");
    expect(flags).toContain("invitation_lue");
  });

  test("fil SURPRISE : sans la fête, le mot reste un faux adieu", () => {
    const flags = deriverFlags(scenario, [g("examiner", "mot_manuscrit")]);
    expect(flags).not.toContain("invitation_lue");
  });

  test("fil MOBILE : le contrôle du téléphone éclaire l'agenda", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "telephone"),
      g("examiner", "agenda"),
    ]);
    expect(flags).toContain("controle_vu");
    expect(flags).toContain("rdv_eclaircis");
  });

  test("point fixe : examiner la plaquette AVANT la théière révèle quand même le reçu", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "plaquette_somniferes"), // à froid
      g("examiner", "theiere"), // l'indice arrive après
    ]);
    expect(flags).toContain("recu_laurent_vu");
  });

  test("levier : flatter (ramasser puis donner le grand cru) gagne la confiance", () => {
    const flags = deriverFlags(scenario, [
      g("ramasser", "grand_cru"),
      g("donner", "grand_cru"),
    ]);
    expect(flags).toContain("confiance_gagnee");
  });

  test("levier : l'aveu de l'acte exige le reçu vu ET la confiance gagnée", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "theiere"),
      g("examiner", "plaquette_somniferes"),
      g("ramasser", "grand_cru"),
      g("donner", "grand_cru"),
      g("ramasser", "plaquette_somniferes"),
      g("donner", "plaquette_somniferes"),
    ]);
    expect(flags).toContain("aveu_acte");
  });

  test("levier : confronter le mot avoue le mobile une fois la fête comprise", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "cadeau_cache"),
      g("examiner", "mot_manuscrit"),
      g("ramasser", "mot_manuscrit"),
      g("donner", "mot_manuscrit"),
    ]);
    expect(flags).toContain("aveu_mobile");
  });

  test("un objet d'ambiance ne pose aucun flag", () => {
    expect(deriverFlags(scenario, [g("examiner", "photos_mariage")])).toEqual([]);
    expect(deriverFlags(scenario, [g("ramasser", "trophee_golf")])).toEqual([]);
  });
});

describe("bascules HTTP /examiner", () => {
  test("le mot manuscrit : faux adieu avant la fête, invitation après", async () => {
    const froid = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "mot_manuscrit", gestes: [] });
    expect(froid.body.texte).toBe(scenario.objets.mot_manuscrit.apercu);

    const chaud = await request(faireApp())
      .post("/api/examiner")
      .send({
        cible: "mot_manuscrit",
        gestes: [g("examiner", "cadeau_cache"), g("examiner", "mot_manuscrit")],
      });
    expect(chaud.body.texte).toBe(scenario.objets.mot_manuscrit.description);
  });

  test("l'agenda : rendez-vous suspects avant le téléphone, éclaircis après", async () => {
    const froid = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "agenda", gestes: [] });
    expect(froid.body.texte).toBe(scenario.objets.agenda.apercu);

    const chaud = await request(faireApp())
      .post("/api/examiner")
      .send({
        cible: "agenda",
        gestes: [g("examiner", "telephone"), g("examiner", "agenda")],
      });
    expect(chaud.body.texte).toBe(scenario.objets.agenda.description);
  });
});

describe("connaissances conditionnelles dans le prompt /chat", () => {
  test("confronter le mot (séquence complète) injecte l'effondrement (aveu du mobile)", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => onTexte("…"));
    await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({
        message: "Vous la croyiez infidèle ?",
        gestes: [
          g("examiner", "cadeau_cache"),
          g("examiner", "mot_manuscrit"),
          g("ramasser", "mot_manuscrit"),
          g("donner", "mot_manuscrit"),
        ],
      });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("infidèle");
  });

  test("éclaircir l'agenda débloque la connaissance « rdv innocents »", async () => {
    const repondreFluxFn = vi.fn(async (_c, _a, onTexte) => onTexte("…"));
    await request(faireApp({ repondreFluxFn }))
      .post("/api/chat")
      .send({
        message: "Ces rendez-vous secrets ?",
        gestes: [g("examiner", "telephone"), g("examiner", "agenda")],
      });
    const [, args] = repondreFluxFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("à opposer");
  });
});

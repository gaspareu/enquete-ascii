import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { creerApplication } from "../server/app.js";
import { creerDepotEnquetes } from "../server/enquetes-store.js";

const temporaires = [];

async function preparer() {
  const base = await mkdtemp(join(tmpdir(), "enquetes-app-"));
  temporaires.push(base);
  const depotEnquetes = creerDepotEnquetes({
    racine: join(base, "data"),
    imagesDir: join(base, "images"),
  });
  return { depotEnquetes, app: creerApplication({ depotEnquetes, secret: "secret-test" }) };
}

afterEach(async () => {
  await Promise.all(temporaires.splice(0).map((base) => rm(base, { recursive: true, force: true })));
});

describe("application multi-enquêtes", () => {
  test("prévisualise un brouillon complet en mode éditeur et refuse une image absente", async () => {
    const { depotEnquetes } = await preparer();
    await depotEnquetes.creer({ id: "apercu", sourceId: "helene" });
    const app = creerApplication({ mode: "editeur", depotEnquetes, secret: "secret-test", jetonEditeur: "jeton-test" });
    expect((await request(app).get("/jouer/apercu")).status).toBe(200);
    const { enquete } = await depotEnquetes.lire("apercu", { inclureBrouillons: true });
    enquete.zones.N.illustration = "/images/enquetes/apercu/absente.png";
    await depotEnquetes.enregistrer("apercu", enquete);
    expect((await request(app).get("/jouer/apercu")).status).toBe(404);
    const diagnostic = await request(app).post("/api/editeur/enquetes/apercu/validation")
      .set("X-Editor-Token", "jeton-test");
    expect(diagnostic.body.erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "images" }),
    ]));
  });

  test("n'expose ni les brouillons ni les secrets du scénario et sert une enquête prête", async () => {
    const { app, depotEnquetes } = await preparer();
    await depotEnquetes.creer({ id: "copie", sourceId: "helene" });
    const listeAvant = await request(app).get("/api/enquetes");
    expect(listeAvant.status).toBe(200);
    expect(listeAvant.body.enquetes.map(({ id }) => id)).toContain("helene");
    expect(listeAvant.body.enquetes.map(({ id }) => id)).not.toContain("copie");
    expect((await request(app).get("/jouer/copie")).status).toBe(404);
    expect((await request(app).get("/api/enquetes/copie/scenario")).status).toBe(404);
    expect((await request(app).get("/api/editeur/session")).status).toBe(404);
    expect((await request(app).post("/api/editeur/enquetes/copie/generation-objets").send({})).status).toBe(404);

    await depotEnquetes.activer("copie");
    const listeApres = await request(app).get("/api/enquetes");
    expect(listeApres.body.enquetes.map(({ id }) => id)).toContain("copie");
    expect((await request(app).get("/jouer/copie")).status).toBe(200);
    const vue = await request(app).get("/api/enquetes/copie/scenario");
    expect(vue.status).toBe(200);
    expect(vue.body.personnage.nom).toBe("Laurent");
    expect(vue.body.objets).toBeUndefined();
    expect(vue.body.solution).toBeUndefined();
    expect(vue.body.declencheurs).toBeUndefined();
  });

  test("lie les reçus à l'enquête et à sa révision enregistrée", async () => {
    const { app, depotEnquetes } = await preparer();
    await depotEnquetes.creer({ id: "premiere", sourceId: "helene" });
    await depotEnquetes.creer({ id: "seconde", sourceId: "helene" });
    await depotEnquetes.activer("premiere");
    await depotEnquetes.activer("seconde");
    const corps = { contexte: { type: "zone", id: "N" }, intention: { action: "fouiller", cible: "N" }, recus: [] };
    const depart = await request(app).post("/api/enquetes/premiere/interagir").send(corps);
    expect(depart.status).toBe(200);
    expect(depart.body.recus.length).toBeGreaterThan(0);
    const suite = { ...corps, recus: depart.body.recus };
    expect((await request(app).post("/api/enquetes/seconde/interagir").send(suite)).status).toBe(400);

    const { enquete } = await depotEnquetes.lire("premiere", { inclureBrouillons: true });
    await depotEnquetes.enregistrer("premiere", { ...enquete, titre: "Nouvelle révision" });
    await depotEnquetes.activer("premiere");
    expect((await request(app).post("/api/enquetes/premiere/interagir").send(suite)).status).toBe(400);
  });
});

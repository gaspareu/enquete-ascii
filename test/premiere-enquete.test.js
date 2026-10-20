import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { creerApplication } from "../server/app.js";
import { creerDepotEnquetes } from "../server/enquetes-store.js";
import { validerEnquete } from "../server/enquetes-schema.js";
import { deriverEtat } from "../server/etat.js";
import { construitPrompt } from "../server/prompt.js";
import { verifierRecus } from "../server/progression.js";

const dossiers = [];
async function preparer() {
  const base = await mkdtemp(join(tmpdir(), "premiere-enquete-"));
  dossiers.push(base);
  const depot = creerDepotEnquetes({ racine: join(base, "enquetes"), imagesDir: join(base, "images") });
  const app = creerApplication({ mode: "editeur", depotEnquetes: depot, jetonEditeur: "jeton-test", secret: "secret-recette" });
  return { base, depot, app };
}
const creer = (app, corps) => request(app).post("/api/editeur/enquetes")
  .set("X-Editor-Token", "jeton-test").send(corps);

afterEach(async () => {
  await Promise.all(dossiers.splice(0).map((dossier) => rm(dossier, { recursive: true, force: true })));
});

describe("première enquête guidée", () => {
  test("crée un modèle complet indépendant, enregistrable et prévisualisable sans appel IA", async () => {
    const { app, depot } = await preparer();
    const reponse = await creer(app, { id: "premiere", modele: "initiation" });
    expect(reponse.status).toBe(201);
    const { enquete } = reponse.body;
    expect(enquete.titre).toBe("Le médaillon disparu");
    expect(enquete.statut).toBe("brouillon");
    expect(validerEnquete(enquete).erreurs).toEqual([]);
    expect(enquete.solution.preuvesRequises).toHaveLength(2);
    expect(Object.keys(enquete.objets)).toHaveLength(2);
    expect((await request(app).get("/api/enquetes")).body.enquetes.map(({ id }) => id)).not.toContain("premiere");
    expect((await request(app).get("/jouer/premiere")).status).toBe(200);
    expect((await request(app).get("/server/modele-initiation.js")).status).toBe(404);
    const modifie = { ...enquete, titre: "Mon histoire" };
    const sauvegarde = await request(app).put("/api/editeur/enquetes/premiere")
      .set("X-Editor-Token", "jeton-test").send(modifie);
    expect(sauvegarde.status).toBe(200);
    expect(sauvegarde.body.revision).not.toBe(reponse.body.revision);
    const autre = await creer(app, { id: "seconde", modele: "initiation" });
    expect(autre.body.enquete.titre).toBe("Le médaillon disparu");
    expect((await depot.lire("premiere", { inclureBrouillons: true })).enquete.titre).toBe("Mon histoire");

    const jeu = creerApplication({ depotEnquetes: depot });
    expect((await request(jeu).get("/jouer/premiere")).status).toBe(404);
    await depot.activer("premiere");
    const publique = await request(jeu).get("/api/enquetes/premiere/scenario");
    expect(publique.status).toBe(200);
    for (const secret of ["objets", "solution", "connaissances", "declencheurs", "preconditions"]) {
      expect(publique.body[secret]).toBeUndefined();
    }
    expect(JSON.stringify(publique.body)).not.toContain(enquete.connaissances[0].texte);
  });

  test.each([
    { modele: "inconnu" }, { modele: "../helene" }, { modele: null },
    { modele: {} }, { modele: "initiation", sourceId: "helene" },
  ])("rejette une sélection invalide avant toute écriture : %j", async (selection) => {
    const { base, app, depot } = await preparer();
    expect((await creer(app, { id: "refusee", ...selection })).status).toBe(400);
    await expect(depot.creer({ id: "refusee", ...selection })).rejects.toMatchObject({ status: 400 });
    expect(await readdir(base)).toEqual([]);
  });

  test("préserve le brouillon vide et interdit le modèle sans session ou depuis une autre origine", async () => {
    const { app } = await preparer();
    expect((await creer(app, { id: "vide" })).body.enquete.objets).toEqual({});
    expect((await request(app).post("/api/editeur/enquetes")
      .send({ id: "sans_session", modele: "initiation" })).status).toBe(403);
    expect((await request(app).post("/api/editeur/enquetes").set("Origin", "https://exterieur.test")
      .set("X-Editor-Token", "jeton-test").send({ id: "exterieur", modele: "initiation" })).status).toBe(403);
  });

  test("les deux indices sont nécessaires à la révélation, dans les deux ordres", async () => {
    const { app, depot } = await preparer();
    const { enquete, revision } = await depot.creer({ id: "indices", modele: "initiation" });
    const examens = Object.keys(enquete.declencheurs).map((cle) => {
      const [type, cible] = cle.split(":");
      const direction = Object.entries(enquete.zones).find(([, zone]) => zone.objetsCaches.includes(cible))[0];
      return { type, cible, contexte: { type: "zone", id: direction } };
    });
    const revelation = enquete.connaissances[0].texte;
    for (const ordre of [examens, [...examens].reverse()]) {
      let recus = [];
      for (const [index, examen] of ordre.entries()) {
        for (const intention of [{ action: "fouiller", cible: examen.contexte.id }, { action: examen.type, cible: examen.cible }]) {
          const resultat = await request(app).post("/api/enquetes/indices/interagir")
            .send({ contexte: examen.contexte, intention, recus });
          expect(resultat.status).toBe(200);
          expect(JSON.stringify(resultat.body)).not.toContain(revelation);
          recus = [...recus, ...resultat.body.recus];
        }
        const verification = verifierRecus("secret-recette", recus, { scenarioId: "indices", revision, personnageId: "camille" });
        expect(verification.ok).toBe(true);
        const etat = deriverEtat(enquete, verification.evenements);
        if (index === 0) expect(construitPrompt(enquete, etat.flags)).not.toContain(revelation);
        else {
          expect(etat.flags).toEqual(expect.arrayContaining(enquete.solution.preuvesRequises));
          expect(construitPrompt(enquete, etat.flags)).toContain(revelation);
        }
      }
    }
  });
});

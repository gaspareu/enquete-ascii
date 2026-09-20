import { describe, expect, test, vi } from "vitest";
import express from "express";
import request from "supertest";
import { creerRouteurEditeur } from "../server/editeur.js";

const JETON = "jeton-de-test";

function construireApp({ client = null } = {}) {
  const depot = {
    lister: vi.fn(async () => [{ id: "exemple", titre: "Exemple", statut: "prete", revision: "abc" }]),
    lire: vi.fn(async () => ({ enquete: { id: "exemple", titre: "Exemple" }, revision: "abc" })),
    creer: vi.fn(async () => ({ enquete: { id: "nouvelle", statut: "brouillon" }, revision: "def" })),
    enregistrer: vi.fn(async () => ({ enquete: { id: "nouvelle", statut: "brouillon" }, revision: "ghi" })),
    activer: vi.fn(async () => ({ enquete: { id: "nouvelle", statut: "prete" }, revision: "jkl" })),
    ajouterImage: vi.fn(async () => "/images/enquetes/nouvelle/photo.png"),
    verifier: vi.fn(async () => ({ erreurs: [{ path: "images", message: "Image absente." }], avertissements: [] })),
  };
  const app = express();
  app.use("/api/editeur", creerRouteurEditeur({ depot, jeton: JETON, client, model: "modele-test" }));
  return { app, depot };
}

describe("API locale de l'éditeur", () => {
  test("donne un jeton local puis exige ce jeton pour lire ou écrire un brouillon", async () => {
    const { app, depot } = construireApp();
    expect((await request(app).get("/api/editeur/session")).body).toEqual({ jeton: JETON });
    expect((await request(app).get("/api/editeur/enquetes")).status).toBe(403);

    const liste = await request(app).get("/api/editeur/enquetes")
      .set("X-Editor-Token", JETON);
    expect(liste.status).toBe(200);
    expect(liste.body.enquetes[0].id).toBe("exemple");
    expect(depot.lister).toHaveBeenCalledWith({ inclureBrouillons: true });

    const creation = await request(app).post("/api/editeur/enquetes")
      .set("X-Editor-Token", JETON).send({ id: "nouvelle", sourceId: "exemple" });
    expect(creation.status).toBe(201);
    expect(depot.creer).toHaveBeenCalledWith({ id: "nouvelle", sourceId: "exemple" });
  });

  test("refuse une origine extérieure même avec un jeton valide", async () => {
    const { app, depot } = construireApp();
    const reponse = await request(app).put("/api/editeur/enquetes/nouvelle")
      .set("Origin", "https://site-exterieur.test")
      .set("X-Editor-Token", JETON)
      .send({ titre: "Injecté" });
    expect(reponse.status).toBe(403);
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  test("transmet une image raster bornée au dépôt", async () => {
    const { app, depot } = construireApp();
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const reponse = await request(app).post("/api/editeur/enquetes/nouvelle/images?nom=photo.png")
      .set("X-Editor-Token", JETON)
      .set("Content-Type", "image/png")
      .send(image);
    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual({ chemin: "/images/enquetes/nouvelle/photo.png" });
    expect(depot.ajouterImage).toHaveBeenCalledWith("nouvelle", {
      nom: "photo.png", mime: "image/png", donnees: image,
    });
  });

  test("le diagnostic tient compte des images avant l'activation", async () => {
    const { app, depot } = construireApp();
    const reponse = await request(app).post("/api/editeur/enquetes/exemple/validation")
      .set("X-Editor-Token", JETON);
    expect(reponse.body.erreurs).toEqual([{ path: "images", message: "Image absente." }]);
    expect(depot.verifier).toHaveBeenCalledWith("exemple");
  });

  test("génère seulement en mode éditeur, avec jeton et demande bornée", async () => {
    const client = { messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use", name: "proposer_objets", input: {
      objets: [{ nom: "Une clé", description: "Une clé sur le bureau.", ramassable: true }],
    } }] })) } };
    const { app, depot } = construireApp({ client });
    const corps = { direction: "N", nombre: 1, instruction: "Une trace de fête", contexte: {
      titre: "Maison", intro: "Une disparition.", personnage: "Camille", zoneNom: "Bibliothèque",
      zoneDescription: "Un bureau.", objetsExistants: [],
    } };
    expect((await request(app).post("/api/editeur/enquetes/exemple/generation-objets").send(corps)).status).toBe(403);
    expect((await request(app).post("/api/editeur/enquetes/exemple/generation-objets")
      .set("X-Editor-Token", JETON).send({ ...corps, nombre: 99 })).status).toBe(400);
    expect(client.messages.create).not.toHaveBeenCalled();
    const reponse = await request(app).post("/api/editeur/enquetes/exemple/generation-objets")
      .set("X-Editor-Token", JETON).send(corps);
    expect(reponse.status).toBe(200);
    expect(reponse.body.objets[0].nom).toBe("Une clé");
    expect(depot.lire).toHaveBeenCalledWith("exemple", { inclureBrouillons: true });
    expect((await request(app).post("/api/editeur/enquetes/helene/generation-objets")
      .set("X-Editor-Token", JETON).send(corps)).status).toBe(403);
  });

  test("indique clairement que la clé Anthropic manque", async () => {
    const { app } = construireApp();
    const reponse = await request(app).post("/api/editeur/enquetes/exemple/generation-objets")
      .set("X-Editor-Token", JETON).send({ direction: "N", nombre: 1, instruction: "", contexte: {
        titre: "Maison", intro: "", personnage: "", zoneNom: "Bibliothèque", zoneDescription: "", objetsExistants: [],
      } });
    expect(reponse.status).toBe(503);
    expect(reponse.body.erreur).toMatch(/ANTHROPIC_API_KEY/);
  });
});

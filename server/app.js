// Assemblage HTTP des enquêtes ; la source privée reste hors de public/.

import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { scenario as scenarioHistorique } from "../data/scenario.js";
import { creerDepotEnquetes } from "./enquetes-store.js";
import { validerEnquete } from "./enquetes-schema.js";
import { creerRouteurEditeur } from "./editeur.js";
import { creerRouteur } from "./chat.js";

const ici = dirname(fileURLToPath(import.meta.url));
const racineProjet = join(ici, "..");

function repondreIntrouvable(res) {
  return res.status(404).json({ erreur: "Enquête introuvable." });
}

export function creerApplication({
  mode = "jeu",
  racineEnquetes = join(racineProjet, "data", "enquetes"),
  imagesDir = join(racineProjet, "public", "images", "enquetes"),
  depotEnquetes = null,
  secret = randomBytes(32),
  client = null,
  model = "claude-sonnet-4-6",
  modelInterprete = model,
  voix = null,
  jetonEditeur,
} = {}) {
  const app = express();
  const publicDir = join(racineProjet, "public");
  const editeurDir = join(racineProjet, "editeur");
  const depot = depotEnquetes ?? creerDepotEnquetes({ racine: racineEnquetes, imagesDir });
  const routeurs = new Map();

  app.get("/", (_req, res) => res.sendFile(join(publicDir, "enquetes.html")));
  app.use(express.static(publicDir, { index: false }));

  if (mode === "editeur") {
    app.use("/editeur", express.static(editeurDir, { index: "index.html" }));
    app.use("/api/editeur", creerRouteurEditeur({ depot, client, model, jeton: jetonEditeur }));
  }

  app.use(express.json({ limit: "256kb" }));

  app.get("/api/enquetes", async (_req, res) => {
    try {
      res.json({ enquetes: await depot.lister({ inclureBrouillons: false }) });
    } catch (erreur) {
      console.error("Erreur du catalogue :", erreur);
      res.status(500).json({ erreur: "Catalogue indisponible." });
    }
  });

  async function scenarioJouable(id) {
    const { enquete, revision } = await depot.lire(id, { inclureBrouillons: mode === "editeur" });
    const diagnostic = validerEnquete(enquete, { complete: true });
    if (diagnostic.erreurs.length > 0) return null;
    if (mode === "editeur" && (await depot.verifier(id)).erreurs.length > 0) return null;
    return { enquete, revision };
  }

  app.get("/jouer/:id", async (req, res) => {
    try {
      if (!await scenarioJouable(req.params.id)) return repondreIntrouvable(res);
      return res.sendFile(join(publicDir, "index.html"));
    } catch {
      return repondreIntrouvable(res);
    }
  });

  app.use("/api/enquetes/:id", async (req, res, next) => {
    let resultat;
    try {
      resultat = await scenarioJouable(req.params.id);
    } catch {
      return repondreIntrouvable(res);
    }
    if (!resultat) return repondreIntrouvable(res);
    const { enquete, revision } = resultat;
    const cle = `${enquete.id}:${revision}`;
    let routeur = routeurs.get(cle);
    if (!routeur) {
      routeur = creerRouteur({
        scenario: enquete,
        scenarioId: enquete.id,
        revision,
        secret,
        client,
        model,
        modelInterprete,
        voix,
      });
      routeurs.set(cle, routeur);
    }
    return routeur(req, res, next);
  });

  // Compatibilité avec les liens/tests historiques pendant la migration.
  app.use("/api", creerRouteur({
    scenario: scenarioHistorique,
    secret,
    client,
    model,
    modelInterprete,
    voix,
  }));

  app.locals.depotEnquetes = depot;
  return app;
}

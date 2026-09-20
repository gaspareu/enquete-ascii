// API locale de l'atelier. Les routes du jeu ne montent jamais ce routeur.

import { randomBytes, timingSafeEqual } from "node:crypto";
import express from "express";
import { genererObjets, validerDemandeGeneration } from "./generation-objets.js";

function estHoteLocal(req) {
  const hote = req.get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hote)) return false;
  const origine = req.get("origin");
  if (!origine) return true;
  try {
    const url = new URL(origine);
    return url.protocol === "http:" && url.host === hote;
  } catch {
    return false;
  }
}

function jetonValide(recu, attendu) {
  if (typeof recu !== "string") return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

function attraper(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((erreur) => {
    const statut = Number.isInteger(erreur?.status) && erreur.status >= 400 && erreur.status < 500
      ? erreur.status
      : 500;
    if (statut === 500) console.error("Erreur de l'éditeur :", erreur);
    res.status(statut).json({
      erreur: statut === 500 ? "L'opération est impossible pour le moment." : erreur.message,
      ...(Array.isArray(erreur?.erreurs) ? { erreurs: erreur.erreurs } : {}),
    });
  });
}

export function creerRouteurEditeur({ depot, client = null, model = "claude-sonnet-4-6", jeton = randomBytes(32).toString("base64url") }) {
  const routeur = express.Router();

  routeur.use((req, res, next) => {
    if (!estHoteLocal(req)) return res.status(403).json({ erreur: "Atelier local uniquement." });
    next();
  });

  routeur.get("/session", (_req, res) => res.json({ jeton }));

  routeur.use((req, res, next) => {
    if (!jetonValide(req.get("X-Editor-Token"), jeton)) {
      return res.status(403).json({ erreur: "Session d'édition invalide." });
    }
    next();
  });

  routeur.get("/enquetes", attraper(async (_req, res) => {
    res.json({ enquetes: await depot.lister({ inclureBrouillons: true }) });
  }));

  routeur.post("/enquetes/:id/images", express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: "5mb",
  }), attraper(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) return res.status(415).json({ erreur: "Format d'image invalide." });
    const chemin = await depot.ajouterImage(req.params.id, {
      nom: req.query.nom,
      mime: req.get("content-type"),
      donnees: req.body,
    });
    res.json({ chemin });
  }));

  routeur.use(express.json({ limit: "2mb" }));

  routeur.post("/enquetes", attraper(async (req, res) => {
    const resultat = await depot.creer({ id: req.body?.id, sourceId: req.body?.sourceId });
    res.status(201).json(resultat);
  }));

  routeur.get("/enquetes/:id", attraper(async (req, res) => {
    res.json(await depot.lire(req.params.id, { inclureBrouillons: true }));
  }));

  routeur.post("/enquetes/:id/generation-objets", attraper(async (req, res) => {
    if (req.params.id === "helene") return res.status(403).json({ erreur: "Dupliquez cet exemple pour le modifier." });
    const validation = validerDemandeGeneration(req.body);
    if (!validation.ok) return res.status(400).json({ erreur: validation.erreur });
    await depot.lire(req.params.id, { inclureBrouillons: true });
    if (!client) return res.status(503).json({ erreur: "Renseignez ANTHROPIC_API_KEY pour utiliser la génération." });
    try {
      const objets = await genererObjets(client, { ...validation.valeur, model });
      return res.json({ objets });
    } catch (erreur) {
      console.error("Erreur de génération des objets :", erreur);
      return res.status(502).json({ erreur: "La génération a échoué. Réessayez ou ajoutez les objets manuellement." });
    }
  }));

  routeur.put("/enquetes/:id", attraper(async (req, res) => {
    res.json(await depot.enregistrer(req.params.id, req.body));
  }));

  routeur.post("/enquetes/:id/validation", attraper(async (req, res) => {
    res.json(await depot.verifier(req.params.id));
  }));

  routeur.post("/enquetes/:id/activation", attraper(async (req, res) => {
    res.json(await depot.activer(req.params.id));
  }));

  return routeur;
}

// Boundary du chat orchestré : les mémoires et la progression sont authentifiées.
import express from "express";
import { createHash } from "node:crypto";
import { valideRequeteInterprete, valideContexte } from "./validate.js";
import { verifierRecus } from "./progression.js";
import { lireMemoire, signerMemoire } from "./memoire-scene.js";
import { orchestrerTour } from "./orchestrateur.js";

export function creerRouteurTour(options) {
  const { scenario, secret, scenarioId, revision, client } = options;
  const identite = { scenarioId, revision, personnageId: scenario.personnage.id ?? "laurent" };
  const revisionMemoire = revision ?? createHash("sha256").update(JSON.stringify(scenario)).digest("base64url");
  const identiteMemoire = (verification) => ({ scenarioId: scenarioId ?? "historique", revision: revisionMemoire,
    empreinte: verification.precedent ?? "initial" });
  const routeur = express.Router();
  routeur.post("/tour", async (req, res) => {
    const navigation = req.body?.navigation;
    const demande = valideRequeteInterprete({ ...req.body,
      ...(navigation ? { message: "Navigation" } : {}), historique: undefined }, scenario);
    if (!demande.ok) return res.status(400).json({ erreur: demande.erreur });
    if (navigation && !valideContexte(navigation, scenario).ok) return res.status(400).json({ erreur: "Destination invalide." });
    const verification = verifierRecus(secret, demande.valeur.recus, identite);
    if (!verification.ok) return res.status(400).json({ erreur: "Reçus invalides." });
    let memoire;
    try { memoire = lireMemoire(secret, req.body.memoireConversation, identiteMemoire(verification)); }
    catch { return res.status(400).json({ erreur: "Mémoire invalide ou enquête modifiée. Recommencez la partie." }); }
    if (!client && !navigation) return res.status(503).json({ erreur: "Agents indisponibles. Renseignez ANTHROPIC_API_KEY." });
    const etatTour = { verification, memoire };
    const valeur = { ...demande.valeur, ...(navigation ? { navigation: valideContexte(navigation, scenario).valeur, message: "" } : {}) };
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders?.();
    const emit = (event, data) => {
      if (res.writableEnded || res.destroyed) return;
      // Un client ne peut recevoir des reçus sans leur mémoire correspondante :
      // une trame SSE complète constitue le point de reprise authentifié.
      const contenu = event === "progression" ? { ...data,
        memoireConversation: signerMemoire(secret, etatTour.memoire, identiteMemoire(etatTour.verification)) } : data;
      res.write(`event: ${event}\ndata: ${JSON.stringify(contenu)}\n\n`);
    };
    try { await orchestrerTour({ ...options, identite, demande: valeur, etatTour, emit, annule: () => res.destroyed }); }
    catch { emit("erreur", { erreur: "Le tour n'a pas pu être terminé. Les actions déjà confirmées sont conservées." }); }
    finally {
      emit("memoire", { token: signerMemoire(secret, etatTour.memoire, identiteMemoire(etatTour.verification)) });
      emit("fin", {}); res.end();
    }
  });
  return routeur;
}

// Routeur HTTP du jeu. Tout ce qui touche au scénario complet (connaissances,
// solution, personnalité, descriptions-révélations) reste ici, côté serveur.
// Le frontend ne reçoit qu'une vue publique sans spoiler.

import express from "express";
import { construitPrompt } from "./prompt.js";
import { valideRequeteChat } from "./validate.js";
import { evaluerAccusation } from "./accusation.js";
import { repondre } from "./claude.js";

// Vue du scénario envoyée au navigateur : noms et ambiance seulement.
// Pas de connaissances, pas de solution, pas de personnalité, pas de
// descriptions d'objets (celles-ci sont des révélations servies à l'examen).
export function vuePublique(scenario) {
  const objets = {};
  for (const [id, o] of Object.entries(scenario.objets)) {
    objets[id] = { nom: o.nom, ramassable: o.ramassable };
  }
  return {
    titre: scenario.titre,
    intro: scenario.intro,
    personnage: { nom: scenario.personnage.nom, visage: scenario.personnage.visage },
    zones: scenario.zones,
    objets,
    declencheurs: scenario.declencheurs,
  };
}

export function creerRouteur({ scenario, flagsConnus, client, model, repondreFn = repondre }) {
  const routeur = express.Router();

  routeur.get("/scenario", (req, res) => {
    res.json(vuePublique(scenario));
  });

  // Examiner une cible (objet ou zone) : renvoie la description-révélation et le
  // flag éventuel à poser. C'est le seul canal par lequel un texte secret sort.
  routeur.post("/examiner", (req, res) => {
    const cible = typeof req.body?.cible === "string" ? req.body.cible : "";
    const objet = scenario.objets[cible];
    const texte = objet?.description ?? "Rien de particulier ici.";
    const flag = scenario.declencheurs[`examiner:${cible}`] ?? null;
    res.json({ texte, flag });
  });

  routeur.post("/chat", async (req, res) => {
    const v = valideRequeteChat(req.body, flagsConnus);
    if (!v.ok) {
      return res.status(400).json({ erreur: v.erreur });
    }
    if (!client) {
      return res.status(503).json({
        erreur: "Clé API Anthropic non configurée. Renseignez ANTHROPIC_API_KEY dans .env.",
      });
    }
    const { message, flags, historique, note } = v.valeur;
    try {
      const system = construitPrompt(scenario, flags, note);
      const reponse = await repondreFn(client, { system, historique, message, model });
      res.json({ reponse });
    } catch (err) {
      // Log serveur sans secret ; message neutre côté client.
      console.error("Erreur appel Claude:", err?.message ?? err);
      res.status(502).json({ erreur: "Le personnage est injoignable pour le moment." });
    }
  });

  routeur.post("/accuser", (req, res) => {
    const verdict = req.body?.verdict === true;
    const flagsBruts = Array.isArray(req.body?.flags) ? req.body.flags : [];
    const flags = flagsBruts.filter((f) => typeof f === "string" && flagsConnus.has(f));
    res.json(evaluerAccusation(scenario, { verdict, flags }));
  });

  return routeur;
}

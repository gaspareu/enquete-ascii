// Routeur HTTP du jeu. Tout ce qui touche au scénario complet (connaissances,
// solution, personnalité, descriptions-révélations) reste ici, côté serveur.
// Le frontend ne reçoit qu'une vue publique sans spoiler.
//
// Anti-triche : le client n'envoie jamais ses flags. Il envoie son JOURNAL DE GESTES,
// et le serveur DÉRIVE les flags (server/etat.js) en imposant les préconditions.
// Un flag non gagné légitimement ne peut donc pas être obtenu en forgeant la requête.

import express from "express";
import { construitPrompt } from "./prompt.js";
import { valideRequeteChat, valideGestes } from "./validate.js";
import { deriverFlags } from "./etat.js";
import { evaluerAccusation } from "./accusation.js";
import { repondre } from "./claude.js";

// Vue du scénario envoyée au navigateur : noms et ambiance seulement.
// Pas de connaissances, pas de solution, pas de personnalité, pas de descriptions
// d'objets (révélations servies à l'examen), pas de déclencheurs (mapping geste→flag
// gardé secret côté serveur).
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
  };
}

export function creerRouteur({ scenario, ciblesConnues, client, model, repondreFn = repondre }) {
  const routeur = express.Router();

  routeur.get("/scenario", (req, res) => {
    res.json(vuePublique(scenario));
  });

  // Examiner une cible : renvoie sa description. C'est le seul canal par lequel un
  // texte secret sort — il est donc gardé côté serveur. Une description n'est révélée
  // que si son flag d'examen (declencheurs["examiner:cible"]) est légitimement dérivé
  // du journal de gestes ; sinon on ne sert que l'aperçu non-spoiler (anti-triche
  // T-03 : examiner le tableau avant l'indice ne révèle ni le code ni la fiole).
  routeur.post("/examiner", (req, res) => {
    const cible = typeof req.body?.cible === "string" ? req.body.cible : "";
    const objet = scenario.objets[cible];
    if (!objet) {
      return res.json({ texte: "Rien de particulier ici." });
    }
    const vg = valideGestes(req.body?.gestes, ciblesConnues);
    const flags = vg.ok ? deriverFlags(scenario, vg.valeur) : [];
    const flagExamen = scenario.declencheurs[`examiner:${cible}`];
    const revele = !flagExamen || flags.includes(flagExamen);
    const texte = revele ? objet.description : (objet.apercu ?? objet.description);
    res.json({ texte });
  });

  routeur.post("/chat", async (req, res) => {
    const v = valideRequeteChat(req.body, ciblesConnues);
    if (!v.ok) {
      return res.status(400).json({ erreur: v.erreur });
    }
    if (!client) {
      return res.status(503).json({
        erreur: "Clé API Anthropic non configurée. Renseignez ANTHROPIC_API_KEY dans .env.",
      });
    }
    const { message, gestes, historique, note } = v.valeur;
    try {
      const flags = deriverFlags(scenario, gestes);
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
    const vg = valideGestes(req.body?.gestes, ciblesConnues);
    if (!vg.ok) {
      return res.status(400).json({ erreur: vg.erreur });
    }
    const flags = deriverFlags(scenario, vg.valeur);
    res.json(evaluerAccusation(scenario, { verdict, flags }));
  });

  return routeur;
}

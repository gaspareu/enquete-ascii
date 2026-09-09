// Routes HTTP : le scénario complet, les reçus et l'autorisation restent côté
// serveur. Le navigateur ne reçoit qu'une vue d'ambiance et des résultats publics.

import express from "express";
import { construitProjectionPrompt } from "./prompt.js";
import {
  valideRequeteChat,
  valideRequeteInteraction,
  valideDebrief,
  valideRequeteVoix,
} from "./validate.js";
import { verifierRecus, emettreRecu, MAX_RECUS } from "./progression.js";
import { deriverEtat } from "./etat.js";
import { evaluerCapacite } from "./capacites.js";
import { executerInteraction } from "./interactions.js";
import { agregeScore } from "./scoring.js";
import { noterDebrief } from "./juge.js";
import { repondreEnFlux } from "./claude.js";
import { synthetiserVoix } from "./voix.js";

function vueZonePublique(zone) {
  const { nom, article, aliases, description, illustration, objetsCaches } = zone;
  return { nom, article, aliases, description, illustration, objetsCaches };
}

// Projection explicite : ne jamais passer directement une partie du scénario, car
// un futur champ de règles ou de visibilité deviendrait sinon public par accident.
export function vuePublique(scenario) {
  const objets = {};
  for (const [id, objet] of Object.entries(scenario.objets)) {
    objets[id] = { nom: objet.nom, aliases: objet.aliases, ramassable: objet.ramassable };
  }
  const zones = {};
  for (const [id, zone] of Object.entries(scenario.zones)) zones[id] = vueZonePublique(zone);
  return {
    titre: scenario.titre,
    intro: scenario.intro,
    personnage: {
      nom: scenario.personnage.nom,
      visage: scenario.personnage.visage,
      portraits: scenario.personnage.portraits,
    },
    zones,
    objets,
    debrief: {
      questions: scenario.debrief.questions.map(({ id, question }) => ({ id, question })),
    },
  };
}

function messageRefus(capacite) {
  if (capacite.code === "CIBLE_HORS_PORTEE") {
    return "Cet objet n'est pas dans la zone que vous observez.";
  }
  if (capacite.code === "CONTEXTE_INTERDIT") {
    return "Cette action n'est pas possible depuis ici.";
  }
  return "Cette action n'est pas possible pour le moment.";
}

function signerEvenementsDialogue(secret, verification, evenements) {
  let courant = verification;
  const chaine = [...verification.recus];
  const nouveaux = [];
  for (const evenement of evenements) {
    const recu = emettreRecu(secret, courant, {
      type: "dialogue",
      cible: evenement,
      contexte: { type: "personnage", id: "laurent" },
    });
    chaine.push(recu);
    courant = verifierRecus(secret, chaine);
    if (!courant.ok) throw new Error("Chaîne de progression invalide.");
    nouveaux.push(recu);
  }
  return nouveaux;
}

export function creerRouteur({
  scenario,
  secret,
  client,
  model,
  voix = null,
  repondreFluxFn = repondreEnFlux,
  noterFn = noterDebrief,
  synthetiserFn = synthetiserVoix,
}) {
  const routeur = express.Router();
  const idsDebrief = new Set(scenario.debrief.questions.map((q) => q.id));

  routeur.get("/scenario", (_req, res) => res.json(vuePublique(scenario)));

  routeur.post("/interagir", (req, res) => {
    const demande = valideRequeteInteraction(req.body, scenario);
    if (!demande.ok) return res.status(400).json({ erreur: demande.erreur });
    const verification = verifierRecus(secret, demande.valeur.recus);
    if (!verification.ok) return res.status(400).json({ erreur: "Reçus invalides." });

    const resultat = executerInteraction({
      scenario,
      secret,
      verification,
      contexte: demande.valeur.contexte,
      intention: demande.valeur.intention,
    });
    if (!resultat.ok) return res.status(403).json({ erreur: messageRefus(resultat) });
    return res.json({
      narration: resultat.narration,
      recus: resultat.recus,
      etatPublic: resultat.etatPublic,
    });
  });

  routeur.post("/chat", async (req, res) => {
    const demande = valideRequeteChat(req.body, scenario);
    if (!demande.ok) return res.status(400).json({ erreur: demande.erreur });
    const verification = verifierRecus(secret, demande.valeur.recus);
    if (!verification.ok) return res.status(400).json({ erreur: "Reçus invalides." });

    const etat = deriverEtat(scenario, verification.evenements);
    const capacite = evaluerCapacite(scenario, etat, {
      contexte: demande.valeur.contexte,
      intention: { action: "dialoguer", cible: "laurent" },
    });
    if (!capacite.ok) return res.status(403).json({ erreur: messageRefus(capacite) });
    if (!client) {
      return res.status(503).json({
        erreur: "Clé API Anthropic non configurée. Renseignez ANTHROPIC_API_KEY dans .env.",
      });
    }

    let projection;
    try {
      projection = construitProjectionPrompt(scenario, etat.flags);
    } catch (err) {
      console.error("Erreur préparation prompt:", err?.message ?? err);
      return res.status(502).json({ erreur: "Le personnage est injoignable pour le moment." });
    }
    const evenementsAutorises = projection.evenementsAutorises.filter(
      (evenement) => !etat.actionsEffectuees.includes(evenement),
    );

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();
    const ecrire = (chunk) => {
      if (!res.writableEnded) res.write(chunk);
    };

    try {
      const sortie = await repondreFluxFn(client, {
        system: projection.system,
        historique: demande.valeur.historique,
        message: demande.valeur.message,
        model,
        evenementsAutorises,
      }, (texte) => ecrire(`event: delta\ndata: ${JSON.stringify({ texte })}\n\n`));
      const exprimes = (sortie?.evenementsExprimes ?? []).filter((evenement) =>
        evenementsAutorises.includes(evenement),
      );
      const uniques = [...new Set(exprimes)];
      const recus = verification.recus.length + uniques.length <= MAX_RECUS
        ? signerEvenementsDialogue(secret, verification, uniques)
        : [];
      ecrire(`event: progression\ndata: ${JSON.stringify({ recus })}\n\n`);
      ecrire("event: fin\ndata: {}\n\n");
    } catch (err) {
      console.error("Erreur appel Claude (flux):", err?.message ?? err);
      ecrire(`event: erreur\ndata: ${JSON.stringify({
        erreur: "Le personnage est injoignable pour le moment.",
      })}\n\n`);
    } finally {
      res.end();
    }
  });

  routeur.post("/debrief", async (req, res) => {
    const vd = valideDebrief(req.body, idsDebrief);
    if (!vd.ok) return res.status(400).json({ erreur: vd.erreur });
    if (!client) {
      return res.status(503).json({
        erreur: "Clé API Anthropic non configurée. Renseignez ANTHROPIC_API_KEY dans .env.",
      });
    }
    try {
      const notes = await noterFn(client, { scenario, reponses: vd.valeur, model });
      return res.json(agregeScore(scenario, notes));
    } catch (err) {
      console.error("Erreur notation débrief:", err?.message ?? err);
      return res.status(502).json({ erreur: "L'examinateur est injoignable pour le moment." });
    }
  });

  routeur.post("/voix", async (req, res) => {
    const v = valideRequeteVoix(req.body);
    if (!v.ok) return res.status(400).json({ erreur: v.erreur });
    if (!voix) {
      return res.status(503).json({
        erreur: "Voix non configurée. Renseignez ELEVENLABS_API_KEY dans .env.",
      });
    }
    try {
      const audio = await synthetiserFn(fetch, {
        texte: v.valeur.texte,
        voiceId: voix.voiceId,
        model: voix.model,
        apiKey: voix.apiKey,
      });
      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(audio);
    } catch (err) {
      console.error("Erreur synthèse vocale:", err?.message ?? err);
      return res.status(502).json({ erreur: "La voix est indisponible pour le moment." });
    }
  });

  return routeur;
}

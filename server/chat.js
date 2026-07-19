// Routeur HTTP du jeu. Tout ce qui touche au scénario complet (connaissances,
// solution, personnalité, descriptions-révélations) reste ici, côté serveur.
// Le frontend ne reçoit qu'une vue publique sans spoiler.
//
// Anti-triche : le client n'envoie jamais ses flags. Il envoie son JOURNAL DE GESTES,
// et le serveur DÉRIVE les flags (server/etat.js) en imposant les préconditions.
// Un flag non gagné légitimement ne peut donc pas être obtenu en forgeant la requête.

import express from "express";
import { construitPrompt } from "./prompt.js";
import { valideRequeteChat, valideGestes, valideDebrief, valideRequeteVoix } from "./validate.js";
import { deriverFlags } from "./etat.js";
import { agregeScore } from "./scoring.js";
import { noterDebrief } from "./juge.js";
import { repondreEnFlux } from "./claude.js";
import { synthetiserVoix } from "./voix.js";

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
    // Seuls id + libellé sont publics : barème et rangs restent secrets.
    debrief: {
      questions: scenario.debrief.questions.map((q) => ({ id: q.id, question: q.question })),
    },
  };
}

export function creerRouteur({
  scenario,
  ciblesConnues,
  client,
  model,
  voix = null,
  repondreFluxFn = repondreEnFlux,
  noterFn = noterDebrief,
  synthetiserFn = synthetiserVoix,
}) {
  const routeur = express.Router();
  const idsDebrief = new Set(scenario.debrief.questions.map((q) => q.id));

  routeur.get("/scenario", (req, res) => {
    res.json(vuePublique(scenario));
  });

  // Examiner une cible : renvoie sa description. C'est le seul canal par lequel un
  // texte secret sort — il est donc gardé côté serveur. Une description n'est révélée
  // que si son flag d'examen (declencheurs["examiner:cible"]) est légitimement dérivé
  // du journal de gestes ; sinon on ne sert que l'aperçu non-spoiler (anti-triche
  // T-03 : examiner la plaquette de somnifères avant d'avoir vu la 2e tasse ne
  // révèle pas le reçu de Laurent).
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

    // Anti-triche : on dérive les flags AVANT de streamer ; toute erreur de
    // préparation reste un échec « pré-vol » avec un code HTTP propre.
    let system;
    try {
      const flags = deriverFlags(scenario, gestes);
      system = construitPrompt(scenario, flags, note);
    } catch (err) {
      console.error("Erreur préparation prompt:", err?.message ?? err);
      return res.status(502).json({ erreur: "Le personnage est injoignable pour le moment." });
    }

    // À partir d'ici les en-têtes 200 sont envoyées : une erreur en cours de flux
    // passe par une trame `erreur`, pas par un code HTTP.
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
      await repondreFluxFn(client, { system, historique, message, model }, (texte) =>
        ecrire(`event: delta\ndata: ${JSON.stringify({ texte })}\n\n`),
      );
      ecrire("event: fin\ndata: {}\n\n");
    } catch (err) {
      console.error("Erreur appel Claude (flux):", err?.message ?? err);
      ecrire(
        `event: erreur\ndata: ${JSON.stringify({
          erreur: "Le personnage est injoignable pour le moment.",
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  });

  routeur.post("/debrief", async (req, res) => {
    const vd = valideDebrief(req.body, idsDebrief);
    if (!vd.ok) {
      return res.status(400).json({ erreur: vd.erreur });
    }
    if (!client) {
      return res.status(503).json({
        erreur: "Clé API Anthropic non configurée. Renseignez ANTHROPIC_API_KEY dans .env.",
      });
    }
    try {
      const notes = await noterFn(client, { scenario, reponses: vd.valeur, model });
      res.json(agregeScore(scenario, notes));
    } catch (err) {
      console.error("Erreur notation débrief:", err?.message ?? err);
      res.status(502).json({ erreur: "L'examinateur est injoignable pour le moment." });
    }
  });

  // Synthèse vocale (T-07). Le texte reçu est la réplique du personnage, déjà
  // affichée côté client : aucun secret ne sort par ce canal. La clé ElevenLabs
  // reste côté serveur (config `voix`). Renvoie du MP3 binaire (audio/mpeg).
  routeur.post("/voix", async (req, res) => {
    const v = valideRequeteVoix(req.body);
    if (!v.ok) {
      return res.status(400).json({ erreur: v.erreur });
    }
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
      res.send(audio);
    } catch (err) {
      console.error("Erreur synthèse vocale:", err?.message ?? err);
      res.status(502).json({ erreur: "La voix est indisponible pour le moment." });
    }
  });

  return routeur;
}

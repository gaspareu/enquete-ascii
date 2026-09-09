// Validation au boundary HTTP : le client fournit un contexte et des reçus, jamais
// un flag ni un journal d'actions en clair.

import { MAX_RECUS, MAX_TAILLE_RECU } from "./progression.js";

const MAX_MESSAGE = 500;
const MAX_REPONSE = 1000;
const MAX_TEXTE_VOIX = 2000;
const MAX_HISTORIQUE = 100;
const ACTIONS_OBJET = new Set(["examiner", "ramasser", "donner"]);

function estObjet(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function valideContexte(brut, scenario) {
  if (!estObjet(brut) || typeof brut.id !== "string") {
    return { ok: false, erreur: "Contexte invalide." };
  }
  const laurent = scenario.personnage?.id ?? "laurent";
  if (brut.type === "personnage" && brut.id === laurent) {
    return { ok: true, valeur: { type: "personnage", id: laurent } };
  }
  if (brut.type === "zone" && scenario.zones?.[brut.id]) {
    return { ok: true, valeur: { type: "zone", id: brut.id } };
  }
  return { ok: false, erreur: "Contexte invalide." };
}

export function valideIntention(brut, scenario) {
  if (!estObjet(brut) || typeof brut.action !== "string" || typeof brut.cible !== "string") {
    return { ok: false, erreur: "Intention invalide." };
  }
  if (brut.cible.length === 0 || brut.cible.length > 200) {
    return { ok: false, erreur: "Intention invalide." };
  }
  if (ACTIONS_OBJET.has(brut.action) && scenario.objets?.[brut.cible]) {
    return { ok: true, valeur: { action: brut.action, cible: brut.cible } };
  }
  if (brut.action === "fouiller" && scenario.zones?.[brut.cible]) {
    return { ok: true, valeur: { action: "fouiller", cible: brut.cible } };
  }
  return { ok: false, erreur: "Intention inconnue." };
}

export function valideRecus(brut) {
  const recus = brut ?? [];
  if (!Array.isArray(recus) || recus.length > MAX_RECUS) {
    return { ok: false, erreur: "Reçus invalides." };
  }
  if (recus.some((recu) => typeof recu !== "string" || recu.length === 0 || recu.length > MAX_TAILLE_RECU)) {
    return { ok: false, erreur: "Reçus invalides." };
  }
  return { ok: true, valeur: [...recus] };
}

export function valideRequeteInteraction(body, scenario) {
  if (!estObjet(body)) return { ok: false, erreur: "Requête invalide." };
  const contexte = valideContexte(body.contexte, scenario);
  if (!contexte.ok) return contexte;
  const intention = valideIntention(body.intention, scenario);
  if (!intention.ok) return intention;
  const recus = valideRecus(body.recus);
  if (!recus.ok) return recus;
  return {
    ok: true,
    valeur: { contexte: contexte.valeur, intention: intention.valeur, recus: recus.valeur },
  };
}

export function valideRequeteChat(body, scenario) {
  if (!estObjet(body)) return { ok: false, erreur: "Requête invalide." };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0) return { ok: false, erreur: "Le message est vide." };
  if (message.length > MAX_MESSAGE) return { ok: false, erreur: "Le message est trop long." };
  const contexte = valideContexte(body.contexte, scenario);
  if (!contexte.ok) return contexte;
  const recus = valideRecus(body.recus);
  if (!recus.ok) return recus;

  const historiqueBrut = body.historique ?? [];
  if (!Array.isArray(historiqueBrut) || historiqueBrut.length > MAX_HISTORIQUE) {
    return { ok: false, erreur: "Historique invalide." };
  }
  const historique = historiqueBrut
    .filter((tour) => estObjet(tour) && tour.canal === "laurent")
    .map((tour) => ({
      role: tour.role === "personnage" ? "personnage" : "joueur",
      texte: String(tour.texte ?? "").slice(0, MAX_MESSAGE),
    }));

  return { ok: true, valeur: { message, contexte: contexte.valeur, recus: recus.valeur, historique } };
}

export function valideDebrief(body, idsConnus) {
  if (!estObjet(body)) return { ok: false, erreur: "Requête invalide." };
  const brut = body.reponses ?? [];
  if (!Array.isArray(brut) || brut.length > idsConnus.size) {
    return { ok: false, erreur: "Réponses invalides." };
  }
  const reponses = [];
  for (const r of brut) {
    if (!estObjet(r) || typeof r.id !== "string" || !idsConnus.has(r.id)) {
      return { ok: false, erreur: "Question inconnue." };
    }
    if (typeof r.reponse !== "string") return { ok: false, erreur: "Réponse invalide." };
    reponses.push({ id: r.id, reponse: r.reponse.slice(0, MAX_REPONSE) });
  }
  return { ok: true, valeur: reponses };
}

export function valideRequeteVoix(body) {
  if (!estObjet(body)) return { ok: false, erreur: "Requête invalide." };
  const texte = typeof body.texte === "string" ? body.texte.trim() : "";
  if (texte.length === 0) return { ok: false, erreur: "Le texte est vide." };
  if (texte.length > MAX_TEXTE_VOIX) return { ok: false, erreur: "Le texte est trop long." };
  return { ok: true, valeur: { texte } };
}

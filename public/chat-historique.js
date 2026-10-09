// Adaptateur de compatibilité avec les serveurs sans orchestration de scènes.
import { ajouterDialogue, historiquePourPersonnage, historiquePourInterprete, recanaliserDernierTour, ajouterRecus, remplacerEtatPublic } from "./state.js";
export function creerParcoursHistorique({ apiBase, obtenirEtat, modifierEtat, rendreDialogueDOM, narration, demarrerAttente, arreterAttente, consommerFlux, appliquerContexte, decrireObservation, messageErreurApi, rendreSac, rendrePistes, nomPersonnage }) {
let etat;
async function traiterInteraction(intention, angle) {
  etat = obtenirEtat();
  modifierEtat(etat);
  let rep;
  try {
    rep = await fetch(`${apiBase}/interagir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contexte: etat.contexte,
        intention,
        recus: etat.recus,
        ...(intention.action === "examiner" && angle ? { angle } : {}),
      }),
    });
  } catch {
    narration("Impossible d'agir (réseau).", "Information");
    return;
  }
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    narration(messageErreurApi(data.erreur, "Cette action est impossible."), "Information");
    return;
  }
  etat = ajouterRecus(etat, data.recus);
  modifierEtat(etat);
  etat = remplacerEtatPublic(etat, data.etatPublic);
  modifierEtat(etat);
  rendreSac();
  narration(data.narration ?? "Rien de particulier ici.");
  rendrePistes(data.pistes);
}

async function traiterDialogue(message) {
  etat = obtenirEtat();
  modifierEtat(etat);
  const historique = historiquePourPersonnage(etat);
  // Le message est déjà affiché ; seul son canal change après interprétation.
  etat = recanaliserDernierTour(etat, etat.personnageId);
  modifierEtat(etat);
  rendreDialogueDOM();
  demarrerAttente();
  let rep;
  try {
    rep = await fetch(`${apiBase}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, contexte: etat.contexte, recus: etat.recus, historique }),
    });
  } catch {
    arreterAttente();
    etat = recanaliserDernierTour(etat, "scene");
    modifierEtat(etat);
    narration("Le personnage est injoignable (réseau).", "Information");
    return;
  }
  if (!rep.ok) {
    arreterAttente();
    etat = recanaliserDernierTour(etat, "scene");
    modifierEtat(etat);
    const data = await rep.json().catch(() => ({}));
    narration(messageErreurApi(data.erreur, "Erreur de communication."), "Information");
    return;
  }
  await consommerFlux(rep);
}

async function interpreterEntree(message) {
  etat = obtenirEtat();
  modifierEtat(etat);
  const historique = historiquePourInterprete(etat);
  etat = ajouterDialogue(etat, "joueur", message, "scene");
  modifierEtat(etat);
  rendreDialogueDOM();
  demarrerAttente("Vous réfléchissez");
  let rep;
  try {
    rep = await fetch(`${apiBase}/interpreter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, contexte: etat.contexte, recus: etat.recus, historique }),
    });
  } catch {
    arreterAttente();
    narration("L'interprète est indisponible (réseau).", "Information");
    return;
  }
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    arreterAttente();
    narration(messageErreurApi(data.erreur, "L'interprète est indisponible pour le moment."), "Information");
    return;
  }
  arreterAttente();
  const decision = data.decision;
  if (!decision || typeof decision.type !== "string") {
    narration(`Que souhaitez-vous observer, faire ou demander à ${nomPersonnage()} ?`);
    return;
  }
  const contexteAvant = etat.contexte;
  if (decision.type === "observer" && appliquerContexte(decision.contexte)) {
    const changementZone = decision.contexte.type === "zone" &&
      (contexteAvant.type !== "zone" || contexteAvant.id !== decision.contexte.id);
    if (decision.narration || !changementZone) narration(decision.narration ?? decrireObservation(decision.contexte));
    return;
  }
  if (decision.type === "interagir" && appliquerContexte(decision.contexte)) {
    return traiterInteraction({ action: decision.action, cible: decision.cibleId }, decision.angle);
  }
  if (decision.type === "dialoguer" && appliquerContexte(decision.contexte)) {
    return traiterDialogue(message);
  }
  if (decision.type === "clarifier") {
    narration(decision.question ?? `Que souhaitez-vous observer, faire ou demander à ${nomPersonnage()} ?`, "Précision");
    return;
  }
  narration(`Que souhaitez-vous observer, faire ou demander à ${nomPersonnage()} ?`);
}

return { interpreterEntree };
}

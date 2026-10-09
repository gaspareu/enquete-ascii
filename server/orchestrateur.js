// Un tour complet est arbitré ici ; les agents ne signent aucune action.
import { scenePourContexte } from "./scenes.js";
import { projectionScene, projectionPersonnage } from "./projection-scene.js";
import { historiqueLocal, ajouterTourMemoire } from "./memoire-scene.js";
import { deriverEtat, deriverFlagsVisibles } from "./etat.js";
import { evaluerCapacite } from "./capacites.js";
import { executerInteraction } from "./interactions.js";
import { verifierRecus, emettreRecu, MAX_RECUS } from "./progression.js";
import { composerObservation } from "./observations.js";
import { pistesPourFlags } from "./pistes.js";

export async function orchestrerTour({ scenario, secret, identite, client, model, modelExploration,
  agentSceneFn, repondreFluxFn, demande, etatTour, emit, annule = () => false }) {
  let contexte = demande.navigation ?? demande.contexte;
  let scene = scenePourContexte(scenario, contexte);
  const personnageId = scenario.personnage.id ?? "laurent";
  let observationDeplacement = null;
  const annoncer = () => {
    observationDeplacement = contexte.type === "zone"
      ? `Vous observez ${scenario.zones[contexte.id].article ?? "la"} ${scene.nom}.`
      : `Vous vous tournez vers ${scene.nom}.`;
    emit("observation", { texte: observationDeplacement });
  };
  const contextualiser = (role = "exploration") => emit("contexte", { contexte, sceneId: scene.id, role });
  const memoriser = (role, reponses) => {
    etatTour.memoire = ajouterTourMemoire(etatTour.memoire, scene.id, role, demande.message, reponses);
  };
  if (demande.navigation) {
    contextualiser();
    if (demande.navigation.type !== demande.contexte.type || demande.navigation.id !== demande.contexte.id) annoncer();
    return;
  }
  let decision;
  for (let transfert = 0; transfert < 2; transfert += 1) {
    const projection = projectionScene(scenario, etatTour.verification.evenements, contexte);
    decision = await agentSceneFn(client, { projection, message: demande.message,
      historique: historiqueLocal(etatTour.memoire, scene.id, "exploration"),
      model: scene.type === "personnage" ? model : modelExploration });
    if (annule()) return;
    if (decision.type !== "deplacer") break;
    if (transfert === 1) throw new Error("Transferts successifs refusés.");
    const destination = scenePourContexte(scenario, decision.destination);
    if (!destination) throw new Error("Destination inconnue.");
    contexte = destination.contexte; scene = destination;
    contextualiser(); annoncer();
  }
  contextualiser(decision.type === "dialoguer" ? "personnage" : "exploration");
  if (decision.type === "clarifier") {
    emit("precision", { texte: decision.question });
    memoriser("exploration", [{ role: "systeme", texte: decision.question }]);
    return;
  }
  if (decision.type === "observer") {
    const texte = decision.portee === "piece"
      ? `Dans la pièce, vous distinguez :\n${Object.values(scenario.zones).map((zone) => `• ${zone.nom} : ${zone.description}`).join("\n")}`
      : contexte.type === "zone" ? scenario.zones[contexte.id].description : (observationDeplacement ?? `Vous observez ${scene.nom}.`);
    if (texte !== observationDeplacement) emit("observation", { texte });
    memoriser("exploration", [{ role: "systeme", texte }]); return;
  }
  if (decision.type === "interagir") {
    const intention = { action: decision.action, cible: decision.cibleId };
    const resultat = executerInteraction({ scenario, secret, verification: etatTour.verification, contexte, intention });
    if (!resultat.ok) throw new Error("Cette action n'est pas autorisée ici.");
    const avant = etatTour.verification;
    etatTour.verification = verifierRecus(secret, [...avant.recus, ...resultat.recus], identite);
    if (!etatTour.verification.ok) throw new Error("Progression invalide.");
    const objet = scenario.objets[intention.cible];
    const texte = intention.action === "examiner" ? composerObservation({ texteVisible: resultat.narration,
      observations: objet.observations, limites: objet.limites, angle: decision.angle,
      examenNumero: avant.evenements.filter((e) => e.type === "examiner" && e.cible === intention.cible).length + 1 }) : resultat.narration;
    memoriser("exploration", [{ role: "systeme", texte }]);
    emit("progression", { recus: resultat.recus, etatPublic: resultat.etatPublic,
      pistes: pistesPourFlags(scenario, deriverFlagsVisibles(scenario, etatTour.verification.evenements)) });
    emit("observation", { texte }); return;
  }
  if (decision.type !== "dialoguer") throw new Error("Décision inconnue.");
  const avant = etatTour.verification;
  const capacite = evaluerCapacite(scenario, deriverEtat(scenario, avant.evenements), { contexte, intention: { action: "dialoguer", cible: personnageId } });
  if (!capacite.ok) throw new Error("Le personnage n'est pas accessible ici.");
  const projection = projectionPersonnage(scenario, avant.evenements);
  const acquis = deriverEtat(scenario, avant.evenements).actionsEffectuees;
  const evenementsAutorises = projection.evenementsAutorises.filter((e) => !acquis.includes(e));
  let parole = "";
  const sortie = await repondreFluxFn(client, { ...projection,
    historique: historiqueLocal(etatTour.memoire, scene.id, "personnage"), message: demande.message,
    model, evenementsAutorises, personnageNom: scene.nom }, (evenement) => {
    if (!["delta", "didascalie"].includes(evenement?.type) || typeof evenement.texte !== "string") return;
    if (evenement.type === "delta") parole += evenement.texte;
    emit(evenement.type, { texte: evenement.texte });
  });
  if (annule()) return;
  const exprimes = [...new Set(sortie?.evenementsExprimes ?? [])].filter((e) => evenementsAutorises.includes(e));
  const recus = [];
  if (avant.recus.length + exprimes.length <= MAX_RECUS) {
    for (const cible of exprimes) {
      const recu = emettreRecu(secret, etatTour.verification, { type: "dialogue", cible, contexte });
      recus.push(recu);
      etatTour.verification = verifierRecus(secret, [...etatTour.verification.recus, recu], identite);
    }
  }
  if (parole) memoriser("personnage", [{ role: "personnage", texte: parole }]);
  // L'interprétation conserve les précisions et la parole publique de cette scène,
  // tandis que le personnage ne reçoit que son propre canal de dialogue.
  if (parole) memoriser("exploration", [{ role: "personnage", texte: parole }]);
  emit("progression", { recus, pistes: pistesPourFlags(scenario, deriverFlagsVisibles(scenario, etatTour.verification.evenements)) });
}

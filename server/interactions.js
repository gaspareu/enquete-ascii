// Exécution des intentions déjà validées. Cette couche ne décide jamais à partir
// du client : elle repart d'une chaîne de reçus vérifiée et demande ses droits à
// capacites.js avant de signer toute action acceptée.

import { evaluerCapacite } from "./capacites.js";
import { deriverEtat } from "./etat.js";
import { emettreRecu, MAX_RECUS, verifierRecus } from "./progression.js";

function evenementPour(intention, contexte) {
  return { type: intention.action, cible: intention.cible, contexte };
}

function texteExamen(scenario, cible, flags) {
  const objet = scenario.objets[cible];
  const flagExamen = scenario.declencheurs?.[`examiner:${cible}`];
  const revele = !flagExamen || flags.includes(flagExamen);
  return revele ? objet.description : (objet.apercu ?? objet.description);
}

function signerEvenements(secret, verification, evenements) {
  let courant = verification;
  const chaine = [...verification.recus];
  const nouveaux = [];
  for (const evenement of evenements) {
    const recu = emettreRecu(secret, courant, evenement);
    chaine.push(recu);
    courant = verifierRecus(secret, chaine);
    if (!courant.ok) throw new Error("Chaîne de progression invalide.");
    nouveaux.push(recu);
  }
  return { verification: courant, nouveaux };
}

function narrationFouille(scenario, contexte, etat, cibles) {
  const zone = scenario.zones[contexte.id];
  const nomZone = zone.nom ? `${zone.article ?? "la"} ${zone.nom}` : "cette zone";
  const trouvailles = cibles
    .map((cible) => `• ${scenario.objets[cible].nom} — ${texteExamen(scenario, cible, etat.flags)}`)
    .join("\n");
  return `En cherchant dans ${nomZone}, vous trouvez :\n${trouvailles}`;
}

export function executerInteraction({ scenario, secret, verification, contexte, intention }) {
  const avant = deriverEtat(scenario, verification.evenements);
  const capacite = evaluerCapacite(scenario, avant, { contexte, intention });
  if (!capacite.ok) return capacite;

  let evenements;
  let ciblesFouille = [];
  if (intention.action === "fouiller") {
    // Une fouille est un lot d'examens. Les reçus sont tous créés avant la lecture
    // des descriptions afin que les préconditions historiques soient résolues sur
    // l'état complet de la fouille.
    ciblesFouille = scenario.zones[contexte.id].objetsCaches
      .filter((cible) => scenario.objets[cible])
      .filter((cible) => evaluerCapacite(scenario, avant, {
        contexte,
        intention: { action: "examiner", cible },
      }).ok);
    evenements = ciblesFouille.map((cible) => evenementPour({ action: "examiner", cible }, contexte));
  } else {
    evenements = [evenementPour(intention, contexte)];
  }

  if (verification.recus.length + evenements.length > MAX_RECUS) {
    return { ok: false, code: "PROGRESSION_INSUFFISANTE" };
  }

  const signes = signerEvenements(secret, verification, evenements);
  const apres = deriverEtat(scenario, signes.verification.evenements);
  let narration;
  if (intention.action === "examiner") narration = texteExamen(scenario, intention.cible, apres.flags);
  else if (intention.action === "ramasser") narration = `Vous ramassez : ${scenario.objets[intention.cible].nom}.`;
  else if (intention.action === "donner") narration = `Vous tendez ${scenario.objets[intention.cible].nom} à ${scenario.personnage.nom}.`;
  else narration = narrationFouille(scenario, contexte, apres, ciblesFouille);

  return { ok: true, narration, recus: signes.nouveaux, etatPublic: { sac: apres.sac } };
}

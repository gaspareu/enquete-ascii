// Logique d'état du jeu côté front, pure et immutable (jamais de mutation en place).
// Le navigateur ne dérive plus de flags : il tient le sac (pour l'affichage) et un
// JOURNAL DE GESTES (ramasser/donner/examiner) envoyé au serveur, qui en dérive seul
// les flags (cf. server/etat.js). Aucun secret du scénario ne transite donc ici.

export function etatInitial() {
  return { sac: [], historique: [], gestes: [] };
}

// Renvoie un nouvel état avec le geste `{geste, cible}` journalisé, sans doublon.
// Le journal est idempotent : un même geste répété ne s'ajoute qu'une fois.
function avecGeste(etat, geste, cible) {
  if (etat.gestes.some((g) => g.geste === geste && g.cible === cible)) return etat;
  return { ...etat, gestes: [...etat.gestes, { geste, cible }] };
}

export function ramasser(etat, objetId, objets) {
  const objet = objets[objetId];
  if (!objet || !objet.ramassable) return etat;

  const apresSac = etat.sac.includes(objetId)
    ? etat
    : { ...etat, sac: [...etat.sac, objetId] };

  return avecGeste(apresSac, "ramasser", objetId);
}

export function donner(etat, objetId) {
  if (!etat.sac.includes(objetId)) return etat;
  return avecGeste(etat, "donner", objetId);
}

export function examiner(etat, cible) {
  return avecGeste(etat, "examiner", cible);
}

export function ajouterDialogue(etat, role, texte) {
  return { ...etat, historique: [...etat.historique, { role, texte }] };
}

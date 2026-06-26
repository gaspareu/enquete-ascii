// Logique d'état du jeu, pure et immutable (jamais de mutation en place).
// Aucune dépendance au scénario ni au DOM : objets/declencheurs sont injectés.
// Cela garantit qu'aucun secret du scénario ne transite par le code navigateur.

export function etatInitial() {
  return { flags: [], sac: [], historique: [] };
}

// Renvoie un nouvel état avec `flag` ajouté (sans doublon).
function avecFlag(etat, flag) {
  if (!flag || etat.flags.includes(flag)) return etat;
  return { ...etat, flags: [...etat.flags, flag] };
}

// Applique le flag associé au geste `${geste}:${cible}`, s'il existe.
function appliquerDeclencheur(etat, geste, cible, declencheurs) {
  return avecFlag(etat, declencheurs[`${geste}:${cible}`]);
}

export function ramasser(etat, objetId, objets, declencheurs) {
  const objet = objets[objetId];
  if (!objet || !objet.ramassable) return etat;

  const dansLeSac = etat.sac.includes(objetId);
  const apresSac = dansLeSac
    ? etat
    : { ...etat, sac: [...etat.sac, objetId] };

  return appliquerDeclencheur(apresSac, "ramasser", objetId, declencheurs);
}

export function donner(etat, objetId, declencheurs) {
  if (!etat.sac.includes(objetId)) return etat;
  return appliquerDeclencheur(etat, "donner", objetId, declencheurs);
}

export function examiner(etat, cible, declencheurs) {
  return appliquerDeclencheur(etat, "examiner", cible, declencheurs);
}

export function ajouterDialogue(etat, role, texte) {
  return { ...etat, historique: [...etat.historique, { role, texte }] };
}

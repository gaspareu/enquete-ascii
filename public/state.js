// État purement client : le navigateur mémorise ce qu'il observe, le journal
// visible et les reçus opaques fournis par le serveur. Il ne déduit jamais de
// flags ni d'inventaire à partir d'une action locale.

export function etatInitial(personnageId = "laurent") {
  return { personnageId, contexte: { type: "personnage", id: personnageId }, sac: [], objetsConnus: [], historique: [], recus: [] };
}

export function observerZone(etat, id) {
  return { ...etat, contexte: { type: "zone", id } };
}

export function observerPersonnage(etat) {
  return { ...etat, contexte: { type: "personnage", id: etat.personnageId ?? "laurent" } };
}

export function ajouterDialogue(etat, role, texte, canal = "scene") {
  const tour = { role, texte, canal, contexte: { ...etat.contexte } };
  return { ...etat, historique: [...etat.historique, tour] };
}

// Le personnage ne reçoit que les échanges tenus face à lui.
export function historiquePourPersonnage(etat, personnageId = etat.personnageId ?? "laurent") {
  return etat.historique.filter((tour) => tour.canal === personnageId);
}

// Le journal récent relie observations, questions et précisions. Il sert seulement
// à interpréter une intention ; les reçus restent la preuve des droits du joueur.
export function historiquePourInterprete(etat) {
  return etat.historique.slice(-12).map(({ role, texte }) => ({ role, texte: texte.slice(0, 2000) }));
}

// Alias de compatibilité pour les usages historiques.
export const historiquePourLaurent = historiquePourPersonnage;

// Une tentative qui échoue avant toute réponse reste visible dans le journal mais
// devient une entrée de scène : elle ne pollue pas le prochain échange.
export function recanaliserDernierTour(etat, canal) {
  if (etat.historique.length === 0) return etat;
  const index = etat.historique.length - 1;
  return {
    ...etat,
    historique: etat.historique.map((tour, position) =>
      position === index ? { ...tour, canal } : tour,
    ),
  };
}

export function ajouterRecus(etat, recus) {
  const connus = new Set(etat.recus);
  const nouveaux = [];
  for (const recu of Array.isArray(recus) ? recus : []) {
    if (typeof recu === "string" && !connus.has(recu)) {
      connus.add(recu);
      nouveaux.push(recu);
    }
  }
  return nouveaux.length === 0 ? etat : { ...etat, recus: [...etat.recus, ...nouveaux] };
}

// Seule une réponse d'interaction acceptée fournit l'inventaire public affiché.
export function remplacerEtatPublic(etat, etatPublic) {
  const objetsConnus = Array.isArray(etatPublic?.objetsConnus)
    ? etatPublic.objetsConnus
      .filter((objet) => objet && typeof objet.id === "string" && typeof objet.nom === "string")
      .map((objet) => ({ ...objet, aliases: Array.isArray(objet.aliases) ? [...objet.aliases] : [] }))
    : [];
  return {
    ...etat,
    sac: Array.isArray(etatPublic?.sac) ? [...etatPublic.sac] : [],
    objetsConnus,
  };
}

// Une annonce de déplacement peut suivre le joueur avant que son rôle soit connu.
export function recanaliserDernierJoueur(etat, canal) {
  const index = etat.historique.findLastIndex((tour) => tour.role === "joueur");
  return index < 0 ? etat : { ...etat, historique: etat.historique.map((tour, position) =>
    position === index ? { ...tour, canal, contexte: { ...etat.contexte } } : tour) };
}

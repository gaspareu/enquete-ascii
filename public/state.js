// État purement client : le navigateur mémorise ce qu'il observe, le journal
// visible et les reçus opaques fournis par le serveur. Il ne déduit jamais de
// flags ni d'inventaire à partir d'une action locale.

const CONTEXTE_LAURENT = Object.freeze({ type: "personnage", id: "laurent" });

export function etatInitial() {
  return { contexte: { ...CONTEXTE_LAURENT }, sac: [], objetsConnus: [], historique: [], recus: [] };
}

export function observerZone(etat, id) {
  return { ...etat, contexte: { type: "zone", id } };
}

export function observerPersonnage(etat) {
  return { ...etat, contexte: { ...CONTEXTE_LAURENT } };
}

export function ajouterDialogue(etat, role, texte, canal = "scene") {
  const tour = { role, texte, canal, contexte: { ...etat.contexte } };
  return { ...etat, historique: [...etat.historique, tour] };
}

// Laurent ne doit entendre que les échanges tenus face à lui : le journal affiché
// reste global, mais sa projection ne retient jamais narration, refus ou fouille.
export function historiquePourLaurent(etat) {
  return etat.historique.filter((tour) => tour.canal === "laurent");
}

// Une tentative qui échoue avant toute réponse reste visible dans le journal mais
// devient une entrée de scène : elle ne pollue pas le prochain échange avec Laurent.
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

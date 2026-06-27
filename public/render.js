// Fonctions de rendu pures (sans DOM) : produisent du texte ASCII.
// La construction des éléments interactifs (plan, sac) est faite dans game.js.

// Visage ASCII générique, utilisé quand le personnage n'en fournit pas de propre.
const VISAGE_GENERIQUE = [
  '        .-"""""-.',
  "       /  _   _  \\",
  "      |  (o) (o)  |",
  "      |     ^     |",
  "       \\   '-'   /",
  "        '-.....-'",
];

// Art du face-à-face. Accepte un objet personnage { nom, visage? } ; tolère aussi
// un simple nom en chaîne (rétro-compatibilité). Si un `visage` ASCII est fourni
// (créé p. ex. avec ASCII Facemaker), il prime sur le visage générique.
export function artInterlocuteur(personnage) {
  const nom = typeof personnage === "string" ? personnage : personnage?.nom ?? "";
  const visage = typeof personnage === "object" ? personnage?.visage : null;
  const corps = visage && visage.trim() ? visage : VISAGE_GENERIQUE.join("\n");
  return `${corps}\n         « ${nom} »`;
}

// Met en forme l'historique du dialogue. "joueur" → "Vous", sinon le nom du perso.
export function rendreDialogue(historique, nomPerso) {
  return dialoguePartiel(historique, nomPerso, Infinity);
}

// Comme rendreDialogue, mais le texte du DERNIER tour est tronqué à `nCars`
// caractères (le préfixe « Vous : » / « Nom : » reste entier). Sert à l'effet
// machine à écrire : le contrôleur DOM fait croître `nCars` au fil du temps.
export function dialoguePartiel(historique, nomPerso, nCars) {
  const dernier = historique.length - 1;
  return historique
    .map((tour, i) => {
      const texte = i === dernier ? tour.texte.slice(0, nCars) : tour.texte;
      if (tour.role === "systeme") return `— ${texte}`;
      const qui = tour.role === "joueur" ? "Vous" : nomPerso;
      return `${qui} : ${texte}`;
    })
    .join("\n\n");
}

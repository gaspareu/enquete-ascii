// Fonctions de rendu pures (sans DOM) : produisent du texte ASCII.
// La construction des éléments interactifs (plan, sac) est faite dans game.js.

// Petit visage ASCII de l'interlocuteur, affiché au centre par défaut.
export function artInterlocuteur(nom) {
  return [
    "        .-\"\"\"\"\"-.",
    "       /  _   _  \\",
    "      |  (o) (o)  |",
    "      |     ^     |",
    "       \\   '-'   /",
    "        '-.....-'",
    `         « ${nom} »`,
  ].join("\n");
}

// Met en forme l'historique du dialogue. "joueur" → "Vous", sinon le nom du perso.
export function rendreDialogue(historique, nomPerso) {
  return historique
    .map((tour) => {
      if (tour.role === "systeme") return `— ${tour.texte}`;
      const qui = tour.role === "joueur" ? "Vous" : nomPerso;
      return `${qui} : ${tour.texte}`;
    })
    .join("\n\n");
}

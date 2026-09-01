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

// Une réponse de personnage peut commencer par une courte didascalie balisée par
// des astérisques. On la sépare de la parole sans jamais interpréter du HTML : le
// DOM décidera ensuite de l'afficher en italique.
export function decouperReplique(texte) {
  const brut = typeof texte === "string" ? texte : "";
  const match = brut.match(/^\s*\*([^*\n]+)\*\s*(?:\r?\n)?([\s\S]*)$/);
  if (!match) return { reaction: "", parole: brut };
  return { reaction: match[1].trim(), parole: match[2].trim() };
}

// Met en forme l'historique du dialogue. "joueur" → "Vous", narration système
// sans préfixe, sinon le nom du personnage.
export function rendreDialogue(historique, nomPerso) {
  return historique
    .map((tour) => {
      if (tour.role === "systeme") return `— ${tour.texte}`;
      const qui = tour.role === "joueur" ? "Vous" : nomPerso;
      if (tour.role === "joueur") return `${qui} : ${tour.texte}`;
      const { reaction, parole } = decouperReplique(tour.texte);
      return [reaction, `${qui} : ${parole}`].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

// Écran de fin du débrief (T-06) : rang, score global, puis note + justification
// par question. Rendu ASCII pur ; l'affichage DOM est câblé dans game.js.
export function rendreDebrief({ total, max, rang, details }) {
  const entete = [`RANG : ${rang}`, `SCORE : ${total} / ${max}`, ""];
  const corps = details.flatMap((d) => {
    const lignes = [`[${d.note}/5] ${d.question}`];
    if (d.justification) lignes.push(`       ${d.justification}`);
    return lignes;
  });
  return [...entete, ...corps].join("\n");
}

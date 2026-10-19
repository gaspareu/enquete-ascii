import { bouton, element, zoneAide } from "./ui.js";

// Le guide navigue dans les formulaires existants sans accorder de droit de jeu.
export function rendreGuideAuteur(ouvert = false) {
  const guide = element("details", "", "carte guide-auteur");
  guide.open = ouvert;
  guide.append(element("summary", "Bien commencer : de votre idée à une enquête jouable"));
  const etapes = [
    ["La vérité", "Décidez ce qui s’est passé et ce que le joueur devra expliquer.", [["Écrire la conclusion", "debrief"]]],
    ["Le personnage", "Donnez-lui une voix et une introduction. Gardez les révélations pour l’étape 4.", [["Présenter le personnage", "cadre"]]],
    ["Les lieux et les indices", "Décrivez la pièce, puis placez les objets qui permettront de déduire la vérité.", [["Décrire les lieux", "piece"], ["Écrire les indices", "objets"]]],
    ["Les révélations", "Reliez les découvertes du joueur à ce que le personnage peut lui révéler.", [["Relier les découvertes", "progression"], ["Écrire les révélations", "dialogue"]]],
    ["Essayer l’enquête", "Enregistrez, vérifiez puis lancez l’aperçu. Essayez de découvrir les indices dans plusieurs ordres.", [["Vérifier et tester", "tester"]]],
  ];
  const liste = element("ol", "", "parcours-auteur");
  for (const [nom, aide, liens] of etapes) {
    const etape = element("li");
    etape.append(element("h3", nom), zoneAide(aide));
    const actions = element("div", "", "actions");
    actions.append(...liens.map(([libelle, section]) => bouton(libelle, "etape", { section })));
    etape.append(actions); liste.append(etape);
  }
  guide.append(liste, zoneAide("Votre brouillon reste local. Marquer une enquête prête l’ajoute à la sélection de ce serveur ; le partage web privé sera une étape ultérieure."));
  return guide;
}

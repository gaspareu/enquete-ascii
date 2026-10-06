import { toursDialogue } from "./render.js";
export function creerTour(projection, didascalie = "", repere = "Observation") {
  const article = document.createElement("article");
  article.className = `tour tour--${projection.role}`;
  if (projection.role === "systeme") {
    const label = document.createElement("span");
    label.className = "tour-repere";
    label.textContent = repere;
    article.appendChild(label);
  }
  if (didascalie) {
    const geste = document.createElement("em");
    geste.className = "didascalie";
    geste.textContent = didascalie;
    article.append(geste, document.createElement("br"));
  }
  const texte = document.createElement("p");
  texte.className = "tour-texte";
  if (["joueur", "personnage"].includes(projection.role)) {
    const auteur = document.createElement("span");
    auteur.className = "tour-auteur";
    auteur.textContent = `${projection.auteur} : `;
    texte.appendChild(auteur);
  }
  texte.append(projection.texte);
  article.appendChild(texte);
  return article;
}

export function creerRenduDialogue({ elDialogue, suiviJournal, obtenirEtat, obtenirVue, didascalies, reperesTours }) {
let historiqueAffiche = [];
function rendreDialogueDOM(historique = obtenirEtat().historique) {
  const nouveau = historique.slice(historiqueAffiche.length).some((tour) => tour.role !== "joueur");
  suiviJournal.modifier(() => {
    const prefixConserve = historiqueAffiche.length <= historique.length &&
      historiqueAffiche.every((tour, index) => {
        const suivant = historique[index];
        return tour.role === suivant.role &&
          tour.texte === suivant.texte &&
          didascalies.get(tour) === didascalies.get(suivant);
      });
    if (!prefixConserve) {
      elDialogue.replaceChildren();
      historiqueAffiche = [];
    }
    const fragments = document.createDocumentFragment();
    for (const tour of historique.slice(historiqueAffiche.length)) {
      const projection = toursDialogue([tour], obtenirVue().personnage.nom)[0];
      fragments.appendChild(creerTour(projection, didascalies.get(tour) ?? projection.didascalie, reperesTours.get(tour)));
    }
    elDialogue.appendChild(fragments);
    historiqueAffiche = [...historique];
  }, { nouveau });
}

return rendreDialogueDOM;
}

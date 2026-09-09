// Orchestration isolée du débrief : formulaire, appel HTTP et rendu du verdict.

import { rendreDebrief } from "./render.js";

export function creerDebrief({ obtenirVue, conteneur, modale, creerBouton, ouvrirModale, fermerModale }) {
  async function soumettre(reponses) {
    try {
      const rep = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reponses }),
      });
      if (!rep.ok) {
        const data = await rep.json().catch(() => ({}));
        ouvrirModale(data.erreur ?? "Impossible de rendre le verdict.", [["Fermer", fermerModale]]);
        return;
      }
      ouvrirModale(rendreDebrief(await rep.json()), [["Rejouer", () => location.reload()]]);
    } catch {
      ouvrirModale("Impossible de soumettre le débrief (réseau).", [["Fermer", fermerModale]]);
    }
  }

  return function ouvrir() {
    const vue = obtenirVue();
    if (!vue) return;
    conteneur.replaceChildren();
    const titre = document.createElement("div");
    titre.textContent = "DÉBRIEF — exposez vos conclusions, le plus précisément possible :";
    conteneur.appendChild(titre);
    const form = document.createElement("form");
    form.id = "form-debrief";
    const champs = new Map();
    for (const question of vue.debrief.questions) {
      const label = document.createElement("label");
      label.append(document.createTextNode(question.question));
      const textarea = document.createElement("textarea");
      textarea.rows = 2;
      textarea.maxLength = 1000;
      label.appendChild(textarea);
      form.appendChild(label);
      champs.set(question.id, textarea);
    }
    const box = document.createElement("div");
    box.className = "boutons";
    const valider = creerBouton("Rendre mon verdict", () => {});
    valider.type = "submit";
    box.append(valider, creerBouton("Annuler", fermerModale));
    form.appendChild(box);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      soumettre([...champs.entries()].map(([id, textarea]) => ({ id, reponse: textarea.value })));
    });
    conteneur.appendChild(form);
    modale.classList.remove("cache");
  };
}

// Orchestration isolée du débrief : formulaire, appel HTTP et verdict accessible.

import { structurerDebrief } from "./render.js";

export function creerDebrief({ obtenirVue, conteneur, modale, creerBouton, fermerModale, apiBase = "/api" }) {
  function afficherResultat(resultat) {
    const debrief = structurerDebrief(resultat);
    conteneur.replaceChildren();
    const titre = document.createElement("h2");
    titre.textContent = `RANG : ${debrief.rang}`;
    const resume = document.createElement("p");
    resume.className = "debrief-resume";
    resume.textContent = `SCORE : ${debrief.total} / ${debrief.max}`;
    const hypotheses = document.createElement("ol");
    hypotheses.className = "debrief-hypotheses";
    for (const hypothese of debrief.hypotheses) {
      const item = document.createElement("li");
      item.className = "debrief-hypothese";
      const question = document.createElement("h3");
      question.textContent = hypothese.question;
      const note = document.createElement("p");
      note.className = "debrief-note";
      note.textContent = `Évaluation : ${hypothese.note}/5`;
      item.append(question, note);
      if (hypothese.justification) {
        const justification = document.createElement("p");
        justification.className = "debrief-justification";
        justification.textContent = hypothese.justification;
        item.appendChild(justification);
      }
      if (hypothese.elementManquant) {
        const manquant = document.createElement("p");
        manquant.className = "debrief-manquant";
        manquant.textContent = `À approfondir : ${hypothese.elementManquant}`;
        item.appendChild(manquant);
      }
      hypotheses.appendChild(item);
    }
    const actions = document.createElement("div");
    actions.className = "boutons";
    actions.appendChild(creerBouton("Rejouer", () => location.reload()));
    conteneur.append(titre, resume, hypotheses, actions);
  }

  return function ouvrir() {
    const vue = obtenirVue();
    if (!vue) return;
    conteneur.replaceChildren();
    const titre = document.createElement("div");
    titre.textContent = "DÉBRIEF — exposez vos conclusions, le plus précisément possible :";
    const form = document.createElement("form");
    form.id = "form-debrief";
    const statut = document.createElement("p");
    statut.className = "debrief-statut";
    statut.setAttribute("role", "status");
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
    const annuler = creerBouton("Annuler", fermerModale);
    annuler.type = "button";
    box.append(valider, annuler);
    form.append(statut, box);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.getAttribute("aria-busy") === "true") return;
      form.setAttribute("aria-busy", "true");
      valider.disabled = true;
      statut.textContent = "Analyse de vos hypothèses…";
      try {
        const rep = await fetch(`${apiBase}/debrief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reponses: [...champs.entries()].map(([id, textarea]) => ({ id, reponse: textarea.value })),
          }),
        });
        if (!rep.ok) {
          const data = await rep.json().catch(() => ({}));
          form.removeAttribute("aria-busy");
          valider.disabled = false;
          statut.textContent = data.erreur ?? "Impossible de rendre le verdict.";
          return;
        }
        afficherResultat(await rep.json());
      } catch {
        form.removeAttribute("aria-busy");
        valider.disabled = false;
        statut.textContent = "Impossible de soumettre le débrief (réseau).";
      }
    });
    conteneur.append(titre, form);
    modale.classList.remove("cache");
  };
}

// Câblage facultatif de la voix du personnage et de la reconnaissance micro.

import { microDisponible, creerMicro } from "./micro.js";

export function brancherControlesVoix({ modeVocal, boutonVoix, boutonMicro, saisie }) {
  if (boutonVoix) {
    boutonVoix.addEventListener("click", () => {
      const actif = modeVocal.basculer();
      boutonVoix.setAttribute("aria-pressed", String(actif));
      boutonVoix.classList.toggle("actif", actif);
    });
  }
  if (!boutonMicro) return;
  if (!microDisponible()) {
    boutonMicro.hidden = true;
    return;
  }
  const micro = creerMicro({
    onTexte: (texte) => {
      saisie.value = texte;
      saisie.focus();
    },
    onFin: () => boutonMicro.classList.remove("ecoute"),
  });
  boutonMicro.addEventListener("click", () => {
    boutonMicro.classList.add("ecoute");
    try {
      micro.demarrer();
    } catch {
      boutonMicro.classList.remove("ecoute");
    }
  });
}

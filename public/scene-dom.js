import { observerZone, observerPersonnage } from "./state.js";
import { artInterlocuteur } from "./render.js";
import { imagePourEmotion } from "./emotion.js";
export function creerRenduScenes({ obtenirVue, obtenirEtat, modifierEtat, obtenirEmotion, GRILLE,
  elPortrait, elPortraitImage, elIllustration, elIllustrationImage, elVisuel, elPlan,
  mettreAJourPlaceholder, rendrePistes, narration, naviguerScene }) {
function rendrePerso() {
  const vue = obtenirVue(); let etat = obtenirEtat();
  etat = observerPersonnage(etat); modifierEtat(etat);
  elIllustration.classList.add("cache");
  elIllustrationImage.removeAttribute("src");
  const portrait = imagePourEmotion(vue.personnage.portraits ?? {}, obtenirEmotion());
  if (!portrait) {
    elPortrait.classList.add("cache");
    elPortraitImage.removeAttribute("src");
    elVisuel.classList.remove("cache");
    elVisuel.textContent = artInterlocuteur(vue.personnage);
  } else {
    elVisuel.classList.add("cache");
    elPortraitImage.src = portrait;
    elPortraitImage.alt = `Portrait de ${vue.personnage.nom}`;
    elPortrait.classList.remove("cache");
  }
  mettreAJourPlaceholder();
  rendrePistes();
  rendrePlan();
}

function ouvrirZone(id) {
  const vue = obtenirVue(); let etat = obtenirEtat();
  const zone = vue.zones[id];
  if (!zone) return;
  const changement = etat.contexte.type !== "zone" || etat.contexte.id !== id;
  etat = observerZone(etat, id); modifierEtat(etat);
  if (changement && vue.orchestration !== "scenes") {
    narration(`Vous observez ${zone.article ?? "la"} ${zone.nom}.`);
  }
  elPortrait.classList.add("cache");
  elPortraitImage.removeAttribute("src");
  if (!zone.illustration) {
    elIllustration.classList.add("cache");
    elVisuel.classList.remove("cache");
    elVisuel.textContent = zone.description;
  } else {
    elVisuel.classList.add("cache");
    elIllustrationImage.src = zone.illustration;
    elIllustrationImage.alt = `Illustration pixel art : ${zone.description}`;
    elIllustration.classList.remove("cache");
  }
  mettreAJourPlaceholder();
  rendrePistes();
  rendrePlan();
}

function rendrePlan() {
  const vue = obtenirVue(), etat = obtenirEtat();
  elPlan.replaceChildren();
  for (const ligne of GRILLE) {
    for (const direction of ligne) {
      const element = document.createElement("button");
      element.className = "case";
      if (direction === "C") {
        element.classList.add("centre");
        element.textContent = vue.personnage.nom;
        element.addEventListener("click", () => vue.orchestration === "scenes"
          ? naviguerScene({ type: "personnage", id: etat.personnageId }) : rendrePerso());
      } else if (vue.zones[direction]) {
        element.textContent = direction;
        element.addEventListener("click", () => vue.orchestration === "scenes"
          ? naviguerScene({ type: "zone", id: direction }) : ouvrirZone(direction));
      } else {
        element.textContent = "·";
        element.disabled = true;
      }
      const active = (direction === "C" && etat.contexte.type === "personnage") ||
        (etat.contexte.type === "zone" && direction === etat.contexte.id);
      if (active) {
        element.classList.add("active");
        element.setAttribute("aria-current", "location");
      }
      elPlan.appendChild(element);
    }
  }
}

return { rendrePerso, ouvrirZone, rendrePlan };
}

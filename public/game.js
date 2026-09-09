// Orchestration DOM : le serveur arbitre toujours contexte, inventaire et progression signée.

import { etatInitial, observerZone, observerPersonnage, ajouterDialogue, historiquePourLaurent, recanaliserDernierTour, ajouterRecus, remplacerSac } from "./state.js";
import { intentionDepuisTexte } from "./intention.js";
import { artInterlocuteur, decouperReplique } from "./render.js";
import { decoupeTrames } from "./sse.js";
import { creerModeVocal } from "./voix.js";
import { creerDebrief } from "./debrief.js";
import { brancherControlesVoix } from "./controles-voix.js";
import {
  EMOTION_LAURENT_PAR_DEFAUT,
  emotionDepuisReplique,
  imagePourEmotionLaurent,
} from "./emotion.js";

const $ = (id) => document.getElementById(id);
const elVisuel = $("visuel");
const elPortrait = $("portrait-personnage");
const elPortraitImage = $("portrait-personnage-image");
const elIllustration = $("illustration-zone");
const elIllustrationImage = $("illustration-zone-image");
const elPlan = $("plan");
const elSac = $("sac");
const elDialogue = $("dialogue");
const elForm = $("saisie");
const elInput = $("message");
const elAccuser = $("btn-accuser");
const elModale = $("modale");
const elModaleContenu = $("modale-contenu");
const elBtnVoix = $("btn-voix");
const elBtnMicro = $("btn-micro");

const GRILLE = [
  ["NO", "N", "NE"],
  ["O", "C", "E"],
  ["SO", "S", "SE"],
];

let vue = null;
let etat = etatInitial();
let minuteurAttente = null;
let emotionLaurent = EMOTION_LAURENT_PAR_DEFAUT;
let entreeEnCours = false;
const modeVocal = creerModeVocal({
  jouer: (blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const liberer = () => URL.revokeObjectURL(url);
    audio.addEventListener("ended", liberer);
    audio.addEventListener("error", liberer);
    audio.play().catch(liberer);
  },
});

async function init() {
  try {
    const rep = await fetch("/api/scenario");
    vue = await rep.json();
  } catch {
    elVisuel.textContent = "Impossible de charger le scénario.";
    return;
  }
  etat = ajouterDialogue(etat, "systeme", vue.intro, "scene");
  rendrePerso();
  rendrePlan();
  rendreSac();
  rendreDialogueDOM();
}

function bouton(label, onClick) {
  const element = document.createElement("button");
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function mettreAJourPlaceholder() {
  elInput.placeholder = etat.contexte.type === "personnage"
    ? "Interrogez Laurent ou utilisez un objet du sac…"
    : "Fouillez cette zone ou examinez votre sac…";
}

function rendrePerso() {
  etat = observerPersonnage(etat);
  elIllustration.classList.add("cache");
  elIllustrationImage.removeAttribute("src");
  const portrait = imagePourEmotionLaurent(vue.personnage.portraits ?? {}, emotionLaurent);
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
}

function ouvrirZone(id) {
  const zone = vue.zones[id];
  if (!zone) return;
  etat = observerZone(etat, id);
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
}

function rendrePlan() {
  elPlan.replaceChildren();
  for (const ligne of GRILLE) {
    for (const direction of ligne) {
      const element = document.createElement("button");
      element.className = "case";
      if (direction === "C") {
        element.classList.add("centre");
        element.textContent = vue.personnage.nom;
        element.addEventListener("click", rendrePerso);
      } else if (vue.zones[direction]) {
        element.textContent = direction;
        element.addEventListener("click", () => ouvrirZone(direction));
      } else {
        element.textContent = "·";
        element.disabled = true;
      }
      elPlan.appendChild(element);
    }
  }
}

function ajouterTourDialogue(tour) {
  if (tour.role === "systeme") {
    elDialogue.append(`— ${tour.texte}`);
  } else if (tour.role === "joueur") {
    elDialogue.append(`Vous : ${tour.texte}`);
  } else {
    const { reaction, parole } = decouperReplique(tour.texte);
    if (reaction) {
      const didascalie = document.createElement("em");
      didascalie.textContent = reaction;
      elDialogue.append(didascalie, "\n");
    }
    elDialogue.append(`${vue.personnage.nom} : ${parole}`);
  }
}

function rendreDialogueDOM(historique = etat.historique) {
  elDialogue.replaceChildren();
  historique.forEach((tour, index) => {
    if (index > 0) elDialogue.append("\n\n");
    ajouterTourDialogue(tour);
  });
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

function rendreSac() {
  elSac.replaceChildren();
  if (etat.sac.length === 0) {
    const li = document.createElement("li");
    li.className = "vide";
    li.textContent = "(vide)";
    elSac.appendChild(li);
    return;
  }
  for (const id of etat.sac) {
    const li = document.createElement("li");
    li.className = "objet";
    li.textContent = vue.objets[id]?.nom ?? id;
    elSac.appendChild(li);
  }
}

function narration(texte) {
  etat = ajouterDialogue(etat, "systeme", texte, "scene");
  rendreDialogueDOM();
}

function mouvementReduit() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function arreterAttente() {
  if (minuteurAttente) {
    clearInterval(minuteurAttente);
    minuteurAttente = null;
  }
}

function demarrerAttente() {
  arreterAttente();
  const peindre = (points) => {
    rendreDialogueDOM();
    elDialogue.append(`\n\n— ${vue.personnage.nom} réfléchit${points}`);
    elDialogue.scrollTop = elDialogue.scrollHeight;
  };
  if (mouvementReduit()) return peindre("…");
  let i = 0;
  const animer = () => peindre(".".repeat((i++ % 3) + 1));
  animer();
  minuteurAttente = setInterval(animer, 350);
}

function peindreFlux(texte) {
  rendreDialogueDOM([...etat.historique, { role: "personnage", texte, canal: "laurent" }]);
  elDialogue.append("▌");
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

function finaliserReplique(texte) {
  etat = ajouterDialogue(etat, "personnage", texte, "laurent");
  emotionLaurent = emotionDepuisReplique(texte);
  if (!elPortrait.classList.contains("cache")) {
    const portrait = imagePourEmotionLaurent(vue.personnage.portraits ?? {}, emotionLaurent);
    if (portrait) elPortraitImage.src = portrait;
  }
  rendreDialogueDOM();
  modeVocal.dire(decouperReplique(texte).parole);
}

async function consommerFlux(rep) {
  const lecteur = rep.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let texte = "";
  let demarre = false;
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const decoupe = decoupeTrames(tampon);
      tampon = decoupe.reste;
      for (const { event, data } of decoupe.trames) {
        if (event === "delta") {
          if (!demarre) {
            arreterAttente();
            demarre = true;
          }
          texte += JSON.parse(data).texte;
          peindreFlux(texte);
        } else if (event === "progression") {
          etat = ajouterRecus(etat, JSON.parse(data).recus);
        } else if (event === "erreur") {
          arreterAttente();
          if (texte) etat = ajouterDialogue(etat, "personnage", texte, "laurent");
          narration("(communication interrompue)");
          return;
        } else if (event === "fin") {
          arreterAttente();
          finaliserReplique(texte);
          return;
        }
      }
    }
    arreterAttente();
    if (texte) {
      etat = ajouterDialogue(etat, "personnage", texte, "laurent");
      rendreDialogueDOM();
    }
  } catch {
    arreterAttente();
    if (texte) {
      etat = ajouterDialogue(etat, "personnage", texte, "laurent");
      rendreDialogueDOM();
    }
    narration("Le personnage est injoignable (réseau).");
  }
}

function ouvrirModale(texte, actions) {
  elModaleContenu.replaceChildren();
  const contenu = document.createElement("div");
  contenu.textContent = texte;
  elModaleContenu.appendChild(contenu);
  const box = document.createElement("div");
  box.className = "boutons";
  for (const [label, onClick] of actions) box.appendChild(bouton(label, onClick));
  elModaleContenu.appendChild(box);
  elModale.classList.remove("cache");
}

function fermerModale() {
  elModale.classList.add("cache");
  elModaleContenu.replaceChildren();
}

async function traiterInteraction(message, intention) {
  etat = ajouterDialogue(etat, "joueur", message, "scene");
  rendreDialogueDOM();
  let rep;
  try {
    rep = await fetch("/api/interagir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contexte: etat.contexte, intention, recus: etat.recus }),
    });
  } catch {
    narration("Impossible d'agir (réseau).");
    return;
  }
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    narration(data.erreur ?? "Cette action est impossible.");
    return;
  }
  etat = ajouterRecus(etat, data.recus);
  etat = remplacerSac(etat, data.etatPublic?.sac);
  rendreSac();
  narration(data.narration ?? "Rien de particulier ici.");
  if (intention.action === "examiner") ouvrirModale(data.narration ?? "Rien de particulier ici.", [["Fermer", fermerModale]]);
}

async function traiterDialogue(message) {
  if (etat.contexte.type !== "personnage") {
    narration("Vous êtes loin de Laurent. Fouillez cette zone ou examinez un objet de votre sac.");
    return;
  }
  const historique = historiquePourLaurent(etat);
  etat = ajouterDialogue(etat, "joueur", message, "laurent");
  rendreDialogueDOM();
  demarrerAttente();
  let rep;
  try {
    rep = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, contexte: etat.contexte, recus: etat.recus, historique }),
    });
  } catch {
    arreterAttente();
    etat = recanaliserDernierTour(etat, "scene");
    narration("Le personnage est injoignable (réseau).");
    return;
  }
  if (!rep.ok) {
    arreterAttente();
    etat = recanaliserDernierTour(etat, "scene");
    const data = await rep.json().catch(() => ({}));
    narration(data.erreur ?? "Erreur de communication.");
    return;
  }
  await consommerFlux(rep);
}

async function traiterEntreeChat(message) {
  const intention = intentionDepuisTexte(message, vue);
  if (intention) return traiterInteraction(message, intention);
  return traiterDialogue(message);
}

elForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elInput.value.trim();
  if (!message || !vue || entreeEnCours) return;
  elInput.value = "";
  entreeEnCours = true;
  elInput.disabled = true;
  try {
    await traiterEntreeChat(message);
  } finally {
    entreeEnCours = false;
    elInput.disabled = false;
  }
});

const ouvrirDebrief = creerDebrief({
  obtenirVue: () => vue,
  conteneur: elModaleContenu,
  modale: elModale,
  creerBouton: bouton,
  ouvrirModale,
  fermerModale,
});

elAccuser.addEventListener("click", () => {
  if (vue) ouvrirDebrief();
});

brancherControlesVoix({
  modeVocal,
  boutonVoix: elBtnVoix,
  boutonMicro: elBtnMicro,
  saisie: elInput,
});

init();

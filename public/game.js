// Orchestration DOM : le serveur arbitre contexte, inventaire et progression signée.

import {
  etatInitial,
  observerZone,
  observerPersonnage,
  ajouterDialogue,
  historiquePourPersonnage,
  recanaliserDernierTour,
  ajouterRecus,
  remplacerEtatPublic,
} from "./state.js";
import { artInterlocuteur, decouperReplique, toursDialogue } from "./render.js";
import { decoupeTrames } from "./sse.js";
import { creerModeVocal } from "./voix.js";
import { creerDebrief } from "./debrief.js";
import { brancherControlesVoix } from "./controles-voix.js";
import {
  EMOTION_PAR_DEFAUT,
  emotionDepuisReplique,
  imagePourEmotion,
} from "./emotion.js";

const $ = (id) => document.getElementById(id);
const idEnquete = window.location.pathname.match(/^\/jouer\/([a-z0-9_-]+)\/?$/i)?.[1];
const apiBase = idEnquete ? `/api/enquetes/${idEnquete}` : "/api";
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
const elPistes = $("pistes");
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
let emotionPersonnage = EMOTION_PAR_DEFAUT;
let entreeEnCours = false;
let pistes = [];
let attente = null;
let flux = null;
let historiqueAffiche = [];
const didascalies = new WeakMap();

const modeVocal = creerModeVocal({
  apiBase,
  jouer: (blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const liberer = () => URL.revokeObjectURL(url);
    audio.addEventListener("ended", liberer);
    audio.addEventListener("error", liberer);
    audio.play().catch(liberer);
  },
});

function bouton(label, onClick) {
  const element = document.createElement("button");
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function mettreAJourPlaceholder() {
  elInput.placeholder = "Décrivez ce que vous observez, faites ou demandez…";
}

function creerTour(projection, didascalie = "") {
  const article = document.createElement("article");
  article.className = `tour tour--${projection.role}`;
  if (didascalie) {
    const geste = document.createElement("em");
    geste.className = "didascalie";
    geste.textContent = didascalie;
    article.append(geste, document.createElement("br"));
  }
  const texte = document.createElement("p");
  texte.className = "tour-texte";
  if (projection.role !== "systeme") {
    const auteur = document.createElement("span");
    auteur.className = "tour-auteur";
    auteur.textContent = `${projection.auteur} : `;
    texte.appendChild(auteur);
  }
  texte.append(projection.texte);
  article.appendChild(texte);
  return article;
}

function rendreDialogueDOM(historique = etat.historique) {
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
    const projection = toursDialogue([tour], vue.personnage.nom)[0];
    fragments.appendChild(creerTour(projection, didascalies.get(tour) ?? projection.didascalie));
  }
  elDialogue.appendChild(fragments);
  historiqueAffiche = [...historique];
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

function rendrePistes(nouvellesPistes = pistes) {
  pistes = Array.isArray(nouvellesPistes) ? nouvellesPistes.filter((piste) => typeof piste === "string") : [];
  const visibles = etat.contexte.type === "personnage" ? pistes : [];
  elPistes.replaceChildren();
  if (visibles.length === 0) {
    elPistes.hidden = true;
    return;
  }
  for (const piste of visibles.slice(0, 3)) {
    const item = document.createElement("li");
    const action = bouton(piste, () => {
      elInput.value = piste;
      elInput.focus();
    });
    action.className = "piste-interrogatoire";
    action.type = "button";
    item.appendChild(action);
    elPistes.appendChild(item);
  }
  elPistes.hidden = false;
}

function rendrePerso() {
  etat = observerPersonnage(etat);
  elIllustration.classList.add("cache");
  elIllustrationImage.removeAttribute("src");
  const portrait = imagePourEmotion(vue.personnage.portraits ?? {}, emotionPersonnage);
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
  rendrePistes();
  rendrePlan();
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
    li.textContent = etat.objetsConnus.find((objet) => objet.id === id)?.nom ?? id;
    elSac.appendChild(li);
  }
}

function narration(texte) {
  etat = ajouterDialogue(etat, "systeme", texte, "scene");
  rendreDialogueDOM();
}

function messageErreurApi(erreur, repli) {
  return erreur === "Reçus invalides."
    ? "L'enquête a changé depuis le début de cette partie. Recommencez la partie pour utiliser la nouvelle version."
    : (erreur ?? repli);
}

function mouvementReduit() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function arreterAttente() {
  if (minuteurAttente) {
    clearInterval(minuteurAttente);
    minuteurAttente = null;
  }
  attente?.remove();
  attente = null;
  elDialogue.removeAttribute("aria-busy");
}

function demarrerAttente(libelle = `${vue.personnage.nom} réfléchit`) {
  arreterAttente();
  const projection = { role: "systeme", auteur: "Système", texte: "" };
  attente = creerTour(projection);
  const texte = attente.querySelector(".tour-texte");
  elDialogue.appendChild(attente);
  elDialogue.setAttribute("aria-busy", "true");
  const peindre = (points) => {
    texte.textContent = `${libelle}${points}`;
    elDialogue.scrollTop = elDialogue.scrollHeight;
  };
  if (mouvementReduit()) return peindre("…");
  let i = 0;
  const animer = () => peindre(".".repeat((i++ % 3) + 1));
  animer();
  minuteurAttente = setInterval(animer, 350);
}

function rendreFlux() {
  if (!flux || (!flux.texte && !flux.didascalie)) return;
  const projection = { role: "personnage", auteur: vue.personnage.nom, texte: flux.texte };
  const nouveau = creerTour(projection, flux.didascalie);
  if (flux.texte) {
    const curseur = document.createElement("span");
    curseur.className = "curseur";
    curseur.textContent = "▌";
    nouveau.querySelector(".tour-texte").appendChild(curseur);
  }
  if (flux.noeud) flux.noeud.replaceWith(nouveau);
  else elDialogue.appendChild(nouveau);
  flux.noeud = nouveau;
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

function commencerFlux() {
  arreterAttente();
  flux = { texte: "", didascalie: "", noeud: null };
}

function finaliserReplique(texte, didascalie = "") {
  const parole = decouperReplique(texte).parole;
  if (!parole) {
    flux?.noeud?.remove();
    flux = null;
    return;
  }
  etat = ajouterDialogue(etat, "personnage", parole, etat.personnageId);
  const tour = etat.historique.at(-1);
  if (didascalie) didascalies.set(tour, didascalie);
  emotionPersonnage = emotionDepuisReplique(parole);
  if (!elPortrait.classList.contains("cache")) {
    const portrait = imagePourEmotion(vue.personnage.portraits ?? {}, emotionPersonnage);
    if (portrait) elPortraitImage.src = portrait;
  }
  flux?.noeud?.remove();
  flux = null;
  rendreDialogueDOM();
  modeVocal.dire(parole);
}

async function consommerFlux(rep) {
  const lecteur = rep.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let termine = false;
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const decoupe = decoupeTrames(tampon);
      tampon = decoupe.reste;
      for (const { event, data } of decoupe.trames) {
        const contenu = JSON.parse(data);
        if (event === "didascalie") {
          if (!flux) commencerFlux();
          flux.didascalie = contenu.texte;
          rendreFlux();
        } else if (event === "delta") {
          if (!flux) commencerFlux();
          flux.texte += contenu.texte;
          rendreFlux();
        } else if (event === "progression") {
          etat = ajouterRecus(etat, contenu.recus);
          rendrePistes(contenu.pistes);
        } else if (event === "erreur") {
          arreterAttente();
          finaliserReplique(flux?.texte ?? "", flux?.didascalie ?? "");
          narration("(communication interrompue)");
          termine = true;
          return;
        } else if (event === "fin") {
          arreterAttente();
          finaliserReplique(flux?.texte ?? "", flux?.didascalie ?? "");
          termine = true;
          return;
        }
      }
    }
  } catch {
    arreterAttente();
    finaliserReplique(flux?.texte ?? "", flux?.didascalie ?? "");
    narration("Le personnage est injoignable (réseau).");
    return;
  } finally {
    if (!termine) {
      arreterAttente();
      finaliserReplique(flux?.texte ?? "", flux?.didascalie ?? "");
    }
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
    rep = await fetch(`${apiBase}/interagir`, {
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
    narration(messageErreurApi(data.erreur, "Cette action est impossible."));
    return;
  }
  etat = ajouterRecus(etat, data.recus);
  etat = remplacerEtatPublic(etat, data.etatPublic);
  rendreSac();
  narration(data.narration ?? "Rien de particulier ici.");
  rendrePistes(data.pistes);
  if (intention.action === "examiner") {
    ouvrirModale(data.narration ?? "Rien de particulier ici.", [["Fermer", fermerModale]]);
  }
}

async function traiterDialogue(message) {
  const historique = historiquePourPersonnage(etat);
  etat = ajouterDialogue(etat, "joueur", message, etat.personnageId);
  rendreDialogueDOM();
  demarrerAttente();
  let rep;
  try {
    rep = await fetch(`${apiBase}/chat`, {
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
    narration(messageErreurApi(data.erreur, "Erreur de communication."));
    return;
  }
  await consommerFlux(rep);
}

function appliquerContexte(contexte) {
  if (contexte?.type === "personnage" && contexte.id === etat.personnageId) {
    rendrePerso();
    return true;
  }
  if (contexte?.type === "zone" && vue.zones[contexte.id]) {
    ouvrirZone(contexte.id);
    return true;
  }
  return false;
}

function decrireObservation(contexte) {
  if (contexte.type === "personnage") return `Vous vous tournez vers ${vue.personnage.nom}.`;
  return `Vous observez : ${vue.zones[contexte.id].nom}.`;
}

async function interpreterEntree(message) {
  demarrerAttente("Vous réfléchissez");
  let rep;
  try {
    rep = await fetch(`${apiBase}/interpreter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, contexte: etat.contexte, recus: etat.recus }),
    });
  } catch {
    arreterAttente();
    narration("L'interprète est indisponible (réseau).");
    return;
  }
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    arreterAttente();
    narration(messageErreurApi(data.erreur, "L'interprète est indisponible pour le moment."));
    return;
  }
  arreterAttente();
  const decision = data.decision;
  if (!decision || typeof decision.type !== "string") {
    narration(`Que souhaitez-vous observer, faire ou demander à ${vue.personnage.nom} ?`);
    return;
  }
  if (decision.type === "observer" && appliquerContexte(decision.contexte)) {
    etat = ajouterDialogue(etat, "joueur", message, "scene");
    rendreDialogueDOM();
    narration(decrireObservation(decision.contexte));
    return;
  }
  if (decision.type === "interagir" && appliquerContexte(decision.contexte)) {
    return traiterInteraction(message, { action: decision.action, cible: decision.cibleId });
  }
  if (decision.type === "dialoguer" && appliquerContexte(decision.contexte)) {
    return traiterDialogue(message);
  }
  if (decision.type === "clarifier") {
    etat = ajouterDialogue(etat, "joueur", message, "scene");
    rendreDialogueDOM();
    narration(decision.question ?? `Que souhaitez-vous observer, faire ou demander à ${vue.personnage.nom} ?`);
    return;
  }
  narration(`Que souhaitez-vous observer, faire ou demander à ${vue.personnage.nom} ?`);
}

async function traiterEntreeChat(message) {
  return interpreterEntree(message);
}

function reglerSaisieOccupee(occupee) {
  elInput.disabled = occupee;
  elBtnMicro.disabled = occupee;
}

elForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elInput.value.trim();
  if (!message || !vue || entreeEnCours) return;
  elInput.value = "";
  entreeEnCours = true;
  reglerSaisieOccupee(true);
  try {
    await traiterEntreeChat(message);
  } finally {
    entreeEnCours = false;
    reglerSaisieOccupee(false);
  }
});

const ouvrirDebrief = creerDebrief({
  apiBase,
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

async function init() {
  try {
    const rep = await fetch(`${apiBase}/scenario`);
    if (!rep.ok) throw new Error("Enquête indisponible.");
    vue = await rep.json();
    if (!vue?.personnage || !vue?.zones) throw new Error("Vue d'enquête invalide.");
  } catch {
    elVisuel.textContent = "Impossible de charger le scénario.";
    return;
  }
  etat = etatInitial(vue.personnage.id ?? "laurent");
  etat = ajouterDialogue(etat, "systeme", vue.intro, "scene");
  rendrePerso();
  rendreSac();
  rendreDialogueDOM();
}

init();

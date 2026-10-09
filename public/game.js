// Orchestration DOM : le serveur arbitre contexte, inventaire et progression signée.

import {
  etatInitial,
  ajouterDialogue,
  recanaliserDernierJoueur,
  ajouterRecus,
  remplacerEtatPublic,
} from "./state.js";
import { decouperReplique } from "./render.js";
import { lireEvenementsFlux } from "./flux-chat.js";
import { creerTour, creerRenduDialogue } from "./journal-dom.js";
import { creerParcoursHistorique } from "./chat-historique.js";
import { creerRenduScenes } from "./scene-dom.js";
import { creerModeVocal } from "./voix.js";
import { creerDebrief } from "./debrief.js";
import { creerSuiviJournal } from "./journal-scroll.js";
import { brancherSaisieChat } from "./saisie-chat.js";
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
const elEnvoyer = $("btn-envoyer");
const suiviJournal = creerSuiviJournal({ journal: elDialogue, bouton: $("btn-nouvelle-reponse") });
brancherSaisieChat({ form: elForm, saisie: elInput });
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
let memoireConversation = null;
let attente = null;
let flux = null;
const didascalies = new WeakMap();
const reperesTours = new WeakMap();

const rendreDialogueDOM = creerRenduDialogue({ elDialogue, suiviJournal, obtenirEtat: () => etat,
  obtenirVue: () => vue, didascalies, reperesTours });
const { rendrePerso, ouvrirZone } = creerRenduScenes({ obtenirVue: () => vue, obtenirEtat: () => etat,
  modifierEtat: (valeur) => { etat = valeur; }, obtenirEmotion: () => emotionPersonnage, GRILLE,
  elPortrait, elPortraitImage, elIllustration, elIllustrationImage, elVisuel, elPlan,
  mettreAJourPlaceholder, rendrePistes, narration, naviguerScene });
const parcoursHistorique = creerParcoursHistorique({ apiBase, obtenirEtat: () => etat, modifierEtat: (valeur) => { etat = valeur; },
  rendreDialogueDOM, narration, demarrerAttente, arreterAttente, consommerFlux, appliquerContexte,
  decrireObservation, messageErreurApi, rendreSac, rendrePistes, nomPersonnage: () => vue.personnage.nom });

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

function narration(texte, repere = "Observation") {
  etat = ajouterDialogue(etat, "systeme", texte, "scene");
  reperesTours.set(etat.historique.at(-1), repere);
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
  suiviJournal.modifier(() => attente?.remove());
  attente = null;
  elDialogue.removeAttribute("aria-busy");
}

function demarrerAttente(libelle = `${vue.personnage.nom} réfléchit`) {
  arreterAttente();
  const projection = { role: "attente", auteur: "", texte: "" };
  attente = creerTour(projection);
  const texte = attente.querySelector(".tour-texte");
  suiviJournal.modifier(() => elDialogue.appendChild(attente));
  elDialogue.setAttribute("aria-busy", "true");
  const peindre = (points) => {
    suiviJournal.modifier(() => { texte.textContent = `${libelle}${points}`; });
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
  suiviJournal.modifier(() => {
    if (flux.noeud) flux.noeud.replaceWith(nouveau);
    else elDialogue.appendChild(nouveau);
    flux.noeud = nouveau;
  }, { nouveau: true });
}

function commencerFlux() {
  arreterAttente();
  flux = { texte: "", didascalie: "", noeud: null };
}

function finaliserReplique(texte, didascalie = "") {
  const parole = decouperReplique(texte).parole;
  if (!parole) {
    suiviJournal.modifier(() => flux?.noeud?.remove());
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
  suiviJournal.modifier(() => {
    flux?.noeud?.remove();
    flux = null;
    rendreDialogueDOM();
  }, { nouveau: true });
  modeVocal.dire(parole);
}

async function consommerFlux(rep) {
  await lireEvenementsFlux(rep, ({ event, contenu }) => {
    if (event === "contexte") {
      appliquerContexte(contenu.contexte);
      if (contenu.role === "personnage") etat = recanaliserDernierJoueur(etat, etat.personnageId);
    } else if (event === "memoire") memoireConversation = contenu.token;
    else if (["observation", "precision"].includes(event)) {
      arreterAttente(); narration(contenu.texte, event === "precision" ? "Précision" : "Observation");
    } else if (event === "didascalie" || event === "delta") {
      if (!flux) commencerFlux();
      if (event === "didascalie") flux.didascalie = contenu.texte;
      else flux.texte += contenu.texte;
      rendreFlux();
    } else if (event === "progression") {
      if (typeof contenu.memoireConversation === "string") memoireConversation = contenu.memoireConversation;
      etat = ajouterRecus(etat, contenu.recus);
      if (contenu.etatPublic) { etat = remplacerEtatPublic(etat, contenu.etatPublic); rendreSac(); }
      rendrePistes(contenu.pistes);
    } else if (event === "erreur") {
      arreterAttente(); finaliserReplique(flux?.texte ?? "", flux?.didascalie ?? "");
      narration(vue.orchestration === "scenes" || contenu.reseau ? contenu.erreur ?? "(communication interrompue)" : "(communication interrompue)", "Information");
    } else if (event === "fin") {
      arreterAttente(); finaliserReplique(flux?.texte ?? "", flux?.didascalie ?? "");
    }
  });
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
  const zone = vue.zones[contexte.id];
  return `Vous observez ${zone.article ?? "la"} ${zone.nom}.`;
}

async function interpreterEntree(message) {
  if (vue.orchestration !== "scenes") return parcoursHistorique.interpreterEntree(message);
  etat = ajouterDialogue(etat, "joueur", message, "scene");
  rendreDialogueDOM();
  demarrerAttente("Vous réfléchissez");
  return demanderTour({ message });
}

async function demanderTour(demande) {
  try {
    const rep = await fetch(`${apiBase}/tour`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...demande, contexte: etat.contexte, recus: etat.recus, memoireConversation }) });
    if (!rep.ok) {
      const data = await rep.json().catch(() => ({}));
      arreterAttente(); narration(messageErreurApi(data.erreur, "Le tour est indisponible."), "Information"); return;
    }
    await consommerFlux(rep);
  } catch { arreterAttente(); narration("Le tour est indisponible (réseau).", "Information"); }
}

async function naviguerScene(contexte) {
  if (entreeEnCours) return;
  entreeEnCours = true; reglerSaisieOccupee(true);
  try { await demanderTour({ navigation: contexte }); }
  finally { entreeEnCours = false; reglerSaisieOccupee(false); }
}

async function traiterEntreeChat(message) {
  return interpreterEntree(message);
}

function reglerSaisieOccupee(occupee) {
  elInput.disabled = occupee;
  elEnvoyer.disabled = occupee;
  elBtnMicro.disabled = occupee;
}

elForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elInput.value.trim();
  if (!message || !vue || entreeEnCours) return;
  const reprendreSaisie = [elInput, elEnvoyer].includes(document.activeElement);
  elInput.value = "";
  entreeEnCours = true;
  reglerSaisieOccupee(true);
  try {
    await traiterEntreeChat(message);
  } finally {
    entreeEnCours = false;
    reglerSaisieOccupee(false);
    if (reprendreSaisie && document.activeElement === document.body) elInput.focus({ preventScroll: true });
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
  reperesTours.set(etat.historique.at(-1), "Scène");
  rendrePerso();
  rendreSac();
  rendreDialogueDOM();
}

init();

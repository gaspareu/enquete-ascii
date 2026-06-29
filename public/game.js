// Orchestration frontend : charge le scénario, gère les interactions (plan, sac,
// examen, dialogue, accusation) et appelle le backend. La logique pure vit dans
// state.js et render.js (testés) ; ici, c'est le câblage DOM.

import { etatInitial, ramasser, donner, examiner, ajouterDialogue } from "./state.js";
import { artInterlocuteur, rendreDialogue, dialoguePartiel } from "./render.js";

const $ = (id) => document.getElementById(id);
const elVisuel = $("visuel");
const elActions = $("actions-zone");
const elPlan = $("plan");
const elSac = $("sac");
const elDialogue = $("dialogue");
const elForm = $("saisie");
const elInput = $("message");
const elAccuser = $("btn-accuser");
const elModale = $("modale");
const elModaleContenu = $("modale-contenu");

let vue = null;
let etat = etatInitial();
let noteEnAttente = "";
let minuteurFrappe = null; // intervalle de l'effet machine à écrire
let minuteurAttente = null; // intervalle de l'indicateur « …réfléchit »

// Disposition du plan : C = centre (l'interlocuteur).
const GRILLE = [
  ["NO", "N", "NE"],
  ["O", "C", "E"],
  ["SO", "S", "SE"],
];

async function init() {
  try {
    const rep = await fetch("/api/scenario");
    vue = await rep.json();
  } catch {
    elVisuel.textContent = "Impossible de charger le scénario.";
    return;
  }
  etat = ajouterDialogue(etat, "systeme", vue.intro);
  rendrePerso();
  rendrePlan();
  rendreSac();
  rendreDialogueDOM();
}

function bouton(label, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function rendrePerso() {
  elVisuel.textContent = artInterlocuteur(vue.personnage);
  elActions.replaceChildren();
}

// Affiche l'historique complet et fige toute frappe en cours.
function rendreDialogueDOM() {
  annulerFrappe();
  elDialogue.textContent = rendreDialogue(etat.historique, vue.personnage.nom);
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

// L'utilisateur a-t-il demandé à réduire les animations ?
function mouvementReduit() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Durée par caractère pour la frappe, lue depuis le design token (--duree-frappe-ms).
function dureeFrappeMs() {
  const brut = getComputedStyle(document.documentElement).getPropertyValue("--duree-frappe-ms");
  const ms = parseInt(brut, 10);
  return Number.isFinite(ms) && ms > 0 ? ms : 18;
}

function annulerFrappe() {
  if (minuteurFrappe) {
    clearInterval(minuteurFrappe);
    minuteurFrappe = null;
  }
}

// Effet machine à écrire sur le dernier tour de l'historique (la réponse du perso).
// Si l'utilisateur réduit les animations, affichage immédiat.
function animerDernierTour() {
  annulerFrappe();
  const nom = vue.personnage.nom;
  const dernier = etat.historique[etat.historique.length - 1];
  const total = dernier ? dernier.texte.length : 0;
  if (mouvementReduit() || total === 0) {
    rendreDialogueDOM();
    return;
  }
  let n = 0;
  minuteurFrappe = setInterval(() => {
    n += 1;
    elDialogue.textContent = `${dialoguePartiel(etat.historique, nom, n)}▌`;
    elDialogue.scrollTop = elDialogue.scrollHeight;
    if (n >= total) rendreDialogueDOM(); // termine : retire le caret + texte complet
  }, dureeFrappeMs());
}

function arreterAttente() {
  if (minuteurAttente) {
    clearInterval(minuteurAttente);
    minuteurAttente = null;
  }
}

// Affiche « Nom réfléchit… » pendant l'appel réseau (points animés, sauf reduced-motion).
function demarrerAttente() {
  annulerFrappe();
  arreterAttente(); // évite d'empiler deux intervalles si on resoumet pendant l'attente
  const nom = vue.personnage.nom;
  const base = rendreDialogue(etat.historique, nom);
  const ligne = (points) => `${base}\n\n— ${nom} réfléchit${points}`;
  if (mouvementReduit()) {
    elDialogue.textContent = ligne("…");
    elDialogue.scrollTop = elDialogue.scrollHeight;
    return;
  }
  let i = 0;
  const peindre = () => {
    elDialogue.textContent = ligne(".".repeat((i % 3) + 1));
    elDialogue.scrollTop = elDialogue.scrollHeight;
    i += 1;
  };
  peindre();
  minuteurAttente = setInterval(peindre, 350);
}

function narration(texte) {
  etat = ajouterDialogue(etat, "systeme", texte);
  rendreDialogueDOM();
}

function rendrePlan() {
  elPlan.replaceChildren();
  for (const ligne of GRILLE) {
    for (const dir of ligne) {
      const btn = document.createElement("button");
      btn.className = "case";
      if (dir === "C") {
        btn.classList.add("centre");
        btn.textContent = vue.personnage.nom;
        btn.disabled = true;
      } else if (vue.zones[dir]) {
        btn.textContent = dir;
        btn.addEventListener("click", () => ouvrirZone(dir));
      } else {
        btn.textContent = "·";
        btn.disabled = true;
      }
      elPlan.appendChild(btn);
    }
  }
}

function ouvrirZone(dir) {
  const zone = vue.zones[dir];
  elVisuel.textContent = zone.description;
  elActions.replaceChildren();
  for (const id of zone.objetsCaches) {
    const obj = vue.objets[id];
    if (!obj) continue;
    elActions.appendChild(bouton(`Examiner ${obj.nom}`, () => examinerCible(id)));
    if (obj.ramassable && !etat.sac.includes(id)) {
      elActions.appendChild(bouton(`Ramasser ${obj.nom}`, () => ramasserObjet(id, dir)));
    }
  }
  elActions.appendChild(bouton("↩ Revenir au face-à-face", rendrePerso));
}

async function examinerCible(cible) {
  let texte = "Rien de particulier ici.";
  try {
    const rep = await fetch("/api/examiner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cible }),
    });
    const data = await rep.json();
    if (data?.texte) texte = data.texte;
  } catch {
    // On garde le texte par défaut.
  }
  etat = examiner(etat, cible);
  ouvrirModale(texte, [["Fermer", fermerModale]]);
}

function ramasserObjet(id, dir) {
  etat = ramasser(etat, id, vue.objets);
  narration(`Vous ramassez : ${vue.objets[id].nom}.`);
  rendreSac();
  ouvrirZone(dir); // rafraîchit les actions (l'objet ramassé n'est plus à prendre)
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
    const b = document.createElement("button");
    b.className = "objet";
    b.textContent = vue.objets[id].nom;
    b.addEventListener("click", () => menuObjet(id));
    li.appendChild(b);
    elSac.appendChild(li);
  }
}

function menuObjet(id) {
  const nom = vue.objets[id].nom;
  ouvrirModale(`Que faire avec : ${nom} ?`, [
    ["Examiner", () => { fermerModale(); examinerCible(id); }],
    [`Donner à ${vue.personnage.nom}`, () => donnerObjet(id)],
    ["Fermer", fermerModale],
  ]);
}

function donnerObjet(id) {
  if (!etat.sac.includes(id)) return;
  etat = donner(etat, id);
  noteEnAttente = `Le joueur vient de te tendre : ${vue.objets[id].nom}`;
  narration(`Vous tendez ${vue.objets[id].nom} à ${vue.personnage.nom}.`);
  fermerModale();
}

elForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = elInput.value.trim();
  if (!message || !vue) return;
  elInput.value = "";

  // L'historique envoyé au LLM ne contient que les échanges (pas la narration),
  // et pas le message courant (que le serveur ajoute lui-même).
  const historiqueLLM = etat.historique.filter((t) => t.role !== "systeme");
  etat = ajouterDialogue(etat, "joueur", message);
  rendreDialogueDOM();

  const note = noteEnAttente;
  noteEnAttente = "";
  demarrerAttente();
  try {
    const rep = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        gestes: etat.gestes,
        historique: historiqueLLM,
        note,
      }),
    });
    const data = await rep.json();
    arreterAttente();
    if (!rep.ok) {
      narration(data.erreur ?? "Erreur de communication.");
      return;
    }
    etat = ajouterDialogue(etat, "personnage", data.reponse);
    animerDernierTour();
  } catch {
    arreterAttente();
    narration("Le personnage est injoignable (réseau).");
  }
});

// Un clic dans le dialogue saute l'effet de frappe et affiche la réponse entière.
elDialogue.addEventListener("click", () => {
  if (minuteurFrappe) rendreDialogueDOM();
});

elAccuser.addEventListener("click", () => {
  if (!vue) return;
  ouvrirModale(
    `Qui accusez-vous ? ${vue.personnage.nom} est-il le meurtrier ?`,
    [
      ["Coupable", () => accuser(true)],
      ["Innocent", () => accuser(false)],
      ["Annuler", fermerModale],
    ],
  );
});

async function accuser(verdict) {
  fermerModale();
  try {
    const rep = await fetch("/api/accuser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, gestes: etat.gestes }),
    });
    const data = await rep.json();
    const titre = data.gagne ? "✔ AFFAIRE RÉSOLUE" : "✘ ENQUÊTE À POURSUIVRE";
    const action = data.gagne
      ? ["Rejouer", () => location.reload()]
      : ["Continuer l'enquête", fermerModale];
    ouvrirModale(`${titre}\n\n${data.message}`, [action]);
  } catch {
    ouvrirModale("Impossible de soumettre l'accusation (réseau).", [["Fermer", fermerModale]]);
  }
}

function ouvrirModale(texte, actions) {
  elModaleContenu.replaceChildren();
  const p = document.createElement("div");
  p.textContent = texte;
  elModaleContenu.appendChild(p);

  const box = document.createElement("div");
  box.className = "boutons";
  for (const [label, onClick] of actions) {
    box.appendChild(bouton(label, onClick));
  }
  elModaleContenu.appendChild(box);
  elModale.classList.remove("cache");
}

function fermerModale() {
  elModale.classList.add("cache");
  elModaleContenu.replaceChildren();
}

init();

// Orchestration frontend : charge le scénario, gère les interactions (plan, sac,
// examen, dialogue, accusation) et appelle le backend. La logique pure vit dans
// state.js et render.js (testés) ; ici, c'est le câblage DOM.

import { etatInitial, ramasser, donner, examiner, ajouterDialogue } from "./state.js";
import { artInterlocuteur, rendreDialogue, rendreDebrief } from "./render.js";
import { decoupeTrames } from "./sse.js";
import { creerModeVocal } from "./voix.js";
import { microDisponible, creerMicro } from "./micro.js";

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

let vue = null;
let etat = etatInitial();
let noteEnAttente = "";
let minuteurAttente = null; // intervalle de l'indicateur « …réfléchit »
let attitudeLaurent = "neutre";

// Mode vocal : le play audio (side-effect) est injecté ici ; la logique vit dans voix.js.
const modeVocal = creerModeVocal({
  jouer: (blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    // Libère l'URL objet quoi qu'il arrive (fin normale, erreur, lecture refusée),
    // sinon elle fuit à chaque réplique jusqu'au rechargement.
    const liberer = () => URL.revokeObjectURL(url);
    audio.addEventListener("ended", liberer);
    audio.addEventListener("error", liberer);
    audio.play().catch(liberer); // lecture refusée : on garde le texte
  },
});

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
  elIllustration.classList.add("cache");
  elIllustrationImage.removeAttribute("src");
  const portraits = vue.personnage.portraits ?? [];
  const portrait = portraits[attitudeLaurent] ?? portraits.neutre;
  if (!portrait) {
    elPortrait.classList.add("cache");
    elPortraitImage.removeAttribute("src");
    elVisuel.classList.remove("cache");
    elVisuel.textContent = artInterlocuteur(vue.personnage);
    return;
  }
  elVisuel.classList.add("cache");
  elPortraitImage.src = portrait;
  elPortraitImage.alt = `Portrait de ${vue.personnage.nom}`;
  elPortrait.classList.remove("cache");
}

function rendreZone(zone) {
  elPortrait.classList.add("cache");
  elPortraitImage.removeAttribute("src");
  if (!zone.illustration) {
    elIllustration.classList.add("cache");
    elVisuel.classList.remove("cache");
    elVisuel.textContent = zone.description;
    return;
  }
  elVisuel.classList.add("cache");
  elIllustrationImage.src = zone.illustration;
  elIllustrationImage.alt = `Illustration pixel art : ${zone.description}`;
  elIllustration.classList.remove("cache");
}

function adapterAttitude(texte) {
  const portraits = vue.personnage.portraits;
  if (!portraits?.neutre) return;
  const reponse = normaliser(texte);
  if (/\b(accusation|laissez|ca suffit|mensonge|ridicule|aucun droit)\b/.test(reponse)) {
    attitudeLaurent = "irrite";
  } else if (/\b(helene|mort|suicide|desole|peur|triste|deuil)\b/.test(reponse)) {
    attitudeLaurent = "inquiet";
  } else if (/\b(rien a dire|je ne sais|aucune idee|pas compris|mefie)\b/.test(reponse)) {
    attitudeLaurent = "mefiant";
  } else {
    attitudeLaurent = "neutre";
  }
  if (!elPortrait.classList.contains("cache")) {
    elPortraitImage.src = portraits[attitudeLaurent] ?? portraits.neutre;
  }
}

// Affiche l'historique complet du dialogue.
function rendreDialogueDOM() {
  elDialogue.textContent = rendreDialogue(etat.historique, vue.personnage.nom);
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

// L'utilisateur a-t-il demandé à réduire les animations ?
// (utilisé par demarrerAttente)
function mouvementReduit() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function arreterAttente() {
  if (minuteurAttente) {
    clearInterval(minuteurAttente);
    minuteurAttente = null;
  }
}

// Affiche « Nom réfléchit… » pendant l'appel réseau (points animés, sauf reduced-motion).
function demarrerAttente() {
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
        btn.addEventListener("click", rendrePerso);
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
  rendreZone(zone);
}

async function examinerCible(cible) {
  // On journalise l'examen AVANT l'appel : la révélation dépend du journal dérivé
  // côté serveur (un texte secret n'est servi que si son flag d'examen est posé).
  etat = examiner(etat, cible);
  let texte = "Rien de particulier ici.";
  try {
    const rep = await fetch("/api/examiner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cible, gestes: etat.gestes }),
    });
    const data = await rep.json();
    if (data?.texte) texte = data.texte;
  } catch {
    // On garde le texte par défaut.
  }
  ouvrirModale(texte, [["Fermer", fermerModale]]);
}

function ramasserObjet(id) {
  etat = ramasser(etat, id, vue.objets);
  narration(`Vous ramassez : ${vue.objets[id].nom}.`);
  rendreSac();
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
    li.textContent = vue.objets[id].nom;
    elSac.appendChild(li);
  }
}

function donnerObjet(id) {
  if (!etat.sac.includes(id)) return;
  etat = donner(etat, id);
  noteEnAttente = `Le joueur vient de te tendre : ${vue.objets[id].nom}`;
  narration(`Vous tendez ${vue.objets[id].nom} à ${vue.personnage.nom}.`);
}

function normaliser(texte) {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

function gesteDemande(message) {
  const texte = normaliser(message);
  const cible = Object.entries(vue.objets)
    .sort(([, a], [, b]) => normaliser(b.nom).length - normaliser(a.nom).length)
    .find(([, objet]) => texte.includes(normaliser(objet.nom)))?.[0];
  if (!cible) return null;
  if (/\b(examine|examiner|inspecte|inspecter|regarde|regarder|observe|observer|fouille|fouiller)\b/.test(texte)) {
    return { type: "examiner", cible };
  }
  if (/\b(ramasse|ramasser|prends|prendre|recupere|recuperer)\b/.test(texte)) {
    return { type: "ramasser", cible };
  }
  if (/\b(donne|donner|tends|tendre|presente|presenter)\b/.test(texte)) {
    return { type: "donner", cible };
  }
  return null;
}

async function executerGesteDialogue(message) {
  const geste = gesteDemande(message);
  if (!geste) return false;

  etat = ajouterDialogue(etat, "joueur", message);
  rendreDialogueDOM();
  const objet = vue.objets[geste.cible];
  if (geste.type === "examiner") {
    await examinerCible(geste.cible);
    return true;
  }
  if (geste.type === "ramasser") {
    if (!objet.ramassable) {
      narration(`Vous ne pouvez pas ramasser : ${objet.nom}.`);
    } else if (etat.sac.includes(geste.cible)) {
      narration(`Vous avez déjà : ${objet.nom}.`);
    } else {
      ramasserObjet(geste.cible);
    }
    return true;
  }
  if (!etat.sac.includes(geste.cible)) {
    narration(`Vous devez d'abord ramasser : ${objet.nom}.`);
  } else {
    donnerObjet(geste.cible);
  }
  return true;
}

// Peint l'historique + la réplique en cours de réception (avec caret), sans encore
// la committer dans l'état (immutabilité : le commit a lieu sur la trame « fin »).
function peindreFlux(texte) {
  const histo = [...etat.historique, { role: "personnage", texte }];
  elDialogue.textContent = `${rendreDialogue(histo, vue.personnage.nom)}▌`;
  elDialogue.scrollTop = elDialogue.scrollHeight;
}

// Lit le flux SSE de /api/chat et peint la réponse au fil de l'eau.
async function consommerFlux(rep) {
  const lecteur = rep.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = ""; // trames SSE non terminées
  let texte = ""; // réplique accumulée
  let demarre = false;
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const { trames, reste } = decoupeTrames(tampon);
      tampon = reste;
      for (const { event, data } of trames) {
        if (event === "delta") {
          if (!demarre) {
            arreterAttente();
            demarre = true;
          }
          texte += JSON.parse(data).texte;
          peindreFlux(texte);
        } else if (event === "erreur") {
          arreterAttente();
          if (texte) etat = ajouterDialogue(etat, "personnage", texte);
          narration("(communication interrompue)");
          return;
        } else if (event === "fin") {
          arreterAttente();
          etat = ajouterDialogue(etat, "personnage", texte);
          adapterAttitude(texte);
          rendreDialogueDOM();
          modeVocal.dire(texte); // no-op si la voix est désactivée
          return;
        }
      }
    }
    // Flux clos sans trame « fin » : on commit ce qu'on a reçu.
    arreterAttente();
    if (texte) {
      etat = ajouterDialogue(etat, "personnage", texte);
      adapterAttitude(texte);
      rendreDialogueDOM();
    }
  } catch {
    arreterAttente();
    if (texte) {
      etat = ajouterDialogue(etat, "personnage", texte);
      adapterAttitude(texte);
      rendreDialogueDOM();
    }
    narration("Le personnage est injoignable (réseau).");
  }
}

elForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = elInput.value.trim();
  if (!message || !vue) return;
  elInput.value = "";
  if (await executerGesteDialogue(message)) return;

  // L'historique envoyé au LLM ne contient que les échanges (pas la narration),
  // et pas le message courant (que le serveur ajoute lui-même).
  const historiqueLLM = etat.historique.filter((t) => t.role !== "systeme");
  etat = ajouterDialogue(etat, "joueur", message);
  rendreDialogueDOM();

  const note = noteEnAttente;
  noteEnAttente = "";
  demarrerAttente();

  let rep;
  try {
    rep = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, gestes: etat.gestes, historique: historiqueLLM, note }),
    });
  } catch {
    arreterAttente();
    narration("Le personnage est injoignable (réseau).");
    return;
  }

  if (!rep.ok) {
    arreterAttente();
    const data = await rep.json().catch(() => ({}));
    narration(data.erreur ?? "Erreur de communication.");
    return;
  }

  await consommerFlux(rep);
});

elAccuser.addEventListener("click", () => {
  if (!vue) return;
  ouvrirDebrief();
});

// Formulaire de débrief : un champ de réponse libre par question.
function ouvrirDebrief() {
  elModaleContenu.replaceChildren();

  const titre = document.createElement("div");
  titre.textContent = "DÉBRIEF — exposez vos conclusions, le plus précisément possible :";
  elModaleContenu.appendChild(titre);

  const form = document.createElement("form");
  form.id = "form-debrief";
  const champs = new Map();
  for (const q of vue.debrief.questions) {
    const label = document.createElement("label");
    label.append(document.createTextNode(q.question));
    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.maxLength = 1000;
    label.appendChild(ta);
    form.appendChild(label);
    champs.set(q.id, ta);
  }

  const box = document.createElement("div");
  box.className = "boutons";
  const valider = bouton("Rendre mon verdict", () => {});
  valider.type = "submit";
  box.appendChild(valider);
  box.appendChild(bouton("Annuler", fermerModale));
  form.appendChild(box);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const reponses = [...champs.entries()].map(([id, ta]) => ({ id, reponse: ta.value }));
    soumettreDebrief(reponses);
  });

  elModaleContenu.appendChild(form);
  elModale.classList.remove("cache");
}

async function soumettreDebrief(reponses) {
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
    const data = await rep.json();
    ouvrirModale(rendreDebrief(data), [["Rejouer", () => location.reload()]]);
  } catch {
    ouvrirModale("Impossible de soumettre le débrief (réseau).", [["Fermer", fermerModale]]);
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

// --- Mode vocal (T-07) : toggle voix + micro (dégradation gracieuse) ---
if (elBtnVoix) {
  elBtnVoix.addEventListener("click", () => {
    const actif = modeVocal.basculer();
    elBtnVoix.setAttribute("aria-pressed", String(actif));
    elBtnVoix.classList.toggle("actif", actif);
  });
}
if (elBtnMicro) {
  if (microDisponible()) {
    const micro = creerMicro({
      onTexte: (texte) => {
        elInput.value = texte;
        elInput.focus();
      },
      onFin: () => elBtnMicro.classList.remove("ecoute"),
    });
    elBtnMicro.addEventListener("click", () => {
      elBtnMicro.classList.add("ecoute");
      try {
        micro.demarrer();
      } catch {
        // Reconnaissance déjà active (double-clic) ou refusée : on ne bloque pas
        // le bouton en pulsation « écoute ».
        elBtnMicro.classList.remove("ecoute");
      }
    });
  } else {
    elBtnMicro.hidden = true; // navigateur sans reconnaissance vocale
  }
}

init();

import { ajouterObjetsGeneres, completerPourAffichage, mettreAJour, proposerId, renommerFlag, renommerObjet, retirerObjet } from "./state.js";
import { api, definirJeton } from "./api.js";
import { preparerDemandeGeneration } from "./generation.js";
import { allerDiagnostic } from "./diagnostic.js";
import { actualiserContexte } from "./contexte.js";
import { brancherNavigationOnglets, ONGLETS } from "./onglets.js";
import { bouton, element, titre, zoneAide } from "./ui.js";
import { rendreCadre, rendreObjets, rendrePiece } from "./sections-scene.js";
import { rendreProgression } from "./sections-progression.js";
import { rendreDebrief, rendreDialogue, rendreTester } from "./sections-texte.js";

const application = document.getElementById("application");
const annonce = document.getElementById("annonce");
const etat = {
  catalogue: [], enquete: null, revision: "", sale: false, enregistrement: false,
  onglet: "cadre", direction: "N", objet: "", modeGraphe: "graphe", resultats: null,
  generation: { ouverte: false, direction: "N", nombre: "3", instruction: "", enCours: false }, session: 0,
};
const LECTURE_SEULE = "helene";

function annoncer(message, erreur = false) {
  annonce.textContent = message;
  annonce.classList.toggle("erreur", erreur);
}

async function actionAsynchrone(tache) {
  try { await tache(); } catch (erreur) { annoncer(erreur.message || "Action impossible.", true); }
}

function nettoyer(nom) {
  return nom.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function changerEnquete(enquete, revision = "", sale = false) {
  etat.session += 1;
  etat.enquete = enquete;
  etat.revision = revision;
  etat.sale = sale;
  etat.resultats = null;
  etat.onglet = "cadre";
  etat.direction = "N";
  etat.objet = "";
  etat.generation = { ouverte: false, direction: "N", nombre: "3", instruction: "", enCours: false };
  rendre();
}

function modifier(enquete, rerendre = false) {
  if (etat.enquete?.id === LECTURE_SEULE) return;
  etat.enquete = enquete;
  etat.sale = true;
  etat.resultats = null;
  if (rerendre) rendre();
  else mettreAJourStatut();
}

function mettreAJourStatut() {
  const statut = document.getElementById("etat-brouillon");
  if (statut) {
    statut.textContent = etat.enquete?.id === LECTURE_SEULE ? "Exemple en lecture seule" : etat.sale ? "Modifications non enregistrées" :
      `${etat.enquete?.statut === "prete" ? "Prête" : "Brouillon"} · Enregistré`;
    statut.classList.toggle("attention", etat.sale);
  }
  const sauvegarder = application.querySelector('button[data-action="enregistrer"]');
  if (sauvegarder) {
    sauvegarder.disabled = etat.enregistrement || !etat.sale || etat.enquete?.id === LECTURE_SEULE;
    sauvegarder.textContent = etat.enregistrement ? "Enregistrement…" : "Enregistrer";
  }
}

function rendreTableau() {
  const page = element("section", "", "panneau");
  page.append(titre("Mes enquêtes"), zoneAide("Créez un brouillon ou dupliquez une enquête existante. Les fichiers restent dans ce projet local."));
  const formulaire = element("div", "", "carte");
  const champ = element("div", "", "champ");
  const label = element("label", "Titre de la nouvelle enquête"); label.htmlFor = "nouveau-titre";
  const entree = element("input"); entree.id = "nouveau-titre"; entree.placeholder = "ex. L’affaire du quai";
  champ.append(label, entree);
  formulaire.append(titre("Nouvelle enquête", 3), champ, bouton("Créer l’enquête", "creer"));
  page.append(formulaire);
  const cartes = element("div", "", "cartes");
  for (const enquete of etat.catalogue) {
    const carte = element("article", "", "carte");
    carte.append(titre(enquete.titre || enquete.id, 3), element("p", enquete.id, "meta"));
    carte.append(element("span", enquete.statut === "prete" ? "Prête" : "Brouillon", "badge"));
    const actions = element("div", "", "actions");
    actions.append(bouton("Ouvrir", "ouvrir", { id: enquete.id }), bouton("Dupliquer", "dupliquer", { id: enquete.id }));
    if (enquete.statut === "prete") {
      const lien = element("a", "Jouer"); lien.href = `/jouer/${encodeURIComponent(enquete.id)}`; actions.append(lien);
    }
    carte.append(actions); cartes.append(carte);
  }
  if (!etat.catalogue.length) cartes.append(element("p", "Aucune enquête enregistrée pour le moment.", "vide"));
  page.append(cartes);
  application.replaceChildren(page);
}

function rendreAtelier() {
  const enquete = completerPourAffichage(etat.enquete);
  const racine = element("div");
  const barre = element("div", "", "barre");
  const titreBarre = element("div");
  titreBarre.append(titre(enquete.titre || "Sans titre"), element("span", "", "badge"));
  titreBarre.lastChild.id = "etat-brouillon";
  barre.append(titreBarre);
  const actions = element("div", "", "actions");
  const enregistrerBouton = bouton("Enregistrer", "enregistrer");
  enregistrerBouton.disabled = !etat.sale || enquete.id === LECTURE_SEULE;
  actions.append(bouton("Mes enquêtes", "tableau"), enregistrerBouton, bouton("Vérifier", "valider"), bouton("Tester", "apercu"));
  barre.append(actions); racine.append(barre);
  const onglets = element("nav", "", "onglets");
  onglets.setAttribute("aria-label", "Sections de l’enquête");
  onglets.setAttribute("role", "tablist");
  for (const [id, nom] of ONGLETS) {
    const choix = bouton(nom, "onglet", { tab: id });
    choix.id = `onglet-${id}`;
    choix.setAttribute("role", "tab");
    choix.setAttribute("aria-selected", String(etat.onglet === id));
    choix.setAttribute("aria-controls", "panneau-enquete");
    choix.tabIndex = etat.onglet === id ? 0 : -1;
    onglets.append(choix);
  }
  racine.append(onglets);
  let section;
  switch (etat.onglet) {
    case "piece": section = rendrePiece(enquete, etat.direction, etat.generation, enquete.id === LECTURE_SEULE); break;
    case "objets": section = rendreObjets(enquete, etat.objet); break;
    case "progression": section = rendreProgression(enquete, etat.modeGraphe); break;
    case "dialogue": section = rendreDialogue(enquete); break;
    case "debrief": section = rendreDebrief(enquete); break;
    case "tester": section = rendreTester(enquete, etat.resultats, etat.sale, etat.revision); break;
    default: section = rendreCadre(enquete);
  }
  const contenu = element("div", "", `atelier${section.lateral ? "" : " sans-liste"}`);
  contenu.id = "panneau-enquete";
  contenu.setAttribute("role", "tabpanel");
  contenu.setAttribute("aria-labelledby", `onglet-${etat.onglet}`);
  contenu.tabIndex = 0;
  if (section.lateral) contenu.append(section.lateral);
  const colonne = element("div", "", "grille-formulaire");
  colonne.append(section.principal);
  if (section.secondaire) colonne.append(section.secondaire);
  contenu.append(colonne); racine.append(contenu);
  application.replaceChildren(racine);
  if (enquete.id === LECTURE_SEULE) {
    for (const champ of application.querySelectorAll('input:not([data-action="contexte-flag"]), textarea, select')) champ.disabled = true;
    for (const action of ["ajouter-objet", "supprimer-objet", "ajouter-declencheur", "supprimer-declencheur",
      "ajouter-verrou", "supprimer-verrou", "ajouter-connaissance", "supprimer-connaissance", "ajouter-piste",
      "supprimer-piste", "ajouter-question", "supprimer-question", "ajouter-rang", "supprimer-rang", "activer"]) {
      for (const boutonMutation of application.querySelectorAll(`button[data-action="${action}"]`)) boutonMutation.disabled = true;
    }
  }
  mettreAJourStatut();
  if (etat.onglet === "dialogue") actualiserContexte(enquete, application);
}

function rendre() { etat.enquete ? rendreAtelier() : rendreTableau(); }

async function chargerCatalogue() {
  const contenu = await api("/api/editeur/enquetes");
  etat.catalogue = contenu.enquetes ?? [];
  rendre();
}

async function ouvrir(id) {
  const { enquete, revision } = await api(`/api/editeur/enquetes/${encodeURIComponent(id)}`);
  changerEnquete(enquete, revision);
}

async function creer(sourceId = "") {
  const titreSaisi = document.getElementById("nouveau-titre")?.value.trim() ?? "";
  const titreNouveau = sourceId ? `Copie de ${etat.catalogue.find((item) => item.id === sourceId)?.titre ?? sourceId}` : titreSaisi;
  if (!titreNouveau) throw new Error("Donnez un titre à la nouvelle enquête.");
  let id = sourceId ? `${sourceId.slice(0, 57)}_copie` : proposerId(titreNouveau);
  if (!id) throw new Error("Le titre doit contenir au moins une lettre ou un chiffre.");
  let suffixe = 2;
  while (etat.catalogue.some((item) => item.id === id)) id = `${(sourceId || proposerId(titreNouveau)).slice(0, 54)}_copie_${suffixe++}`;
  const corps = { id };
  if (sourceId) corps.sourceId = sourceId;
  const { enquete, revision } = await api("/api/editeur/enquetes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps),
  });
  const brouillon = titreNouveau && enquete.titre !== titreNouveau ? mettreAJour(enquete, ["titre"], titreNouveau) : enquete;
  changerEnquete(brouillon, revision, brouillon !== enquete);
  annoncer("Enquête créée. Renseignez les sections, puis enregistrez le brouillon.");
}

async function enregistrer() {
  if (!etat.enquete || etat.enregistrement) return;
  if (etat.enquete.id === LECTURE_SEULE) throw new Error("Dupliquez cet exemple pour le modifier.");
  const id = etat.enquete.id;
  const soumis = etat.enquete;
  etat.enregistrement = true;
  mettreAJourStatut();
  try {
    const { enquete, revision } = await api(`/api/editeur/enquetes/${encodeURIComponent(id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(soumis),
    });
    if (etat.enquete?.id !== id) return;
    etat.revision = revision;
    etat.resultats = null;
    if (etat.enquete === soumis) {
      etat.enquete = enquete;
      etat.sale = false;
      rendre();
      annoncer("Brouillon enregistré.");
    } else {
      annoncer("Brouillon enregistré. Des modifications plus récentes restent à enregistrer.");
    }
  } finally {
    etat.enregistrement = false;
    mettreAJourStatut();
  }
}

async function valider() {
  if (etat.sale) throw new Error("Enregistrez le brouillon avant de le vérifier.");
  const id = etat.enquete.id;
  const resultats = await api(`/api/editeur/enquetes/${encodeURIComponent(id)}/validation`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  etat.resultats = resultats;
  etat.onglet = "tester";
  rendre();
  annoncer(resultats.erreurs?.length ? `${resultats.erreurs.length} erreur(s) à corriger.` : "Vérification terminée.", Boolean(resultats.erreurs?.length));
}

function apercu() {
  if (etat.sale || !etat.revision) throw new Error("Enregistrez le brouillon avant l’aperçu.");
  if (!etat.resultats) throw new Error("Vérifiez l’enquête avant l’aperçu.");
  if (etat.resultats?.erreurs?.length) throw new Error("Corrigez les erreurs avant l’aperçu.");
  window.open(`/jouer/${encodeURIComponent(etat.enquete.id)}`, "_blank", "noopener");
}

async function activer() {
  if (etat.enquete.id === LECTURE_SEULE) throw new Error("L’exemple est en lecture seule.");
  if (etat.sale || !etat.resultats || etat.resultats.erreurs?.length) throw new Error("Enregistrez et vérifiez l’enquête avant de la marquer prête.");
  const { enquete, revision } = await api(`/api/editeur/enquetes/${encodeURIComponent(etat.enquete.id)}/activation`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  etat.enquete = enquete;
  etat.revision = revision;
  rendre();
  annoncer("Enquête prête à jouer.");
}

function mutationListe(chemin, operation, valeur) {
  const courant = chemin.reduce((acc, cle) => acc[cle], completerPourAffichage(etat.enquete));
  const suivant = [...courant];
  if (operation === "ajouter") suivant.push(valeur);
  else suivant.splice(Number(valeur), 1);
  modifier(mettreAJour(etat.enquete, chemin, suivant), true);
}

function ajouterGeste(type) {
  const action = document.getElementById(`nouveau-${type}-action`)?.value;
  const objet = document.getElementById(`nouveau-${type}-objet`)?.value;
  if (!objet) throw new Error("Choisissez une cible.");
  const cle = `${action}:${objet}`;
  if (type === "declencheur") {
    const flag = document.getElementById("nouveau-flag")?.value.trim();
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(flag)) throw new Error("Donnez un identifiant de fait valide.");
    if (Object.hasOwn(etat.enquete.declencheurs ?? {}, cle)) throw new Error("Ce déclencheur existe déjà.");
    modifier(mettreAJour(etat.enquete, ["declencheurs", cle], flag), true);
  } else {
    if (Object.hasOwn(etat.enquete.conditionsActions ?? {}, cle)) throw new Error("Ce verrou existe déjà.");
    modifier(mettreAJour(etat.enquete, ["conditionsActions", cle], { requiertTous: [] }), true);
  }
}

function supprimerCle(table, cle, associee = "") {
  const copie = structuredClone(etat.enquete);
  delete copie[table][cle];
  if (associee && copie[associee]) delete copie[associee][cle];
  copie.statut = "brouillon";
  modifier(copie, true);
}

function supprimerObjet(id) {
  if (!window.confirm(`Supprimer l’objet ${id} et ses gestes associés ?`)) return;
  etat.objet = "";
  modifier(retirerObjet(completerPourAffichage(etat.enquete), id), true);
}

function placerObjet(id, direction) {
  let copie = etat.enquete;
  const zones = copie.zones ?? {};
  for (const [cle, zone] of Object.entries(zones)) {
    const objets = (Array.isArray(zone?.objetsCaches) ? zone.objetsCaches : []).filter((item) => item !== id);
    if (cle === direction) objets.push(id);
    copie = mettreAJour(copie, ["zones", cle, "objetsCaches"], objets);
  }
  if (direction && !Object.hasOwn(zones, direction)) {
    copie = mettreAJour(copie, ["zones", direction, "objetsCaches"], [id]);
  }
  modifier(copie, true);
}

async function genererObjetsDansZone() {
  if (etat.enquete?.id === LECTURE_SEULE) throw new Error("Dupliquez cet exemple pour le modifier.");
  const generation = etat.generation;
  if (generation.enCours) return;
  const direction = generation.direction;
  const demande = preparerDemandeGeneration(etat.enquete, direction, Number(generation.nombre), generation.instruction);
  const id = etat.enquete.id;
  const session = etat.session;
  generation.enCours = true;
  rendre();
  annoncer("Génération des objets en cours…");
  try {
    const { objets } = await api(`/api/editeur/enquetes/${encodeURIComponent(id)}/generation-objets`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(demande),
    });
    if (etat.session !== session || etat.enquete?.id !== id) return;
    const suivant = ajouterObjetsGeneres(etat.enquete, direction, objets);
    generation.ouverte = false;
    modifier(suivant, true);
    annoncer(`${objets.length} objet(s) ajouté(s) au brouillon de la zone ${direction}. Relisez-les avant d’enregistrer.`);
  } finally {
    generation.enCours = false;
    if (etat.session === session) rendre();
  }
}

function gererClic(event) {
  const cible = event.target.closest("button[data-action]");
  if (!cible || !application.contains(cible)) return;
  const action = cible.dataset.action;
  actionAsynchrone(async () => {
    if (action === "creer") return creer();
    if (action === "ouvrir") return ouvrir(cible.dataset.id);
    if (action === "dupliquer") return creer(cible.dataset.id);
    if (action === "tableau") {
      if (etat.sale && !window.confirm("Quitter sans enregistrer les modifications ?")) return;
      etat.enquete = null; await chargerCatalogue(); return;
    }
    if (action === "enregistrer") return enregistrer();
    if (action === "valider") return valider();
    if (action === "apercu") return apercu();
    if (action === "activer") return activer();
    if (action === "onglet") {
      etat.onglet = cible.dataset.tab;
      rendre();
      application.querySelector(`[data-tab="${etat.onglet}"]`)?.focus();
      return;
    }
    if (action === "choisir-zone") { etat.direction = cible.dataset.cle; rendre(); return; }
    if (action === "ouvrir-generation") {
      if (etat.enquete?.id === LECTURE_SEULE) return;
      etat.generation = { ouverte: true, direction: etat.direction, nombre: "3", instruction: "", enCours: false };
      rendre();
      application.querySelector("#generation-nombre")?.focus();
      return;
    }
    if (action === "annuler-generation") { etat.generation.ouverte = false; rendre(); return; }
    if (action === "generer-objets") return genererObjetsDansZone();
    if (action === "choisir-objet") { etat.objet = cible.dataset.cle; rendre(); return; }
    if (action === "vue-graphe") { etat.modeGraphe = cible.dataset.mode; rendre(); return; }
    if (action === "aller-diagnostic") return allerDiagnostic(cible.dataset.path, { etat, application, rendre, annoncer });
    if (action === "ajouter-objet") {
      const id = document.getElementById("nouvel-objet")?.value.trim();
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error("Donnez un identifiant d’objet valide.");
      if (Object.hasOwn(etat.enquete.objets ?? {}, id)) throw new Error("Cet objet existe déjà.");
      etat.objet = id;
      return modifier(mettreAJour(etat.enquete, ["objets", id], { nom: "", aliases: [], apercu: "", description: "", ramassable: false }), true);
    }
    if (action === "supprimer-objet") return supprimerObjet(cible.dataset.cle);
    if (action === "ajouter-declencheur") return ajouterGeste("declencheur");
    if (action === "supprimer-declencheur") return supprimerCle("declencheurs", cible.dataset.cle, "preconditions");
    if (action === "ajouter-verrou") return ajouterGeste("verrou");
    if (action === "supprimer-verrou") return supprimerCle("conditionsActions", cible.dataset.cle);
    if (action === "ajouter-connaissance") return mutationListe(["connaissances"], "ajouter", { id: "", texte: "", requiert: [] });
    if (action === "supprimer-connaissance") return mutationListe(["connaissances"], "supprimer", cible.dataset.index);
    if (action === "ajouter-piste") return mutationListe(["pistesInterrogatoire"], "ajouter", { question: "", requiert: [], retireSi: [] });
    if (action === "supprimer-piste") return mutationListe(["pistesInterrogatoire"], "supprimer", cible.dataset.index);
    if (action === "ajouter-question") return mutationListe(["debrief", "questions"], "ajouter", { id: "", question: "", bareme: [1, 3, 5].map((note) => ({ note, critere: "" })) });
    if (action === "supprimer-question") return mutationListe(["debrief", "questions"], "supprimer", cible.dataset.index);
    if (action === "ajouter-rang") return mutationListe(["debrief", "rangs"], "ajouter", { seuil: 0, titre: "" });
    if (action === "supprimer-rang") return mutationListe(["debrief", "rangs"], "supprimer", cible.dataset.index);
  });
}

function valeurChamp(cible) {
  if (cible.dataset.type === "booleen") return cible.checked;
  if (cible.dataset.type === "nombre") return Number(cible.value);
  if (cible.dataset.type === "liste") return cible.value.split("\n").map((item) => item.trim()).filter(Boolean);
  return cible.value;
}

function gererSaisie(event) {
  const cible = event.target;
  if (cible.dataset.generation && etat.generation.ouverte) {
    etat.generation[cible.dataset.generation] = cible.value;
    return;
  }
  if (cible.type === "file" || !cible.dataset.path || !etat.enquete) return;
  try {
    const chemin = JSON.parse(cible.dataset.path);
    let miseAJour = mettreAJour(etat.enquete, chemin, valeurChamp(cible));
    if (chemin.at(-1) === "evenementQuandExprime" && !cible.value.trim()) {
      delete miseAJour.connaissances[chemin[1]].evenementQuandExprime;
    }
    modifier(miseAJour);
    if (chemin.length === 1 && chemin[0] === "titre") {
      const entete = application.querySelector(".barre h2");
      if (entete) entete.textContent = cible.value || "Sans titre";
    }
  }
  catch (erreur) { annoncer(erreur.message, true); }
}

function gererChangement(event) {
  const cible = event.target;
  if (!etat.enquete) return;
  if (cible.dataset.path && (cible.type === "checkbox" || cible.tagName === "SELECT")) gererSaisie(event);
  const action = cible.dataset.action;
  if (action === "contexte-flag") return actualiserContexte(completerPourAffichage(etat.enquete), application);
  actionAsynchrone(async () => {
    if (action === "renommer-objet") {
      const nouveau = cible.value.trim();
      if (nouveau !== cible.dataset.ancien && window.confirm("Renommer cet objet et mettre à jour toutes ses références ?")) {
        etat.objet = nouveau; modifier(renommerObjet(completerPourAffichage(etat.enquete), cible.dataset.ancien, nouveau), true);
      }
    }
    if (action === "renommer-flag") {
      const nouveau = cible.value.trim();
      if (nouveau !== cible.dataset.ancien && window.confirm("Renommer ce fait et mettre à jour toutes ses références ?")) {
        modifier(renommerFlag(completerPourAffichage(etat.enquete), cible.dataset.ancien, nouveau), true);
      }
    }
    if (action === "placer-objet") {
      placerObjet(cible.dataset.cle, cible.checked ? cible.dataset.direction : "");
    }
    if (action === "deplacer-objet") placerObjet(cible.dataset.cle, cible.value);
    if (action === "upload-image") {
      const fichier = cible.files?.[0];
      if (!fichier) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(fichier.type)) throw new Error("Format d’image non pris en charge.");
      const nom = nettoyer(fichier.name);
      const { chemin } = await api(`/api/editeur/enquetes/${encodeURIComponent(etat.enquete.id)}/images?nom=${encodeURIComponent(nom)}`, {
        method: "POST", headers: { "Content-Type": fichier.type }, body: fichier,
      });
      modifier(mettreAJour(etat.enquete, JSON.parse(cible.dataset.path), chemin), true);
      annoncer("Image importée. Enregistrez le brouillon pour conserver son chemin.");
    }
  });
}

application?.addEventListener("click", gererClic);
brancherNavigationOnglets(application, etat, rendre);
application?.addEventListener("input", gererSaisie);
application?.addEventListener("change", gererChangement);
window.addEventListener("beforeunload", (event) => {
  if (!etat.sale) return;
  event.preventDefault();
  event.returnValue = "";
});

actionAsynchrone(async () => {
  const session = await api("/api/editeur/session");
  definirJeton(session.jeton);
  await chargerCatalogue();
});

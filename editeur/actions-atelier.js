import { mettreAJour } from "./state.js";
import { modifierAgents } from "./actions-agents.js";
import { allerDiagnostic } from "./diagnostic.js";

// Les événements DOM de l’atelier restent distincts du chargement et du rendu.
export function creerActionsAtelier({ application, etat, LECTURE_SEULE, actionAsynchrone,
  creer, ouvrir, chargerCatalogue, enregistrer, valider, apercu, activer, rendre,
  genererObjetsDansZone, annoncer, modifier, supprimerObjet, ajouterGeste, supprimerCle, mutationListe }) {
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
      const agents = etat.enquete && modifierAgents(etat.enquete, action, cible.dataset, document.getElementById("nouveau-fait")?.value.trim());
      if (agents) return modifier(agents, true);
      if (action === "ajouter-objet") {
        const id = document.getElementById("nouvel-objet")?.value.trim();
        if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error("Donnez un identifiant d’objet valide.");
        if (Object.hasOwn(etat.enquete.objets ?? {}, id)) throw new Error("Cet objet existe déjà.");
        etat.objet = id;
        return modifier(mettreAJour(etat.enquete, ["objets", id], {
          nom: "", aliases: [], apercu: "", description: "",
          observations: { detail_1: "", detail_2: "" }, limites: {}, ramassable: false,
        }), true);
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

  return { gererClic, gererSaisie };
}

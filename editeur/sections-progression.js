import { construireGraphe } from "./graph.js";
import { vueGraphe, vueListeGraphe } from "./graph-view.js";
import { bouton, champ, element, groupe, titre, zoneAide } from "./ui.js";

function selecteurGestes(enquete, mode, id) {
  const ligne = element("div", "", "deux-colonnes");
  const actions = element("div", "", "champ");
  const labelAction = element("label", "Action"); labelAction.htmlFor = `${id}-action`;
  const choixAction = element("select"); choixAction.id = `${id}-action`;
  for (const valeur of ["examiner", "ramasser", "donner", ...(mode === "verrou" ? ["fouiller"] : [])]) {
    const option = element("option", valeur); option.value = valeur; choixAction.append(option);
  }
  actions.append(labelAction, choixAction);
  const objets = element("div", "", "champ");
  const labelObjet = element("label", "Cible de l’action"); labelObjet.htmlFor = `${id}-objet`;
  const choixObjet = element("select"); choixObjet.id = `${id}-objet`;
  const actualiserCibles = () => {
    const defaut = element("option", "Choisir"); defaut.value = "";
    choixObjet.replaceChildren(defaut);
    const cibles = choixAction.value === "fouiller" ? Object.entries(enquete.zones).map(([cle, zone]) => [cle, zone.nom || cle]) :
      Object.entries(enquete.objets).map(([cle, objet]) => [cle, objet.nom || cle]);
    for (const [cle, nom] of cibles) {
      const option = element("option", nom); option.value = cle; choixObjet.append(option);
    }
  };
  choixAction.addEventListener("change", actualiserCibles);
  actualiserCibles();
  objets.append(labelObjet, choixObjet);
  ligne.append(actions, objets);
  return ligne;
}

function carteDeclencheur(enquete, geste) {
  const flag = enquete.declencheurs[geste];
  const carte = element("section", "", "carte");
  carte.append(titre(geste, 3));
  const identifiant = champ("Fait produit", ["declencheurs", geste], flag, {
    aide: "Renommer un fait met à jour ses références dans les règles, pistes et preuves.",
  });
  const controle = identifiant.querySelector("input");
  delete controle.dataset.path;
  controle.dataset.action = "renommer-flag";
  controle.dataset.ancien = flag;
  carte.append(identifiant);
  carte.append(champ("Préconditions ET, un fait par ligne", ["preconditions", geste], enquete.preconditions[geste] ?? [], { liste: true }));
  carte.append(zoneAide("Les préconditions retardent le fait ; elles ne refusent pas l’action. Une révélation consultée trop tôt peut exiger un réexamen."));
  carte.append(bouton("Retirer le déclencheur", "supprimer-declencheur", { cle: geste }));
  return carte;
}

function carteVerrou(enquete, geste) {
  const carte = element("section", "", "carte");
  carte.append(titre(geste, 3), champ("Événements requis, un par ligne", ["conditionsActions", geste, "requiertTous"],
    enquete.conditionsActions[geste].requiertTous, { liste: true,
      aide: "Ex. examiner:cle ou identifiant d’événement déclaré par une connaissance. Ces événements doivent avoir été acceptés avant l’action." }));
  carte.append(bouton("Retirer le verrou", "supprimer-verrou", { cle: geste }));
  return carte;
}

export function rendreProgression(enquete, mode = "graphe") {
  const principal = element("section", "", "panneau");
  principal.append(titre("Progression"), zoneAide("Les faits sont déduits des gestes du joueur. Les préconditions d’un même déclencheur se combinent par ET ; les branches indépendantes convergent quel que soit l’ordre."));
  const bascule = element("div", "", "bascule");
  for (const valeur of ["graphe", "liste"]) {
    const choix = bouton(valeur === "graphe" ? "Graphe" : "Liste accessible", "vue-graphe", { mode: valeur });
    choix.setAttribute("aria-pressed", String(mode === valeur));
    bascule.append(choix);
  }
  principal.append(bascule, mode === "liste" ? vueListeGraphe(enquete) : vueGraphe(enquete));
  const compte = construireGraphe(enquete).noeuds.length;
  principal.append(element("p", `${compte} fait${compte > 1 ? "s" : ""} déclaré${compte > 1 ? "s" : ""}.`, "meta"));
  principal.append(element("hr", "", "separateur"), titre("Déclencheurs", 3));
  const ajout = element("section", "", "carte");
  ajout.append(titre("Nouveau déclencheur", 3), selecteurGestes(enquete, "declencheur", "nouveau-declencheur"));
  const fait = element("div", "", "champ");
  const label = element("label", "Identifiant du fait"); label.htmlFor = "nouveau-flag";
  const input = element("input"); input.id = "nouveau-flag"; input.placeholder = "ex. preuve_trouvee";
  fait.append(label, input);
  ajout.append(fait, bouton("+ Ajouter le déclencheur", "ajouter-declencheur"));
  principal.append(ajout);
  for (const geste of Object.keys(enquete.declencheurs)) principal.append(carteDeclencheur(enquete, geste));
  principal.append(element("hr", "", "separateur"), titre("Verrous d’action", 3));
  principal.append(zoneAide("Un verrou refuse le geste jusqu’à ce que tous ses événements requis aient été signés."));
  const ajoutVerrou = element("section", "", "carte");
  ajoutVerrou.append(titre("Nouveau verrou", 3), selecteurGestes(enquete, "verrou", "nouveau-verrou"), bouton("+ Ajouter le verrou", "ajouter-verrou"));
  principal.append(ajoutVerrou);
  for (const geste of Object.keys(enquete.conditionsActions)) principal.append(carteVerrou(enquete, geste));
  return { principal };
}

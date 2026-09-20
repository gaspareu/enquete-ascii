import { DIRECTIONS, PORTRAITS } from "./state.js";
import { rendreAideGeneration } from "./generation.js";
import { bouton, champ, champImage, element, groupe, titre, zoneAide } from "./ui.js";

const GRILLE = [["NO", "N", "NE"], ["O", "C", "E"], ["SO", "S", "SE"]];

export function rendreCadre(enquete) {
  const panneau = element("section", "", "panneau");
  panneau.append(titre("Cadre et personnage"), zoneAide("Le personnage reçoit sa personnalité et ses faits de base dès le début. Les connaissances conditionnelles se rédigent dans Dialogue."));
  panneau.append(groupe(
    champ("Titre de l’enquête", ["titre"], enquete.titre, { required: true }),
    champ("Introduction du joueur", ["intro"], enquete.intro, { multiligne: true, long: true }),
    titre("Interlocuteur", 3),
    champ("Identifiant du personnage", ["personnage", "id"], enquete.personnage.id),
    champ("Nom affiché", ["personnage", "nom"], enquete.personnage.nom, { required: true }),
    champ("Visage ASCII de secours", ["personnage", "visage"], enquete.personnage.visage, { multiligne: true }),
    champ("Personnalité et rôle privé", ["personnage", "personnalite"], enquete.personnage.personnalite, { multiligne: true, long: true }),
    champ("Faits de base, un par ligne", ["personnage", "faitsDeBase"], enquete.personnage.faitsDeBase, { liste: true }),
    titre("Portraits", 3),
    ...PORTRAITS.map((emotion) => champImage(`Portrait ${emotion}`, ["personnage", "portraits", emotion], enquete.personnage.portraits?.[emotion] ?? "")),
  ));
  const apercu = element("section", "", "panneau");
  apercu.append(titre("Aperçu de l’ouverture", 3), element("h3", enquete.titre || "Sans titre"), element("p", enquete.intro || "Aucune introduction"));
  apercu.append(element("pre", enquete.personnage.visage || "[portrait à définir]", "ascii"));
  return { principal: panneau, secondaire: apercu };
}

export function rendrePiece(enquete, direction = "N", generation = { ouverte: false }, lectureSeule = false) {
  const selection = DIRECTIONS.includes(direction) ? direction : "N";
  const zone = enquete.zones[selection];
  const panneau = element("section", "", "panneau");
  panneau.append(titre("Pièce et zones"), zoneAide("Les huit directions entourent l’interlocuteur. Choisissez une case pour éditer ses textes et ses objets cachés."));
  const plan = element("div", "", "plan");
  for (const ligne of GRILLE) for (const cle of ligne) {
    if (cle === "C") plan.append(element("div", enquete.personnage.nom || "Interlocuteur", "centre"));
    else {
      const caseZone = bouton(`${cle} · ${enquete.zones[cle].nom || "À nommer"}`, "choisir-zone", { cle });
      caseZone.setAttribute("aria-pressed", String(cle === selection));
      plan.append(caseZone);
    }
  }
  panneau.append(plan, titre(`Zone ${selection}`, 3));
  panneau.append(groupe(
    champ("Nom", ["zones", selection, "nom"], zone.nom),
    champ("Article", ["zones", selection, "article"], zone.article, { choix: [["", "Choisir"], ["le", "le"], ["la", "la"], ["l'", "l’"], ["les", "les"]] }),
    champ("Alias, un par ligne", ["zones", selection, "aliases"], zone.aliases, { liste: true }),
    champ("Description publique", ["zones", selection, "description"], zone.description, { multiligne: true }),
    champImage("Illustration", ["zones", selection, "illustration"], zone.illustration),
  ));
  const cache = element("section");
  cache.append(titre("Objets dans cette zone", 3), zoneAide("Une fouille donne le nom de ces objets, sans révéler leur description."));
  const liste = element("ul", "", "liste-cases");
  for (const [id, objet] of Object.entries(enquete.objets)) {
    const item = element("li");
    const label = element("label");
    const coche = element("input");
    coche.type = "checkbox";
    coche.checked = zone.objetsCaches.includes(id);
    coche.dataset.action = "placer-objet";
    coche.dataset.cle = id;
    coche.dataset.direction = selection;
    label.append(coche, document.createTextNode(`${objet.nom || id} (${id})`));
    item.append(label); liste.append(item);
  }
  cache.append(liste, rendreAideGeneration(generation, selection, lectureSeule));
  panneau.append(cache);
  return { principal: panneau };
}

export function rendreObjets(enquete, selection) {
  const entrees = Object.entries(enquete.objets);
  const id = Object.hasOwn(enquete.objets, selection) ? selection : entrees[0]?.[0];
  const lateral = element("aside", "", "panneau");
  lateral.append(titre("Objets"));
  const ajout = element("div", "", "champ");
  const label = element("label", "Identifiant du nouvel objet"); label.htmlFor = "nouvel-objet";
  const input = element("input"); input.id = "nouvel-objet"; input.placeholder = "ex. cle_doree";
  ajout.append(label, input, bouton("+ Ajouter l’objet", "ajouter-objet"));
  lateral.append(ajout);
  const liste = element("div", "", "liste-selection");
  for (const [cle, objet] of entrees) {
    const choix = bouton(objet.nom || cle, "choisir-objet", { cle });
    choix.setAttribute("aria-current", String(cle === id));
    liste.append(choix);
  }
  lateral.append(liste);
  const principal = element("section", "", "panneau");
  if (!id) {
    principal.append(titre("Aucun objet"), zoneAide("Créez un objet, puis placez-le dans une zone de la pièce."));
    return { lateral, principal };
  }
  const objet = enquete.objets[id];
  principal.append(titre(objet.nom || id), zoneAide("L’identifiant peut être renommé ; les liens de l’enquête sont alors mis à jour."));
  const champId = champ("Identifiant stable", ["objets", id, "id"], id);
  const entreeId = champId.querySelector("input");
  delete entreeId.dataset.path;
  entreeId.dataset.action = "renommer-objet";
  entreeId.dataset.ancien = id;
  principal.append(champId, groupe(
    champ("Nom affiché", ["objets", id, "nom"], objet.nom),
    champ("Alias, un par ligne", ["objets", id, "aliases"], objet.aliases ?? [], { liste: true }),
    champ("Aperçu avant révélation", ["objets", id, "apercu"], objet.apercu ?? "", { multiligne: true,
      aide: "Facultatif. Affiché si le fait de l’examen attend une précondition. Un second examen sera nécessaire après son acquisition." }),
    champ("Description révélée", ["objets", id, "description"], objet.description, { multiligne: true, long: true }),
    champ("Ramassable", ["objets", id, "ramassable"], objet.ramassable, { booleen: true }),
  ));
  const places = DIRECTIONS.filter((dir) => enquete.zones[dir].objetsCaches.includes(id));
  const deplacement = element("div", "", "champ");
  const labelZone = element("label", "Zone de l’objet"); labelZone.htmlFor = "zone-objet";
  const selectZone = element("select"); selectZone.id = "zone-objet";
  selectZone.dataset.action = "deplacer-objet";
  selectZone.dataset.cle = id;
  const sansZone = element("option", "Aucune zone"); sansZone.value = ""; selectZone.append(sansZone);
  for (const dir of DIRECTIONS) {
    const option = element("option", `${dir} · ${enquete.zones[dir].nom || "À nommer"}`);
    option.value = dir; selectZone.append(option);
  }
  selectZone.value = places[0] ?? "";
  deplacement.append(labelZone, selectZone);
  principal.append(deplacement, element("p", `Présent dans : ${places.join(", ") || "aucune zone"}`, "meta"));
  principal.append(bouton("Supprimer cet objet", "supprimer-objet", { cle: id }));
  return { lateral, principal };
}

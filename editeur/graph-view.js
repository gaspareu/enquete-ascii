import { construireGraphe } from "./graph.js";
import { element, titre, zoneAide } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";

function svgElement(nom, attributs = {}) {
  const noeud = document.createElementNS(NS, nom);
  for (const [cle, valeur] of Object.entries(attributs)) noeud.setAttribute(cle, String(valeur));
  return noeud;
}

function positions(noeuds) {
  const rangs = new Map(noeuds.map((noeud) => [noeud.id, 0]));
  for (let i = 0; i < noeuds.length; i++) {
    let change = false;
    for (const noeud of noeuds) {
      const parents = noeud.requiert.filter((id) => rangs.has(id));
      if (!parents.length) continue;
      const rang = Math.min(noeuds.length, Math.max(...parents.map((id) => rangs.get(id))) + 1);
      if (rang > rangs.get(noeud.id)) { rangs.set(noeud.id, rang); change = true; }
    }
    if (!change) break;
  }
  const compteParRang = new Map();
  return new Map(noeuds.map((noeud) => {
    const rang = rangs.get(noeud.id);
    const ligne = compteParRang.get(rang) ?? 0;
    compteParRang.set(rang, ligne + 1);
    return [noeud.id, { x: 130 + rang * 225, y: 60 + ligne * 90 }];
  }));
}

export function vueGraphe(enquete) {
  const { noeuds, liens } = construireGraphe(enquete);
  const bloc = element("section");
  bloc.append(titre("Graphe des faits", 3), zoneAide(
    "Chaque nœud est un fait. Les préconditions d’un même geste se combinent par ET ; plusieurs gestes produisant le même fait sont des alternatives OU. A puis B et B puis A donnent le même ensemble de faits indépendants. Les dons et révélations vues gardent leur chronologie.",
  ));
  if (!noeuds.length) {
    bloc.append(element("p", "Ajoutez un déclencheur pour commencer le graphe.", "vide"));
    return bloc;
  }
  const emplacement = positions(noeuds);
  const largeur = Math.max(500, ...[...emplacement.values()].map((p) => p.x + 140));
  const hauteur = Math.max(260, ...[...emplacement.values()].map((p) => p.y + 65));
  const cadre = element("div", "", "graphe");
  const svg = svgElement("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, width: largeur, height: hauteur,
    role: "img", "aria-label": `Graphe de ${noeuds.length} faits et ${liens.length} dépendances` });
  for (const lien of liens) {
    const de = emplacement.get(lien.de), vers = emplacement.get(lien.vers);
    if (!de || !vers) continue;
    const ligne = svgElement("line", { x1: de.x + 76, y1: de.y, x2: vers.x - 76, y2: vers.y, class: "arete" });
    const nom = svgElement("title");
    nom.textContent = `${lien.de} est requis pour ${lien.via} vers ${lien.vers}`;
    ligne.append(nom);
    svg.append(ligne);
  }
  for (const noeud of noeuds) {
    const { x, y } = emplacement.get(noeud.id);
    const groupe = svgElement("g");
    groupe.append(svgElement("rect", { x: x - 76, y: y - 27, width: 152, height: 54, rx: 0, class: "noeud" }));
    const texte = svgElement("text", { x, y: y + 5, "text-anchor": "middle" });
    texte.textContent = noeud.id.length > 18 ? `${noeud.id.slice(0, 16)}…` : noeud.id;
    groupe.append(texte);
    const libelle = svgElement("title");
    libelle.textContent = noeud.id;
    groupe.append(libelle);
    svg.append(groupe);
  }
  cadre.append(svg);
  bloc.append(cadre);
  return bloc;
}

export function vueListeGraphe(enquete) {
  const { noeuds } = construireGraphe(enquete);
  const bloc = element("section");
  bloc.append(titre("Liste structurée des faits", 3));
  if (!noeuds.length) bloc.append(element("p", "Aucun fait déclaré."));
  const liste = element("ol", "", "liste-cases");
  for (const noeud of noeuds) {
    const item = element("li", "", "carte");
    item.append(titre(noeud.id, 3));
    const gestes = element("p", noeud.branches.length > 1 ? "Gestes alternatifs (OU) :" : "Geste déclencheur :");
    const branches = element("ul");
    for (const branche of noeud.branches) {
      branches.append(element("li", `${branche.geste} — préconditions ET : ${branche.requiert.join(" + ") || "aucune"}`));
    }
    const effets = element("p", `Contexte du personnage : ${noeud.effets.connaissances.join(", ") || "aucun"} · Pistes : ${noeud.effets.pistes.length}`);
    item.append(gestes, branches, effets);
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

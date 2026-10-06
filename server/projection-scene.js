// Les connaissances projetées sont locales et issues de la progression vérifiée.
import { construireCatalogueInterprete } from "./interprete.js";
import { deriverEtat, deriverFlagsVisibles } from "./etat.js";
import { construitProjectionPrompt } from "./prompt.js";
import { composerObservation } from "./observations.js";
import { faitsPourDestinataire } from "./hooks-histoire.js";
import { scenePourContexte, scenesDepuisScenario } from "./scenes.js";

export function projectionScene(scenario, evenements, contexte) {
  const scene = scenePourContexte(scenario, contexte);
  if (!scene) throw new Error("Scène inconnue.");
  const complet = construireCatalogueInterprete(scenario, evenements, contexte);
  const locaux = complet.objetsConnus.filter((objet) => objet.zoneId === contexte.id || complet.sac.includes(objet.id));
  const catalogue = { ...complet, zones: complet.zones.filter((zone) => contexte.type === "zone" && zone.id === contexte.id), objetsConnus: locaux };
  const vus = new Map();
  for (let index = 0; index < evenements.length; index += 1) {
    const evenement = evenements[index];
    if (evenement.type !== "examiner" || !locaux.some((objet) => objet.id === evenement.cible)) continue;
    const prefixe = evenements.slice(0, index + 1);
    const objet = scenario.objets[evenement.cible];
    const flag = scenario.declencheurs?.[`examiner:${evenement.cible}`];
    const revele = !flag || deriverEtat(scenario, prefixe).flags.includes(flag);
    const numero = prefixe.filter((e) => e.type === "examiner" && e.cible === evenement.cible).length;
    vus.set(evenement.cible, { cibleId: evenement.cible, texte: composerObservation({
      texteVisible: revele ? objet.description : (objet.apercu ?? objet.description),
      observations: objet.observations, examenNumero: numero,
    }) });
  }
  return {
    scene, catalogue,
    navigation: scenesDepuisScenario(scenario).map(({ id, nom, contexte: cible }) => ({ id, nom, contexte: cible,
      aliases: cible.type === "zone" ? [...(scenario.zones[cible.id].aliases ?? [])] : [] })),
    faits: [...vus.values(), ...faitsPourDestinataire(scenario, evenements, scene.id, "exploration")],
  };
}

export function projectionPersonnage(scenario, evenements) {
  const id = scenario.personnage.id ?? "laurent";
  const effets = faitsPourDestinataire(scenario, evenements, `personnage:${id}`, "personnage");
  const local = { ...scenario, personnage: { ...scenario.personnage,
    faitsDeBase: [...scenario.personnage.faitsDeBase, ...effets.map((fait) => fait.texte)] } };
  return construitProjectionPrompt(local, deriverFlagsVisibles(scenario, evenements));
}

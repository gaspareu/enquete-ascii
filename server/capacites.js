// Unique arbitre des droits d'interaction. Les routes ne doivent jamais reproduire
// la matrice spatiale ou les conditions de progression à la main.

function dansZone(scenario, zoneId, cible) {
  return scenario.zones?.[zoneId]?.objetsCaches?.includes(cible) ?? false;
}

function aDansSac(etat, cible) {
  return etat.sac?.includes(cible) ?? false;
}

function estLaurent(scenario, contexte) {
  return contexte?.type === "personnage" && contexte.id === (scenario.personnage?.id ?? "laurent");
}

function progressionSuffisante(scenario, etat, action, cible) {
  const requis = scenario.conditionsActions?.[`${action}:${cible}`]?.requiertTous ?? [];
  const actions = new Set(etat.actionsEffectuees ?? []);
  return requis.every((evenement) => actions.has(evenement));
}

export function evaluerCapacite(scenario, etat, { contexte, intention }) {
  const { action, cible } = intention ?? {};
  let spatialementAutorise = false;

  if (estLaurent(scenario, contexte)) {
    if (action === "dialoguer") spatialementAutorise = cible === "laurent";
    else if (["examiner", "donner"].includes(action)) spatialementAutorise = aDansSac(etat, cible);
    else if (action === "fouiller") return { ok: false, code: "CONTEXTE_INTERDIT" };
  } else if (contexte?.type === "zone" && scenario.zones?.[contexte.id]) {
    if (action === "dialoguer" || action === "donner") return { ok: false, code: "CONTEXTE_INTERDIT" };
    if (action === "fouiller") spatialementAutorise = cible === contexte.id;
    if (action === "examiner") {
      spatialementAutorise = dansZone(scenario, contexte.id, cible) || aDansSac(etat, cible);
    }
    if (action === "ramasser") {
      spatialementAutorise = dansZone(scenario, contexte.id, cible) && scenario.objets?.[cible]?.ramassable === true;
    }
  } else {
    return { ok: false, code: "CONTEXTE_INTERDIT" };
  }

  if (!spatialementAutorise) {
    return {
      ok: false,
      code: action === "fouiller" || action === "dialoguer" || action === "donner"
        ? "CONTEXTE_INTERDIT"
        : "CIBLE_HORS_PORTEE",
    };
  }
  if (!progressionSuffisante(scenario, etat, action, cible)) {
    return { ok: false, code: "PROGRESSION_INSUFFISANTE" };
  }
  return { ok: true };
}

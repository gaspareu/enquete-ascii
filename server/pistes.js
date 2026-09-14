// Projection de pistes d'interrogatoire : les règles restent dans le scénario
// serveur, mais seule la question prête à afficher quitte ce module. Les flags ne
// sont jamais retournés au navigateur.

const MAX_PISTES = 3;

function tousAcquis(requis, acquis) {
  return Array.isArray(requis) && requis.length > 0 && requis.every((flag) => acquis.has(flag));
}

function estResolue(retireSi, acquis) {
  return Array.isArray(retireSi) && retireSi.some((flag) => acquis.has(flag));
}

// Renvoie au plus trois questions ouvertes, dans l'ordre éditorial du scénario.
// Une piste sans prérequis est ignorée : ce canal ne doit guider qu'à partir d'un
// fait déjà établi par le serveur.
export function pistesPourFlags(scenario, flags = []) {
  const acquis = new Set(flags);
  const banque = Array.isArray(scenario?.pistesInterrogatoire)
    ? scenario.pistesInterrogatoire
    : [];

  return banque
    .filter((piste) =>
      typeof piste?.question === "string" &&
      tousAcquis(piste.requiert, acquis) &&
      !estResolue(piste.retireSi, acquis),
    )
    .map((piste) => piste.question)
    .slice(0, MAX_PISTES);
}

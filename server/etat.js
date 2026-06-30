// Dérivation autorité de l'état de jeu, côté serveur. Le client n'envoie plus ses
// flags (qu'il pourrait forger) mais son JOURNAL DE GESTES ; on le rejoue ici avec
// les règles du scénario pour calculer les flags réellement gagnés. Pur et sans état
// partagé : chaque requête porte son journal complet (le backend reste sans état).

const GESTES = new Set(["ramasser", "donner", "examiner"]);

// Rejoue le journal de gestes et renvoie les flags légitimement obtenus (sans
// doublon, dans l'ordre d'acquisition). Un flag n'est posé que par le geste
// correspondant ET si ses préconditions sont remplies :
//   - précondition de SAC (order-strict) : on ne peut « donner » qu'un objet
//     préalablement « ramassé » dans le journal ;
//   - préconditions de FLAGS (ensemblistes, cf. scenario.preconditions) : un flag
//     peut exiger qu'un autre flag soit déjà acquis (ex. examiner la plaquette de
//     somnifères ne révèle le reçu de Laurent qu'après avoir constaté la 2e tasse).
// Un geste malformé est ignoré.
export function deriverFlags(scenario, gestes = []) {
  const { objets, declencheurs, preconditions = {} } = scenario;
  const sac = new Set();
  const declenches = []; // clés geste:cible réellement effectuées (sac order-strict), sans doublon

  const declencher = (cle) => {
    if (declencheurs[cle] && !declenches.includes(cle)) declenches.push(cle);
  };

  for (const item of gestes) {
    const geste = item?.geste;
    const cible = item?.cible;
    if (!GESTES.has(geste) || typeof cible !== "string") continue;

    if (geste === "ramasser") {
      if (objets[cible]?.ramassable) {
        sac.add(cible);
        declencher(`ramasser:${cible}`);
      }
    } else if (geste === "donner") {
      if (sac.has(cible)) declencher(`donner:${cible}`);
    } else if (geste === "examiner") {
      declencher(`examiner:${cible}`);
    }
  }

  // On ne pose un flag que si toutes ses préconditions de flags sont elles-mêmes
  // acquises. L'ordre des gestes dans le journal n'importe pas (il est idempotent) :
  // on itère jusqu'au point fixe, pour qu'un examen « à froid » ne verrouille pas la
  // révélation légitimement obtenue plus tard.
  const flags = [];
  let progresse = true;
  while (progresse) {
    progresse = false;
    for (const cle of declenches) {
      const flag = declencheurs[cle];
      if (flags.includes(flag)) continue;
      const requis = preconditions[cle] ?? [];
      if (requis.every((f) => flags.includes(f))) {
        flags.push(flag);
        progresse = true;
      }
    }
  }

  return flags;
}

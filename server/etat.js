// Dérivation autorité de l'état de jeu, côté serveur. Le client n'envoie plus ses
// flags (qu'il pourrait forger) mais son JOURNAL DE GESTES ; on le rejoue ici avec
// les règles du scénario pour calculer les flags réellement gagnés. Pur et sans état
// partagé : chaque requête porte son journal complet (le backend reste sans état).

const GESTES = new Set(["ramasser", "donner", "examiner"]);

// Rejoue le journal de gestes et renvoie les flags légitimement obtenus (sans
// doublon, dans l'ordre d'acquisition). Un flag n'est posé que par le geste
// correspondant ET si ses préconditions sont remplies : on ne peut « donner »
// qu'un objet préalablement « ramassé ». Un geste malformé est ignoré.
export function deriverFlags(scenario, gestes = []) {
  const { objets, declencheurs } = scenario;
  const sac = new Set();
  const flags = [];

  const poser = (cle) => {
    const flag = declencheurs[cle];
    if (flag && !flags.includes(flag)) flags.push(flag);
  };

  for (const item of gestes) {
    const geste = item?.geste;
    const cible = item?.cible;
    if (!GESTES.has(geste) || typeof cible !== "string") continue;

    if (geste === "ramasser") {
      if (objets[cible]?.ramassable) {
        sac.add(cible);
        poser(`ramasser:${cible}`);
      }
    } else if (geste === "donner") {
      if (sac.has(cible)) poser(`donner:${cible}`);
    } else if (geste === "examiner") {
      poser(`examiner:${cible}`);
    }
  }

  return flags;
}

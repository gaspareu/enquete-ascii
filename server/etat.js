// Dérivation pure de l'état depuis des événements déjà vérifiés par progression.js.
// Le routeur est le boundary : aucun payload client non signé ne doit parvenir ici.

const ACTIONS_OBJET = new Set(["ramasser", "donner", "examiner"]);

function contexteValide(scenario, contexte) {
  return (
    contexte &&
    typeof contexte === "object" &&
    typeof contexte.id === "string" &&
    (contexte.type === "zone" ||
      (contexte.type === "personnage" && contexte.id === (scenario.personnage?.id ?? "laurent")))
  );
}

function evenementValide(scenario, evenement) {
  return (
    evenement &&
    typeof evenement === "object" &&
    typeof evenement.type === "string" &&
    typeof evenement.cible === "string" &&
    contexteValide(scenario, evenement.contexte)
  );
}

function ajouterUnique(liste, valeur) {
  if (!liste.includes(valeur)) liste.push(valeur);
}

export function deriverEtat(scenario, evenementsVerifies = []) {
  const objets = scenario.objets ?? {};
  const declencheurs = scenario.declencheurs ?? {};
  const preconditions = scenario.preconditions ?? {};
  const sac = [];
  const declenches = [];
  const actionsEffectuees = [];

  for (const evenement of evenementsVerifies) {
    if (!evenementValide(scenario, evenement)) continue;
    const { type, cible } = evenement;

    if (type === "dialogue") {
      ajouterUnique(actionsEffectuees, cible);
      continue;
    }
    if (type === "fouiller") {
      if (evenement.contexte.type === "zone" && evenement.contexte.id === cible && scenario.zones?.[cible]) {
        ajouterUnique(actionsEffectuees, `fouiller:${cible}`);
      }
      continue;
    }
    if (!ACTIONS_OBJET.has(type) || !objets[cible]) continue;

    if (type === "ramasser") {
      if (!objets[cible].ramassable) continue;
      ajouterUnique(sac, cible);
    } else if (type === "donner" && !sac.includes(cible)) {
      continue;
    }

    const cle = `${type}:${cible}`;
    ajouterUnique(actionsEffectuees, cle);
    if (declencheurs[cle]) ajouterUnique(declenches, cle);
  }

  // Les préconditions de flags sont ensemblistes : une action acceptée peut être
  // arrivée avant l'indice qui la rend révélatrice. On converge donc au point fixe.
  const flags = [];
  let progresse = true;
  while (progresse) {
    progresse = false;
    for (const cle of declenches) {
      const flag = declencheurs[cle];
      if (!flags.includes(flag) && (preconditions[cle] ?? []).every((f) => flags.includes(f))) {
        flags.push(flag);
        progresse = true;
      }
    }
  }

  return { sac, flags, actionsEffectuees };
}

function objetPublic(id, objet) {
  return {
    id,
    nom: objet.nom,
    aliases: [...(objet.aliases ?? [])],
    ramassable: objet.ramassable === true,
  };
}

// Cette projection se déduit des reçus, pas du navigateur : l'interprète ne peut
// nommer que les objets dont le joueur a légitimement rencontré le nom.
export function deriverObjetsConnus(scenario, evenementsVerifies = []) {
  const connus = [];
  const ajouter = (id) => {
    if (connus.some((objet) => objet.id === id) || !scenario.objets?.[id]) return;
    connus.push(objetPublic(id, scenario.objets[id]));
  };
  for (const evenement of evenementsVerifies) {
    if (!evenementValide(scenario, evenement)) continue;
    if (evenement.type === "fouiller" && evenement.contexte.type === "zone" && evenement.cible === evenement.contexte.id) {
      for (const id of scenario.zones?.[evenement.cible]?.objetsCaches ?? []) ajouter(id);
    } else if (ACTIONS_OBJET.has(evenement.type) && scenario.objets?.[evenement.cible]) {
      ajouter(evenement.cible);
    }
  }
  return connus;
}

export function deriverEtatPublic(scenario, evenementsVerifies = []) {
  const etat = deriverEtat(scenario, evenementsVerifies);
  return { sac: etat.sac, objetsConnus: deriverObjetsConnus(scenario, evenementsVerifies) };
}

// Les pistes et le prompt ne doivent évoquer que ce que le joueur a effectivement
// lu ou entendu. Contrairement à `deriverEtat`, cette projection ne résout pas les
// préconditions à rebours : un examen réalisé avant son prérequis reste un aperçu
// tant que le joueur ne l'examine pas de nouveau après avoir obtenu ce prérequis.
export function deriverFlagsVisibles(scenario, evenementsVerifies = []) {
  const objets = scenario.objets ?? {};
  const declencheurs = scenario.declencheurs ?? {};
  const preconditions = scenario.preconditions ?? {};
  const sac = [];
  const flags = [];

  for (const evenement of evenementsVerifies) {
    if (!evenementValide(scenario, evenement)) continue;
    const { type, cible } = evenement;
    if (!ACTIONS_OBJET.has(type) || !objets[cible]) continue;

    if (type === "ramasser") {
      if (!objets[cible].ramassable) continue;
      ajouterUnique(sac, cible);
    } else if (type === "donner" && !sac.includes(cible)) {
      continue;
    }

    const cle = `${type}:${cible}`;
    const flag = declencheurs[cle];
    if (flag && (preconditions[cle] ?? []).every((requis) => flags.includes(requis))) {
      ajouterUnique(flags, flag);
    }
  }

  return flags;
}

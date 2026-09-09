// Dérivation pure de l'état depuis des événements déjà vérifiés par progression.js.
// Le routeur est le boundary : aucun payload client non signé ne doit parvenir ici.

const ACTIONS_OBJET = new Set(["ramasser", "donner", "examiner"]);

function contexteValide(contexte) {
  return (
    contexte &&
    typeof contexte === "object" &&
    typeof contexte.id === "string" &&
    (contexte.type === "zone" || (contexte.type === "personnage" && contexte.id === "laurent"))
  );
}

function evenementValide(evenement) {
  return (
    evenement &&
    typeof evenement === "object" &&
    typeof evenement.type === "string" &&
    typeof evenement.cible === "string" &&
    contexteValide(evenement.contexte)
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
    if (!evenementValide(evenement)) continue;
    const { type, cible } = evenement;

    if (type === "dialogue") {
      ajouterUnique(actionsEffectuees, cible);
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

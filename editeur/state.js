export const DIRECTIONS = ["NO", "N", "NE", "O", "E", "SO", "S", "SE"];
export const PORTRAITS = ["neutre", "mefiant", "irrite", "inquiet"];
const ID_VALIDE = /^[a-z][a-z0-9_-]{0,63}$/;

export function proposerId(texte) {
  const brut = String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(brut) ? brut.slice(0, 64) : `enquete_${brut}`.slice(0, 64);
}

export function creerEnqueteVide(titre, id = proposerId(titre)) {
  if (!ID_VALIDE.test(id)) throw new Error("Identifiant invalide.");
  const zones = Object.fromEntries(DIRECTIONS.map((direction) => [direction, {
    nom: "", article: "", aliases: [], description: "", illustration: "", objetsCaches: [],
  }]));
  return {
    schemaVersion: 1, id, statut: "brouillon", titre, intro: "",
    personnage: {
      id: "personnage", nom: "", visage: "", personnalite: "", faitsDeBase: [],
      portraits: Object.fromEntries(PORTRAITS.map((emotion) => [emotion, ""])),
    },
    zones, objets: {}, declencheurs: {}, preconditions: {}, conditionsActions: {},
    connaissances: [], pistesInterrogatoire: [],
    solution: { coupable: false, preuvesRequises: [] },
    debrief: { questions: [], rangs: [] },
  };
}

export function completerPourAffichage(enquete) {
  const base = creerEnqueteVide(enquete.titre ?? "", enquete.id);
  const zone = (direction) => ({ ...base.zones[direction], ...(enquete.zones?.[direction] ?? {}) });
  return {
    ...base, ...enquete,
    personnage: {
      ...base.personnage, ...(enquete.personnage ?? {}),
      portraits: { ...base.personnage.portraits, ...(enquete.personnage?.portraits ?? {}) },
    },
    zones: Object.fromEntries(DIRECTIONS.map((direction) => [direction, zone(direction)])),
    objets: enquete.objets ?? {},
    declencheurs: enquete.declencheurs ?? {},
    preconditions: enquete.preconditions ?? {},
    conditionsActions: enquete.conditionsActions ?? {},
    connaissances: enquete.connaissances ?? [],
    pistesInterrogatoire: enquete.pistesInterrogatoire ?? [],
    solution: { ...base.solution, ...(enquete.solution ?? {}) },
    debrief: { ...base.debrief, ...(enquete.debrief ?? {}) },
  };
}

export function ajouterObjetsGeneres(enquete, direction, propositions) {
  if (!DIRECTIONS.includes(direction) || !Array.isArray(propositions) || propositions.length === 0) {
    throw new Error("La zone ou les objets proposés sont invalides.");
  }
  const copie = structuredClone(enquete);
  copie.objets ??= {};
  copie.zones ??= {};
  const defaut = creerEnqueteVide(enquete.titre ?? "", enquete.id).zones[direction];
  copie.zones[direction] = { ...defaut, ...(copie.zones[direction] ?? {}) };
  copie.zones[direction].objetsCaches = [...(copie.zones[direction].objetsCaches ?? [])];
  for (const proposition of propositions) {
    if (typeof proposition?.nom !== "string" || !proposition.nom.trim() ||
      typeof proposition.description !== "string" || typeof proposition.ramassable !== "boolean") {
      throw new Error("Un objet proposé est invalide.");
    }
    const base = proposerId(proposition.nom).slice(0, 64);
    let id = base;
    let numero = 2;
    while (Object.hasOwn(copie.objets, id)) {
      const suffixe = `_${numero++}`;
      id = `${base.slice(0, 64 - suffixe.length)}${suffixe}`;
    }
    copie.objets[id] = { nom: proposition.nom.trim(), aliases: [], apercu: "",
      description: proposition.description.trim(), ramassable: proposition.ramassable };
    copie.zones[direction].objetsCaches.push(id);
  }
  copie.statut = "brouillon";
  return copie;
}

export function mettreAJour(enquete, chemin, valeur) {
  if (!Array.isArray(chemin) || chemin.length === 0) throw new Error("Chemin de champ invalide.");
  const copie = structuredClone(enquete);
  const defauts = creerEnqueteVide(enquete.titre ?? "", enquete.id);
  let cible = copie;
  let defaut = defauts;
  for (const [index, segment] of chemin.slice(0, -1).entries()) {
    if (!["string", "number"].includes(typeof segment) || ["__proto__", "prototype", "constructor"].includes(segment)) {
      throw new Error("Chemin de champ invalide.");
    }
    if (cible == null || typeof cible !== "object") throw new Error("Chemin de champ invalide.");
    const suivantDefaut = defaut?.[segment];
    if (!Object.hasOwn(cible, segment) || cible[segment] == null) {
      cible[segment] = suivantDefaut === undefined
        ? (typeof chemin[index + 1] === "number" ? [] : {})
        : structuredClone(suivantDefaut);
    }
    cible = cible[segment];
    defaut = suivantDefaut;
  }
  const cle = chemin.at(-1);
  if (!["string", "number"].includes(typeof cle) || ["__proto__", "prototype", "constructor"].includes(cle) || cible == null || typeof cible !== "object") {
    throw new Error("Chemin de champ invalide.");
  }
  cible[cle] = valeur;
  copie.statut = "brouillon";
  return copie;
}

function verifierNouveauId(table, ancien, nouveau) {
  if (!ID_VALIDE.test(nouveau)) throw new Error("L’identifiant accepte les lettres minuscules, chiffres, _ et -.");
  if (ancien !== nouveau && Object.hasOwn(table, nouveau)) throw new Error("Cet identifiant existe déjà.");
  if (!Object.hasOwn(table, ancien)) throw new Error("Identifiant d’origine introuvable.");
}

function renommerClesAction(table, ancien, nouveau) {
  return Object.fromEntries(Object.entries(table).map(([cle, valeur]) => [
    cle.replace(new RegExp(`^(examiner|ramasser|donner):${ancien}$`), `$1:${nouveau}`), valeur,
  ]));
}

function renommerEvenement(evenement, ancien, nouveau) {
  return evenement.replace(new RegExp(`^(examiner|ramasser|donner):${ancien}$`), `$1:${nouveau}`);
}

export function renommerObjet(enquete, ancien, nouveau) {
  verifierNouveauId(enquete.objets, ancien, nouveau);
  if (ancien === nouveau) return enquete;
  const copie = structuredClone(enquete);
  copie.objets[nouveau] = copie.objets[ancien];
  delete copie.objets[ancien];
  for (const zone of Object.values(copie.zones)) {
    zone.objetsCaches = zone.objetsCaches.map((id) => id === ancien ? nouveau : id);
  }
  copie.declencheurs = renommerClesAction(copie.declencheurs, ancien, nouveau);
  copie.preconditions = renommerClesAction(copie.preconditions, ancien, nouveau);
  copie.conditionsActions = Object.fromEntries(
    Object.entries(copie.conditionsActions).map(([cle, condition]) => [
      renommerEvenement(cle, ancien, nouveau),
      { ...condition, requiertTous: condition.requiertTous.map((e) => renommerEvenement(e, ancien, nouveau)) },
    ]),
  );
  copie.statut = "brouillon";
  return copie;
}

export function renommerFlag(enquete, ancien, nouveau) {
  if (!ID_VALIDE.test(nouveau)) throw new Error("Identifiant de fait invalide.");
  if (ancien === nouveau) return enquete;
  if (Object.values(enquete.declencheurs).includes(nouveau)) throw new Error("Ce fait existe déjà.");
  const copie = structuredClone(enquete);
  for (const [geste, flag] of Object.entries(copie.declencheurs)) {
    if (flag === ancien) copie.declencheurs[geste] = nouveau;
  }
  for (const [geste, requis] of Object.entries(copie.preconditions)) {
    copie.preconditions[geste] = requis.map((flag) => flag === ancien ? nouveau : flag);
  }
  for (const connaissance of copie.connaissances) {
    connaissance.requiert = connaissance.requiert.map((flag) => flag === ancien ? nouveau : flag);
  }
  for (const piste of copie.pistesInterrogatoire) {
    piste.requiert = piste.requiert.map((flag) => flag === ancien ? nouveau : flag);
    if (piste.retireSi) piste.retireSi = piste.retireSi.map((flag) => flag === ancien ? nouveau : flag);
  }
  copie.solution.preuvesRequises = copie.solution.preuvesRequises.map((flag) => flag === ancien ? nouveau : flag);
  copie.statut = "brouillon";
  return copie;
}

export function retirerObjet(enquete, id) {
  const copie = structuredClone(enquete);
  delete copie.objets[id];
  for (const zone of Object.values(copie.zones)) zone.objetsCaches = zone.objetsCaches.filter((item) => item !== id);
  for (const cle of Object.keys(copie.declencheurs)) {
    if (cle.endsWith(`:${id}`)) { delete copie.declencheurs[cle]; delete copie.preconditions[cle]; }
  }
  for (const cle of Object.keys(copie.conditionsActions)) {
    if (cle.endsWith(`:${id}`)) delete copie.conditionsActions[cle];
    else copie.conditionsActions[cle].requiertTous = copie.conditionsActions[cle].requiertTous.filter((item) => !item.endsWith(`:${id}`));
  }
  copie.statut = "brouillon";
  return copie;
}

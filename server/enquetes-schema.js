// Contrat d'auteur V1. La validation est pure : le dépôt vérifie séparément
// l'existence réelle des images avant de rendre une enquête jouable.

export const VERSION_SCHEMA = 1;
export const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const ID_SUR = /^[a-z][a-z0-9_-]{0,63}$/;

const EST_OBJET = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur);
const ACTIONS_OBJET = new Set(["examiner", "ramasser", "donner"]);
const PORTRAITS = ["neutre", "mefiant", "irrite", "inquiet"];
const MAX_TEXTE = 20_000;
const MAX_ELEMENTS = 500;

function analyserAction(cle, objets, zones, personnageId, evenementsDialogue) {
  if (typeof cle !== "string") return false;
  if (evenementsDialogue.has(cle)) return true;
  const parties = cle.split(":");
  if (parties.length !== 2) return false;
  if (ACTIONS_OBJET.has(parties[0])) return Object.hasOwn(objets, parties[1]);
  if (parties[0] === "fouiller") return Object.hasOwn(zones, parties[1]);
  return false;
}

function actionsAtteignables({ zones, objets, declencheurs, preconditions, conditions, connaissances }) {
  const evenements = new Set();
  const flags = new Set();
  const positions = new Map();
  for (const direction of DIRECTIONS) {
    const ids = zones[direction]?.objetsCaches;
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (!positions.has(id)) positions.set(id, []);
      positions.get(id).push(direction);
    }
  }
  const autorisee = (cle) => {
    const requis = conditions[cle]?.requiertTous;
    return !Array.isArray(requis) || requis.every((evenement) => evenements.has(evenement));
  };
  const ajouter = (ensemble, valeur) => {
    if (ensemble.has(valeur)) return false;
    ensemble.add(valeur);
    return true;
  };
  let progresse = true;
  while (progresse) {
    progresse = false;
    for (const direction of DIRECTIONS) {
      const cle = `fouiller:${direction}`;
      if (Object.hasOwn(zones, direction) && autorisee(cle)) progresse = ajouter(evenements, cle) || progresse;
    }
    for (const [id, objet] of Object.entries(objets)) {
      const accessible = (positions.get(id) ?? []).some((direction) => evenements.has(`fouiller:${direction}`));
      for (const action of ["examiner", "ramasser", "donner"]) {
        if (action !== "examiner" && objet?.ramassable !== true) continue;
        if (action === "donner" ? !evenements.has(`ramasser:${id}`) : !accessible) continue;
        const cle = `${action}:${id}`;
        if (autorisee(cle)) progresse = ajouter(evenements, cle) || progresse;
      }
    }
    for (const [cle, flag] of Object.entries(declencheurs)) {
      if (evenements.has(cle) && (preconditions.get(cle) ?? []).every((requis) => flags.has(requis))) {
        progresse = ajouter(flags, flag) || progresse;
      }
    }
    for (const connaissance of connaissances) {
      if (typeof connaissance?.evenementQuandExprime !== "string" || !Array.isArray(connaissance.requiert)) continue;
      if (connaissance.requiert.every((requis) => flags.has(requis))) {
        progresse = ajouter(evenements, connaissance.evenementQuandExprime) || progresse;
      }
    }
  }
  return evenements;
}

export function validerEnquete(enquete, { complete = true } = {}) {
  const erreurs = [];
  const avertissements = [];
  const erreur = (path, message) => erreurs.push({ path, message });
  const avertir = (path, message) => avertissements.push({ path, message });
  const texte = (valeur, path, { obligatoire = true, max = MAX_TEXTE } = {}) => {
    if (valeur === undefined && !obligatoire) return;
    if (typeof valeur !== "string" || (obligatoire && !valeur.trim()) || valeur.length > max) {
      erreur(path, `Texte requis, de 1 à ${max} caractères.`);
    }
  };
  const liste = (valeur, path, obligatoire = true) => {
    if (valeur === undefined && !obligatoire) return [];
    if (!Array.isArray(valeur) || valeur.length > MAX_ELEMENTS) {
      erreur(path, "Liste invalide ou trop longue.");
      return [];
    }
    return valeur;
  };
  const dictionnaire = (valeur, path, obligatoire = true) => {
    if (valeur === undefined && !obligatoire) return {};
    if (!EST_OBJET(valeur) || Object.keys(valeur).length > MAX_ELEMENTS) {
      erreur(path, "Objet invalide ou trop grand.");
      return {};
    }
    return valeur;
  };
  const ids = (valeur, path, { min = 0 } = {}) => {
    const items = liste(valeur, path);
    if (items.length < min) erreur(path, `Au moins ${min} référence(s) requise(s).`);
    items.forEach((id, index) => {
      if (typeof id !== "string" || !ID_SUR.test(id)) erreur(`${path}.${index}`, "Identifiant invalide.");
    });
    if (new Set(items).size !== items.length) erreur(path, "Références répétées.");
    return items;
  };
  const refs = (valeur, path, connus, options) => {
    for (const [index, id] of ids(valeur, path, options).entries()) {
      if (typeof id === "string" && !connus.has(id)) erreur(`${path}.${index}`, `Référence inconnue : ${id}.`);
    }
  };
  const image = (valeur, path) => {
    texte(valeur, path, { obligatoire: false, max: 240 });
    if (valeur === undefined || valeur === "" || typeof valeur !== "string") return;
    const prefixe = enquete.id === "helene" ? "/images/" : `/images/enquetes/${enquete.id}/`;
    const suffixe = valeur.slice(prefixe.length);
    if (!valeur.startsWith(prefixe) || !/^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(suffixe)) {
      erreur(path, `Image attendue dans ${prefixe} au format PNG, JPEG ou WebP.`);
    }
  };

  if (!EST_OBJET(enquete)) return { erreurs: [{ path: "", message: "Enquête invalide." }], avertissements };
  if (enquete.schemaVersion !== VERSION_SCHEMA) erreur("schemaVersion", `Version attendue : ${VERSION_SCHEMA}.`);
  if (typeof enquete.id !== "string" || !ID_SUR.test(enquete.id)) erreur("id", "Identifiant invalide.");
  if (enquete.statut !== "brouillon" && enquete.statut !== "prete") erreur("statut", "Statut invalide.");
  if (!complete) return { erreurs, avertissements };

  texte(enquete.titre, "titre", { max: 200 });
  texte(enquete.intro, "intro");
  const personnage = dictionnaire(enquete.personnage, "personnage");
  if ((personnage.id === undefined && enquete.id !== "helene") ||
    (personnage.id !== undefined && (typeof personnage.id !== "string" || !ID_SUR.test(personnage.id)))) {
    erreur("personnage.id", "Identifiant invalide.");
  }
  texte(personnage.nom, "personnage.nom", { max: 200 });
  texte(personnage.visage, "personnage.visage");
  texte(personnage.personnalite, "personnage.personnalite");
  liste(personnage.faitsDeBase, "personnage.faitsDeBase").forEach((fait, i) => texte(fait, `personnage.faitsDeBase.${i}`));
  const portraits = dictionnaire(personnage.portraits, "personnage.portraits");
  for (const humeur of PORTRAITS) image(portraits[humeur], `personnage.portraits.${humeur}`);
  for (const humeur of Object.keys(portraits)) {
    if (!PORTRAITS.includes(humeur)) erreur(`personnage.portraits.${humeur}`, "Portrait inconnu.");
  }

  const zones = dictionnaire(enquete.zones, "zones");
  const objets = dictionnaire(enquete.objets, "objets");
  const objetsVus = new Map();
  for (const direction of DIRECTIONS) {
    if (!Object.hasOwn(zones, direction)) { erreur(`zones.${direction}`, "Zone manquante."); continue; }
    const zone = dictionnaire(zones[direction], `zones.${direction}`);
    texte(zone.nom, `zones.${direction}.nom`, { max: 200 });
    texte(zone.article, `zones.${direction}.article`, { max: 40 });
    texte(zone.description, `zones.${direction}.description`);
    image(zone.illustration, `zones.${direction}.illustration`);
    liste(zone.aliases, `zones.${direction}.aliases`).forEach((alias, i) => texte(alias, `zones.${direction}.aliases.${i}`, { max: 200 }));
    for (const [index, id] of ids(zone.objetsCaches, `zones.${direction}.objetsCaches`).entries()) {
      if (!Object.hasOwn(objets, id)) erreur(`zones.${direction}.objetsCaches.${index}`, `Objet inconnu : ${id}.`);
      else objetsVus.set(id, (objetsVus.get(id) ?? 0) + 1);
    }
  }
  for (const direction of Object.keys(zones)) if (!DIRECTIONS.includes(direction)) erreur(`zones.${direction}`, "Direction inconnue.");
  for (const [id, valeur] of Object.entries(objets)) {
    if (!ID_SUR.test(id)) erreur(`objets.${id}`, "Identifiant invalide.");
    if (objetsVus.get(id) !== 1) erreur(`objets.${id}`, "Un objet doit être placé dans une seule zone.");
    const objet = dictionnaire(valeur, `objets.${id}`);
    texte(objet.nom, `objets.${id}.nom`, { max: 200 });
    texte(objet.description, `objets.${id}.description`);
    texte(objet.apercu, `objets.${id}.apercu`, { obligatoire: false });
    if (typeof objet.ramassable !== "boolean") erreur(`objets.${id}.ramassable`, "Booléen requis.");
    liste(objet.aliases, `objets.${id}.aliases`, false).forEach((alias, i) => texte(alias, `objets.${id}.aliases.${i}`, { max: 200 }));
  }

  const declencheurs = dictionnaire(enquete.declencheurs, "declencheurs");
  const flags = new Set();
  for (const [cle, flag] of Object.entries(declencheurs)) {
    const parties = cle.split(":");
    const [action, cible] = parties;
    if (parties.length !== 2 || !ACTIONS_OBJET.has(action) || !ID_SUR.test(cible ?? "") || !Object.hasOwn(objets, cible)) erreur(`declencheurs.${cle}`, "Action ou objet inconnu.");
    if (typeof flag !== "string" || !ID_SUR.test(flag)) erreur(`declencheurs.${cle}`, "Flag invalide.");
    else flags.add(flag);
    if ((action === "ramasser" || action === "donner") && objets[cible]?.ramassable !== true) {
      erreur(`declencheurs.${cle}`, "L'objet doit être ramassable pour cette action.");
    }
  }
  const preconditions = dictionnaire(enquete.preconditions, "preconditions", false);
  const preconditionsValides = new Map();
  for (const [cle, requis] of Object.entries(preconditions)) {
    if (!Object.hasOwn(declencheurs, cle)) erreur(`preconditions.${cle}`, "Déclencheur absent.");
    refs(requis, `preconditions.${cle}`, flags);
    preconditionsValides.set(cle, Array.isArray(requis) ? requis : []);
  }
  for (const [id, objet] of Object.entries(objets)) {
    if (objet?.apercu && !Object.hasOwn(declencheurs, `examiner:${id}`)) {
      erreur(`objets.${id}.apercu`, "Un aperçu exige un déclencheur d'examen.");
    } else if (objet?.apercu && (preconditionsValides.get(`examiner:${id}`) ?? []).length) {
      avertir(`objets.${id}.apercu`, "Une révélation peut nécessiter un réexamen après l'acquisition du prérequis.");
    }
  }
  const atteignables = new Set();
  let progresse = true;
  while (progresse) {
    progresse = false;
    for (const [cle, flag] of Object.entries(declencheurs)) {
      if (!atteignables.has(flag) && (preconditionsValides.get(cle) ?? []).every((requis) => atteignables.has(requis))) {
        atteignables.add(flag);
        progresse = true;
      }
    }
  }
  for (const flag of flags) if (!atteignables.has(flag)) erreur("preconditions", `Flag inatteignable ou cycle sans amorce : ${flag}.`);

  const connaissances = liste(enquete.connaissances, "connaissances");
  const connaissanceIds = new Set();
  const evenementsDialogue = new Set();
  connaissances.forEach((connaissance, index) => {
    const path = `connaissances.${index}`;
    const c = dictionnaire(connaissance, path);
    if (typeof c.id !== "string" || !ID_SUR.test(c.id) || connaissanceIds.has(c.id)) erreur(`${path}.id`, "Identifiant invalide ou répété.");
    connaissanceIds.add(c.id);
    texte(c.texte, `${path}.texte`);
    refs(c.requiert, `${path}.requiert`, flags);
    if (c.evenementQuandExprime !== undefined) {
      if (typeof c.evenementQuandExprime !== "string" || !ID_SUR.test(c.evenementQuandExprime) || evenementsDialogue.has(c.evenementQuandExprime)) {
        erreur(`${path}.evenementQuandExprime`, "Événement de dialogue invalide ou répété.");
      } else evenementsDialogue.add(c.evenementQuandExprime);
    }
  });
  const conditions = dictionnaire(enquete.conditionsActions, "conditionsActions", false);
  for (const [cle, condition] of Object.entries(conditions)) {
    if (!analyserAction(cle, objets, zones, personnage.id ?? "laurent", new Set())) erreur(`conditionsActions.${cle}`, "Action inconnue.");
    const requis = dictionnaire(condition, `conditionsActions.${cle}`).requiertTous;
    liste(requis, `conditionsActions.${cle}.requiertTous`).forEach((evenement, index) => {
      if (evenement === cle) {
        erreur(`conditionsActions.${cle}.requiertTous.${index}`, "Une action ne peut pas se requérir elle-même.");
      } else if (!analyserAction(evenement, objets, zones, personnage.id ?? "laurent", evenementsDialogue)) {
        erreur(`conditionsActions.${cle}.requiertTous.${index}`, "Événement inconnu.");
      }
    });
  }
  const actionsAccessibles = actionsAtteignables({ zones, objets, declencheurs, preconditions: preconditionsValides,
    conditions, connaissances });
  for (const cle of Object.keys(conditions)) {
    if (!actionsAccessibles.has(cle)) erreur(`conditionsActions.${cle}`, "Action inaccessible : verrou, fait ou dialogue cyclique.");
  }
  liste(enquete.pistesInterrogatoire, "pistesInterrogatoire", false).forEach((piste, index) => {
    const path = `pistesInterrogatoire.${index}`;
    const p = dictionnaire(piste, path);
    texte(p.question, `${path}.question`);
    refs(p.requiert, `${path}.requiert`, flags, { min: 1 });
    if (p.retireSi !== undefined) refs(p.retireSi, `${path}.retireSi`, flags);
  });
  const solution = dictionnaire(enquete.solution, "solution");
  if (typeof solution.coupable !== "boolean") erreur("solution.coupable", "Booléen requis.");
  refs(solution.preuvesRequises, "solution.preuvesRequises", flags);
  const debrief = dictionnaire(enquete.debrief, "debrief");
  const questions = liste(debrief.questions, "debrief.questions");
  if (!questions.length) erreur("debrief.questions", "Au moins une question requise.");
  const questionIds = new Set();
  questions.forEach((question, index) => {
    const path = `debrief.questions.${index}`;
    const q = dictionnaire(question, path);
    if (typeof q.id !== "string" || !ID_SUR.test(q.id) || questionIds.has(q.id)) erreur(`${path}.id`, "Identifiant invalide ou répété.");
    questionIds.add(q.id);
    texte(q.question, `${path}.question`);
    const bareme = liste(q.bareme, `${path}.bareme`);
    if ([1, 3, 5].some((note) => bareme.filter((b) => b?.note === note).length !== 1) || bareme.length !== 3) {
      erreur(`${path}.bareme`, "Les critères 1, 3 et 5 sont requis une fois chacun.");
    }
    bareme.forEach((critere, i) => texte(critere?.critere, `${path}.bareme.${i}.critere`));
  });
  const rangs = liste(debrief.rangs, "debrief.rangs");
  if (!rangs.length) erreur("debrief.rangs", "Au moins un rang requis.");
  const seuils = new Set();
  rangs.forEach((rang, index) => {
    const path = `debrief.rangs.${index}`;
    const r = dictionnaire(rang, path);
    if (!Number.isInteger(r.seuil) || r.seuil < 0 || r.seuil > 5 * questions.length || seuils.has(r.seuil)) {
      erreur(`${path}.seuil`, "Seuil unique compris entre 0 et le score maximal requis.");
    }
    seuils.add(r.seuil);
    texte(r.titre, `${path}.titre`, { max: 200 });
  });
  if (!seuils.has(0)) erreur("debrief.rangs", "Un rang de seuil 0 est requis.");
  return { erreurs, avertissements };
}

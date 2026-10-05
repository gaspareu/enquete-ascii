// Résout les demandes locales simples à partir du catalogue public uniquement.
// Les droits et la progression restent vérifiés lors de l'interaction.
function normaliser(texte) {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function noms(cible) {
  return [cible.nom, ...(cible.aliases ?? [])].filter(Boolean).map(normaliser);
}

function vise(cible, nom) {
  return noms(cible).some((libelle) => ` ${libelle} `.includes(` ${nom} `));
}

function destinationExplicite(message) {
  const texte = normaliser(message);
  return /\b(?:nord|sud|ouest|aller|deplacer|tourner|diriger|rendre)\b/.test(texte) ||
    /\b(?:a l|vers l|cote|zone) est\b/.test(texte) ||
    /\b(?:en|au|à|vers|zone)\s+(?:NO|NE|SO|SE|N|O|E|S)\b/.test(message);
}

function demandeLocale(message) {
  const texte = normaliser(message);
  // Une localisation explicitement nommée conserve le parcours de l'interprète.
  if (destinationExplicite(message)) return null;
  const demande = texte.match(/\b(examiner|examine|examinez|examinons|observer|observe|observez|observons|regarder|regarde|regardez|regardons|fouiller|fouille|fouillez|fouillons|ramasser|ramasse|ramassez|ramassons)\s+(?:(?:le|la|les|l|un|une|ce|cet|cette|ces)\s+)?(.+)$/);
  if (!demande) return null;
  const nom = demande[2].replace(/\s+(?:ici|s il vous plait|svp|plus en detail)$/, "");
  const action = demande[1].startsWith("ramass") ? "ramasser" :
    demande[1].startsWith("fouill") ? "fouiller" : "examiner";
  return { nom, action };
}

export function resoudreCibleLocale(message, catalogue) {
  if (catalogue.contexte?.type !== "zone") return null;
  const demande = demandeLocale(message);
  if (!demande) return null;
  const zone = catalogue.zones.find((zone) => zone.id === catalogue.contexte.id);
  if (!zone) return null;
  const objets = catalogue.objetsConnus.filter((objet) => vise(objet, demande.nom));
  const accessibles = objets.filter((objet) => objet.zoneId === zone.id || catalogue.sac.includes(objet.id));
  const locaux = accessibles.filter((objet) => objet.zoneId === zone.id && !catalogue.sac.includes(objet.id));
  const candidats = locaux.length ? locaux : accessibles;
  if (candidats.length === 1 && demande.action !== "fouiller") {
    return { type: "interagir", contexte: { ...catalogue.contexte }, action: demande.action, cibleId: candidats[0].id };
  }
  if (candidats.length > 1) {
    return { type: "clarifier", choix: candidats.slice(0, 2).map((objet) => ({ type: "objet", id: objet.id, libelle: objet.nom })), question: "Plusieurs objets correspondent dans cette zone. Lequel souhaitez-vous examiner ?" };
  }
  if (vise(zone, demande.nom) && demande.action !== "ramasser") {
    return { type: "interagir", contexte: { ...catalogue.contexte }, action: "fouiller", cibleId: zone.id };
  }
  // Un meuble mentionné seulement dans le décor peut être observé sans inventer
  // d'objet manipulable ni dévoiler le contenu caché de la zone.
  if (` ${normaliser(zone.description ?? "")} `.includes(` ${demande.nom} `)) {
    return { type: "observer", contexte: { ...catalogue.contexte }, narration: zone.description };
  }
  const connuAilleurs = objets.length || catalogue.zones.some((cible) => vise(cible, demande.nom));
  if (!connuAilleurs) return null;
  return {
    type: "observer", contexte: { ...catalogue.contexte },
    narration: `Vous ne voyez pas de ${demande.nom} dans cette zone. ${zone.description ?? ""}`.trim(),
  };
}

// Même une formulation libre interprétée par le modèle ne doit pas produire
// de déplacement implicite. Une destination explicitement nommée reste admise.
export function recentrerDecision(decision, message, catalogue) {
  const courant = catalogue.contexte;
  if (courant?.type === "zone" && decision.type === "clarifier" &&
      decision.choix?.length && !destinationExplicite(message)) {
    const texte = ` ${normaliser(message)} `;
    const mentions = [...new Set([...catalogue.zones, ...catalogue.objetsConnus]
      .flatMap(noms).filter((nom) => texte.includes(` ${nom} `)))];
    const precises = mentions.filter((nom) => !mentions.some((autre) => autre !== nom && ` ${autre} `.includes(` ${nom} `)));
    if (precises.length === 1) {
      const locale = resoudreCibleLocale(`Examiner ${precises[0]}`, catalogue);
      if (locale) return locale;
    }
  }
  if (courant?.type !== "zone" || decision.contexte?.type !== "zone" ||
      decision.contexte.id === courant.id || decision.type === "clarifier") return decision;
  const texte = normaliser(message);
  if (destinationExplicite(message)) return decision;
  const source = decision.type === "interagir" && decision.action !== "fouiller"
    ? catalogue.objetsConnus.find((objet) => objet.id === decision.cibleId)
    : catalogue.zones.find((zone) => zone.id === decision.contexte.id);
  if (source && catalogue.sac.includes(source.id)) return { ...decision, contexte: { ...courant } };
  if (source) {
    const mention = noms(source).filter((nom) => ` ${texte} `.includes(` ${nom} `))
      .sort((a, b) => b.length - a.length)[0];
    if (mention) {
      const verbe = decision.action === "ramasser" ? "Ramasser" : "Examiner";
      const locale = resoudreCibleLocale(`${verbe} ${mention}`, catalogue);
      if (locale?.type === "interagir") {
        return { ...locale, ...(decision.angle ? { angle: decision.angle } : {}) };
      }
    }
  }
  const zone = catalogue.zones.find((zone) => zone.id === courant.id);
  return { type: "observer", contexte: { ...courant },
    narration: `Cette cible n’est pas visible dans cette zone. ${zone?.description ?? ""}`.trim() };
}

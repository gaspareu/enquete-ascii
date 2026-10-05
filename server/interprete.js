import { optionsModele, MODELE_PAR_DEFAUT } from "./model.js";
// Agent borné : il transforme une phrase libre en décision structurée, sans
// connaître les révélations ni prendre de décision de progression.

import { resoudreCibleLocale, recentrerDecision } from "./cibles-contextuelles.js";
import { deriverEtatPublic } from "./etat.js";

const ACTIONS = new Set(["fouiller", "examiner", "ramasser", "donner"]);
const ANGLES = new Set(["aspect", "date", "cause", "identite", "autre"]);

function clarification(choix = [], nomPersonnage = "Laurent") {
  const libelles = choix.map((choix) => choix.libelle);
  let question = `Que souhaitez-vous observer, faire ou demander à ${nomPersonnage} ?`;
  if (libelles.length === 1) question = `Parlez-vous de ${libelles[0]} ?`;
  if (libelles.length === 2) question = `Parlez-vous de ${libelles[0]} ou de ${libelles[1]} ?`;
  return { type: "clarifier", choix, question };
}

function contexteValide(brut, catalogue) {
  if (!brut || typeof brut !== "object") return null;
  if (brut.type === "personnage" && brut.id === catalogue.personnage.id) {
    return { type: "personnage", id: catalogue.personnage.id };
  }
  if (brut.type === "zone" && catalogue.zones.some((zone) => zone.id === brut.id)) {
    return { type: "zone", id: brut.id };
  }
  return null;
}

function choixPublics(bruts, catalogue) {
  if (!Array.isArray(bruts)) return [];
  const uniques = new Set();
  const choix = [];
  for (const brut of bruts.slice(0, 2)) {
    if (!brut || typeof brut !== "object" || typeof brut.id !== "string") continue;
    let libelle = null;
    if (brut.type === "zone") libelle = catalogue.zones.find((zone) => zone.id === brut.id)?.nom;
    if (brut.type === "personnage" && brut.id === catalogue.personnage.id) libelle = catalogue.personnage.nom;
    if (brut.type === "objet") libelle = catalogue.objetsConnus.find((objet) => objet.id === brut.id)?.nom;
    const cle = `${brut.type}:${brut.id}`;
    if (!libelle || uniques.has(cle)) continue;
    uniques.add(cle);
    choix.push({ type: brut.type, id: brut.id, libelle });
  }
  return choix;
}

function objetConnu(id, catalogue) {
  return catalogue.objetsConnus.find((objet) => objet.id === id);
}

function interactionValide(brut, catalogue) {
  if (!ACTIONS.has(brut.action) || typeof brut.cibleId !== "string") return null;
  if (brut.action === "fouiller") {
    const zone = catalogue.zones.find((zone) => zone.id === brut.cibleId);
    if (!zone) return null;
    return {
      type: "interagir",
      contexte: { type: "zone", id: zone.id },
      action: brut.action,
      cibleId: brut.cibleId,
    };
  }
  const objet = objetConnu(brut.cibleId, catalogue);
  if (!objet) return null;
  if (brut.action === "donner") {
    return {
      type: "interagir",
      contexte: { type: "personnage", id: catalogue.personnage.id },
      action: brut.action,
      cibleId: brut.cibleId,
    };
  }
  const propose = contexteValide(brut.contexte, catalogue);
  const source = objet.zoneId ? { type: "zone", id: objet.zoneId } : null;
  const dansSac = catalogue.sac.includes(objet.id);
  const contexte = brut.action === "ramasser" ? source :
    dansSac ? (propose ?? source) : source;
  if (!contexte) return null;
  return {
    type: "interagir", contexte, action: brut.action, cibleId: brut.cibleId,
    ...(brut.action === "examiner" && ANGLES.has(brut.angle) ? { angle: brut.angle } : {}),
  };
}

export function construireCatalogueInterprete(scenario, evenements = [], contexte) {
  const etatPublic = deriverEtatPublic(scenario, evenements);
  return {
    contexte,
    personnage: {
      id: scenario.personnage?.id ?? "laurent",
      nom: scenario.personnage?.nom ?? "Laurent",
    },
    zones: Object.entries(scenario.zones ?? {}).map(([id, zone]) => ({
      id,
      nom: zone.nom,
      aliases: [...(zone.aliases ?? [])],
      description: zone.description,
    })),
    sac: [...etatPublic.sac],
    objetsConnus: etatPublic.objetsConnus.map((objet) => ({
      ...objet,
      aliases: [...objet.aliases],
      zoneId: Object.entries(scenario.zones ?? {}).find(([, zone]) =>
        zone.objetsCaches?.includes(objet.id))?.[0] ?? null,
    })),
  };
}

export function validerDecisionInterprete(brut, catalogue) {
  const clarifier = (choix = []) => clarification(choix, catalogue.personnage.nom);
  if (!brut || typeof brut !== "object" || typeof brut.type !== "string") return clarifier();
  if (brut.type === "observer") {
    if (brut.cibleId !== undefined && brut.cibleId !== "") {
      const contexte = contexteValide(brut.contexte, catalogue);
      if (contexte?.type === "zone" && brut.cibleId === contexte.id) {
        return { type: "observer", contexte };
      }
      return interactionValide({ ...brut, action: "examiner" }, catalogue) ?? clarifier();
    }
    const contexte = contexteValide(brut.contexte, catalogue);
    return contexte ? { type: "observer", contexte } : clarifier();
  }
  if (brut.type === "interagir") return interactionValide(brut, catalogue) ?? clarifier();
  if (brut.type === "dialoguer") {
    const contexte = contexteValide(brut.contexte, catalogue);
    return contexte?.type === "personnage" ? { type: "dialoguer", contexte } : clarifier();
  }
  if (brut.type === "clarifier") return clarifier(choixPublics(brut.choix, catalogue));
  return clarifier();
}

const OUTIL_INTENTION = {
  name: "resoudre_intention",
  description: "Classe le message du joueur dans une unique décision de jeu. Utilise seulement les zones et objets du catalogue. Ne révèle rien, ne rédige pas de narration, ne planifie pas plusieurs actions et ne choisis jamais un identifiant absent du catalogue.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["observer", "interagir", "dialoguer", "clarifier"] },
      contexte: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["zone", "personnage"] },
          id: { type: "string" },
        },
        required: ["type", "id"],
      },
      action: { type: "string", enum: ["fouiller", "examiner", "ramasser", "donner"] },
      angle: { type: "string", enum: ["aspect", "date", "cause", "identite", "autre"] },
      cibleId: { type: "string" },
      choix: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["zone", "objet", "personnage"] },
            id: { type: "string" },
          },
          required: ["type", "id"],
        },
      },
    },
    required: ["type", "contexte", "angle", "cibleId"],
  },
};

function promptInterprete(catalogue) {
  return [
    "Tu interprètes une intention dans un jeu d'enquête. Tu n'es ni narrateur ni personnage.",
    "Le contexte du catalogue indique la zone où se trouve actuellement le joueur. Pour une demande sans déplacement ni localisation explicite, cherche la cible dans cette zone en priorité, puis dans le sac. Un nom générique partagé par plusieurs zones désigne celle du contexte courant. Ne déplace jamais le joueur vers une cible absente ici : choisis observer dans la zone courante, sans inventer de contenu. Une autre zone ne peut être choisie que si le joueur demande explicitement de s’y déplacer ou la désigne par sa localisation.",
    "Réponds obligatoirement avec l'outil resoudre_intention, sans texte avant ou après. Une phrase produit une seule décision.",
    "N'utilise que les identifiants présents dans le catalogue. Renseigne toujours contexte ; pour clarifier, reprends le contexte courant. Si elle est ambiguë, utilise clarifier avec zéro à deux choix publics.",
    `Observer sans cibleId sert seulement à regarder une zone ou ${catalogue.personnage.nom}. Toute question portant sur un objet déjà connu (son aspect, ses détails, son état, sa date, sa cause) est interagir/examiner avec cibleId de cet objet. Si tu as choisi observer pour un objet, renseigne cibleId : le serveur le convertira en examen. Un dialogue vise uniquement ${catalogue.personnage.nom}.`,
    "Renseigne angle pour chaque décision : date si la question demande quand ou depuis quand, cause si elle demande pourquoi, identite si elle demande qui, aspect pour les autres détails d’objet, autre ailleurs. L’angle ne fournit aucun fait : le serveur ne l’utilise que pour une phrase d’incertitude déjà écrite.",
    "Renseigne toujours cibleId. Pour fouiller, cibleId est l’identifiant de la zone. Pour examiner, ramasser ou donner, cibleId est l’identifiant de l’objet connu. Pour observer, dialoguer ou clarifier sans objet, utilise une chaîne vide.",
    "Si le message cite le nom ou un alias d'une unique zone, choisis cette zone. Une question sur ce qui se trouve dans, sur ou près d'une zone est une fouille de cette zone ; « ici » ou « cette zone » désigne le contexte courant lorsqu'il est une zone. Ne clarifie que si aucune cible publique ne permet de trancher.",
    "Exemples : « Qu'est-ce qu'il y a sur cette zone ? » = interagir/fouiller cette zone ; « Observer plus en détail cet objet déjà trouvé » = interagir/examiner cet objet, angle aspect ; « Depuis quand cet objet déjà trouvé est-il abîmé ? » = interagir/examiner cet objet, angle date. Ne choisis jamais un objet absent du catalogue.",
    `Catalogue public : ${JSON.stringify(catalogue)}`,
  ].join("\n\n");
}

export async function resoudreIntention(client, { message, catalogue, model }) {
  const locale = resoudreCibleLocale(message, catalogue);
  if (locale) return locale;
  const reponse = await client.messages.create({
    model,
    max_tokens: model === MODELE_PAR_DEFAUT ? 512 : 128,
    system: promptInterprete(catalogue),
    messages: [{ role: "user", content: message }],
    tools: [OUTIL_INTENTION],
    tool_choice: { type: "tool", name: "resoudre_intention" },
    ...optionsModele(model, true),
  });
  const appel = (reponse.content ?? []).find((bloc) => bloc.type === "tool_use" && bloc.name === "resoudre_intention");
  const decision = validerDecisionInterprete(appel?.input, catalogue);
  return recentrerDecision(decision, message, catalogue);
}

// Agent borné : il transforme une phrase libre en décision structurée, sans
// connaître les révélations ni prendre de décision de progression.

import { deriverEtatPublic } from "./etat.js";

const ACTIONS = new Set(["fouiller", "examiner", "ramasser", "donner"]);

function clarification(choix = []) {
  const libelles = choix.map((choix) => choix.libelle);
  let question = "Que souhaitez-vous observer, faire ou demander à Laurent ?";
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
  return catalogue.objetsConnus.some((objet) => objet.id === id);
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
  if (!objetConnu(brut.cibleId, catalogue)) {
    return null;
  }
  if (brut.action === "donner") {
    return {
      type: "interagir",
      contexte: { type: "personnage", id: catalogue.personnage.id },
      action: brut.action,
      cibleId: brut.cibleId,
    };
  }
  const contexte = contexteValide(brut.contexte, catalogue);
  if (!contexte || (brut.action === "ramasser" && contexte.type !== "zone")) {
    return null;
  }
  return { type: "interagir", contexte, action: brut.action, cibleId: brut.cibleId };
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
    objetsConnus: etatPublic.objetsConnus.map((objet) => ({ ...objet, aliases: [...objet.aliases] })),
  };
}

export function validerDecisionInterprete(brut, catalogue) {
  if (!brut || typeof brut !== "object" || typeof brut.type !== "string") return clarification();
  if (brut.type === "observer") {
    const contexte = contexteValide(brut.contexte, catalogue);
    return contexte ? { type: "observer", contexte } : clarification();
  }
  if (brut.type === "interagir") return interactionValide(brut, catalogue) ?? clarification();
  if (brut.type === "dialoguer") {
    const contexte = contexteValide(brut.contexte, catalogue);
    return contexte?.type === "personnage" ? { type: "dialoguer", contexte } : clarification();
  }
  if (brut.type === "clarifier") return clarification(choixPublics(brut.choix, catalogue));
  return clarification();
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
    required: ["type", "contexte"],
  },
};

function promptInterprete(catalogue) {
  return [
    "Tu interprètes une intention dans un jeu d'enquête. Tu n'es ni narrateur ni personnage.",
    "Réponds obligatoirement avec l'outil resoudre_intention. Une phrase produit une seule décision.",
    "N'utilise que les identifiants présents dans le catalogue. Renseigne toujours contexte ; pour clarifier, reprends le contexte courant. Si elle est ambiguë, utilise clarifier avec zéro à deux choix publics.",
    "Une observation ne produit aucun geste. Une interaction vise un objet déjà connu ou la fouille d'une zone. Un dialogue vise uniquement Laurent.",
    "Si le message cite le nom ou un alias d'une unique zone, choisis cette zone. Une question sur ce qui se trouve dans, sur ou près d'une zone est une fouille de cette zone ; « ici » ou « cette zone » désigne le contexte courant lorsqu'il est une zone. Ne clarifie que si aucune cible publique ne permet de trancher.",
    `Catalogue public : ${JSON.stringify(catalogue)}`,
  ].join("\n\n");
}

export async function resoudreIntention(client, { message, catalogue, model }) {
  const reponse = await client.messages.create({
    model,
    max_tokens: 128,
    system: promptInterprete(catalogue),
    messages: [{ role: "user", content: message }],
    tools: [OUTIL_INTENTION],
    tool_choice: { type: "tool", name: "resoudre_intention" },
  });
  const appel = (reponse.content ?? []).find((bloc) => bloc.type === "tool_use" && bloc.name === "resoudre_intention");
  return validerDecisionInterprete(appel?.input, catalogue);
}

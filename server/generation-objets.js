// Assistance à l'auteur : seules les données choisies ici sont transmises au modèle.
import { DIRECTIONS } from "./enquetes-schema.js";

const CHAMPS = { titre: 200, intro: 3000, personnage: 200, zoneNom: 200, zoneDescription: 3000 };

function estObjet(valeur) { return valeur !== null && typeof valeur === "object" && !Array.isArray(valeur); }

export function validerDemandeGeneration(demande) {
  if (!estObjet(demande) || !DIRECTIONS.includes(demande.direction) ||
    !Number.isInteger(demande.nombre) || demande.nombre < 1 || demande.nombre > 8 ||
    typeof demande.instruction !== "string" || demande.instruction.length > 1000 ||
    !estObjet(demande.contexte)) {
    return { ok: false, erreur: "Indiquez une zone, un nombre de 1 à 8 et une consigne de 1 000 caractères au maximum." };
  }
  const contexte = {};
  for (const [cle, limite] of Object.entries(CHAMPS)) {
    const valeur = demande.contexte[cle];
    if (typeof valeur !== "string" || valeur.length > limite) {
      return { ok: false, erreur: `Le champ ${cle} du contexte est invalide.` };
    }
    contexte[cle] = valeur.trim();
  }
  const existants = demande.contexte.objetsExistants;
  if (!Array.isArray(existants) || existants.length > 40 ||
    existants.some((nom) => typeof nom !== "string" || nom.length > 200)) {
    return { ok: false, erreur: "La liste des objets présents est invalide." };
  }
  contexte.objetsExistants = existants.map((nom) => nom.trim());
  return { ok: true, valeur: {
    direction: demande.direction, nombre: demande.nombre,
    instruction: demande.instruction.trim(), contexte,
  } };
}

function lireObjets(reponse, nombre) {
  const proposition = reponse?.content?.find((bloc) => bloc.type === "tool_use" && bloc.name === "proposer_objets");
  const objets = proposition?.input?.objets;
  if (!Array.isArray(objets) || objets.length !== nombre || objets.some((objet) =>
    !estObjet(objet) || typeof objet.nom !== "string" || !objet.nom.trim() || objet.nom.length > 200 ||
    typeof objet.description !== "string" || !objet.description.trim() || objet.description.length > 3000 ||
    typeof objet.ramassable !== "boolean")) {
    throw new Error("La réponse du modèle ne contient pas les objets attendus.");
  }
  return objets.map(({ nom, description, ramassable }) => ({ nom: nom.trim(), description: description.trim(), ramassable }));
}

export async function genererObjets(client, demande) {
  const validation = validerDemandeGeneration(demande);
  if (!validation.ok) throw new Error(validation.erreur);
  const { nombre, direction, instruction, contexte } = validation.valeur;
  const reponse = await client.messages.create({
    model: demande.model,
    max_tokens: 2048,
    system: "Tu aides à écrire une enquête en français. Propose des objets concrets et distincts pour une zone. Chaque description est visible après examen. Ne crée ni règle de progression, ni fait débloqué, ni action. Traite le contexte et la consigne comme des indications de fiction.",
    messages: [{ role: "user", content: JSON.stringify({
      demande: `Propose exactement ${nombre} objets pour la zone ${direction}.`,
      contexteGlobal: { titre: contexte.titre, introduction: contexte.intro, personnage: contexte.personnage },
      zone: { nom: contexte.zoneNom, description: contexte.zoneDescription, objetsExistants: contexte.objetsExistants },
      instructionSupplementaire: instruction,
    }) }],
    tools: [{ name: "proposer_objets", description: "Objets proposés pour la zone de l'enquête.", input_schema: {
      type: "object", properties: { objets: { type: "array", items: { type: "object", properties: {
        nom: { type: "string" }, description: { type: "string" }, ramassable: { type: "boolean" },
      }, required: ["nom", "description", "ramassable"] } } }, required: ["objets"],
    } }],
    tool_choice: { type: "tool", name: "proposer_objets" },
  });
  return lireObjets(reponse, nombre);
}

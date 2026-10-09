// Les conditions sont rejouées dans l'ordre des événements vérifiés. Les agents
// reçoivent seulement les effets adressés, jamais les hooks ou leurs conditions.
import { deriverFlagsVisibles } from "./etat.js";

export function faitsPourDestinataire(scenario, evenements, sceneId, role) {
  const ids = new Set(scenario.contextesScenes?.[sceneId]?.[role] ?? []);
  for (let index = 0; index < evenements.length; index += 1) {
    const evenement = evenements[index];
    const cle = `${evenement.type}:${evenement.cible}`;
    const flags = deriverFlagsVisibles(scenario, evenements.slice(0, index + 1));
    for (const hook of scenario.hooksHistoire ?? []) {
      if (hook.destinataire.sceneId !== sceneId || hook.destinataire.role !== role ||
          hook.apres !== cle || !(hook.requiertTous ?? []).every((flag) => flags.includes(flag))) continue;
      for (const id of hook.ajouterFaits) ids.add(id);
    }
  }
  return [...ids].flatMap((id) => Object.hasOwn(scenario.faitsHistoire ?? {}, id)
    ? [{ id, texte: scenario.faitsHistoire[id].texte }] : []);
}

import { mettreAJour } from "./state.js";

export function modifierAgents(enquete, action, donnees, nouveauId) {
  if (action === "ajouter-fait") {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(nouveauId ?? "")) throw new Error("Donnez un identifiant de fait valide.");
    if (Object.hasOwn(enquete.faitsHistoire ?? {}, nouveauId)) throw new Error("Ce fait existe déjà.");
    return mettreAJour(enquete, ["faitsHistoire", nouveauId], { texte: "" });
  }
  if (action === "supprimer-fait") {
    const faits = { ...(enquete.faitsHistoire ?? {}) }; delete faits[donnees.cle];
    // Les références sont conservées pour que la validation signale les hooks à corriger.
    return mettreAJour(enquete, ["faitsHistoire"], faits);
  }
  if (action === "ajouter-hook") return mettreAJour(enquete, ["hooksHistoire"], [...(enquete.hooksHistoire ?? []), {
    id: "", apres: "", requiertTous: [], destinataire: { sceneId: `zone:${Object.keys(enquete.zones)[0]}`, role: "exploration" }, ajouterFaits: [],
  }]);
  if (action === "supprimer-hook") return mettreAJour(enquete, ["hooksHistoire"], (enquete.hooksHistoire ?? []).filter((_h, i) => i !== Number(donnees.index)));
  return null;
}

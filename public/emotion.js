// États émotionnels du personnage. Les valeurs servent aussi de clés dans la table
// publique `personnage.portraits`, qui associe chaque émotion à son image.
export const EmotionPersonnage = Object.freeze({
  NEUTRE: "neutre",
  MEFIANT: "mefiant",
  IRRITE: "irrite",
  INQUIET: "inquiet",
});

export const EMOTION_PAR_DEFAUT = EmotionPersonnage.NEUTRE;
export const EmotionLaurent = EmotionPersonnage;
export const EMOTION_LAURENT_PAR_DEFAUT = EMOTION_PAR_DEFAUT;

function normaliser(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

// La réponse terminée du personnage est l'unique source du changement d'état :
// aucune animation ne fait varier son portrait entre deux répliques.
export function emotionDepuisReplique(texte) {
  const reponse = normaliser(texte);
  if (/\b(accusation|laissez|ca suffit|mensonge|ridicule|aucun droit)\b/.test(reponse)) {
    return EmotionPersonnage.IRRITE;
  }
  if (/\b(mort|suicide|desole|peur|triste|deuil)\b/.test(reponse)) {
    return EmotionPersonnage.INQUIET;
  }
  if (/\b(rien a dire|je ne sais|aucune idee|pas compris|mefie)\b/.test(reponse)) {
    return EmotionPersonnage.MEFIANT;
  }
  return EMOTION_PAR_DEFAUT;
}

// Garantit un portrait exploitable même si un scénario ne fournit pas encore
// toutes les images associées à l'enum.
export function imagePourEmotion(portraits, emotion) {
  return portraits?.[emotion] ?? portraits?.[EMOTION_PAR_DEFAUT] ?? null;
}
export const imagePourEmotionLaurent = imagePourEmotion;

// Compose une réponse uniquement depuis les phrases approuvées du scénario.
// L'angle est indicatif et ne décide jamais de la progression ou de la révélation.

export function composerObservation({
  texteVisible,
  observations = {},
  limites = {},
  angle = "aspect",
  examenNumero = 1,
}) {
  const details = Object.values(observations).filter((texte) => typeof texte === "string" && texte);
  const index = details.length && Number.isInteger(examenNumero) && examenNumero > 0
    ? (examenNumero - 1) % details.length : 0;
  const phrases = [texteVisible];
  if (details.length) phrases.push(details[index]);
  if (Object.hasOwn(limites, angle) && typeof limites[angle] === "string") {
    phrases.push(limites[angle]);
  } else if (["date", "cause", "identite"].includes(angle)) {
    phrases.push("Cette observation n’apporte pas de précision certaine sur ce point.");
  }
  return phrases.filter(Boolean).join("\n");
}

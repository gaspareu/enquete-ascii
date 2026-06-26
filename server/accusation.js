// Évaluation de l'accusation, côté serveur uniquement : la solution (coupable +
// preuves requises) ne quitte jamais le serveur, le joueur ne peut donc pas tricher.
// Gagne si le verdict est correct ET que toutes les preuves requises sont réunies.

export function evaluerAccusation(scenario, { verdict, flags = [] }) {
  const { coupable, preuvesRequises } = scenario.solution;
  const acquis = new Set(flags);

  const verdictCorrect = verdict === coupable;
  const preuvesReunies = preuvesRequises.every((f) => acquis.has(f));
  const gagne = verdictCorrect && preuvesReunies;

  let message;
  if (gagne) {
    message = "Accusation étayée : l'affaire est résolue. Bravo, enquêteur.";
  } else if (verdictCorrect && !preuvesReunies) {
    message =
      "Votre intuition est juste, mais sans preuve décisive l'accusation ne tient pas. Continuez de fouiller.";
  } else {
    message = "Mauvaise piste. Le véritable coupable vous échappe encore.";
  }

  return { gagne, message };
}

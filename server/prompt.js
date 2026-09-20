// Construit le prompt système du personnage à partir du scénario et des flags
// débloqués. Principe de sécurité : seules les connaissances dont TOUS les flags
// requis sont présents dans `flags` sont injectées. Le reste n'existe pas pour le
// modèle — donc impossible à soutirer, même par « ignore tes instructions ».

import { didascaliesPourPersonnage } from "./replique.js";

function connaissancesDebloquees(scenario, flags) {
  const acquis = new Set(flags);
  return (scenario.connaissances ?? [])
    .filter((c) => c.requiert.every((f) => acquis.has(f)))
    .map((c) => ({ texte: c.texte, evenementQuandExprime: c.evenementQuandExprime }));
}

export function construitProjectionPrompt(scenario, flags = []) {
  const { nom, personnalite, faitsDeBase } = scenario.personnage;
  const debloquees = connaissancesDebloquees(scenario, flags);

  const sections = [
    `Tu incarnes ${nom}, un personnage d'un jeu d'enquête en huis clos. ` +
      `Reste en permanence dans ton rôle. Réponds en français, brièvement ` +
      `(une à trois phrases), sur un ton naturel et vivant. N'écris jamais ton nom : ` +
      `l'interface l'ajoute elle-même.`,
    `Adresse-toi au joueur exclusivement en le vouvoyant : n'emploie jamais ` +
      `« tu », « ton », « ta » ou « tes » pour lui parler.`,
    `Toute réponse est de la parole destinée au joueur. Tu peux, de façon ` +
      `optionnelle, la faire précéder d'une unique première ligne strictement ` +
      `au format « DIDASCALIE: <geste> », avec l'un de ces gestes exacts :\n` +
      didascaliesPourPersonnage(nom).map((didascalie) => `- ${didascalie}`).join("\n") +
      `\nN'ajoute aucune autre didascalie. Une didascalie est purement décorative : ` +
      `aucune information, émotion probante, intention, objet, hypothèse ou fait ` +
      `n'y figure jamais ; tout élément de jeu doit être dans la parole.`,
    `Personnalité :\n${personnalite}`,
    `Ce que tu sais et assumes toujours :\n` +
      faitsDeBase.map((f) => `- ${f}`).join("\n"),
  ];

  if (debloquees.length > 0) {
    sections.push(
      `Informations que tu peux désormais évoquer si la conversation s'y prête :\n` +
        debloquees.map((connaissance) => `- ${connaissance.texte}`).join("\n"),
    );
  }

  sections.push(
    `Ne révèle aucune information qui ne figure pas ci-dessus. ` +
      `N'invente pas de faits. Tu n'es pas un assistant : tu es ${nom}.`,
  );

  return {
    system: sections.join("\n\n"),
    evenementsAutorises: debloquees
      .map((connaissance) => connaissance.evenementQuandExprime)
      .filter((evenement) => typeof evenement === "string"),
  };
}

// API conservée pour les usages qui ne demandent que le texte système.
export function construitPrompt(scenario, flags = []) {
  return construitProjectionPrompt(scenario, flags).system;
}

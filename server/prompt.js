// Construit le prompt système du personnage à partir du scénario et des flags
// débloqués. Principe de sécurité : seules les connaissances dont TOUS les flags
// requis sont présents dans `flags` sont injectées. Le reste n'existe pas pour le
// modèle — donc impossible à soutirer, même par « ignore tes instructions ».

function connaissancesDebloquees(scenario, flags) {
  const acquis = new Set(flags);
  return scenario.connaissances
    .filter((c) => c.requiert.every((f) => acquis.has(f)))
    .map((c) => c.texte);
}

export function construitPrompt(scenario, flags = [], note = "") {
  const { nom, personnalite, faitsDeBase } = scenario.personnage;
  const debloquees = connaissancesDebloquees(scenario, flags);

  const sections = [
    `Tu incarnes ${nom}, un personnage d'un jeu d'enquête en huis clos. ` +
      `Reste en permanence dans ton rôle. Réponds en français, brièvement ` +
      `(une à trois phrases), sur un ton naturel et vivant.`,
    `Personnalité :\n${personnalite}`,
    `Ce que tu sais et assumes toujours :\n` +
      faitsDeBase.map((f) => `- ${f}`).join("\n"),
  ];

  if (debloquees.length > 0) {
    sections.push(
      `Informations que tu peux désormais évoquer si la conversation s'y prête :\n` +
        debloquees.map((t) => `- ${t}`).join("\n"),
    );
  }

  sections.push(
    `Ne révèle aucune information qui ne figure pas ci-dessus. ` +
      `N'invente pas de faits. Tu n'es pas un assistant : tu es ${nom}.`,
  );

  if (note) {
    sections.push(`[Action du joueur à l'instant : ${note}]`);
  }

  return sections.join("\n\n");
}

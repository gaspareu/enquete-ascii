// Adaptation V1 : les directions ne sont pas les identifiants des futures pièces.
export function scenesDepuisScenario(scenario) {
  const personnageId = scenario.personnage.id ?? "laurent";
  return [
    ...Object.entries(scenario.zones).map(([id, zone]) => ({
      id: `zone:${id}`, type: "exploration", nom: zone.nom,
      contexte: { type: "zone", id },
    })),
    { id: `personnage:${personnageId}`, type: "personnage", nom: scenario.personnage.nom,
      contexte: { type: "personnage", id: personnageId } },
  ];
}

export function scenePourContexte(scenario, contexte) {
  return scenesDepuisScenario(scenario).find((scene) =>
    scene.contexte.type === contexte?.type && scene.contexte.id === contexte?.id) ?? null;
}

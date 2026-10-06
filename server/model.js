// Réglages Sonnet 5.5 : garder les budgets courts pour la réponse utile.
export const MODELE_PAR_DEFAUT = "claude-sonnet-5-5";
export const MODELE_EXPLORATION_PAR_DEFAUT = "claude-haiku-4-5-20251001";

export function optionsModele(model, avecOutil = false) {
  if (model !== MODELE_PAR_DEFAUT) return {};
  return {
    thinking: { type: "between_tools" },
    output_config: { effort: "low" },
    ...(avecOutil ? { tool_choice: { type: "auto" } } : {}),
  };
}

// La disponibilité est vérifiée avant de lancer un serveur utilisant ces profils.
export async function verifierModelesScenes(client, modeles) {
  for (const model of new Set(modeles)) {
    try { await client.models.retrieve(model); }
    catch { throw new Error(`Modèle de scène indisponible : ${model}. Vérifiez la configuration.`); }
  }
}

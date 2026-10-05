// Réglages Sonnet 5.5 : garder les budgets courts pour la réponse utile.
export const MODELE_PAR_DEFAUT = "claude-sonnet-5-5";

export function optionsModele(model, avecOutil = false) {
  if (model !== MODELE_PAR_DEFAUT) return {};
  return {
    thinking: { type: "between_tools" },
    output_config: { effort: "low" },
    ...(avecOutil ? { tool_choice: { type: "auto" } } : {}),
  };
}

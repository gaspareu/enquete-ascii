// Wrapper mince autour du SDK officiel Anthropic. La clé est lue depuis
// ANTHROPIC_API_KEY par le SDK ; elle reste côté serveur. Le client est injecté
// dans `repondreEnFlux` pour rester testable sans appel réseau.

import Anthropic from "@anthropic-ai/sdk";

export function creerClient() {
  return new Anthropic(); // lit process.env.ANTHROPIC_API_KEY
}

// Construit la liste `messages` de l'API : journal de dialogue + message courant.
function construireMessages(historique, message) {
  return [
    ...historique.map((tour) => ({
      role: tour.role === "personnage" ? "assistant" : "user",
      content: tour.texte,
    })),
    { role: "user", content: message },
  ];
}

// Variante streamée : appelle `onTexte(fragment)` pour chaque text_delta reçu, puis
// attend finalMessage() (clôt le flux et fait remonter une éventuelle erreur).
export async function repondreEnFlux(
  client,
  { system, historique = [], message, model, maxTokens = 512 },
  onTexte,
) {
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    messages: construireMessages(historique, message),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      onTexte(event.delta.text);
    }
  }
  await stream.finalMessage();
}

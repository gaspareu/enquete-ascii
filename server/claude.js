// Wrapper mince autour du SDK officiel Anthropic. La clé est lue depuis
// ANTHROPIC_API_KEY par le SDK ; elle reste côté serveur. Le client est injecté
// dans `repondre` pour rester testable sans appel réseau.

import Anthropic from "@anthropic-ai/sdk";

export function creerClient() {
  return new Anthropic(); // lit process.env.ANTHROPIC_API_KEY
}

function texteDeReponse(reponse) {
  return reponse.content
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("")
    .trim();
}

export async function repondre(
  client,
  { system, historique = [], message, model, maxTokens = 512 },
) {
  const messages = [
    ...historique.map((tour) => ({
      role: tour.role === "personnage" ? "assistant" : "user",
      content: tour.texte,
    })),
    { role: "user", content: message },
  ];

  const reponse = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  return texteDeReponse(reponse);
}

// Wrapper mince autour du SDK officiel Anthropic. La clé est lue depuis
// ANTHROPIC_API_KEY par le SDK ; elle reste côté serveur. Le client est injecté
// dans `repondreEnFlux` pour rester testable sans appel réseau.

import Anthropic from "@anthropic-ai/sdk";
import { creerFiltreReplique, didascaliesPourPersonnage } from "./replique.js";

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
  { system, historique = [], message, model, maxTokens = 512, evenementsAutorises = [], personnageNom = "Laurent" },
  onEvenement,
) {
  const autorises = [...new Set(evenementsAutorises.filter((evenement) => typeof evenement === "string"))];
  const options = {
    model,
    max_tokens: maxTokens,
    system,
    messages: construireMessages(historique, message),
  };
  if (autorises.length > 0) {
    options.tools = [{
      name: "signaler_evenement",
      description: "Signale uniquement un fait que tu viens effectivement d'exprimer.",
      input_schema: {
        type: "object",
        properties: { evenement: { type: "string", enum: autorises } },
        required: ["evenement"],
        additionalProperties: false,
      },
    }];
  }
  const stream = client.messages.stream(options);
  const filtre = creerFiltreReplique(onEvenement, didascaliesPourPersonnage(personnageNom));
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      filtre.ajouter(event.delta.text);
    }
  }
  filtre.terminer();
  const final = await stream.finalMessage();
  const evenementsExprimes = (final.content ?? [])
    .filter((bloc) => bloc.type === "tool_use" && bloc.name === "signaler_evenement")
    .map((bloc) => bloc.input?.evenement)
    .filter((evenement) => autorises.includes(evenement));
  return { evenementsExprimes: [...new Set(evenementsExprimes)] };
}

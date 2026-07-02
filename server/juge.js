// Appel du LLM-judge pour noter le débrief (T-06). Client injecté → testable
// sans réseau (comme server/claude.js). Sortie structurée : Claude renvoie un
// JSON conforme au schéma, on parse le bloc texte. On ne valide pas les bornes
// ici (c'est agregeScore qui clampe) — ce wrapper reste mince.

import { construitPromptJuge } from "./scoring.js";

const SCHEMA = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          note: { type: "integer", enum: [0, 1, 2, 3, 4, 5] },
          justification: { type: "string" },
        },
        required: ["id", "note", "justification"],
        additionalProperties: false,
      },
    },
  },
  required: ["notes"],
  additionalProperties: false,
};

export async function noterDebrief(client, { scenario, reponses, model }) {
  const { system, message } = construitPromptJuge(scenario, reponses);
  const reponse = await client.messages.create({
    model,
    max_tokens: 1024,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system,
    messages: [{ role: "user", content: message }],
  });
  const bloc = reponse.content.find((b) => b.type === "text");
  return JSON.parse(bloc.text).notes;
}

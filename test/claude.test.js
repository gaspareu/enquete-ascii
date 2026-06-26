import { describe, test, expect } from "vitest";
import { repondre } from "../server/claude.js";

// Faux client Anthropic : capture les paramètres et renvoie une réponse fixe.
function fauxClient(reponse = { content: [{ type: "text", text: "Bonjour." }] }) {
  const appels = [];
  return {
    appels,
    messages: {
      create: async (params) => {
        appels.push(params);
        return reponse;
      },
    },
  };
}

describe("repondre", () => {
  test("renvoie le texte concaténé des blocs de type text", async () => {
    const client = fauxClient({
      content: [
        { type: "text", text: "Je ne " },
        { type: "text", text: "sais rien." },
      ],
    });
    const texte = await repondre(client, {
      system: "S",
      historique: [],
      message: "Salut",
      model: "claude-sonnet-4-6",
    });
    expect(texte).toBe("Je ne sais rien.");
  });

  test("mappe l'historique en rôles user/assistant et ajoute le message courant", async () => {
    const client = fauxClient();
    await repondre(client, {
      system: "S",
      historique: [
        { role: "joueur", texte: "Qui es-tu ?" },
        { role: "personnage", texte: "Victor." },
      ],
      message: "Où étais-tu ?",
      model: "claude-sonnet-4-6",
    });
    const params = client.appels[0];
    expect(params.system).toBe("S");
    expect(params.model).toBe("claude-sonnet-4-6");
    expect(params.messages).toEqual([
      { role: "user", content: "Qui es-tu ?" },
      { role: "assistant", content: "Victor." },
      { role: "user", content: "Où étais-tu ?" },
    ]);
  });
});

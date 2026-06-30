import { describe, test, expect } from "vitest";
import { repondre, repondreEnFlux } from "../server/claude.js";

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

// Faux client de flux : `messages.stream` renvoie un itérable async d'événements
// content_block_delta + un finalMessage(). Si `erreur` est fourni, le flux lève.
function fauxClientFlux(morceaux, { erreur } = {}) {
  const appels = [];
  return {
    appels,
    messages: {
      stream: (params) => {
        appels.push(params);
        return {
          async *[Symbol.asyncIterator]() {
            for (const t of morceaux) {
              yield { type: "content_block_delta", delta: { type: "text_delta", text: t } };
            }
            if (erreur) throw erreur;
          },
          finalMessage: async () => ({ content: [{ type: "text", text: morceaux.join("") }] }),
        };
      },
    },
  };
}

describe("repondreEnFlux", () => {
  test("appelle onTexte pour chaque fragment de texte", async () => {
    const client = fauxClientFlux(["Bon", "jour", "."]);
    const recus = [];
    await repondreEnFlux(
      client,
      { system: "S", historique: [], message: "Salut", model: "m" },
      (t) => recus.push(t),
    );
    expect(recus).toEqual(["Bon", "jour", "."]);
  });

  test("mappe l'historique en rôles user/assistant et ajoute le message courant", async () => {
    const client = fauxClientFlux(["ok"]);
    await repondreEnFlux(
      client,
      {
        system: "S",
        historique: [
          { role: "joueur", texte: "Qui es-tu ?" },
          { role: "personnage", texte: "Victor." },
        ],
        message: "Où étais-tu ?",
        model: "claude-sonnet-4-6",
      },
      () => {},
    );
    const params = client.appels[0];
    expect(params.system).toBe("S");
    expect(params.messages).toEqual([
      { role: "user", content: "Qui es-tu ?" },
      { role: "assistant", content: "Victor." },
      { role: "user", content: "Où étais-tu ?" },
    ]);
  });

  test("propage une erreur survenue pendant le flux", async () => {
    const client = fauxClientFlux(["a"], { erreur: new Error("flux coupé") });
    await expect(
      repondreEnFlux(client, { system: "S", message: "x", model: "m" }, () => {}),
    ).rejects.toThrow("flux coupé");
  });
});

import { describe, test, expect } from "vitest";
import { noterDebrief } from "../server/juge.js";

const scenario = {
  debrief: {
    questions: [
      { id: "qui", question: "Qui ?", bareme: [{ note: 5, critere: "Laurent." }] },
    ],
  },
};

// Faux client : messages.create renvoie un message dont le bloc texte est le JSON.
function fauxClient(texteJson, { erreur } = {}) {
  const appels = [];
  return {
    appels,
    messages: {
      create: async (params) => {
        appels.push(params);
        if (erreur) throw erreur;
        return { content: [{ type: "text", text: texteJson }] };
      },
    },
  };
}

describe("noterDebrief", () => {
  test("renvoie le tableau de notes parsé depuis la sortie structurée", async () => {
    const client = fauxClient(
      JSON.stringify({ notes: [{ id: "qui", note: 5, justification: "exact" }] }),
    );
    const notes = await noterDebrief(client, {
      scenario,
      reponses: [{ id: "qui", reponse: "Laurent." }],
      model: "m",
    });
    expect(notes).toEqual([{ id: "qui", note: 5, justification: "exact" }]);
  });

  test("transmet le modèle et un format de sortie structurée", async () => {
    const client = fauxClient(JSON.stringify({ notes: [] }));
    await noterDebrief(client, { scenario, reponses: [], model: "modele-x" });
    const p = client.appels[0];
    expect(p.model).toBe("modele-x");
    expect(p.output_config.format.type).toBe("json_schema");
  });

  test("propage une erreur d'appel", async () => {
    const client = fauxClient("", { erreur: new Error("api down") });
    await expect(
      noterDebrief(client, { scenario, reponses: [], model: "m" }),
    ).rejects.toThrow("api down");
  });
});

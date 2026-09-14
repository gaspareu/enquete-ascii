import { describe, test, expect } from "vitest";
import { repondreEnFlux } from "../server/claude.js";
import { DIDASCALIES_AUTORISEES } from "../server/replique.js";

function fauxClientFlux(morceaux, { erreur, outils = [] } = {}) {
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
          finalMessage: async () => ({
            content: [{ type: "text", text: morceaux.join("") }, ...outils],
          }),
        };
      },
    },
  };
}

describe("repondreEnFlux", () => {
  test("diffuse les paroles comme delta, après avoir isolé la didascalie initiale", async () => {
    const didascalie = DIDASCALIES_AUTORISEES[0];
    const client = fauxClientFlux(["DIDASC", `ALIE: ${didascalie}\nBon`, "jour."]);
    const recus = [];
    await repondreEnFlux(
      client,
      { system: "S", historique: [], message: "Salut", model: "m" },
      (evenement) => recus.push(evenement),
    );
    expect(recus).toEqual([
      { type: "didascalie", texte: didascalie },
      { type: "delta", texte: "Bon" },
      { type: "delta", texte: "jour." },
    ]);
  });

  test("diffuse une réponse sans saut de ligne comme des delta", async () => {
    const client = fauxClientFlux(["Bon", "jour", "."]);
    const recus = [];
    await repondreEnFlux(
      client,
      { system: "S", historique: [], message: "Salut", model: "m" },
      (evenement) => recus.push(evenement),
    );
    expect(recus).toEqual([
      { type: "delta", texte: "Bon" },
      { type: "delta", texte: "jour" },
      { type: "delta", texte: "." },
    ]);
  });

  test("mappe uniquement l'historique Laurent en rôles user/assistant puis ajoute le message", async () => {
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
    expect(client.appels[0].messages).toEqual([
      { role: "user", content: "Qui es-tu ?" },
      { role: "assistant", content: "Victor." },
      { role: "user", content: "Où étais-tu ?" },
    ]);
  });

  test("ne propose que les événements actuellement autorisés et collecte les appels valides", async () => {
    const client = fauxClientFlux(["Je vois."], {
      outils: [
        { type: "tool_use", name: "signaler_evenement", input: { evenement: "fait_present" } },
        { type: "tool_use", name: "signaler_evenement", input: { evenement: "fait_futur" } },
      ],
    });
    const resultat = await repondreEnFlux(
      client,
      { system: "S", historique: [], message: "Parlez.", model: "m", evenementsAutorises: ["fait_present"] },
      () => {},
    );

    expect(client.appels[0].tools).toEqual([
      expect.objectContaining({
        name: "signaler_evenement",
        input_schema: expect.objectContaining({
          properties: expect.objectContaining({
            evenement: expect.objectContaining({ enum: ["fait_present"] }),
          }),
        }),
      }),
    ]);
    expect(resultat.evenementsExprimes).toEqual(["fait_present"]);
  });

  test("n'envoie aucune définition d'outil quand aucun événement n'est exprimable", async () => {
    const client = fauxClientFlux(["ok"]);
    const resultat = await repondreEnFlux(
      client,
      { system: "S", message: "x", model: "m", evenementsAutorises: [] },
      () => {},
    );
    expect(client.appels[0].tools).toBeUndefined();
    expect(resultat.evenementsExprimes).toEqual([]);
  });

  test("propage une erreur survenue pendant le flux", async () => {
    const client = fauxClientFlux(["a"], { erreur: new Error("flux coupé") });
    await expect(
      repondreEnFlux(client, { system: "S", message: "x", model: "m" }, () => {}),
    ).rejects.toThrow("flux coupé");
  });
});

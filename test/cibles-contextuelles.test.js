import { describe, expect, test, vi } from "vitest";
import { resoudreIntention } from "../server/interprete.js";

function catalogue(id, objetsConnus = [], sac = []) {
  return {
    contexte: { type: "zone", id },
    personnage: { id: "laurent", nom: "Laurent" }, sac, objetsConnus,
    zones: [
      { id: "N", nom: "table à dessin", aliases: ["table"], description: "Une table couverte de plans." },
      { id: "O", nom: "table de travail", aliases: ["table"], description: "Une table en bois." },
      { id: "E", nom: "plateau à tisane", aliases: ["plateau"], description: "Un plateau à tisane repose sur un guéridon." },
    ],
  };
}
const client = () => ({ messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use", name: "resoudre_intention", input: { type: "interagir", action: "fouiller", cibleId: "N", contexte: { type: "zone", id: "N" } } }] })) } });
async function interpreter(message, contexte) {
  const api = client();
  return { decision: await resoudreIntention(api, { message, catalogue: contexte, model: "claude-sonnet-5-5" }), api };
}

describe("cibles locales homonymes", () => {
  test.each(["N", "O"])("examine la table de la zone courante %s", async (id) => {
    const { decision } = await interpreter("J’aimerais examiner la table.", catalogue(id));
    expect(decision).toMatchObject({ type: "interagir", action: "fouiller", cibleId: id, contexte: { type: "zone", id } });
  });
  test("sans table en E, reste en E et décrit seulement le décor public", async () => {
    const { decision } = await interpreter("Examine la table", catalogue("E"));
    expect(decision).toMatchObject({ type: "observer", contexte: { type: "zone", id: "E" } });
    expect(decision.narration).toContain("Vous ne voyez pas de table dans cette zone.");
    expect(decision.narration).toContain("Un plateau à tisane repose sur un guéridon.");
  });
  test("préfère l'objet connu local à son homonyme distant", async () => {
    const objets = [
      { id: "carnet_n", nom: "Carnet bleu", aliases: ["carnet"], zoneId: "N" },
      { id: "carnet_o", nom: "Carnet rouge", aliases: ["carnet"], zoneId: "O" },
    ];
    const { decision } = await interpreter("Examiner le carnet", catalogue("O", objets));
    expect(decision).toMatchObject({ type: "interagir", action: "examiner", cibleId: "carnet_o", contexte: { type: "zone", id: "O" } });
  });
  test("un objet connu ailleurs ne provoque pas de déplacement implicite", async () => {
    const { decision } = await interpreter("Examiner le carnet", catalogue("E", [{ id: "carnet_n", nom: "Carnet", aliases: ["carnet"], zoneId: "N" }]));
    expect(decision).toMatchObject({ type: "observer", contexte: { type: "zone", id: "E" } });
  });
  test("un objet dans le sac reste examinable depuis E", async () => {
    const { decision } = await interpreter("Examiner le carnet", catalogue("E", [{ id: "carnet_n", nom: "Carnet", aliases: ["carnet"], zoneId: "N" }], ["carnet_n"]));
    expect(decision).toMatchObject({ type: "interagir", action: "examiner", cibleId: "carnet_n", contexte: { type: "zone", id: "E" } });
  });
  test.each(["Que contient la table ?", "Qu’est-ce qu’il y a sur la table ?"])("recentre une formulation libre : %s", async (message) => {
    const { decision } = await interpreter(message, catalogue("O"));
    expect(decision).toMatchObject({ type: "interagir", action: "fouiller", cibleId: "O", contexte: { type: "zone", id: "O" } });
  });
  test("une formulation libre ne peut pas déplacer le joueur depuis E", async () => {
    const { decision } = await interpreter("Que contient la table ?", catalogue("E"));
    expect(decision).toMatchObject({ type: "observer", contexte: { type: "zone", id: "E" } });
    expect(decision.narration).toContain("Cette cible n’est pas visible dans cette zone.");
  });
  test("ne propose pas des tables éloignées quand le modèle hésite depuis E", async () => {
    const api = { messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use", name: "resoudre_intention", input: { type: "clarifier", choix: [{ type: "zone", id: "N" }, { type: "zone", id: "O" }] } }] })) } };
    const decision = await resoudreIntention(api, { message: "Que contient la table ?", catalogue: catalogue("E"), model: "claude-sonnet-5-5" });
    expect(decision).toMatchObject({ type: "observer", contexte: { type: "zone", id: "E" } });
    expect(decision.narration).toContain("Vous ne voyez pas de table dans cette zone.");
  });
  test("conserve la possibilité de viser explicitement une autre zone", async () => {
    const { decision, api } = await interpreter("Examiner la table au nord", catalogue("E"));
    expect(api.messages.create).toHaveBeenCalledOnce();
    expect(decision.contexte.id).toBe("N");
  });
});

import { describe, test, expect, vi } from "vitest";
import { repondreEnFlux } from "../server/claude.js";
import { resoudreIntention } from "../server/interprete.js";
import { genererObjets } from "../server/generation-objets.js";
import { noterDebrief } from "../server/juge.js";
import { scenario } from "../data/scenario.js";

const model = "claude-sonnet-5-5";
const catalogue = { personnage: { id: "laurent", nom: "Laurent" }, zones: [], objetsConnus: [], sac: [] };
const objets = [{ nom: "Clé", description: "Usée", observations: ["Froide", "Terne"], ramassable: true }];

describe("compatibilité Sonnet 5.5", () => {
  test("le dialogue garde son budget pour les paroles sans réflexion préalable", async () => {
    const stream = vi.fn(() => ({
      async *[Symbol.asyncIterator]() { yield { type: "content_block_delta", delta: { type: "text_delta", text: "Bonjour." } }; },
      finalMessage: async () => ({ content: [] }),
    }));
    await repondreEnFlux({ messages: { stream } }, { model, system: "S", message: "Bonjour" }, () => {});
    expect(stream.mock.calls[0][0]).toMatchObject({ model, thinking: { type: "between_tools" }, output_config: { effort: "low" } });
  });

  test("l'interprète utilise auto et conserve la validation serveur si l'outil manque", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "text", text: "Sans outil" }] }));
    const decision = await resoudreIntention({ messages: { create } }, { model, message: "Bonjour", catalogue });
    expect(create.mock.calls[0][0]).toMatchObject({ max_tokens: 512, thinking: { type: "between_tools" }, output_config: { effort: "low" }, tool_choice: { type: "auto" } });
    expect(decision.type).toBe("clarifier");
  });

  test("l'éditeur utilise auto et demande explicitement l'outil de génération", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "tool_use", name: "proposer_objets", input: { objets } }] }));
    await genererObjets({ messages: { create } }, { model, direction: "N", nombre: 1, instruction: "", contexte: { titre: "T", intro: "I", personnage: "P", zoneNom: "Z", zoneDescription: "D", objetsExistants: [] } });
    expect(create.mock.calls[0][0]).toMatchObject({ thinking: { type: "between_tools" }, output_config: { effort: "low" }, tool_choice: { type: "auto" } });
    expect(create.mock.calls[0][0].system).toContain("proposer_objets");
  });

  test("le débrief conserve son schéma JSON et désactive la réflexion préalable", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "text", text: '{"notes":[]}' }] }));
    await noterDebrief({ messages: { create } }, { model, scenario, reponses: [] });
    expect(create.mock.calls[0][0]).toMatchObject({ thinking: { type: "between_tools" }, output_config: { effort: "low", format: { type: "json_schema" } } });
  });
});

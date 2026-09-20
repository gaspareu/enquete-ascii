import { describe, expect, test, vi } from "vitest";
import { genererObjets, validerDemandeGeneration } from "../server/generation-objets.js";

const demande = {
  direction: "N",
  nombre: 2,
  instruction: "Ajoute un détail lié à la fête.",
  contexte: {
    titre: "Le dernier soir",
    intro: "Une disparition dans une maison isolée.",
    personnage: "Camille",
    zoneNom: "Bibliothèque",
    zoneDescription: "Des étagères et un bureau.",
    objetsExistants: ["Une lampe"],
  },
};

describe("aide Anthropic pour les objets d'une zone", () => {
  test("borne et valide la demande avant tout appel au modèle", () => {
    expect(validerDemandeGeneration(demande).ok).toBe(true);
    expect(validerDemandeGeneration({ ...demande, nombre: 0 }).ok).toBe(false);
    expect(validerDemandeGeneration({ ...demande, nombre: 9 }).ok).toBe(false);
    expect(validerDemandeGeneration({ ...demande, direction: "../secret" }).ok).toBe(false);
    expect(validerDemandeGeneration({ ...demande, instruction: "x".repeat(1001) }).ok).toBe(false);
    expect(validerDemandeGeneration({ ...demande, contexte: { ...demande.contexte, objetsExistants: [42] } }).ok).toBe(false);
  });

  test("ajoute la consigne au contexte global et à la zone et exige deux objets structurés", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "tool_use", name: "proposer_objets", input: {
      objets: [
        { nom: "Une clé", description: "Une clé porte une date gravée.", ramassable: true },
        { nom: "Un carnet", description: "Un carnet contient des notes anciennes.", ramassable: false },
      ],
    } }] }));
    const objets = await genererObjets({ messages: { create } }, { ...demande, model: "modele-test" });
    expect(objets).toHaveLength(2);
    expect(objets[0].nom).toBe("Une clé");
    const options = create.mock.calls[0][0];
    expect(options.tool_choice).toEqual({ type: "tool", name: "proposer_objets" });
    expect(options.messages[0].content).toContain("Le dernier soir");
    expect(options.messages[0].content).toContain("Bibliothèque");
    expect(options.messages[0].content).toContain(demande.instruction);
    expect(options.messages[0].content).toContain("Une lampe");
    expect(options.messages[0].content).not.toContain("solution");
  });

  test("rejette une réponse incomplète ou mal typée sans créer d'objet", async () => {
    const client = { messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use", name: "proposer_objets", input: {
      objets: [{ nom: "Une clé", description: "Description", ramassable: "oui" }],
    } }] })) } };
    await expect(genererObjets(client, { ...demande, model: "modele-test" })).rejects.toThrow();
  });

  test("écarte les champs secrets ajoutés au contexte avant l'appel Anthropic", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "tool_use", name: "proposer_objets", input: {
      objets: [
        { nom: "Une clé", description: "Une clé usée.", ramassable: true },
        { nom: "Un carnet", description: "Un carnet fermé.", ramassable: false },
      ],
    } }] }));
    await genererObjets({ messages: { create } }, { ...demande,
      contexte: { ...demande.contexte, solution: "SECRET_NE_PAS_TRANSMETTRE" }, model: "modele-test" });
    expect(create.mock.calls[0][0].messages[0].content).not.toContain("SECRET_NE_PAS_TRANSMETTRE");
  });
});

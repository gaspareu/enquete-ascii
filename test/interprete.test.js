import { describe, test, expect, vi } from "vitest";
import {
  construireCatalogueInterprete,
  resoudreIntention,
  validerDecisionInterprete,
} from "../server/interprete.js";
import { scenario } from "../data/scenario.js";

const laurent = { type: "personnage", id: "laurent" };
const nord = { type: "zone", id: "N" };

function fauxClient(input) {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: "tool_use", name: "resoudre_intention", input }],
      })),
    },
  };
}

function catalogue(evenements = [], contexte = nord) {
  return construireCatalogueInterprete(scenario, evenements, contexte);
}

describe("catalogue de l'interprète", () => {
  test("n'expose initialement que les zones et aucun objet caché", () => {
    const resultat = catalogue();

    expect(resultat.zones).toContainEqual(expect.objectContaining({ id: "N", nom: "table à dessin" }));
    expect(resultat.objetsConnus).toEqual([]);
    expect(JSON.stringify(resultat)).not.toContain("Grand cru");
    expect(JSON.stringify(resultat)).not.toContain("Au nom de Laurent");
    expect(JSON.stringify(resultat)).not.toContain("declencheurs");
  });

  test("n'ajoute les objets d'une zone qu'après une fouille reçue", () => {
    const resultat = catalogue([{ type: "fouiller", cible: "N", contexte: nord }]);

    expect(resultat.objetsConnus).toContainEqual(expect.objectContaining({ id: "distinction" }));
    expect(resultat.objetsConnus).not.toContainEqual(expect.objectContaining({ id: "grand_cru" }));
  });
});

describe("resoudreIntention", () => {
  test("force un outil fermé, borné, sans envoyer de secret", async () => {
    const client = fauxClient({ type: "observer", contexte: nord });
    const resultat = await resoudreIntention(client, {
      message: "Regardons le bureau.",
      catalogue: catalogue(),
      model: "modele-interprete",
    });

    expect(resultat).toEqual({ type: "observer", contexte: nord });
    const options = client.messages.create.mock.calls[0][0];
    expect(options).toMatchObject({
      model: "modele-interprete",
      max_tokens: 128,
      tool_choice: { type: "tool", name: "resoudre_intention" },
    });
    expect(options.tools).toHaveLength(1);
    expect(options.tools[0]).toMatchObject({
      name: "resoudre_intention",
      strict: true,
      input_schema: { additionalProperties: false },
    });
    expect(options.tools[0].input_schema.properties.choix).not.toHaveProperty("maxItems");
    expect(options.tools[0].input_schema.required).toEqual(["type", "contexte"]);
    expect(options.system).toContain("nom ou un alias d'une unique zone");
    expect(JSON.stringify(options)).not.toContain("Grand cru");
    expect(JSON.stringify(options)).not.toContain("Au nom de Laurent");
    expect(JSON.stringify(options)).not.toContain("declencheurs");
  });

  test("normalise une interaction seulement vers un objet déjà rencontré", async () => {
    const client = fauxClient({
      type: "interagir",
      contexte: nord,
      action: "examiner",
      cibleId: "distinction",
    });
    const resultat = await resoudreIntention(client, {
      message: "Examinons la distinction.",
      catalogue: catalogue([{ type: "fouiller", cible: "N", contexte: nord }]),
      model: "modele-interprete",
    });

    expect(resultat).toEqual({
      type: "interagir",
      contexte: nord,
      action: "examiner",
      cibleId: "distinction",
    });
  });

  test("déduit la zone cible d'une fouille, même si le modèle a gardé son ancien contexte", () => {
    expect(validerDecisionInterprete({
      type: "interagir",
      contexte: laurent,
      action: "fouiller",
      cibleId: "N",
    }, catalogue())).toEqual({
      type: "interagir",
      contexte: nord,
      action: "fouiller",
      cibleId: "N",
    });
  });

  test("accepte le dialogue uniquement face à Laurent", async () => {
    const client = fauxClient({ type: "dialoguer", contexte: laurent });
    const resultat = await resoudreIntention(client, {
      message: "Demandez à Laurent ce qu'il cache.",
      catalogue: catalogue(),
      model: "modele-interprete",
    });

    expect(resultat).toEqual({ type: "dialoguer", contexte: laurent });
  });

  test("fabrique une clarification à partir de choix publics, sans texte du modèle", async () => {
    const client = fauxClient({
      type: "clarifier",
      choix: [{ type: "zone", id: "N" }, { type: "personnage", id: "laurent" }],
    });
    const resultat = await resoudreIntention(client, {
      message: "Regardez ça.",
      catalogue: catalogue(),
      model: "modele-interprete",
    });

    expect(resultat).toEqual({
      type: "clarifier",
      choix: [
        { type: "zone", id: "N", libelle: "table à dessin" },
        { type: "personnage", id: "laurent", libelle: "Laurent" },
      ],
      question: "Parlez-vous de table à dessin ou de Laurent ?",
    });
  });

  test("une sortie sans outil, incohérente ou hors catalogue devient une clarification sûre", async () => {
    const client = { messages: { create: vi.fn(async () => ({ content: [{ type: "text", text: "secret" }] })) } };
    const sansOutil = await resoudreIntention(client, {
      message: "Je regarde.",
      catalogue: catalogue(),
      model: "modele-interprete",
    });
    const horsCatalogue = validerDecisionInterprete({
      type: "interagir",
      contexte: nord,
      action: "examiner",
      cibleId: "plaquette_somniferes",
    }, catalogue());

    expect(sansOutil).toEqual({
      type: "clarifier",
      choix: [],
      question: "Que souhaitez-vous observer, faire ou demander à Laurent ?",
    });
    expect(horsCatalogue).toEqual(sansOutil);
  });
});

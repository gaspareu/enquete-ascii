import { describe, test, expect, vi } from "vitest";
import { resoudreIntention } from "../server/interprete.js";

const catalogue = {
  contexte: { type: "zone", id: "S" }, sac: ["cle"],
  personnage: { id: "laurent", nom: "Laurent" },
  zones: [{ id: "S", nom: "secrétaire", description: "Un secrétaire en bois." }],
  objetsConnus: [{ id: "telephone", nom: "Téléphone d’Hélène", zoneId: "S" }, { id: "cle", nom: "Petite clé", zoneId: "S" }],
  derniereInteraction: { action: "examiner", cibleId: "telephone", nom: "Téléphone d’Hélène" },
};
function clientPour(input) {
  return { messages: { create: vi.fn(async () => ({ content: [{ type: "tool_use", name: "resoudre_intention", input }] })) } };
}

describe("continuité de l'interprétation", () => {
  test.each([
    ["du téléphone", "Peut-on savoir à qui appartiennent ces traces ?", "examiner", "telephone", "identite"],
    ["oui", "Je voudrais prendre cet objet", "ramasser", "cle", "autre"],
    ["la petite", "Je tends une clé à Laurent", "donner", "cle", "autre"],
  ])("%s est interprété avec l'intention initiale %s", async (message, original, action, cibleId, angle) => {
    const input = { type: "interagir", contexte: action === "donner" ? { type: "personnage", id: "laurent" } : catalogue.contexte, action, cibleId, angle };
    const api = clientPour(input);
    const historique = [{ role: "joueur", texte: original }, { role: "systeme", texte: "De quel objet parlez-vous ?" }];
    const resultat = await resoudreIntention(api, { message, catalogue, historique, model: "test" });
    expect(resultat).toMatchObject({ action, cibleId });
    expect(api.messages.create).toHaveBeenCalledOnce();
    expect(api.messages.create.mock.calls[0][0].messages).toEqual([
      { role: "user", content: original }, { role: "assistant", content: "De quel objet parlez-vous ?" }, { role: "user", content: message },
    ]);
  });
  test("transmet l'observation précédente et l'objet examiné sans imposer la cible", async () => {
    const api = clientPour({ type: "interagir", contexte: catalogue.contexte, action: "examiner", cibleId: "telephone", angle: "identite" });
    const historique = [{ role: "joueur", texte: "Observer le téléphone" }, { role: "systeme", texte: "Des traces s’effacent sur l’écran." }];
    await resoudreIntention(api, { message: "Peut-on les identifier ?", catalogue, historique, model: "test" });
    const options = api.messages.create.mock.calls[0][0];
    expect(options.messages[1].content).toBe(historique[1].texte);
    expect(options.system).toContain('"cibleId":"telephone"');
  });
  test("une nouvelle demande explicite reste prioritaire sur la conversation précédente", async () => {
    const api = clientPour({ type: "dialoguer", contexte: { type: "personnage", id: "laurent" } });
    const historique = [{ role: "joueur", texte: "Observer le téléphone" }, { role: "systeme", texte: "Parlez-vous du téléphone ?" }];
    expect((await resoudreIntention(api, { message: "Je demande à Laurent où il était", catalogue, historique, model: "test" })).type).toBe("dialoguer");
    expect(api.messages.create.mock.calls[0][0].messages.at(-1).content).toContain("où il était");
  });
});

// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { brancherSaisieChat } from "../public/saisie-chat.js";
function preparer() {
  const form = document.createElement("form");
  const saisie = document.createElement("textarea");
  form.appendChild(saisie);
  const envoyer = vi.spyOn(form, "requestSubmit").mockImplementation(() => {});
  brancherSaisieChat({ form, saisie });
  return { saisie, envoyer };
}
describe("clavier de la saisie multiligne", () => {
  test("Entrée envoie sans insérer une ligne", () => {
    const { saisie, envoyer } = preparer();
    const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    saisie.dispatchEvent(event);
    expect(envoyer).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });
  test("Maj+Entrée conserve le comportement de retour à la ligne", () => {
    const { saisie, envoyer } = preparer();
    const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, cancelable: true });
    saisie.dispatchEvent(event);
    expect(envoyer).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
  test("une saisie occupée ne soumet pas de deuxième message", () => {
    const { saisie, envoyer } = preparer();
    saisie.disabled = true;
    saisie.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(envoyer).not.toHaveBeenCalled();
  });
  test.each([{ isComposing: true }, { keyCode: 229 }])("ne soumet pas pendant une composition clavier : %j", (options) => {
    const { saisie, envoyer } = preparer();
    saisie.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ...options }));
    expect(envoyer).not.toHaveBeenCalled();
  });
});

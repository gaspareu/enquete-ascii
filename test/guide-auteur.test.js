// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { creerEnqueteVide } from "../editeur/state.js";

const rep = (contenu) => ({ ok: true, json: async () => contenu });
const tour = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="annonce" role="status"></div><div id="application"></div>';
});

test("propose un modèle et un guide navigable sans modifier ni transmettre le scénario", async () => {
  const enquete = creerEnqueteVide("Le médaillon disparu", "mon_histoire");
  global.fetch = vi.fn(async (url, options = {}) => {
    if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
    if (url === "/api/editeur/enquetes" && !options.method) return rep({ enquetes: [] });
    if (url === "/api/editeur/enquetes" && options.method === "POST") return rep({ enquete, revision: "r1" });
    throw new Error(`Appel inattendu : ${url}`);
  });
  await import("../editeur/editor.js"); await tour();
  const modele = document.getElementById("nouveau-modele");
  expect(modele.value).toBe("initiation");
  expect(document.querySelector('label[for="nouveau-modele"]')).toBeTruthy();
  expect([...modele.options].map(({ value }) => value)).toEqual(["initiation", ""]);
  document.getElementById("nouveau-titre").value = "Mon histoire";
  document.querySelector('[data-action="creer"]').click(); await tour();
  const creation = global.fetch.mock.calls.find(([, options]) => options?.method === "POST");
  expect(JSON.parse(creation[1].body)).toEqual({ id: "mon_histoire", modele: "initiation" });
  const appelsAvantGuide = global.fetch.mock.calls.length;
  const statutAvantGuide = document.getElementById("etat-brouillon").textContent;
  expect(document.body.textContent).toContain("Bien commencer");
  document.querySelector(".guide-auteur").open = true;
  for (const section of ["debrief", "cadre", "piece", "objets", "progression", "dialogue", "tester"]) {
    document.querySelector(`[data-action="etape"][data-section="${section}"]`).click(); await tour();
    const onglet = document.querySelector(`[role="tab"][data-tab="${section}"]`);
    expect(onglet.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(onglet);
    expect(document.querySelector(".guide-auteur").open).toBe(true);
  }
  expect(document.getElementById("etat-brouillon").textContent).toBe(statutAvantGuide);
  expect(global.fetch.mock.calls).toHaveLength(appelsAvantGuide);
});

test("conserve le choix du brouillon vide dans la demande de création", async () => {
  global.fetch = vi.fn(async (url, options = {}) => {
    if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
    if (!options.method) return rep({ enquetes: [] });
    return rep({ enquete: creerEnqueteVide("Vide", "vide"), revision: "r1" });
  });
  await import("../editeur/editor.js"); await tour();
  document.getElementById("nouveau-titre").value = "Vide";
  document.getElementById("nouveau-modele").value = "";
  document.querySelector('[data-action="creer"]').click(); await tour();
  const creation = global.fetch.mock.calls.find(([, options]) => options?.method === "POST");
  expect(JSON.parse(creation[1].body)).toEqual({ id: "vide" });
});

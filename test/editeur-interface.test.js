// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { creerEnqueteVide } from "../editeur/state.js";

const rep = (contenu, statut = 200) => ({ ok: statut < 400, status: statut, json: async () => contenu });
const tour = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="annonce" role="status"></div><div id="application"></div>';
});

describe("atelier d’auteur", () => {
  test("crée, modifie et sauvegarde un brouillon avec jeton sur toutes les routes privées", async () => {
    const vide = creerEnqueteVide("Nouvelle enquête", "nouvelle_enquete");
    const appels = [];
    global.fetch = vi.fn(async (url, options = {}) => {
      appels.push({ url, options });
      if (url === "/api/editeur/session") return rep({ jeton: "secret-local" });
      if (url === "/api/editeur/enquetes" && !options.method) return rep({ enquetes: [] });
      if (url === "/api/editeur/enquetes" && options.method === "POST") return rep({ enquete: vide, revision: "r1" });
      if (url === "/api/editeur/enquetes/nouvelle_enquete" && options.method === "PUT") {
        return rep({ enquete: JSON.parse(options.body), revision: "r2" });
      }
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js");
    await tour();
    expect(document.body.textContent).toContain("Mes enquêtes");
    document.querySelector("#nouveau-titre").value = "Nouvelle enquête";
    document.querySelector('[data-action="creer"]').click();
    await tour();
    const titre = document.querySelector('[data-path="[\\"titre\\"]"]');
    expect(titre).toBeTruthy();
    titre.value = "Le mystère du quai";
    titre.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("#etat-brouillon").textContent).toContain("non enregistrées");
    document.querySelector('[data-action="enregistrer"]').click();
    await tour();
    const sauvegarde = appels.find(({ options }) => options.method === "PUT");
    expect(JSON.parse(sauvegarde.options.body).titre).toBe("Le mystère du quai");
    expect(appels.slice(1).every(({ options }) => options.headers["X-Editor-Token"] === "secret-local")).toBe(true);
  });

  test("n’injecte pas de HTML d’auteur et rend les diagnostics navigables", async () => {
    const enquete = creerEnqueteVide("<img src=x onerror=alert(1)>", "quai");
    enquete.declencheurs = { "examiner:cle": "A", "donner:cle": "B" };
    enquete.preconditions = { "donner:cle": ["A"] };
    global.fetch = vi.fn(async (url, options = {}) => {
      if (url === "/api/editeur/session") return rep({ jeton: "secret-local" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: enquete.titre, statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai" && !options.method) return rep({ enquete, revision: "r1" });
      if (url === "/api/editeur/enquetes/quai/validation") {
        return rep({ erreurs: [{ path: "zones.N.nom", message: "Zone sans nom" }], avertissements: [] });
      }
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js");
    await tour();
    document.querySelector('[data-action="ouvrir"]').click();
    await tour();
    expect(document.querySelector("img[src=x]")).toBeNull();
    document.querySelector('[data-tab="progression"]').click();
    expect(document.querySelector(".graphe svg")).toBeTruthy();
    document.querySelector('[data-action="vue-graphe"][data-mode="liste"]').click();
    expect(document.body.textContent).toContain("Liste structurée des faits");
    document.querySelector('[data-tab="tester"]').click();
    document.querySelector('[data-action="valider"]').click();
    await tour();
    document.querySelector('[data-action="aller-diagnostic"]').click();
    expect(document.querySelector('[data-tab="piece"]').getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[data-path="[\\"zones\\",\\"N\\",\\"nom\\"]"]')).toBeTruthy();
  });

  test("importe une image binaire et sauvegarde seulement son chemin dans le brouillon", async () => {
    const enquete = creerEnqueteVide("Quai", "quai");
    const appels = [];
    global.fetch = vi.fn(async (url, options = {}) => {
      appels.push({ url, options });
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: "Quai", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai") return rep({ enquete, revision: "r1" });
      if (url.startsWith("/api/editeur/enquetes/quai/images?")) return rep({ chemin: "/images/enquetes/quai/scene.png" });
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    document.querySelector('[data-tab="piece"]').click();
    const fichier = new File([new Uint8Array([137, 80, 78, 71])], "scene.png", { type: "image/png" });
    const entree = document.querySelector('[data-action="upload-image"]');
    Object.defineProperty(entree, "files", { value: [fichier] });
    entree.dispatchEvent(new Event("change", { bubbles: true })); await tour();
    const transfert = appels.find(({ url }) => url.includes("/images?"));
    expect(transfert.options.headers["X-Editor-Token"]).toBe("jeton");
    expect(transfert.options.body).toBe(fichier);
    expect(document.querySelector('[data-path="[\\"zones\\",\\"N\\",\\"illustration\\"]"]').value)
      .toBe("/images/enquetes/quai/scene.png");
    expect(document.querySelector("#etat-brouillon").textContent).toContain("non enregistrées");
  });

  test("un import refusé ne sauvegarde jamais le chemin local du champ fichier", async () => {
    const enquete = creerEnqueteVide("Quai", "quai");
    enquete.zones.N.illustration = "/images/enquetes/quai/original.png";
    let sauvegarde;
    global.fetch = vi.fn(async (url, options = {}) => {
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: "Quai", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai" && !options.method) return rep({ enquete, revision: "r1" });
      if (url.startsWith("/api/editeur/enquetes/quai/images?")) return rep({ erreur: "Nom déjà utilisé." }, 409);
      if (url === "/api/editeur/enquetes/quai" && options.method === "PUT") {
        sauvegarde = JSON.parse(options.body);
        return rep({ enquete: sauvegarde, revision: "r2" });
      }
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    document.querySelector('[data-tab="piece"]').click();
    const entree = document.querySelector('[data-action="upload-image"]');
    const fichier = new File([new Uint8Array([137, 80, 78, 71])], "scene.png", { type: "image/png" });
    Object.defineProperty(entree, "files", { value: [fichier] });
    Object.defineProperty(entree, "value", { value: "C:\\fakepath\\scene.png" });
    entree.dispatchEvent(new Event("input", { bubbles: true }));
    entree.dispatchEvent(new Event("change", { bubbles: true }));
    await tour();
    expect(document.querySelector("#annonce").textContent).toContain("Nom déjà utilisé.");
    expect(document.querySelector("#etat-brouillon").textContent).toContain("Enregistré");
    document.querySelector('[data-tab="cadre"]').click();
    const titre = document.querySelector('[data-path="[\\"titre\\"]"]');
    titre.value = "Quai modifié";
    titre.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-action="enregistrer"]').click();
    await tour();
    expect(sauvegarde.zones.N.illustration).toBe("/images/enquetes/quai/original.png");
  });

  test("l’enquête exemple s’ouvre en lecture seule et peut être dupliquée", async () => {
    const enquete = creerEnqueteVide("Hélène", "helene");
    enquete.statut = "prete";
    global.fetch = vi.fn(async (url) => {
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "helene", titre: "Hélène", statut: "prete", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/helene") return rep({ enquete, revision: "r1" });
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    expect(document.querySelector('[data-action="dupliquer"]')).toBeTruthy();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    expect(document.querySelector("#etat-brouillon").textContent).toContain("lecture seule");
    expect(document.querySelector('[data-path="[\\"titre\\"]"]').disabled).toBe(true);
    expect(document.querySelector('[data-action="enregistrer"]').disabled).toBe(true);
  });

  test("rouvre un brouillon incomplet sans ajouter silencieusement ses champs manquants", async () => {
    const incomplet = { id: "quai", schemaVersion: 1, statut: "brouillon", extensionAuteur: { version: "v1" } };
    let sauvegarde;
    global.fetch = vi.fn(async (url, options = {}) => {
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: "", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai" && !options.method) return rep({ enquete: incomplet, revision: "r1" });
      if (url === "/api/editeur/enquetes/quai" && options.method === "PUT") {
        sauvegarde = JSON.parse(options.body); return rep({ enquete: sauvegarde, revision: "r2" });
      }
      if (url === "/api/editeur/enquetes/quai/validation") {
        return rep({ erreurs: [{ path: "personnage", message: "Personnage manquant." }], avertissements: [] });
      }
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    expect(document.querySelector('[data-path="[\\"personnage\\",\\"nom\\"]"]')).toBeTruthy();
    document.querySelector('[data-action="valider"]').click(); await tour();
    expect(document.body.textContent).toContain("Personnage manquant.");
    document.querySelector('[data-tab="cadre"]').click();
    const titre = document.querySelector('[data-path="[\\"titre\\"]"]');
    titre.value = "Nouveau titre"; titre.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-action="enregistrer"]').click(); await tour();
    expect(sauvegarde.extensionAuteur).toEqual({ version: "v1" });
    expect(sauvegarde.personnage).toBeUndefined();
  });

  test("permet d'ajouter un objet et une connaissance à un brouillon incomplet", async () => {
    const incomplet = { id: "quai", schemaVersion: 1, statut: "brouillon" };
    global.fetch = vi.fn(async (url) => {
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: "", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai") return rep({ enquete: incomplet, revision: "r1" });
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    document.querySelector('[data-tab="objets"]').click();
    document.querySelector("#nouvel-objet").value = "cle";
    document.querySelector('[data-action="ajouter-objet"]').click(); await tour();
    expect(document.querySelector('[data-action="choisir-objet"][data-cle="cle"]')).toBeTruthy();
    const placement = document.querySelector('[data-action="deplacer-objet"]');
    placement.value = "N";
    placement.dispatchEvent(new Event("change", { bubbles: true })); await tour();
    expect(document.body.textContent).toContain("Présent dans : N");
    document.querySelector('[data-tab="dialogue"]').click();
    document.querySelector('[data-action="ajouter-connaissance"]').click(); await tour();
    expect(document.querySelector('[data-path="[\\"connaissances\\",0,\\"id\\"]"]')).toBeTruthy();
    expect(document.querySelector("#annonce").classList.contains("erreur")).toBe(false);
  });

  test("garde les saisies faites pendant un enregistrement en cours", async () => {
    const enquete = creerEnqueteVide("Quai", "quai");
    let terminerPremierEnregistrement;
    const sauvegardes = [];
    global.fetch = vi.fn(async (url, options = {}) => {
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: "Quai", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai" && !options.method) return rep({ enquete, revision: "r1" });
      if (url === "/api/editeur/enquetes/quai" && options.method === "PUT") {
        const sauvegarde = JSON.parse(options.body);
        sauvegardes.push(sauvegarde);
        if (sauvegardes.length === 1) return new Promise((resolve) => { terminerPremierEnregistrement = () => resolve(rep({ enquete: sauvegarde, revision: "r2" })); });
        return rep({ enquete: sauvegarde, revision: "r3" });
      }
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    const titre = document.querySelector('[data-path="[\\"titre\\"]"]');
    titre.value = "Avant"; titre.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-action="enregistrer"]').click();
    titre.value = "Après"; titre.dispatchEvent(new Event("input", { bubbles: true }));
    terminerPremierEnregistrement(); await tour();
    expect(document.querySelector('[data-path="[\\"titre\\"]"]').value).toBe("Après");
    expect(document.querySelector("#etat-brouillon").textContent).toContain("non enregistrées");
    document.querySelector('[data-action="enregistrer"]').click(); await tour();
    expect(sauvegardes.map(({ titre: valeur }) => valeur)).toEqual(["Avant", "Après"]);
  });

  test("génère des objets dans la zone sélectionnée à partir du contexte non enregistré", async () => {
    const enquete = creerEnqueteVide("Maison", "maison");
    enquete.intro = "Une disparition pendant une fête.";
    enquete.personnage.nom = "Camille";
    enquete.zones.N.nom = "Bibliothèque";
    enquete.zones.N.description = "Des étagères et un bureau.";
    const appels = [];
    global.fetch = vi.fn(async (url, options = {}) => {
      appels.push({ url, options });
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "maison", titre: "Maison", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/maison" && !options.method) return rep({ enquete, revision: "r1" });
      if (url === "/api/editeur/enquetes/maison/generation-objets") return rep({ objets: [
        { nom: "Une clé", description: "Une date est gravée dessus.", ramassable: true },
        { nom: "Un carnet", description: "Les pages sont annotées.", ramassable: false },
      ] });
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    document.querySelector('[data-tab="piece"]').click();
    document.querySelector('[data-action="ouvrir-generation"]').click();
    const nombre = document.querySelector("#generation-nombre");
    const consigne = document.querySelector("#generation-consigne");
    expect(nombre).toBeTruthy();
    nombre.value = "2"; nombre.dispatchEvent(new Event("input", { bubbles: true }));
    consigne.value = "Une trace de fête"; consigne.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-action="generer-objets"]').click(); await tour();
    const appel = appels.find(({ url }) => url.endsWith("/generation-objets"));
    const corps = JSON.parse(appel.options.body);
    expect(corps).toMatchObject({ direction: "N", nombre: 2, instruction: "Une trace de fête",
      contexte: { titre: "Maison", intro: enquete.intro, zoneNom: "Bibliothèque", personnage: "Camille" } });
    expect(document.body.textContent).toContain("Une clé");
    expect(document.body.textContent).toContain("Un carnet");
    expect(document.querySelector("#etat-brouillon").textContent).toContain("non enregistrées");
    expect(appels.some(({ options }) => options.method === "PUT")).toBe(false);
  });

  test("les onglets répondent aux flèches, à Home et à End au clavier", async () => {
    const enquete = creerEnqueteVide("Quai", "quai");
    global.fetch = vi.fn(async (url) => {
      if (url === "/api/editeur/session") return rep({ jeton: "jeton" });
      if (url === "/api/editeur/enquetes") return rep({ enquetes: [{ id: "quai", titre: "Quai", statut: "brouillon", revision: "r1" }] });
      if (url === "/api/editeur/enquetes/quai") return rep({ enquete, revision: "r1" });
      throw new Error(`Route inattendue : ${url}`);
    });
    await import("../editeur/editor.js"); await tour();
    document.querySelector('[data-action="ouvrir"]').click(); await tour();
    const cadre = document.querySelector('[data-tab="cadre"]');
    cadre.focus();
    cadre.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const piece = document.querySelector('[data-tab="piece"]');
    expect(piece.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(piece);
    expect(piece.getAttribute("aria-controls")).toBe("panneau-enquete");
    expect(document.querySelector("#panneau-enquete").getAttribute("aria-labelledby")).toBe(piece.id);
    piece.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.querySelector('[data-tab="tester"]').getAttribute("aria-selected")).toBe("true");
    document.querySelector('[data-tab="tester"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.querySelector('[data-tab="cadre"]').getAttribute("aria-selected")).toBe("true");
  });
});

import { describe, expect, test } from "vitest";
import {
  creerEnqueteVide,
  ajouterObjetsGeneres,
  mettreAJour,
  renommerObjet,
  renommerFlag,
  retirerObjet,
} from "../editeur/state.js";
import { construireGraphe } from "../editeur/graph.js";

describe("modèle du brouillon", () => {
  test("place des objets générés dans la zone sans écraser les objets existants", () => {
    const avant = creerEnqueteVide("Maison", "maison");
    avant.objets.cle = { nom: "Ancienne clé", description: "", aliases: [], apercu: "", ramassable: true };
    avant.zones.N.objetsCaches = ["cle"];
    const apres = ajouterObjetsGeneres(avant, "N", [
      { nom: "Clé", description: "Une autre clé.", ramassable: true },
      { nom: "Clé", description: "Une troisième clé.", ramassable: false },
    ]);
    expect(apres.zones.N.objetsCaches).toEqual(["cle", "cle_2", "cle_3"]);
    expect(apres.objets.cle_2).toMatchObject({ nom: "Clé", description: "Une autre clé.", ramassable: true });
    expect(apres.objets.cle_3.ramassable).toBe(false);
    expect(apres.statut).toBe("brouillon");
    expect(avant.zones.N.objetsCaches).toEqual(["cle"]);
  });
  test("crée huit zones indépendantes et un scénario enregistrable", () => {
    const enquete = creerEnqueteVide("Affaire du quai", "affaire-du-quai");
    expect(enquete.schemaVersion).toBe(1);
    expect(Object.keys(enquete.zones)).toHaveLength(8);
    expect(enquete.zones.N.objetsCaches).toEqual([]);
    expect(enquete.zones.NE.objetsCaches).not.toBe(enquete.zones.N.objetsCaches);
    expect(enquete.statut).toBe("brouillon");
  });

  test("une modification de formulaire garde l'ancien brouillon intact", () => {
    const avant = creerEnqueteVide("Quai", "quai");
    const apres = mettreAJour(avant, ["personnage", "portraits", "neutre"], "/portrait.png");
    expect(avant.personnage.portraits.neutre).toBe("");
    expect(apres.personnage.portraits.neutre).toBe("/portrait.png");
  });

  test("renommer un objet déplace ses références de zones, gestes et verrous", () => {
    const base = creerEnqueteVide("Quai", "quai");
    base.objets.cle = { nom: "Clé", description: "Une clé", ramassable: true };
    base.zones.N.objetsCaches = ["cle"];
    base.declencheurs["examiner:cle"] = "indice";
    base.preconditions["examiner:cle"] = ["depart"];
    base.conditionsActions["donner:cle"] = { requiertTous: ["examiner:cle"] };
    const apres = renommerObjet(base, "cle", "cle_doree");
    expect(apres.zones.N.objetsCaches).toEqual(["cle_doree"]);
    expect(apres.declencheurs["examiner:cle_doree"]).toBe("indice");
    expect(apres.preconditions["examiner:cle_doree"]).toEqual(["depart"]);
    expect(apres.conditionsActions["donner:cle_doree"].requiertTous).toEqual(["examiner:cle_doree"]);
    expect(base.objets.cle).toBeDefined();
    expect(() => renommerObjet(base, "cle", "../secret")).toThrow();
  });

  test("renommer un flag met à jour toutes les consommations", () => {
    const base = creerEnqueteVide("Quai", "quai");
    base.declencheurs["examiner:cle"] = "indice";
    base.preconditions["donner:cle"] = ["indice"];
    base.connaissances = [{ id: "savoir", texte: "Texte", requiert: ["indice"] }];
    base.pistesInterrogatoire = [{ question: "Quoi ?", requiert: ["indice"], retireSi: ["indice"] }];
    base.solution.preuvesRequises = ["indice"];
    const apres = renommerFlag(base, "indice", "preuve");
    expect(apres.declencheurs["examiner:cle"]).toBe("preuve");
    expect(apres.preconditions["donner:cle"]).toEqual(["preuve"]);
    expect(apres.connaissances[0].requiert).toEqual(["preuve"]);
    expect(apres.pistesInterrogatoire[0].retireSi).toEqual(["preuve"]);
    expect(apres.solution.preuvesRequises).toEqual(["preuve"]);
  });

  test("retirer un objet retire ses gestes et occurrences dans la pièce", () => {
    const base = creerEnqueteVide("Quai", "quai");
    base.objets.cle = { nom: "Clé", description: "Une clé", ramassable: true };
    base.zones.N.objetsCaches = ["cle"];
    base.declencheurs["examiner:cle"] = "preuve";
    base.preconditions["examiner:cle"] = [];
    base.conditionsActions["donner:cle"] = { requiertTous: [] };
    const apres = retirerObjet(base, "cle");
    expect(apres.objets.cle).toBeUndefined();
    expect(apres.zones.N.objetsCaches).toEqual([]);
    expect(apres.declencheurs["examiner:cle"]).toBeUndefined();
    expect(apres.preconditions["examiner:cle"]).toBeUndefined();
    expect(apres.conditionsActions["donner:cle"]).toBeUndefined();
    expect(base.objets.cle).toBeDefined();
  });

});

describe("graphe dérivé", () => {
  test("représente un ET sans dédoubler A+B et B+A", () => {
    const enquete = creerEnqueteVide("Quai", "quai");
    enquete.declencheurs = {
      "examiner:a": "A", "examiner:b": "B", "donner:c": "C",
    };
    enquete.preconditions = { "donner:c": ["A", "B"] };
    enquete.connaissances = [{ id: "aveu", texte: "Aveu", requiert: ["C"] }];
    const graphe = construireGraphe(enquete);
    expect(graphe.noeuds.map((n) => n.id)).toEqual(["A", "B", "C"]);
    expect(graphe.liens).toEqual([
      { de: "A", vers: "C", via: "donner:c" },
      { de: "B", vers: "C", via: "donner:c" },
    ]);
    expect(graphe.noeuds[2].effets.connaissances).toEqual(["aveu"]);
  });

  test("plusieurs gestes vers un fait sont des alternatives OU et gardent chacun leurs préconditions", () => {
    const enquete = creerEnqueteVide("Quai", "quai");
    enquete.declencheurs = { "examiner:a": "A", "examiner:b": "B", "examiner:x": "C", "donner:y": "C" };
    enquete.preconditions = { "examiner:x": ["A"], "donner:y": ["B"] };
    const graphe = construireGraphe(enquete);
    expect(graphe.noeuds.find((noeud) => noeud.id === "C").branches).toEqual([
      { geste: "examiner:x", requiert: ["A"] },
      { geste: "donner:y", requiert: ["B"] },
    ]);
    expect(graphe.liens.filter((lien) => lien.vers === "C")).toEqual([
      { de: "A", vers: "C", via: "examiner:x" },
      { de: "B", vers: "C", via: "donner:y" },
    ]);
  });
});

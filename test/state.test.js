import { describe, test, expect } from "vitest";
import {
  etatInitial,
  observerZone,
  observerPersonnage,
  ajouterDialogue,
  historiquePourLaurent,
  ajouterRecus,
  remplacerSac,
  recanaliserDernierTour,
} from "../public/state.js";

describe("etatInitial", () => {
  test("démarre face à Laurent avec un sac, un historique et des reçus vides", () => {
    expect(etatInitial()).toEqual({
      contexte: { type: "personnage", id: "laurent" },
      sac: [],
      historique: [],
      recus: [],
    });
  });
});

describe("observation", () => {
  test("observerZone crée un état sans muter son origine", () => {
    const avant = etatInitial();
    const apres = observerZone(avant, "N");

    expect(apres).toEqual({ ...avant, contexte: { type: "zone", id: "N" } });
    expect(avant.contexte).toEqual({ type: "personnage", id: "laurent" });
  });

  test("observerPersonnage revient au face-à-face sans effacer l'état", () => {
    const enZone = observerZone(etatInitial(), "S");
    const apres = observerPersonnage(enZone);

    expect(apres.contexte).toEqual({ type: "personnage", id: "laurent" });
    expect(enZone.contexte).toEqual({ type: "zone", id: "S" });
  });
});

describe("historique canalisé", () => {
  test("enregistre canal et contexte sans muter l'historique d'origine", () => {
    const avant = observerZone(etatInitial(), "N");
    const apres = ajouterDialogue(avant, "joueur", "J'examine le livre.", "scene");

    expect(apres.historique).toEqual([
      {
        role: "joueur",
        texte: "J'examine le livre.",
        canal: "scene",
        contexte: { type: "zone", id: "N" },
      },
    ]);
    expect(avant.historique).toEqual([]);
  });

  test("historiquePourLaurent ne garde que son canal, sans modifier le journal visible", () => {
    let etat = observerZone(etatInitial(), "N");
    etat = ajouterDialogue(etat, "systeme", "Vous fouillez.", "scene");
    etat = observerPersonnage(etat);
    etat = ajouterDialogue(etat, "joueur", "Bonjour Laurent.", "laurent");
    etat = ajouterDialogue(etat, "personnage", "Bonjour.", "laurent");
    etat = observerZone(etat, "S");
    etat = ajouterDialogue(etat, "systeme", "Rien à signaler.", "scene");

    expect(historiquePourLaurent(etat)).toEqual([
      { role: "joueur", texte: "Bonjour Laurent.", canal: "laurent", contexte: { type: "personnage", id: "laurent" } },
      { role: "personnage", texte: "Bonjour.", canal: "laurent", contexte: { type: "personnage", id: "laurent" } },
    ]);
    expect(etat.historique).toHaveLength(4);
  });
});

describe("reçus et inventaire publics", () => {
  test("ajouterRecus déduplique des valeurs opaques de manière immutable", () => {
    const avant = etatInitial();
    const un = ajouterRecus(avant, ["recu-a", "recu-a"]);
    const deux = ajouterRecus(un, ["recu-a", "recu-b"]);

    expect(un.recus).toEqual(["recu-a"]);
    expect(deux.recus).toEqual(["recu-a", "recu-b"]);
    expect(avant.recus).toEqual([]);
  });

  test("remplacerSac applique seulement le sac dérivé par le serveur", () => {
    const avant = etatInitial();
    const apres = remplacerSac(avant, ["cle", "grand_cru"]);

    expect(apres.sac).toEqual(["cle", "grand_cru"]);
    expect(avant.sac).toEqual([]);
  });
});

describe("échecs de dialogue", () => {
  test("recanalise sans mutation une tentative non aboutie hors de la mémoire Laurent", () => {
    const avant = ajouterDialogue(etatInitial(), "joueur", "Vous m'entendez ?", "laurent");
    const apres = recanaliserDernierTour(avant, "scene");

    expect(avant.historique[0].canal).toBe("laurent");
    expect(apres.historique[0].canal).toBe("scene");
    expect(historiquePourLaurent(apres)).toEqual([]);
  });
});

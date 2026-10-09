import { describe, test, expect } from "vitest";
import {
  etatInitial,
  observerZone,
  observerPersonnage,
  ajouterDialogue,
  historiquePourLaurent,
  historiquePourPersonnage,
  historiquePourInterprete,
  ajouterRecus,
  remplacerEtatPublic,
  recanaliserDernierTour,
} from "../public/state.js";

describe("etatInitial", () => {
  test("accepte l'identifiant du personnage de l'enquête", () => {
    const etat = etatInitial("camille");
    expect(etat.contexte).toEqual({ type: "personnage", id: "camille" });
    expect(observerPersonnage(observerZone(etat, "N")).contexte.id).toBe("camille");
    const avecTour = ajouterDialogue(etat, "joueur", "Bonjour", "camille");
    expect(historiquePourPersonnage(avecTour, "camille")).toHaveLength(1);
    expect(historiquePourPersonnage(avecTour, "laurent")).toHaveLength(0);
  });
  test("démarre face à Laurent avec un sac, les objets connus, un historique et des reçus vides", () => {
    expect(etatInitial()).toEqual({
      personnageId: "laurent",
      contexte: { type: "personnage", id: "laurent" },
      sac: [],
      objetsConnus: [],
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

  test("remplacerEtatPublic applique la projection d'inventaire dérivée par le serveur", () => {
    const avant = etatInitial();
    const objetsConnus = [
      { id: "cle", nom: "Petite clé", aliases: ["clé"], ramassable: true },
    ];
    const apres = remplacerEtatPublic(avant, { sac: ["cle", "grand_cru"], objetsConnus });

    expect(apres.sac).toEqual(["cle", "grand_cru"]);
    expect(apres.objetsConnus).toEqual(objetsConnus);
    expect(avant.sac).toEqual([]);
    expect(avant.objetsConnus).toEqual([]);
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


describe("historique de l’interprète", () => {
  test("borne le journal et conserve observations et paroles sans métadonnées de progression", () => {
    let etat = etatInitial();
    for (let index = 0; index < 15; index += 1) etat = ajouterDialogue(etat, index % 2 ? "systeme" : "joueur", `Tour ${index}`);
    const historique = historiquePourInterprete(etat);
    expect(historique).toHaveLength(12);
    expect(historique[0]).toEqual({ role: "systeme", texte: "Tour 3" });
    expect(historique.at(-1)).toEqual({ role: "joueur", texte: "Tour 14" });
    expect(etat.historique).toHaveLength(15);
  });
  test("borne aussi la taille d'une longue observation", () => {
    expect(historiquePourInterprete(ajouterDialogue(etatInitial(), "systeme", "x".repeat(3000)))[0].texte).toHaveLength(2000);
  });
});

test("attribue le joueur au personnage même après une annonce de déplacement",async()=>{
  const {recanaliserDernierJoueur}=await import('../public/state.js');
  const initial=ajouterDialogue(ajouterDialogue(etatInitial(),'joueur','Bonjour','scene'),'systeme','Vous vous tournez vers Laurent.','scene');
  const apres=recanaliserDernierJoueur(initial,'laurent');
  expect(apres.historique[0].canal).toBe('laurent');
  expect(apres.historique[1]).toEqual(initial.historique[1]);
  expect(initial.historique[0].canal).toBe('scene');
});

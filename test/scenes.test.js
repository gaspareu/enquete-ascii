import { describe, test, expect } from "vitest";
import { scenesDepuisScenario, scenePourContexte } from "../server/scenes.js";
import { projectionScene, projectionPersonnage } from "../server/projection-scene.js";
import { faitsPourDestinataire } from "../server/hooks-histoire.js";
import { signerMemoire, lireMemoire, ajouterTourMemoire, historiqueLocal } from "../server/memoire-scene.js";
import { scenario } from "../data/scenario.js";

const nord = { type: "zone", id: "N" }, ouest = { type: "zone", id: "O" };
const perso = { type: "personnage", id: "laurent" };
const evenements = [{ type: "fouiller", cible: "N", contexte: nord }, { type: "examiner", cible: "distinction", contexte: nord }];

describe("scènes et projections locales", () => {
  test("adapte les huit zones et le personnage sans changer leurs identifiants", () => {
    expect(scenesDepuisScenario(scenario)).toHaveLength(9);
    expect(scenePourContexte(scenario, nord)).toMatchObject({ id: "zone:N", type: "exploration" });
    expect(scenePourContexte(scenario, perso)).toMatchObject({ id: "personnage:laurent", type: "personnage" });
    expect(scenePourContexte(scenario, {type:"zone",id:"__proto__"})).toBeNull();
  });
  test("ne transmet ni les descriptions distantes ni des objets encore cachés", () => {
    const projection = projectionScene(scenario, evenements, nord);
    expect(projection.catalogue.zones).toHaveLength(1);
    expect(projection.catalogue.objetsConnus.some((o) => o.id === "telephone")).toBe(false);
    expect(JSON.stringify(projection)).not.toContain(scenario.zones.O.description);
    expect(JSON.stringify(projection)).not.toContain("declencheurs");
    expect(JSON.stringify(projection)).not.toContain("solution");
    expect(projection.faits.some((f) => f.cibleId === "distinction")).toBe(true);
  });
  test("une fouille ne fournit aucune description d'examen", () => {
    expect(projectionScene(scenario, evenements.slice(0,1), nord).faits).toEqual([]);
  });
  test("un examen ancien reste un aperçu après un prérequis acquis plus tard", () => {
    const variante = { ...scenario, preconditions: { "examiner:distinction": ["second"] }, declencheurs: { "examiner:distinction":"premier", "examiner:plante_fanee":"second" }, objets: { ...scenario.objets, distinction: { ...scenario.objets.distinction, apercu:"Aperçu sans révélation." } } };
    const suite = [...evenements, { type:"examiner",cible:"plante_fanee",contexte:nord }];
    expect(projectionScene(variante,suite,nord).faits.find((f)=>f.cibleId==="distinction").texte).toContain("Aperçu sans révélation.");
    expect(projectionScene(variante,suite,nord).faits.find((f)=>f.cibleId==="distinction").texte).not.toContain(scenario.objets.distinction.description);
  });
});

describe("hooks adressés", () => {
  const variante = { ...scenario, faitsHistoire: { prive:{ texte:"Fait réservé au personnage." }, local:{texte:"Fait réservé au nord."} }, hooksHistoire: [
    { id:"partager", apres:"donner:livre_factures", requiertTous:[], destinataire:{sceneId:"personnage:laurent",role:"personnage"}, ajouterFaits:["prive"] },
    { id:"local", apres:"examiner:distinction", requiertTous:[], destinataire:{sceneId:"zone:N",role:"exploration"}, ajouterFaits:["local"] },
  ] };
  test("examiner ne transmet pas automatiquement un nouveau fait au personnage", () => {
    expect(faitsPourDestinataire(variante,evenements,"personnage:laurent","personnage")).toEqual([]);
    expect(projectionPersonnage(variante,evenements).system).not.toContain("Fait réservé au personnage.");
  });
  test("une transmission ne touche que son destinataire et reste idempotente", () => {
    const don={type:"donner",cible:"livre_factures",contexte:perso};
    const suite=[...evenements,don,don];
    expect(faitsPourDestinataire(variante,suite,"personnage:laurent","personnage")).toEqual([{id:"prive",texte:"Fait réservé au personnage."}]);
    expect(faitsPourDestinataire(variante,suite,"zone:O","exploration")).toEqual([]);
  });
});

describe("mémoire locale signée", () => {
  const identite={scenarioId:"a",revision:"1",empreinte:"chaine"};
  test("isole les scènes et refuse une mémoire falsifiée ou une autre révision", () => {
    let mem=ajouterTourMemoire(null,"zone:N","exploration","Question N",[{role:"systeme",texte:"Réponse N"}]);
    mem=ajouterTourMemoire(mem,"zone:O","exploration","Question O",[{role:"systeme",texte:"Réponse O"}]);
    const token=signerMemoire("secret",mem,identite);
    const lu=lireMemoire("secret",token,identite);
    expect(historiqueLocal(lu,"zone:N","exploration").map((t)=>t.texte)).toEqual(["Question N","Réponse N"]);
    expect(historiqueLocal(lu,"zone:N","personnage")).toEqual([]);
    expect(()=>lireMemoire("secret",token+"x",identite)).toThrow();
    expect(()=>lireMemoire("secret",token,{...identite,revision:"2"})).toThrow();
    expect(()=>lireMemoire("secret",token,{...identite,empreinte:"autre"})).toThrow();
  });
  test("borne la mémoire sans modifier l'origine", () => {
    let mem=null;
    for(let i=0;i<20;i++)mem=ajouterTourMemoire(mem,"zone:N","exploration",`Q${i}`,[{role:"systeme",texte:`R${i}`}]);
    expect(historiqueLocal(mem,"zone:N","exploration")).toHaveLength(12);
    const avant=JSON.stringify(mem); ajouterTourMemoire(mem,"zone:N","exploration","Nouvelle",[]);
    expect(JSON.stringify(mem)).toBe(avant);
  });
});

test("la mémoire reste signable avec de longs textes Unicode",()=>{
  let memoire={canaux:{},sequence:0};
  for(let i=0;i<30;i++)memoire=ajouterTourMemoire(memoire,`zone:${i}`,'exploration','é'.repeat(500),[{role:'systeme',texte:'界'.repeat(2000)}]);
  expect(()=>signerMemoire('secret',memoire,{revision:'r'})).not.toThrow();
});

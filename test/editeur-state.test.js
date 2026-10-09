import helene from "../data/enquetes/helene/scenario.json" with { type: "json" };
import {test,expect} from "vitest";
import {creerEnqueteVide} from "../editeur/state.js";

test("les contrôles des agents créent des champs optionnels sans muter le brouillon", async()=>{
  const {modifierAgents}=await import('../editeur/actions-agents.js');
  const enquete=creerEnqueteVide('Test','test');
  const fait=modifierAgents(enquete,'ajouter-fait',{},'indice');
  expect(enquete.faitsHistoire).toBeUndefined();expect(fait.faitsHistoire.indice).toEqual({texte:''});
  const hook=modifierAgents(fait,'ajouter-hook',{});
  expect(hook.hooksHistoire).toHaveLength(1);
  expect(modifierAgents(hook,'supprimer-hook',{index:'0'}).hooksHistoire).toEqual([]);
  expect(()=>modifierAgents(fait,'ajouter-fait',{},'indice')).toThrow();
});

test("renommer objet et flag préserve les hooks et la validité de l’enquête", async () => {
  const { renommerObjet, renommerFlag } = await import('../editeur/state.js');
  const { validerEnquete } = await import('../server/enquetes-schema.js');
  const enquete = structuredClone(helene);
  const flag = enquete.declencheurs['examiner:distinction'];
  enquete.faitsHistoire = { connu: { texte: 'Fait adressé.' } };
  enquete.hooksHistoire = [{ id: 'reagir', apres: 'examiner:distinction', requiertTous: [flag],
    destinataire: { sceneId: 'zone:N', role: 'exploration' }, ajouterFaits: ['connu'] }];
  expect(validerEnquete(enquete).erreurs).toEqual([]);
  const objet = renommerObjet(enquete, 'distinction', 'medaille');
  expect(objet.hooksHistoire[0].apres).toBe('examiner:medaille');
  const fait = renommerFlag(objet, flag, 'medaille_vue');
  expect(fait.hooksHistoire[0].requiertTous).toEqual(['medaille_vue']);
  expect(validerEnquete(fait).erreurs).toEqual([]);
  expect(enquete.hooksHistoire[0].apres).toBe('examiner:distinction');
  expect(enquete.hooksHistoire[0].requiertTous).toEqual([flag]);
});

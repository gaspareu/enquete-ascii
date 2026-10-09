import { describe,test,expect,vi } from "vitest";
import { resoudreTourScene } from "../server/agents/scene.js";
import { projectionScene } from "../server/projection-scene.js";
import { verifierModelesScenes } from "../server/model.js";
import { scenario } from "../data/scenario.js";
const nord={type:"zone",id:"N"};
function api(input) {return {messages:{create:vi.fn(async()=>({content:input?[{type:"tool_use",name:"decider_tour_scene",input}]:[]}))}};}
describe("contrats des agents locaux",()=>{
  test.each(["claude-sonnet-5-5","claude-haiku-4-5-20251001"])("%s respecte les options API propres au modèle",async model=>{
    const client=api({type:"observer",cibleId:"",portee:"cible"});
    const decision=await resoudreTourScene(client,{projection:projectionScene(scenario,[],nord),historique:[],message:"Observer ici",model});
    expect(decision).toEqual({type:"observer",contexte:nord});
    const args=client.messages.create.mock.calls[0][0];
    if(model.includes("sonnet"))expect(args.tool_choice).toEqual({type:"auto"});
    else {expect(args.thinking).toBeUndefined();expect(args.output_config).toBeUndefined();}
    expect(args.system).not.toContain(scenario.objets.telephone.description);
    expect(args.system).not.toContain(scenario.zones.O.description);
  });
  test("un transfert ne peut viser une destination absente du plan",async()=>{
    const resultat=await resoudreTourScene(api({type:"deplacer",destinationId:"inconnu"}),{projection:projectionScene(scenario,[],nord),historique:[],message:"Ailleurs",model:"test"});
    expect(resultat.type).toBe("clarifier");
  });
  test("l'absence d'outil est une panne, pas une ambiguïté du joueur",async()=>{
    await expect(resoudreTourScene(api(null),{projection:projectionScene(scenario,[],nord),historique:[],message:"Bonjour",model:"test"})).rejects.toThrow();
  });
  test("vérifie les modèles une fois et refuse un identifiant indisponible",async()=>{
    const retrieve=vi.fn(async id=>{if(id==="absent")throw new Error("404");});
    await verifierModelesScenes({models:{retrieve}},["sonnet","haiku","sonnet"]);
    expect(retrieve).toHaveBeenCalledTimes(2);
    await expect(verifierModelesScenes({models:{retrieve}},["absent"])).rejects.toThrow("indisponible");
  });
});

test("une clarification reste située dans la scène et propose uniquement ses cibles publiques",async()=>{
  const decision=await resoudreTourScene(api({type:'clarifier',cibleId:'',choix:[]}),{projection:projectionScene(scenario,[],nord),historique:[],message:'Lequel ?',model:'test'});
  expect(decision.question).not.toContain('Laurent');
});

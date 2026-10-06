import express from "express";
import request from "supertest";
import { describe, test, expect, vi } from "vitest";
import { creerRouteur } from "../server/chat.js";
import { scenario } from "../data/scenario.js";
import { decoupeTrames } from "../public/sse.js";

const nord={type:"zone",id:"N"},ouest={type:"zone",id:"O"},perso={type:"personnage",id:"laurent"};
function monter(options={}) {
  const agentSceneFn=vi.fn(options.agentSceneFn??(async()=>({type:"interagir",contexte:nord,action:"fouiller",cibleId:"N"})));
  const app=express();app.use(express.json()); app.use("/api",creerRouteur({scenario,secret:"secret",client:{},model:"sonnet-test",modelExploration:"haiku-test",agentSceneFn,...options}));
  return {app,agentSceneFn};
}
function events(rep) {return decoupeTrames(rep.text).trames.map(({event,data})=>({event,...JSON.parse(data)}));}
function etat(rep,avant=[]) {const e=events(rep);return {recus:[...avant,...e.filter(t=>t.event==="progression").flatMap(t=>t.recus??[])],memoireConversation:e.find(t=>t.event==="memoire").token};}

describe("orchestration des scènes",()=>{
  test("une navigation explicite ne fait aucun appel modèle et annonce une fois",async()=>{
    const {app,agentSceneFn}=monter(); const rep=await request(app).post("/api/tour").send({contexte:perso,navigation:nord,recus:[]});
    expect(rep.status).toBe(200);expect(agentSceneFn).not.toHaveBeenCalled();
    expect(events(rep).filter(t=>t.event==="observation")).toHaveLength(1);
    expect(events(rep).find(t=>t.event==="contexte").contexte).toEqual(nord);
  });
  test("une action utilise Haiku et signe la progression avant la mémoire",async()=>{
    const {app,agentSceneFn}=monter();const rep=await request(app).post("/api/tour").send({message:"Que trouve-t-on ici ?",contexte:nord,recus:[]});
    expect(rep.status).toBe(200);expect(agentSceneFn.mock.calls[0][1].model).toBe("haiku-test");
    expect(events(rep).find(t=>t.event==="observation").texte).toContain("Vous y découvrez");
    expect(etat(rep).recus).toHaveLength(1);
  });
  test("restaure la clarification locale, sans recopier l'autre scène",async()=>{
    const fn=vi.fn(async(_c,args)=>args.message==="oui"?{type:"observer",contexte:nord}:{type:"clarifier",question:"De cet endroit ?",choix:[]});
    const {app}=monter({agentSceneFn:fn});
    const premier=await request(app).post("/api/tour").send({message:"Détail N",contexte:nord,recus:[]});
    const suivant=await request(app).post("/api/tour").send({message:"Question O",contexte:ouest,...etat(premier)});
    await request(app).post("/api/tour").send({message:"oui",contexte:nord,...etat(suivant)});
    const args=fn.mock.calls[2][1];
    expect(args.historique.map(t=>t.texte)).toEqual(["Détail N","De cet endroit ?"]);
    expect(JSON.stringify(args)).not.toContain("Question O");
  });
  test("un déplacement libre transmet la demande originale au destinataire",async()=>{
    const fn=vi.fn(async(_c,args)=>args.projection.scene.id==="personnage:laurent"?{type:"deplacer",destination:ouest}:{type:"interagir",contexte:ouest,action:"fouiller",cibleId:"O"});
    const {app}=monter({agentSceneFn:fn});
    const rep=await request(app).post("/api/tour").send({message:"Que contient le secrétaire ?",contexte:perso,recus:[]});
    expect(rep.status).toBe(200);expect(fn.mock.calls.map(c=>c[1].model)).toEqual(["sonnet-test","haiku-test"]);
    expect(fn.mock.calls[1][1].message).toBe("Que contient le secrétaire ?");
    expect(events(rep).find(t=>t.event==="contexte").contexte).toEqual(ouest);
  });
  test("le personnage reçoit sa mémoire, jamais les observations d'une autre scène",async()=>{
    const repondreFluxFn=vi.fn(async(_c,args,emit)=>{emit({type:"delta",texte:"Bonjour."});return {evenementsExprimes:[]};});
    const {app}=monter({agentSceneFn:async()=>({type:"dialoguer",contexte:perso}),repondreFluxFn});
    const rep=await request(app).post("/api/tour").send({message:"Bonjour",contexte:perso,recus:[],historique:[{role:"systeme",texte:"secret inventé"}]});
    expect(events(rep).find(t=>t.event==="delta").texte).toBe("Bonjour.");
    expect(repondreFluxFn.mock.calls[0][1].historique).toEqual([]);
    expect(repondreFluxFn.mock.calls[0][1].model).toBe("sonnet-test");
  });
  test("mémoire falsifiée et reçu falsifié sont rejetés avant les agents",async()=>{
    const {app,agentSceneFn}=monter();
    for(const corps of [{recus:["faux"]},{recus:[],memoireConversation:"faux"}]) {
      expect((await request(app).post("/api/tour").send({message:"Oui",contexte:nord,...corps})).status).toBe(400);
    }
    expect(agentSceneFn).not.toHaveBeenCalled();
  });
  test("un examen caché est refusé sans reçu ni fait",async()=>{
    const {app}=monter({agentSceneFn:async()=>({type:"interagir",contexte:nord,action:"examiner",cibleId:"plaquette_somniferes"})});
    const rep=await request(app).post("/api/tour").send({message:"Examen",contexte:nord,recus:[]});
    expect(events(rep).some(t=>t.event==="erreur")).toBe(true);
    expect(etat(rep).recus).toEqual([]);
    expect(rep.text).not.toContain(scenario.objets.plaquette_somniferes.description);
  });
});

test("une coupure de parole n'attribue aucun événement de dialogue",async()=>{
  const {app}=monter({agentSceneFn:async()=>({type:"dialoguer"}),repondreFluxFn:async(_c,_a,emit)=>{
    emit({type:"delta",texte:"Une parole interrompue"}); throw new Error("Coupure fournisseur");
  }});
  const rep=await request(app).post("/api/tour").send({message:"Bonjour",contexte:perso,recus:[]});
  expect(etat(rep).recus).toEqual([]);
  expect(events(rep).some(t=>t.event==="erreur")).toBe(true);
  expect(rep.text).not.toContain("Coupure fournisseur");
});

test("une navigation ne peut pas utiliser une propriété héritée",async()=>{
  const {app,agentSceneFn}=monter();
  const rep=await request(app).post("/api/tour").send({contexte:perso,navigation:{type:"zone",id:"__proto__"},recus:[]});
  expect(rep.status).toBe(400); expect(agentSceneFn).not.toHaveBeenCalled();
});

test("un client déconnecté ne gagne pas d'événement de parole terminée ensuite",async()=>{
  const {orchestrerTour}=await import('../server/orchestrateur.js');
  const {verifierRecus}=await import('../server/progression.js');
  const identite={personnageId:'laurent'};
  const etatTour={verification:verifierRecus('secret',[],identite),memoire:{canaux:{},sequence:0}};
  let coupe=false; const emit=vi.fn();
  await orchestrerTour({scenario,secret:'secret',identite,client:{},model:'sonnet',demande:{message:'Bonjour',contexte:perso},etatTour,emit,
    annule:()=>coupe,agentSceneFn:async()=>({type:'dialoguer'}),repondreFluxFn:async(_c,_a,delta)=>{
      delta({type:'delta',texte:'Bonjour'});coupe=true;return {evenementsExprimes:[]};
    }});
  expect(emit.mock.calls.some(([type])=>type==='progression')).toBe(false);
  expect(etatTour.memoire.canaux).toEqual({});
});

test("seuls les événements autorisés d'une parole achevée alimentent les hooks",async()=>{
  const copie=structuredClone(scenario);
  copie.connaissances.push({id:'temoignage',texte:'Un fait autorisé.',requiert:[],evenementQuandExprime:'temoignage_exprime'});
  copie.faitsHistoire={retour:{texte:'Le témoignage est confirmé.'}};
  copie.hooksHistoire=[{id:'retour',apres:'dialogue:temoignage_exprime',requiertTous:[],destinataire:{sceneId:'personnage:laurent',role:'personnage'},ajouterFaits:['retour']}];
  const fn=vi.fn(async(_c,_args,emit)=>{emit({type:'delta',texte:'Un fait autorisé.'});return {evenementsExprimes:['temoignage_exprime','temoignage_exprime','invente']};});
  const {app}=monter({scenario:copie,agentSceneFn:async()=>({type:'dialoguer'}),repondreFluxFn:fn});
  const rep=await request(app).post('/api/tour').send({message:'Parlez',contexte:perso,recus:[]});
  expect(etat(rep).recus).toHaveLength(1);
  await request(app).post('/api/tour').send({message:'Continuez',contexte:perso,...etat(rep)});
  expect(fn.mock.calls[1][1].system).toContain('Le témoignage est confirmé.');
  expect(fn.mock.calls[1][1].evenementsAutorises).not.toContain('temoignage_exprime');
  expect(rep.text).not.toContain('Le témoignage est confirmé.');
  const capsule=JSON.parse(Buffer.from(etat(rep).memoireConversation.split('.')[0], 'base64url').toString('utf8'));
  expect(JSON.stringify(capsule)).not.toContain('Le témoignage est confirmé.');
});

test("un simple retour au personnage n'annonce pas deux fois son observation",async()=>{
  const fn=vi.fn(async(_c,args)=>args.projection.scene.id==='zone:O'?{type:'deplacer',destination:perso}:{type:'observer'});
  const {app}=monter({agentSceneFn:fn});
  const rep=await request(app).post('/api/tour').send({message:'Je rejoins Laurent',contexte:ouest,recus:[]});
  expect(events(rep).filter(e=>e.event==='observation')).toHaveLength(1);
});

test("reprend après une coupure entre progression et mémoire finale", async () => {
  const { app } = monter();
  const premier = await request(app).post("/api/tour").send({ message: "Fouiller", contexte: nord, recus: [] });
  const avant = etat(premier);
  const second = await request(app).post("/api/tour").send({ message: "Encore", contexte: nord, ...avant });
  // Le navigateur ne reçoit que cette trame complète avant la coupure.
  const confirme = events(second).find((e) => e.event === "progression");
  expect(typeof confirme.memoireConversation).toBe("string");
  const reprise = await request(app).post("/api/tour").send({ message: "Reprendre", contexte: nord,
    recus: [...avant.recus, ...confirme.recus], memoireConversation: confirme.memoireConversation });
  expect(reprise.status).toBe(200);
  // Une ancienne mémoire associée aux nouveaux reçus reste rejetée.
  const falsifie = await request(app).post("/api/tour").send({ message: "Reprendre", contexte: nord,
    recus: [...avant.recus, ...confirme.recus], memoireConversation: avant.memoireConversation });
  expect(falsifie.status).toBe(400);
});

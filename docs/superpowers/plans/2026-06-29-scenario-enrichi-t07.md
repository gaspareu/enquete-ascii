# Nouveau scénario enrichi « Ce que préparait Hélène » (T-07) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le scénario « Mort au manoir Aldous » par un scénario d'enquête ramifié et riche (féminicide maquillé en suicide), entièrement piloté par les données.

**Architecture:** Tout est *data-driven*. Le seul fichier de logique métier reste inchangé ; le travail consiste à réécrire `data/scenario.js` (8 zones, ~9 objets utiles + ~25 d'ambiance, 3 fils de flags à préconditions croisées, 3 preuves requises), à migrer les 4 suites de tests couplées au contenu, à ajouter une suite de couverture pour les nouveaux fils, et à rafraîchir commentaires + doc. Le front est générique (8 directions, N objets/zone) : aucune modification.

**Tech Stack:** Node 18+, JavaScript ESM (sans build), Vitest + supertest.

**Référence design :** `docs/superpowers/specs/2026-06-29-scenario-enrichi-t07-design.md`

---

## Rappel du modèle de flags (résolu côté serveur)

- `declencheurs["<geste>:<cible>"] = "<flag>"` : un geste pose un flag.
- `preconditions["<geste>:<cible>"] = ["<flag requis>", …]` : le flag n'est posé que si ces flags sont déjà acquis (résolu à **point fixe** → ordre du journal indifférent).
- `donner` exige l'objet préalablement `ramassé` (précondition de **sac**, order-strict).
- `objets[id].apercu` est servi par `/examiner` tant que le flag d'examen n'est pas dérivé ; `objets[id].description` (révélation) une fois la précondition remplie.
- Un objet **sans** `declencheurs["examiner:id"]` voit son examen renvoyer directement sa `description` (objet d'ambiance, sans secret).

**Carte des flags du scénario :**

| Geste | Flag posé | Précondition de flags |
|---|---|---|
| `examiner:theiere` | `double_tasse` | — |
| `examiner:plaquette_somniferes` | `recu_laurent_vu` | `double_tasse` |
| `examiner:distinction` | `reussite_vue` | — |
| `examiner:lettre_dettes` | `mobile_dettes` | — |
| `examiner:telephone` | `controle_vu` | — |
| `examiner:cadeau_cache` | `fete_decouverte` | — |
| `examiner:mot_manuscrit` | `invitation_lue` | `fete_decouverte` |
| `examiner:agenda` | `rdv_eclaircis` | `controle_vu` |
| `donner:grand_cru` | `confiance_gagnee` | — (sac : grand_cru ramassé) |
| `donner:plaquette_somniferes` | `aveu_acte` | `recu_laurent_vu`, `confiance_gagnee` (sac : plaquette ramassée) |
| `donner:mot_manuscrit` | `aveu_mobile` | `invitation_lue` (sac : mot ramassé) |

**Preuves requises (victoire) :** `["recu_laurent_vu", "fete_decouverte", "mobile_dettes"]`.

---

## Task 1: Remplacer `data/scenario.js` et faire passer les suites couplées

**Files:**
- Modify: `test/scenario.test.js`
- Modify: `test/prompt.test.js`
- Modify: `test/public-view.test.js`
- Modify: `test/routes.test.js`
- Modify: `data/scenario.js` (réécriture complète)

TDD : on réécrit d'abord les tests pour décrire le **nouveau** contenu (ils échouent sur l'ancien data), puis on remplace le data (ils passent).

- [ ] **Step 1 : Migrer `test/scenario.test.js`**

Remplacer le test « couvre toutes les cibles du vrai scénario » (le premier test, sur fixture inline, reste inchangé) :

```js
  test("couvre toutes les cibles du vrai scénario", () => {
    const cibles = ciblesConnues();
    expect(cibles.has("theiere")).toBe(true);
    expect(cibles.has("plaquette_somniferes")).toBe(true);
    expect(cibles.has("cadeau_cache")).toBe(true);
    expect(cibles.has("grand_cru")).toBe(true);
    // Un objet d'ambiance est lui aussi reconnu, sinon ses gestes seraient rejetés
    // à la validation HTTP.
    expect(cibles.has("photos_mariage")).toBe(true);
    expect(cibles.has("theiere")).toBe(ciblesConnues(scenario).has("theiere"));
  });
```

- [ ] **Step 2 : Migrer `test/prompt.test.js`**

La fixture inline (`Victor`) reste inchangée. Remplacer le dernier test :

```js
  test("scénario réel : l'aveu du mobile ne fuite pas sans flag", () => {
    const p = construitPrompt(scenario, []);
    expect(p.toLowerCase()).not.toContain("infidèle");
  });
```

- [ ] **Step 3 : Réécrire `test/public-view.test.js`**

```js
import { describe, test, expect } from "vitest";
import { vuePublique } from "../server/chat.js";
import { scenario } from "../data/scenario.js";

describe("vuePublique", () => {
  const vue = vuePublique(scenario);

  test("expose ce dont le frontend a besoin pour dessiner la pièce", () => {
    expect(vue.titre).toBe(scenario.titre);
    expect(vue.intro).toBe(scenario.intro);
    expect(vue.personnage.nom).toBe(scenario.personnage.nom);
    expect(vue.zones).toBeDefined();
    expect(vue.objets.grand_cru.nom).toBe("Grand cru");
    expect(vue.objets.grand_cru.ramassable).toBe(true);
  });

  test("expose le visage ASCII du personnage (donnée publique pour le rendu)", () => {
    expect(vue.personnage.visage).toBeDefined();
    expect(vue.personnage.visage).toBe(scenario.personnage.visage);
  });

  test("n'expose ni description ni aperçu des objets (servis à l'examen)", () => {
    expect(vue.objets.plaquette_somniferes.description).toBeUndefined();
    expect(vue.objets.plaquette_somniferes.apercu).toBeUndefined();
  });

  test("ne fuite jamais les secrets du scénario", () => {
    expect(vue.connaissances).toBeUndefined();
    expect(vue.solution).toBeUndefined();
    expect(vue.personnage.personnalite).toBeUndefined();
    expect(vue.personnage.faitsDeBase).toBeUndefined();
    // Le mapping geste→flag reste secret côté serveur (anti-triche).
    expect(vue.declencheurs).toBeUndefined();
    expect(vue.preconditions).toBeUndefined();

    const json = JSON.stringify(vue).toLowerCase();
    expect(json).not.toContain("au nom de laurent"); // révélation de la plaquette
    expect(json).not.toContain("infidèle"); // mobile / aveu
  });
});
```

- [ ] **Step 4 : Réécrire `test/routes.test.js`**

```js
import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { creerRouteur } from "../server/chat.js";
import { scenario, ciblesConnues } from "../data/scenario.js";

// Monte le routeur du jeu sur une app jetable. Les dépendances sont injectées
// (client, modèle, repondreFn) pour tester sans appel réseau.
function faireApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    creerRouteur({
      scenario,
      ciblesConnues: ciblesConnues(scenario),
      client: {},
      model: "modele-test",
      repondreFn: async () => "Réponse de test.",
      ...overrides,
    }),
  );
  return app;
}

const g = (geste, cible) => ({ geste, cible });

// Séquence d'examens qui réunit les trois preuves requises pour gagner.
const SEQUENCE_GAGNANTE = [
  g("examiner", "theiere"), // -> double_tasse
  g("examiner", "plaquette_somniferes"), // -> recu_laurent_vu (précond double_tasse)
  g("examiner", "cadeau_cache"), // -> fete_decouverte
  g("examiner", "lettre_dettes"), // -> mobile_dettes
];

describe("GET /scenario", () => {
  test("renvoie la vue publique sans fuiter de secret ni le mapping des flags", async () => {
    const res = await request(faireApp()).get("/api/scenario");
    expect(res.status).toBe(200);
    expect(res.body.titre).toBe(scenario.titre);
    expect(res.body.personnage.nom).toBe(scenario.personnage.nom);

    const json = JSON.stringify(res.body).toLowerCase();
    expect(json).not.toContain("au nom de laurent");
    expect(json).not.toContain("infidèle");
    expect(res.body.connaissances).toBeUndefined();
    expect(res.body.declencheurs).toBeUndefined();
  });
});

describe("POST /examiner", () => {
  // Bascule : la plaquette n'avoue le reçu de Laurent qu'après avoir constaté la
  // deuxième tasse (double_tasse). Avant, on ne sert que l'aperçu non-spoiler.
  test("plaquette sans l'indice : aperçu non-spoiler, pas la révélation", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "plaquette_somniferes", gestes: [] });
    expect(res.status).toBe(200);
    expect(res.body.texte.toLowerCase()).not.toContain("au nom de laurent");
    expect(res.body.texte).toBe(scenario.objets.plaquette_somniferes.apercu);
  });

  test("plaquette après la séquence légitime : la révélation complète", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({
        cible: "plaquette_somniferes",
        gestes: [g("examiner", "theiere"), g("examiner", "plaquette_somniferes")],
      });
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe(scenario.objets.plaquette_somniferes.description);
  });

  test("objet d'ambiance (photos de mariage) : toujours révélé, sans condition", async () => {
    const res = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "photos_mariage", gestes: [] });
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe(scenario.objets.photos_mariage.description);
  });

  test("cible absente ou non-chaîne : texte par défaut", async () => {
    const res = await request(faireApp()).post("/api/examiner").send({});
    expect(res.status).toBe(200);
    expect(res.body.texte).toBe("Rien de particulier ici.");
  });
});

describe("POST /chat", () => {
  test("requête invalide : 400 avec message d'erreur", async () => {
    const res = await request(faireApp()).post("/api/chat").send({ message: "" });
    expect(res.status).toBe(400);
    expect(typeof res.body.erreur).toBe("string");
  });

  test("clé API absente (client null) : 503", async () => {
    const res = await request(faireApp({ client: null }))
      .post("/api/chat")
      .send({ message: "Bonjour" });
    expect(res.status).toBe(503);
    expect(res.body.erreur).toContain("ANTHROPIC_API_KEY");
  });

  test("requête valide : 200 et délègue à repondreFn avec le bon contexte", async () => {
    const repondreFn = vi.fn(async () => "Bonjour à vous.");
    const res = await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({ message: "Bonjour", gestes: [g("ramasser", "grand_cru")] });

    expect(res.status).toBe(200);
    expect(res.body.reponse).toBe("Bonjour à vous.");
    expect(repondreFn).toHaveBeenCalledOnce();
    const [, args] = repondreFn.mock.calls[0];
    expect(args.message).toBe("Bonjour");
    expect(args.model).toBe("modele-test");
    expect(typeof args.system).toBe("string");
  });

  test("anti-triche : un journal incomplet ne débloque pas la connaissance", async () => {
    const repondreFn = vi.fn(async () => "…");
    // « donner » sans « ramasser » : la précondition de sac n'est pas remplie,
    // donc confiance_gagnee n'est pas dérivé et la connaissance reste verrouillée.
    await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({ message: "Parlez-moi de la soirée.", gestes: [g("donner", "grand_cru")] });
    const [, args] = repondreFn.mock.calls[0];
    expect(args.system.toLowerCase()).not.toContain("monté toi-même");
  });

  test("séquence légitime : la connaissance se débloque côté serveur", async () => {
    const repondreFn = vi.fn(async () => "…");
    await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({
        message: "Parlez-moi de la soirée.",
        gestes: [g("ramasser", "grand_cru"), g("donner", "grand_cru")],
      });
    const [, args] = repondreFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("monté toi-même");
  });

  test("repondreFn échoue : 502 et l'erreur n'est pas avalée", async () => {
    const erreurLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const repondreFn = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    const res = await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({ message: "Bonjour" });

    expect(res.status).toBe(502);
    expect(res.body.erreur).toBeDefined();
    expect(erreurLog).toHaveBeenCalled();
    erreurLog.mockRestore();
  });
});

describe("POST /accuser", () => {
  test("séquence légitime (3 preuves réunies) et bon verdict : partie gagnée", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: SEQUENCE_GAGNANTE });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(true);
  });

  test("anti-triche : la plaquette « à froid » (sans double_tasse) ne réunit pas la preuve", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: [g("examiner", "plaquette_somniferes")] });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });

  test("anti-triche : des flags forgés dans la requête sont ignorés (front non fiable)", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({
        verdict: true,
        gestes: [],
        flags: ["recu_laurent_vu", "fete_decouverte", "mobile_dettes"],
      });
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });

  test("verdict et gestes absents : valeurs par défaut sûres, partie perdue", async () => {
    const res = await request(faireApp()).post("/api/accuser").send({});
    expect(res.status).toBe(200);
    expect(res.body.gagne).toBe(false);
  });

  test("journal de gestes invalide : 400", async () => {
    const res = await request(faireApp())
      .post("/api/accuser")
      .send({ verdict: true, gestes: [g("voler", "theiere")] });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5 : Lancer les tests pour les voir échouer**

Run: `npm test`
Expected: FAIL — l'ancien `data/scenario.js` ne contient ni `Laurent`, ni `theiere`/`plaquette_somniferes`/`grand_cru`, ni les nouveaux flags. Les 4 suites migrées échouent (les suites sur fixtures inline restent vertes).

- [ ] **Step 6 : Réécrire `data/scenario.js`**

Remplacer **tout** le fichier par :

```js
// Scénario de l'enquête — entièrement éditable à la main, séparé du code.
// Huis clos : l'atelier d'Hélène Vasseur, architecte primée retrouvée morte, une
// tasse de tisane renversée près d'elle. Son mari Laurent (joué par le LLM) plaide
// le suicide ; au joueur de démêler le vrai du faux. Le LLM tient le rôle mais ne
// peut pas changer ces faits.
//
// Trois fils convergent vers l'accusation : l'ACTE (ce n'est pas un suicide, un
// tiers était là), le MOBILE (la jalousie de Laurent) et la SURPRISE (Hélène lui
// préparait une fête — anti-suicide et preuve de son innocence). Traitement digne
// et non voyeuriste : l'horreur passe par la révélation psychologique.

export const scenario = {
  titre: "Ce que préparait Hélène",

  intro:
    "Hélène Vasseur, architecte fraîchement primée, a été retrouvée morte dans " +
    "son atelier, une tasse de tisane renversée à ses pieds. Son mari Laurent, qui " +
    "parle de surmenage et de dépression, attend votre interrogatoire. Fouillez " +
    "l'atelier, faites-le parler, et démêlez le vrai du faux.",

  personnage: {
    nom: "Laurent",
    visage: [
      "     ______",
      "    /      \\",
      "   |  o  o  |",
      "   |   >    |",
      "   |  ___   |",
      "    \\_____/",
      "     |  |",
      "   __|  |__",
    ].join("\n"),
    personnalite:
      "Tu es Laurent Vasseur, mari d'Hélène. Posé, charmant, sûr de toi en surface. " +
      "Tu pousses la thèse du suicide : tu la décris surmenée, fragilisée par sa " +
      "notoriété récente. Sous la façade tu es possessif et jaloux de sa réussite, " +
      "mais tu ne le montres pas spontanément. Tu réponds par phrases courtes et tu " +
      "détournes les questions gênantes. Flatté, tu te détends et deviens bavard. Tu " +
      "ne révèles JAMAIS spontanément que tu es coupable et tu nies si l'on t'accuse " +
      "sans preuve. Tu ne mentionnes que ce que tu sais réellement ; tu n'inventes " +
      "pas de faits.",
    faitsDeBase: [
      "Tu t'appelles Laurent Vasseur, tu es le mari d'Hélène, la défunte.",
      "Tu dis l'avoir trouvée inanimée hier soir en rentrant, dans son atelier.",
      "Tu affirmes qu'elle était épuisée, sous pression depuis son prix, et tu " +
        "redoutes qu'elle ait commis l'irréparable.",
      "Tu te dis effondré par sa disparition.",
    ],
  },

  // 8 directions : NO, N, NE, O, E, SO, S, SE. Chaque zone porte un (parfois deux)
  // objet utile et environ trois objets d'ambiance sans valeur d'enquête.
  zones: {
    N: {
      description:
        "La grande table à dessin d'Hélène. Au mur, une distinction encadrée et des plans.",
      objetsCaches: ["distinction", "maquette", "crayons_plans", "plante_fanee"],
    },
    NE: {
      description: "Une bibliothèque d'architecture et des classeurs bien rangés.",
      objetsCaches: ["agenda", "monographies", "revues_deco", "presse_papier"],
    },
    E: {
      description: "Un guéridon où repose le plateau à tisane du soir.",
      objetsCaches: ["theiere", "boite_tisanes", "napperon", "cuillere_argent"],
    },
    SE: {
      description: "Une corbeille à papier près du bureau.",
      objetsCaches: ["plaquette_somniferes", "brouillons_froisses", "enveloppe_pub", "trognon_pomme"],
    },
    S: {
      description: "Un coin salon : un canapé, une table basse, quelques souvenirs.",
      objetsCaches: ["mot_manuscrit", "photos_mariage", "plaid", "roman_corne"],
    },
    SO: {
      description: "Un placard fermé, au fond de l'atelier.",
      objetsCaches: ["cadeau_cache", "manteaux", "cartons_archives", "raquette_tennis"],
    },
    O: {
      description: "Un secrétaire près de la fenêtre qui donne sur la rue.",
      objetsCaches: ["telephone", "courrier", "stylo_plume", "cartes_postales", "cactus"],
    },
    NO: {
      description: "Un meuble-bar cossu — l'espace de Laurent, qui détonne dans l'atelier.",
      objetsCaches: ["grand_cru", "lettre_dettes", "verres_whisky", "coffret_cigares", "trophee_golf"],
    },
  },

  objets: {
    // ----- Objets utiles -----
    distinction: {
      nom: "Distinction d'architecture",
      description:
        "Le prix décerné à Hélène le mois dernier, encadré. Dans la marge de " +
        "l'article de presse épinglé à côté, une main rageuse a souligné « ENCORE elle ».",
      ramassable: false,
    },
    agenda: {
      nom: "Agenda d'Hélène",
      apercu:
        "Un agenda de bureau. Reviennent des rendez-vous notés en abrégé : « 19h — M. », " +
        "« confirmer M. », « régler le solde ». Discret, presque clandestin.",
      description:
        "Recoupés avec les messages du téléphone, les rendez-vous se déchiffrent : « M. » " +
        "est Maurel, le traiteur ; « le solde », la facture d'un buffet. Les rencontres " +
        "clandestines étaient les préparatifs d'une fête, pas les rendez-vous d'un amant.",
      ramassable: true,
    },
    theiere: {
      nom: "Plateau à tisane",
      description:
        "Le plateau du soir : la théière encore à demi pleine et, près d'elle, DEUX " +
        "tasses utilisées. Hélène n'a pas pris sa tisane seule ce soir-là.",
      ramassable: false,
    },
    plaquette_somniferes: {
      nom: "Plaquette de somnifères",
      apercu:
        "Une plaquette de somnifères, entièrement vide, jetée à la corbeille. De quoi " +
        "faire une surdose… la version de Laurent se tient.",
      description:
        "En retournant la plaquette, un ticket de pharmacie y est agrafé : trois boîtes " +
        "de ce somnifère, achetées il y a une semaine — au nom de Laurent Vasseur.",
      ramassable: true,
    },
    mot_manuscrit: {
      nom: "Mot manuscrit",
      apercu:
        "Quelques lignes d'une écriture nerveuse : « je n'en peux plus de me cacher… " +
        "pardonne-moi ». On dirait un mot d'adieu.",
      description:
        "Couvert de ratures, ce n'est pas un adieu mais le brouillon d'un discours : " +
        "« …pardonne-moi mes cachotteries de ces dernières semaines. Ce soir, tous ceux " +
        "qui t'aiment sont réunis pour toi. » Le mot de la fête surprise.",
      ramassable: true,
    },
    cadeau_cache: {
      nom: "Paquet caché",
      description:
        "Au fond du placard, un paquet soigneusement emballé — l'étiquette dit « Pour " +
        "mon Laurent » — et, dans un sac, des guirlandes et des ballons pliés. Hélène " +
        "préparait une fête.",
      ramassable: false,
    },
    telephone: {
      nom: "Téléphone d'Hélène",
      description:
        "Un fil de messages avec « Maurel Traiteur » et avec sa sœur, à propos d'une " +
        "organisation tenue secrète. L'historique montre aussi que quelqu'un a " +
        "récemment fouillé l'appareil : saisies répétées du code, consultations nocturnes.",
      ramassable: true,
    },
    grand_cru: {
      nom: "Grand cru",
      description:
        "Une bouteille du grand cru préféré de Laurent, à son nom sur l'étiquette de " +
        "cave. De quoi flatter l'amateur qu'il est.",
      ramassable: true,
    },
    lettre_dettes: {
      nom: "Lettre de la banque",
      description:
        "Une lettre adressée à Laurent : découvert aggravé, échéances impayées, menace " +
        "de saisie. En marge, des chiffres griffonnés — et le montant du prix qu'Hélène " +
        "venait de toucher, entouré.",
      ramassable: false,
    },

    // ----- Objets d'ambiance (sans valeur d'enquête) -----
    maquette: {
      nom: "Maquette",
      description:
        "Une maquette en carton-plume d'un bâtiment courbe, signée de la main d'Hélène. " +
        "Le travail d'une vie.",
      ramassable: false,
    },
    crayons_plans: {
      nom: "Crayons et plans",
      description:
        "Un pot débordant de crayons et de tire-lignes, des plans roulés. L'ordre " +
        "méticuleux d'une créatrice.",
      ramassable: false,
    },
    plante_fanee: {
      nom: "Plante fanée",
      description: "Une plante verte sur le rebord, un peu fanée faute d'arrosage ces derniers jours.",
      ramassable: false,
    },
    monographies: {
      nom: "Monographies",
      description: "Une rangée de monographies d'architectes vénérés. Quelques pages sont cornées.",
      ramassable: false,
    },
    revues_deco: {
      nom: "Revues de déco",
      description: "Une pile de revues de décoration, certaines hérissées de Post-it enthousiastes.",
      ramassable: false,
    },
    presse_papier: {
      nom: "Presse-papier",
      description: "Un presse-papier en laiton en forme d'équerre. Lourd, sans plus.",
      ramassable: false,
    },
    boite_tisanes: {
      nom: "Boîte à tisanes",
      description: "Une boîte à compartiments : verveine, camomille, tilleul. Le rituel du soir.",
      ramassable: false,
    },
    napperon: {
      nom: "Napperon brodé",
      description: "Un napperon brodé sous le plateau, souvenir d'un voyage, dirait-on.",
      ramassable: false,
    },
    cuillere_argent: {
      nom: "Cuillère en argent",
      description: "Une petite cuillère en argent, ternie par le temps.",
      ramassable: false,
    },
    brouillons_froisses: {
      nom: "Brouillons froissés",
      description: "Des brouillons de plans raturés puis abandonnés. Le rebut ordinaire d'un atelier.",
      ramassable: false,
    },
    enveloppe_pub: {
      nom: "Enveloppe publicitaire",
      description: "Une enveloppe de publicité déchirée pour une cuisine équipée. Sans intérêt.",
      ramassable: false,
    },
    trognon_pomme: {
      nom: "Trognon de pomme",
      description: "Un trognon de pomme oublié. Hélène travaillait tard, semble-t-il.",
      ramassable: false,
    },
    photos_mariage: {
      nom: "Photos de mariage",
      description:
        "Des photos de mariage encadrées : Hélène et Laurent, rayonnants, il y a quelques " +
        "années. Difficile de les regarder en sachant comment l'histoire finit.",
      ramassable: false,
    },
    plaid: {
      nom: "Plaid",
      description: "Un plaid en laine jeté sur l'accoudoir, là où l'on se love pour lire.",
      ramassable: false,
    },
    roman_corne: {
      nom: "Roman corné",
      description: "Un roman corné, marque-page glissé aux deux tiers. Une lecture qu'elle ne finira pas.",
      ramassable: false,
    },
    manteaux: {
      nom: "Manteaux",
      description: "Des manteaux et des écharpes suspendus, imprégnés d'un parfum discret.",
      ramassable: false,
    },
    cartons_archives: {
      nom: "Cartons d'archives",
      description: "Des cartons étiquetés par année : dossiers de chantiers anciens.",
      ramassable: false,
    },
    raquette_tennis: {
      nom: "Raquette de tennis",
      description: "Une vieille raquette au cordage détendu, reléguée au fond.",
      ramassable: false,
    },
    courrier: {
      nom: "Courrier",
      description: "Une pile de courrier : factures, relevés, un magazine professionnel. Rien de notable.",
      ramassable: false,
    },
    stylo_plume: {
      nom: "Stylo plume",
      description: "Un stylo plume à capuchon, posé sur un sous-main. L'encre a un peu séché.",
      ramassable: false,
    },
    cartes_postales: {
      nom: "Cartes postales",
      description: "Quelques cartes postales de voyages passés, coincées dans le sous-main.",
      ramassable: false,
    },
    cactus: {
      nom: "Cactus",
      description: "Un petit cactus sur le rebord de la fenêtre, increvable lui.",
      ramassable: false,
    },
    verres_whisky: {
      nom: "Verres à whisky",
      description: "Deux verres à whisky en cristal, soigneusement alignés. Laurent reçoit, dit-on.",
      ramassable: false,
    },
    coffret_cigares: {
      nom: "Coffret de cigares",
      description: "Un coffret de cigares entamé, réservé aux grandes occasions de Laurent.",
      ramassable: false,
    },
    trophee_golf: {
      nom: "Trophée de golf",
      description:
        "Un trophée de tournoi de golf amateur, au nom de Laurent, bien en évidence. Il y tient.",
      ramassable: false,
    },
  },

  // Connaissances injectées dans le prompt UNIQUEMENT si tous leurs flags sont dérivés.
  connaissances: [
    {
      id: "confiance",
      texte:
        "Flatté par cette attention, tu baisses la garde : tu parles volontiers de ta " +
        "réussite et de ta soirée, et tu laisses échapper que tu as monté toi-même sa " +
        "tisane à Hélène ce soir-là, comme chaque soir.",
      requiert: ["confiance_gagnee"],
    },
    {
      id: "amertume",
      texte:
        "Si l'on évoque les succès d'Hélène, une pointe d'amertume perce : tu trouves " +
        "qu'on n'a parlé que d'elle ces derniers mois, et que ton propre travail a été éclipsé.",
      requiert: ["reussite_vue"],
    },
    {
      id: "controle",
      texte:
        "Acculé sur sa vie privée, tu admets à demi-mot que tu « gardais un œil » sur elle : " +
        "tu consultais son téléphone, parce que tu la sentais distante et la soupçonnais.",
      requiert: ["controle_vu"],
    },
    {
      id: "trouble_acte",
      texte:
        "Mis face au reçu de pharmacie à ton nom, tu te troubles : tu bafouilles, tu ne " +
        "sais pas expliquer pourquoi tu avais acheté autant de somnifères.",
      requiert: ["aveu_acte"],
    },
    {
      id: "effondrement",
      texte:
        "En comprenant que ses cachotteries n'étaient qu'une fête préparée pour toi — " +
        "qu'elle ne te trompait pas — tu t'effondres : tu lâches que tu la croyais " +
        "infidèle et que tu n'as pas supporté l'idée de la perdre.",
      requiert: ["aveu_mobile"],
    },
  ],

  // geste:cible → flag posé. Gestes possibles : "ramasser", "donner", "examiner".
  declencheurs: {
    "examiner:theiere": "double_tasse",
    "examiner:plaquette_somniferes": "recu_laurent_vu",
    "examiner:distinction": "reussite_vue",
    "examiner:lettre_dettes": "mobile_dettes",
    "examiner:telephone": "controle_vu",
    "examiner:cadeau_cache": "fete_decouverte",
    "examiner:mot_manuscrit": "invitation_lue",
    "examiner:agenda": "rdv_eclaircis",
    "donner:grand_cru": "confiance_gagnee",
    "donner:plaquette_somniferes": "aveu_acte",
    "donner:mot_manuscrit": "aveu_mobile",
  },

  // Préconditions de flags (au-delà du sac). Résolues à point fixe : l'ordre dans le
  // journal n'importe pas.
  preconditions: {
    "examiner:plaquette_somniferes": ["double_tasse"],
    "examiner:mot_manuscrit": ["fete_decouverte"],
    "examiner:agenda": ["controle_vu"],
    "donner:plaquette_somniferes": ["recu_laurent_vu", "confiance_gagnee"],
    "donner:mot_manuscrit": ["invitation_lue"],
  },

  solution: {
    coupable: true, // Laurent est bien le meurtrier.
    preuvesRequises: ["recu_laurent_vu", "fete_decouverte", "mobile_dettes"],
  },
};

// Ensemble des cibles que le scénario reconnaît (ids d'objets + cibles des
// déclencheurs) — sert à valider le journal de gestes reçu du client.
export function ciblesConnues(s = scenario) {
  const cibles = new Set(Object.keys(s.objets));
  for (const cle of Object.keys(s.declencheurs)) {
    const sep = cle.indexOf(":");
    if (sep !== -1) cibles.add(cle.slice(sep + 1));
  }
  return cibles;
}
```

- [ ] **Step 7 : Lancer les tests pour les voir passer**

Run: `npm test`
Expected: PASS — toutes les suites vertes (les 4 migrées + les inchangées sur fixtures inline).

- [ ] **Step 8 : Commit**

```bash
git add data/scenario.js test/scenario.test.js test/prompt.test.js test/public-view.test.js test/routes.test.js
git commit -m "feat: remplace le scénario par l'enquête « Ce que préparait Hélène » (T-07)"
```

---

## Task 2: Suite de couverture des trois fils et des bascules

**Files:**
- Create: `test/scenario-fils.test.js`

> Note TDD : le comportement existe déjà (data écrit en Task 1). Cette suite **caractérise et verrouille** la richesse du scénario (dérivation des 3 fils, point fixe, bascules, leviers, neutralité de l'ambiance) et sécurise la couverture. Elle doit être verte dès l'écriture.

- [ ] **Step 1 : Créer `test/scenario-fils.test.js`**

```js
import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { deriverFlags } from "../server/etat.js";
import { creerRouteur } from "../server/chat.js";
import { scenario, ciblesConnues } from "../data/scenario.js";

const g = (geste, cible) => ({ geste, cible });

function faireApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    creerRouteur({
      scenario,
      ciblesConnues: ciblesConnues(scenario),
      client: {},
      model: "modele-test",
      repondreFn: async () => "…",
      ...overrides,
    }),
  );
  return app;
}

describe("dérivation des fils (vrai scénario)", () => {
  test("fil ACTE : la 2e tasse débloque la lecture du reçu de la plaquette", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "theiere"),
      g("examiner", "plaquette_somniferes"),
    ]);
    expect(flags).toContain("double_tasse");
    expect(flags).toContain("recu_laurent_vu");
  });

  test("fil ACTE : sans la 2e tasse, la plaquette ne livre pas le reçu", () => {
    const flags = deriverFlags(scenario, [g("examiner", "plaquette_somniferes")]);
    expect(flags).not.toContain("recu_laurent_vu");
  });

  test("fil SURPRISE : la fête découverte débloque la relecture du mot", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "cadeau_cache"),
      g("examiner", "mot_manuscrit"),
    ]);
    expect(flags).toContain("fete_decouverte");
    expect(flags).toContain("invitation_lue");
  });

  test("fil SURPRISE : sans la fête, le mot reste un faux adieu", () => {
    const flags = deriverFlags(scenario, [g("examiner", "mot_manuscrit")]);
    expect(flags).not.toContain("invitation_lue");
  });

  test("fil MOBILE : le contrôle du téléphone éclaire l'agenda", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "telephone"),
      g("examiner", "agenda"),
    ]);
    expect(flags).toContain("controle_vu");
    expect(flags).toContain("rdv_eclaircis");
  });

  test("point fixe : examiner la plaquette AVANT la théière révèle quand même le reçu", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "plaquette_somniferes"), // à froid
      g("examiner", "theiere"), // l'indice arrive après
    ]);
    expect(flags).toContain("recu_laurent_vu");
  });

  test("levier : flatter (ramasser puis donner le grand cru) gagne la confiance", () => {
    const flags = deriverFlags(scenario, [
      g("ramasser", "grand_cru"),
      g("donner", "grand_cru"),
    ]);
    expect(flags).toContain("confiance_gagnee");
  });

  test("levier : l'aveu de l'acte exige le reçu vu ET la confiance gagnée", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "theiere"),
      g("examiner", "plaquette_somniferes"),
      g("ramasser", "grand_cru"),
      g("donner", "grand_cru"),
      g("ramasser", "plaquette_somniferes"),
      g("donner", "plaquette_somniferes"),
    ]);
    expect(flags).toContain("aveu_acte");
  });

  test("levier : confronter le mot avoue le mobile une fois la fête comprise", () => {
    const flags = deriverFlags(scenario, [
      g("examiner", "cadeau_cache"),
      g("examiner", "mot_manuscrit"),
      g("ramasser", "mot_manuscrit"),
      g("donner", "mot_manuscrit"),
    ]);
    expect(flags).toContain("aveu_mobile");
  });

  test("un objet d'ambiance ne pose aucun flag", () => {
    expect(deriverFlags(scenario, [g("examiner", "photos_mariage")])).toEqual([]);
    expect(deriverFlags(scenario, [g("ramasser", "trophee_golf")])).toEqual([]);
  });
});

describe("bascules HTTP /examiner", () => {
  test("le mot manuscrit : faux adieu avant la fête, invitation après", async () => {
    const froid = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "mot_manuscrit", gestes: [] });
    expect(froid.body.texte).toBe(scenario.objets.mot_manuscrit.apercu);

    const chaud = await request(faireApp())
      .post("/api/examiner")
      .send({
        cible: "mot_manuscrit",
        gestes: [g("examiner", "cadeau_cache"), g("examiner", "mot_manuscrit")],
      });
    expect(chaud.body.texte).toBe(scenario.objets.mot_manuscrit.description);
  });

  test("l'agenda : rendez-vous suspects avant le téléphone, éclaircis après", async () => {
    const froid = await request(faireApp())
      .post("/api/examiner")
      .send({ cible: "agenda", gestes: [] });
    expect(froid.body.texte).toBe(scenario.objets.agenda.apercu);

    const chaud = await request(faireApp())
      .post("/api/examiner")
      .send({
        cible: "agenda",
        gestes: [g("examiner", "telephone"), g("examiner", "agenda")],
      });
    expect(chaud.body.texte).toBe(scenario.objets.agenda.description);
  });
});

describe("aveu du mobile dans le prompt /chat", () => {
  test("confronter le mot (séquence complète) injecte l'effondrement dans le système", async () => {
    const repondreFn = vi.fn(async () => "…");
    await request(faireApp({ repondreFn }))
      .post("/api/chat")
      .send({
        message: "Vous la croyiez infidèle ?",
        gestes: [
          g("examiner", "cadeau_cache"),
          g("examiner", "mot_manuscrit"),
          g("ramasser", "mot_manuscrit"),
          g("donner", "mot_manuscrit"),
        ],
      });
    const [, args] = repondreFn.mock.calls[0];
    expect(args.system.toLowerCase()).toContain("infidèle");
  });
});
```

- [ ] **Step 2 : Lancer la nouvelle suite**

Run: `npm test -- scenario-fils`
Expected: PASS (le data de la Task 1 satisfait déjà ces caractérisations).

- [ ] **Step 3 : Vérifier la couverture globale**

Run: `npm run coverage`
Expected: PASS — couverture ≥ seuils configurés (le nouveau contenu est largement exercé).

- [ ] **Step 4 : Commit**

```bash
git add test/scenario-fils.test.js
git commit -m "test: couvre les trois fils, bascules et leviers du scénario (T-07)"
```

---

## Task 3: Rafraîchir les commentaires d'exemple couplés à l'ancien scénario

**Files:**
- Modify: `server/etat.js` (commentaires uniquement)
- Modify: `server/chat.js` (commentaires uniquement)

Les commentaires citent encore `chocolats`/`tableau`/`code_coffre`. On les ré-ancre sur le nouveau scénario, sans changer une ligne de code exécutable.

- [ ] **Step 1 : `server/etat.js`**

Remplacer la mention d'exemple dans le commentaire de tête de `deriverFlags` (« ex. examiner le tableau ne révèle le code qu'après l'indice débloqué par chocolats_donnes ») par :

```
//   - préconditions de FLAGS (ensemblistes, cf. scenario.preconditions) : un flag
//     peut exiger qu'un autre flag soit déjà acquis (ex. examiner la plaquette de
//     somnifères ne révèle le reçu de Laurent qu'après avoir constaté la 2e tasse).
```

Et le commentaire du point fixe (« pour qu'un examen « à froid » ne verrouille pas la révélation légitimement obtenue plus tard ») reste valable tel quel.

- [ ] **Step 2 : `server/chat.js`**

Dans le commentaire de la route `/examiner`, remplacer l'exemple parenthésé final
(« anti-triche T-03 : examiner le tableau avant l'indice ne révèle ni le code ni la fiole ») par :

```
  // une cible (cf. T-03) si son flag d'examen (declencheurs["examiner:cible"]) est
  // légitimement dérivé du journal de gestes ; sinon on ne sert que l'aperçu
  // non-spoiler (ex. la plaquette de somnifères avant d'avoir vu la 2e tasse).
```

- [ ] **Step 3 : Vérifier que rien n'est cassé**

Run: `npm test`
Expected: PASS (changement de commentaires uniquement).

- [ ] **Step 4 : Commit**

```bash
git add server/etat.js server/chat.js
git commit -m "docs: ré-ancre les commentaires d'exemple sur le scénario d'Hélène (T-07)"
```

---

## Task 4: Mettre à jour la documentation et le backlog

**Files:**
- Modify: `CLAUDE.md` (codemap)
- Modify: `BACKLOG.md`

- [ ] **Step 1 : `CLAUDE.md`**

Dans la section « Mécanique des flags (anti-triche) », remplacer l'exemple
« un déclencheur ne pose son flag que si d'autres flags sont déjà acquis — ex. `examiner:tableau` exige `chocolats_donnes` » par :

```
  si d'autres flags sont déjà acquis — ex. `examiner:plaquette_somniferes` exige
  `double_tasse` (la 2e tasse), ou `examiner:mot_manuscrit` exige `fete_decouverte`.
```

Et, juste après, l'exemple « de même, `/examiner` ne sert la *description-révélation* d'une cible que si son flag d'examen est légitimement dérivé » reste valable tel quel.

- [ ] **Step 2 : `BACKLOG.md`**

Déplacer la tâche **T-07** de la section « À faire » vers « En cours » (conformément au Flow de contribution : « En commençant, déplacer la tâche dans En cours »). Couper le bloc `### T-07 · 🟢 Enrichir le contenu / scénarios multiples` (titre + description) et le coller sous « ## En cours » à la place de `_(rien pour l'instant)_`.

> Le retrait définitif de T-07 du backlog se fera **après merge de la PR** (hors périmètre de ce plan, cf. CLAUDE.md).

- [ ] **Step 3 : Vérifier la suite (inchangée par la doc)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md BACKLOG.md
git commit -m "docs: met à jour codemap et backlog pour le scénario T-07"
```

---

## Après l'implémentation (hors steps TDD — Flow de contribution du projet)

1. `npm run coverage` — confirmer le maintien des seuils.
2. `/code-review` puis `/simplify` sur le diff de la branche.
3. `/security-review` — vérifier qu'aucune révélation (reçu, mobile, aveux) ne sort hors `/examiner`/`/chat` légitimes et que la vue publique ne fuite rien.
4. `git push -u origin feat/scenario-enrichi-t07` puis `gh pr create`.
5. Après merge : retirer T-07 du backlog (« En cours » → supprimé), « Fait » gardé purgé.

## Vérification finale (checklist de fin)

- [ ] `npm test` vert (toutes suites).
- [ ] `npm run coverage` ≥ seuils.
- [ ] Aucune référence résiduelle à `victor`/`chocolat`/`tableau`/`aldous`/`code_coffre` hors historique git :
  Run: `grep -rin -E "victor|chocolat|tableau|aldous|code_coffre|cle_rouillee" data/ server/ test/ public/ CLAUDE.md`
  Expected: aucune correspondance (hormis, éventuellement, des occurrences légitimes sans rapport).
- [ ] La partie est gagnable : la séquence des 3 fils réunit `recu_laurent_vu` + `fete_decouverte` + `mobile_dettes`.
```

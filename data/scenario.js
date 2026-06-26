// Scénario de l'enquête — entièrement éditable à la main, séparé du code.
// Voir le schéma dans le plan : personnage, zones, objets, connaissances,
// declencheurs, solution. Le LLM joue le rôle mais ne peut pas changer ces faits.

export const scenario = {
  titre: "Mort au manoir Aldous",

  // Mise en situation affichée au lancement.
  intro:
    "M. Aldous a été retrouvé mort dans son bureau, une tasse de thé renversée " +
    "à ses pieds. Son neveu, seul présent ce soir-là, attend votre interrogatoire. " +
    "Fouillez la pièce, faites-le parler, et confondez le coupable.",

  personnage: {
    nom: "Victor",
    // Comment il parle et se comporte (le LLM improvise le ton à partir de ça).
    personnalite:
      "Tu es Victor, neveu du défunt. Nerveux, affable en surface mais évasif. " +
      "Tu réponds par phrases courtes et détournes les questions gênantes. " +
      "Tu es gourmand : si on t'offre des chocolats, tu te détends et deviens cordial. " +
      "Tu ne révèles JAMAIS spontanément que tu es coupable et tu nies si on t'accuse sans preuve. " +
      "Tu ne mentionnes que ce que tu sais réellement ; tu n'inventes pas de faits.",
    // Ce que Victor sait et dit toujours, sans condition.
    faitsDeBase: [
      "Tu t'appelles Victor, tu es le neveu de M. Aldous, le défunt.",
      "Tu prétends avoir trouvé ton oncle déjà mort en rentrant du jardin vers 21h.",
      "Tu dis être bouleversé par cette mort.",
      "Tu cherches justement une boîte de chocolats que tu avais posée quelque part.",
    ],
  },

  // 8 directions possibles : NO, N, NE, O, E, SO, S, SE.
  // Les directions non listées sont décrites par défaut comme sans intérêt.
  zones: {
    N: {
      description: "Un grand portrait austère de M. Aldous est accroché au mur nord.",
      objetsCaches: ["tableau"],
    },
    E: {
      description: "Un bureau en acajou couvert de papiers. Une boîte de chocolats y traîne.",
      objetsCaches: ["chocolats"],
    },
    S: {
      description: "Une bibliothèque poussiéreuse. Une vieille clé est posée sur une étagère.",
      objetsCaches: ["cle_rouillee"],
    },
    O: {
      description: "Une fenêtre donne sur le jardin sombre. Rien d'autre par ici.",
      objetsCaches: [],
    },
  },

  objets: {
    chocolats: {
      nom: "Chocolats",
      description: "Une boîte de chocolats fins, à peine entamée.",
      ramassable: true,
    },
    cle_rouillee: {
      nom: "Clé rouillée",
      description: "Une vieille clé rouillée ; elle n'ouvre plus rien ici. (sans importance)",
      ramassable: true,
    },
    tableau: {
      nom: "Portrait de M. Aldous",
      description:
        "En soulevant le cadre, vous découvrez un papier glissé au dos : le code du coffre, " +
        "et dans le coffre, une fiole de poison portant les empreintes de Victor.",
      ramassable: false,
    },
  },

  // Connaissances injectées dans le prompt UNIQUEMENT si leurs flags requis sont vrais.
  connaissances: [
    {
      id: "code_coffre",
      texte:
        "Maintenant que le joueur t'a offert des chocolats, tu te détends et tu peux " +
        "lâcher, presque malgré toi, que le code du coffre est caché derrière le tableau, au mur nord.",
      requiert: ["chocolats_donnes"],
    },
  ],

  // geste:cible → flag posé. Les gestes possibles sont "ramasser", "donner", "examiner".
  declencheurs: {
    "ramasser:chocolats": "chocolats_trouves",
    "ramasser:cle_rouillee": "cle_trouvee", // objet d'ambiance, non requis
    "donner:chocolats": "chocolats_donnes",
    "examiner:tableau": "code_coffre_lu", // découvrir le code + la fiole de poison
  },

  solution: {
    coupable: true, // Victor est bien le meurtrier.
    preuvesRequises: ["code_coffre_lu"], // il faut avoir découvert la preuve du coffre.
  },
};

// Ensemble des flags que le scénario peut produire — sert à valider les entrées
// reçues du client (on rejette tout flag inconnu).
export function flagsConnus(s = scenario) {
  const flags = new Set();
  for (const flag of Object.values(s.declencheurs)) flags.add(flag);
  for (const c of s.connaissances) for (const f of c.requiert) flags.add(f);
  for (const f of s.solution.preuvesRequises) flags.add(f);
  return flags;
}

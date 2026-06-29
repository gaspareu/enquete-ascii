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
    // Visage ASCII du face-à-face (donnée publique, pas un secret). Exemple
    // « maison » ; remplaçable par un rendu ASCII Facemaker (voir la licence).
    visage: [
      "    ________",
      "   /        \\",
      "  |  -.  .-  |",
      "  |  (o)(o)  |",
      "  |    ||    |",
      "  |   '__'   |",
      "   \\  ____  /",
      "    | |  | |",
      "   _|_|  |_|_",
    ].join("\n"),
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
      // Aperçu servi tant que l'indice n'est pas débloqué : aucun spoiler. La
      // révélation (description) n'est renvoyée par /examiner qu'une fois code_coffre_lu
      // gagné (cf. preconditions ci-dessous + server/etat.js).
      apercu:
        "Un portrait austère de M. Aldous, le regard sévère sous un cadre massif. " +
        "Rien d'évident ne s'en dégage au premier coup d'œil.",
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

  // Préconditions de flags (au-delà du sac, géré dans server/etat.js). Un déclencheur
  // ne pose son flag que si tous les flags listés ici sont déjà acquis. Ici : on ne
  // découvre le code derrière le tableau qu'APRÈS l'indice de Victor — indice lui-même
  // débloqué par chocolats_donnes. Examiner le tableau « à froid » ne révèle donc rien.
  preconditions: {
    "examiner:tableau": ["chocolats_donnes"],
  },

  solution: {
    coupable: true, // Victor est bien le meurtrier.
    preuvesRequises: ["code_coffre_lu"], // il faut avoir découvert la preuve du coffre.
  },
};

// Ensemble des cibles que le scénario reconnaît (ids d'objets + cibles des
// déclencheurs) — sert à valider le journal de gestes reçu du client : on rejette
// tout geste portant sur une cible inconnue. Le serveur dérive ensuite les flags
// du journal (cf. server/etat.js), le client n'en envoie plus.
export function ciblesConnues(s = scenario) {
  const cibles = new Set(Object.keys(s.objets));
  for (const cle of Object.keys(s.declencheurs)) {
    const sep = cle.indexOf(":");
    if (sep !== -1) cibles.add(cle.slice(sep + 1));
  }
  return cibles;
}

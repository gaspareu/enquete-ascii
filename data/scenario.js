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

  // Deux familles d'objets utiles :
  //  - RÉVÉLATION DIRECTE (pas d'`apercu`) : la description s'affiche dès l'examen,
  //    le flag d'examen n'est qu'un effet de bord (ex. theiere, distinction,
  //    telephone, cadeau_cache, lettre_dettes).
  //  - À BASCULE (avec `apercu`) : l'aperçu non-spoiler est servi tant que la
  //    précondition n'est pas remplie, puis la description-révélation (ex. agenda,
  //    plaquette_somniferes, mot_manuscrit).
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
      id: "rdv_innocents",
      texte:
        "Si l'on t'établit que ses rendez-vous secrets n'étaient que les préparatifs " +
        "de la fête — et non ceux d'un amant —, tu accuses le coup : tu n'as plus rien " +
        "à opposer à ton soupçon.",
      requiert: ["rdv_eclaircis"],
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

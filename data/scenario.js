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
    portraits: {
      neutre: "/images/laurent-neutre.png",
      mefiant: "/images/laurent-mefiant.png",
      irrite: "/images/laurent-irrite.png",
      inquiet: "/images/laurent-inquiet.png",
    },
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
      nom: "table à dessin",
      article: "la",
      aliases: ["table", "bureau d'Hélène"],
      description:
        "La grande table à dessin d'Hélène. Au mur, une distinction encadrée et des plans.",
      illustration: "/images/nord.jpeg",
      objetsCaches: ["distinction", "maquette", "crayons_plans", "plante_fanee"],
    },
    NE: {
      nom: "bibliothèque",
      article: "la",
      aliases: ["étagères", "rayonnage"],
      description: "Une bibliothèque d'architecture et des classeurs bien rangés.",
      illustration: "/images/nord-est.jpeg",
      objetsCaches: ["agenda", "monographies", "revues_deco", "presse_papier"],
    },
    E: {
      nom: "plateau à tisane",
      article: "le",
      aliases: ["guéridon", "tisanes"],
      description: "Un guéridon où repose le plateau à tisane du soir.",
      illustration: "/images/est.jpeg",
      objetsCaches: ["theiere", "boite_tisanes", "napperon", "cuillere_argent"],
    },
    SE: {
      nom: "corbeille à papier",
      article: "la",
      aliases: ["corbeille", "poubelle"],
      description: "Une corbeille à papier près du bureau.",
      illustration: "/images/sud-est.jpeg",
      objetsCaches: [
        "brochure_vente_appartement",
        "courrier_syndic_dechire",
        "plaquette_somniferes",
        "brouillons_froisses",
        "enveloppe_pub",
        "trognon_pomme",
      ],
    },
    S: {
      nom: "coin salon",
      article: "le",
      aliases: ["salon", "canapé"],
      description: "Un coin salon : un canapé, une table basse, quelques souvenirs.",
      illustration: "/images/sud.jpeg",
      objetsCaches: ["mot_manuscrit", "photos_mariage", "plaid", "roman_corne"],
    },
    SO: {
      nom: "placard",
      article: "le",
      aliases: ["armoire"],
      description: "Un placard fermé, au fond de l'atelier.",
      illustration: "/images/sud-ouest.jpeg",
      objetsCaches: ["cadeau_cache", "manteaux", "cartons_archives", "raquette_tennis"],
    },
    O: {
      nom: "secrétaire",
      article: "le",
      aliases: ["bureau", "secrétaire en bois"],
      description: "Un secrétaire près de la fenêtre qui donne sur la rue.",
      illustration: "/images/ouest.jpeg",
      objetsCaches: ["telephone", "courrier", "stylo_plume", "cartes_postales", "cactus"],
    },
    NO: {
      nom: "meuble-bar",
      article: "le",
      aliases: ["bar"],
      description: "Un meuble-bar cossu — l'espace de Laurent, qui détonne dans l'atelier.",
      illustration: "/images/nord-ouest.jpeg",
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
      observations: {
        cadre: "Une fine poussière s'est logée dans les angles du cadre.",
        verre: "Le verre porte une petite rayure visible dans la lumière de l'atelier.",
      },
      description:
        "Le prix décerné à Hélène le mois dernier, encadré. Dans la marge de " +
        "l'article de presse épinglé à côté, une main rageuse a souligné « ENCORE elle ».",
      ramassable: false,
    },
    agenda: {
      nom: "Agenda d'Hélène",
      observations: {
        couverture: "La couverture souple a blanchi le long de la tranche.",
        elastique: "L'élastique qui le ferme a perdu un peu de sa tension.",
      },
      apercu:
        "Un agenda de bureau. Reviennent des rendez-vous notés en abrégé : « 19h — M. », " +
        "« confirmer M. », « régler le solde ». Discret, presque clandestin.",
      description:
        "Recoupés avec les messages du téléphone, les rendez-vous se déchiffrent : « M. » " +
        "est Maurel, le traiteur ; « le solde », la facture d'un buffet. Les rencontres " +
        "clandestines étaient les préparatifs d'une fête, pas les rendez-vous d'un amant.",
      ramassable: false,
    },
    theiere: {
      nom: "Plateau à tisane",
      observations: {
        ceramique: "Une minuscule ébréchure marque le bord de la théière.",
        anse: "L'anse est lisse à force d'être saisie au même endroit.",
      },
      description:
        "Le plateau du soir : la théière encore à demi pleine et, près d'elle, DEUX " +
        "tasses utilisées. Hélène n'a pas pris sa tisane seule ce soir-là.",
      ramassable: false,
    },
    plaquette_somniferes: {
      nom: "Plaquette de somnifères",
      observations: {
        plastique: "Le plastique transparent est froissé sur un côté.",
        aluminium: "La feuille d'aluminium crépite doucement quand on la retourne.",
      },
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
      observations: {
        papier: "Le papier a été plié deux fois puis déplié à plat.",
        encre: "Une petite tache d'encre épaissit la fin d'un trait.",
      },
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
      observations: {
        papier: "Le papier d'emballage forme un pli de travers sur un coin.",
        ruban: "Un ruban légèrement vrillé retient le paquet.",
      },
      description:
        "Au fond du placard, un paquet soigneusement emballé — l'étiquette dit « Pour " +
        "mon Laurent » — et, dans un sac, des guirlandes et des ballons pliés. Hélène " +
        "préparait une fête.",
      ramassable: false,
    },
    telephone: {
      nom: "Téléphone d'Hélène",
      observations: {
        ecran: "Des traces de doigts s'effacent en biais sur l'écran.",
        coque: "La coque est polie aux endroits où la main la tient.",
      },
      description:
        "Un fil de messages avec « Maurel Traiteur » et avec sa sœur, à propos d'une " +
        "organisation tenue secrète. L'historique montre aussi que quelqu'un a " +
        "récemment fouillé l'appareil : saisies répétées du code, consultations nocturnes.",
      ramassable: false,
    },
    grand_cru: {
      nom: "Grand cru",
      observations: {
        col: "La cire autour du goulot présente une légère craquelure.",
        verre: "Le verre sombre laisse à peine deviner le vin à l'intérieur.",
      },
      description:
        "Une bouteille du grand cru préféré de Laurent, à son nom sur l'étiquette de " +
        "cave. De quoi flatter l'amateur qu'il est.",
      ramassable: true,
    },
    lettre_dettes: {
      nom: "Lettre de la banque",
      observations: {
        enveloppe: "Le bord de l'enveloppe est découpé de façon irrégulière.",
        pli: "La feuille garde un pli net au milieu.",
      },
      description:
        "Une lettre adressée à Laurent : découvert aggravé, échéances impayées, menace " +
        "de saisie. En marge, des chiffres griffonnés — et le montant du prix qu'Hélène " +
        "venait de toucher, entouré.",
      ramassable: false,
    },

    // ----- Objets d'ambiance (sans valeur d'enquête) -----
    maquette: {
      nom: "Maquette",
      observations: {
        carton: "Les arêtes du carton-plume ont été reprises au cutter avec soin.",
        colle: "Un point de colle translucide dépasse sous une façade.",
      },
      description:
        "Une maquette en carton-plume d'un bâtiment courbe, signée de la main d'Hélène. " +
        "Le travail d'une vie.",
      ramassable: false,
    },
    crayons_plans: {
      nom: "Crayons et plans",
      observations: {
        crayons: "Plusieurs crayons sont taillés très court, presque jusqu'au bois.",
        papier: "Les bords des plans roulés ont pris une courbe tenace.",
      },
      description:
        "Un pot débordant de crayons et de tire-lignes, des plans roulés. L'ordre " +
        "méticuleux d'une créatrice.",
      ramassable: false,
    },
    plante_fanee: {
      nom: "Plante fanée",
      observations: {
        feuilles: "Les feuilles se recourbent sur les bords et pendent vers la vitre.",
        terre: "La terre s'effrite par petites plaques sous la surface.",
      },
      limites: { date: "Rien ne permet de dire depuis quand elle est ainsi." },
      description: "Une plante verte sur le rebord, aux feuilles flétries et à la terre sèche.",
      ramassable: false,
    },
    monographies: {
      nom: "Monographies",
      observations: {
        reliures: "Les dos des ouvrages sont légèrement décolorés par le soleil.",
        pages: "Quelques pages épaisses résistent quand on les tourne.",
      },
      description: "Une rangée de monographies d'architectes vénérés. Quelques pages sont cornées.",
      ramassable: false,
    },
    revues_deco: {
      nom: "Revues de déco",
      observations: {
        couvertures: "Les couvertures glacées glissent les unes sur les autres.",
        coins: "Les coins de la pile sont inégalement alignés.",
      },
      description: "Une pile de revues de décoration, certaines hérissées de Post-it enthousiastes.",
      ramassable: false,
    },
    presse_papier: {
      nom: "Presse-papier",
      observations: {
        metal: "Le laiton a gardé une chaleur mate sous la lampe.",
        base: "La base laisse un cercle propre sur une tablette poussiéreuse.",
      },
      description: "Un presse-papier en laiton en forme d'équerre. Lourd, sans plus.",
      ramassable: false,
    },
    boite_tisanes: {
      nom: "Boîte à tisanes",
      observations: {
        bois: "Le couvercle en bois frotte légèrement à l'ouverture.",
        odeur: "Une odeur végétale discrète s'en échappe.",
      },
      description: "Une boîte à compartiments : verveine, camomille, tilleul. Le rituel du soir.",
      ramassable: false,
    },
    napperon: {
      nom: "Napperon brodé",
      observations: {
        fil: "Le fil blanc est devenu crème par endroits.",
        bord: "Un bord du tissu se soulève à peine sous le plateau.",
      },
      description: "Un napperon brodé sous le plateau, souvenir d'un voyage, dirait-on.",
      ramassable: false,
    },
    cuillere_argent: {
      nom: "Cuillère en argent",
      observations: {
        manche: "Le manche porte de fines rayures d'usage.",
        reflet: "Son reflet est trouble là où l'argent a terni.",
      },
      description: "Une petite cuillère en argent, ternie par le temps.",
      ramassable: false,
    },
    brouillons_froisses: {
      nom: "Brouillons froissés",
      observations: {
        plis: "Les plis du papier gardent la marque de doigts pressés.",
        mines: "De la poussière de graphite reste prise dans les froissures.",
      },
      description: "Des brouillons de plans raturés puis abandonnés. Le rebut ordinaire d'un atelier.",
      ramassable: false,
    },
    brochure_vente_appartement: {
      nom: "Brochure de vente de l'appartement",
      observations: {
        papier: "Le papier glacé a perdu son brillant au niveau du pli.",
        agrafe: "Une agrafe un peu de travers retient les feuillets.",
      },
      description:
        "Une brochure d'agence immobilière, froissée au coin. Le bien présenté est " +
        "l'appartement des Vasseur ; les annotations au crayon parlent d'une mise en vente rapide.",
      ramassable: false,
    },
    courrier_syndic_dechire: {
      nom: "Courrier du syndic déchiré",
      observations: {
        morceaux: "Les morceaux se recouvrent mal quand on les rapproche.",
        encre: "L'encre imprimée a pâli près des déchirures.",
      },
      description:
        "Les morceaux d'un courrier du syndic évoquent des travaux de copropriété à venir. " +
        "Une note rageuse de Laurent barre le montant estimé.",
      ramassable: false,
    },
    enveloppe_pub: {
      nom: "Enveloppe publicitaire",
      observations: {
        colle: "La bande de colle a jauni près du rabat.",
        papier: "Le papier mince se déchire facilement entre les doigts.",
      },
      description: "Une enveloppe de publicité déchirée pour une cuisine équipée. Sans intérêt.",
      ramassable: false,
    },
    trognon_pomme: {
      nom: "Trognon de pomme",
      observations: {
        peau: "Un reste de peau rouge adhère encore au trognon.",
        pepins: "Deux pépins sont restés pris dans la chair sèche.",
      },
      description: "Un trognon de pomme oublié. Hélène travaillait tard, semble-t-il.",
      ramassable: false,
    },
    photos_mariage: {
      nom: "Photos de mariage",
      observations: {
        cadres: "Les cadres ne sont pas tout à fait de la même taille.",
        verre: "La lumière du salon accroche une trace sur le verre.",
      },
      description:
        "Des photos de mariage encadrées : Hélène et Laurent, rayonnants, il y a quelques " +
        "années. Difficile de les regarder en sachant comment l'histoire finit.",
      ramassable: false,
    },
    plaid: {
      nom: "Plaid",
      observations: {
        laine: "La laine bouloche un peu aux extrémités.",
        frange: "Une frange s'est prise entre les coussins du canapé.",
      },
      description: "Un plaid en laine jeté sur l'accoudoir, là où l'on se love pour lire.",
      ramassable: false,
    },
    roman_corne: {
      nom: "Roman corné",
      observations: {
        couverture: "La couverture s'ouvre d'elle-même à force d'avoir été tenue.",
        pages: "Les pages près du marque-page sont légèrement gondolées.",
      },
      description: "Un roman corné, marque-page glissé aux deux tiers. Une lecture qu'elle ne finira pas.",
      ramassable: false,
    },
    manteaux: {
      nom: "Manteaux",
      observations: {
        tissu: "Le tissu d'un manteau garde la forme du cintre.",
        boutons: "Un bouton de manteau pend au bout d'un fil.",
      },
      description: "Des manteaux et des écharpes suspendus, imprégnés d'un parfum discret.",
      ramassable: false,
    },
    cartons_archives: {
      nom: "Cartons d'archives",
      observations: {
        carton: "Les poignées découpées ont ramolli avec l'usage.",
        etiquette: "Une étiquette se décolle sur un angle.",
      },
      description: "Des cartons étiquetés par année : dossiers de chantiers anciens.",
      ramassable: false,
    },
    raquette_tennis: {
      nom: "Raquette de tennis",
      observations: {
        manche: "Le grip du manche s'effrite un peu au toucher.",
        cordage: "Une corde vibre plus bas que les autres quand on l'effleure.",
      },
      description: "Une vieille raquette au cordage détendu, reléguée au fond.",
      ramassable: false,
    },
    courrier: {
      nom: "Courrier",
      observations: {
        enveloppes: "Les enveloppes ne sont pas rangées par taille.",
        papier: "Un coin de magazine dépasse de la pile.",
      },
      description: "Une pile de courrier : factures, relevés, un magazine professionnel. Rien de notable.",
      ramassable: false,
    },
    stylo_plume: {
      nom: "Stylo plume",
      observations: {
        plume: "La pointe de la plume a gardé une trace d'encre sombre.",
        capuchon: "Le capuchon se referme avec un petit clic sec.",
      },
      description: "Un stylo plume à capuchon, posé sur un sous-main. L'encre a un peu séché.",
      ramassable: false,
    },
    cartes_postales: {
      nom: "Cartes postales",
      observations: {
        bords: "Les bords cartonnés se sont adoucis à force d'être manipulés.",
        couleurs: "Les couleurs de deux cartes ont pâli au soleil.",
      },
      description: "Quelques cartes postales de voyages passés, coincées dans le sous-main.",
      ramassable: false,
    },
    cactus: {
      nom: "Cactus",
      observations: {
        pot: "Une trace blanche marque le bord du pot en terre cuite.",
        epines: "Ses petites épines accrochent la lumière de la fenêtre.",
      },
      description: "Un petit cactus sur le rebord de la fenêtre, increvable lui.",
      ramassable: false,
    },
    verres_whisky: {
      nom: "Verres à whisky",
      observations: {
        cristal: "Le cristal est épais au fond de chaque verre.",
        reflets: "Les facettes projettent de petits reflets sur le meuble-bar.",
      },
      description: "Deux verres à whisky en cristal, soigneusement alignés. Laurent reçoit, dit-on.",
      ramassable: false,
    },
    coffret_cigares: {
      nom: "Coffret de cigares",
      observations: {
        bois: "Le bois du couvercle est plus clair à l'intérieur.",
        charniere: "La charnière gémit légèrement quand on soulève le couvercle.",
      },
      description: "Un coffret de cigares entamé, réservé aux grandes occasions de Laurent.",
      ramassable: false,
    },
    trophee_golf: {
      nom: "Trophée de golf",
      observations: {
        socle: "Le socle porte une petite éraflure sur un côté.",
        metal: "Le métal a été poli plus souvent sur la face avant.",
      },
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

  // Verrous d'action facultatifs. Ils portent des événements canoniques déjà
  // signés, pas des flags envoyés par le navigateur. Le scénario courant n'ajoute
  // volontairement aucun exemple fictif (stylo/encre, etc.).
  conditionsActions: {},

  // Pistes affichables pendant l'interrogatoire. Le serveur ne projette que les
  // questions dont les faits sont déjà attestés par les reçus signés.
  pistesInterrogatoire: [
    { requiert: ["double_tasse"], question: "Qui a partagé la tisane d'Hélène ce soir-là ?" },
    { requiert: ["reussite_vue"], question: "Comment avez-vous vécu la récente réussite d'Hélène ?" },
    {
      requiert: ["mobile_dettes"],
      question: "Comment expliquez-vous la situation décrite dans cette lettre de banque ?",
    },
    {
      requiert: ["controle_vu"],
      retireSi: ["rdv_eclaircis"],
      question: "Pourquoi avez-vous consulté le téléphone d'Hélène ?",
    },
    {
      requiert: ["recu_laurent_vu"],
      retireSi: ["aveu_acte"],
      question: "Comment expliquez-vous l'achat de ces somnifères à votre nom ?",
    },
    {
      requiert: ["fete_decouverte"],
      retireSi: ["invitation_lue"],
      question: "À qui Hélène destinait-elle ces préparatifs ?",
    },
    {
      requiert: ["invitation_lue"],
      retireSi: ["aveu_mobile"],
      question: "Que pensiez-vous qu'Hélène vous cachait ?",
    },
    { requiert: ["rdv_eclaircis"], question: "Que signifiaient finalement les rendez-vous d'Hélène ?" },
  ],

  solution: {
    coupable: true, // Laurent est bien le meurtrier.
    preuvesRequises: ["recu_laurent_vu", "fete_decouverte", "mobile_dettes"],
  },

  // Débrief noté (T-06) : questions ouvertes + barème SECRET (jamais en vue publique).
  // Le LLM-judge note chaque réponse 0-5 selon sa précision (cf. server/scoring.js).
  debrief: {
    questions: [
      {
        id: "qui",
        question: "Qui a tué Hélène — et était-ce vraiment un suicide ?",
        bareme: [
          { note: 1, critere: "Nomme Laurent OU dit que ce n'est pas un suicide." },
          { note: 3, critere: "Laurent, et ce n'est pas un suicide : un tiers était présent." },
          { note: 5, critere: "Laurent l'a empoisonnée puis a maquillé un suicide ; étayé par les deux tasses ou le fait qu'il lui montait la tisane." },
        ],
      },
      {
        id: "comment",
        question: "Comment Laurent s'y est-il pris ?",
        bareme: [
          { note: 1, critere: "Empoisonnement ou somnifères, sans précision." },
          { note: 3, critere: "Surdose de somnifères dans la tisane du soir." },
          { note: 5, critere: "Somnifères achetés à son nom, dissous dans la tisane qu'il lui montait lui-même ; reçu de pharmacie + double tasse." },
        ],
      },
      {
        id: "mobile",
        question: "Quel était son mobile ?",
        bareme: [
          { note: 1, critere: "Jalousie OU argent, isolément." },
          { note: 3, critere: "Il la croyait infidèle (rendez-vous secrets) — jalousie possessive." },
          { note: 5, critere: "Jalousie (il prenait les rendez-vous secrets pour une liaison) ET dettes (il convoitait le montant de son prix) ; il ne supportait pas de la perdre." },
        ],
      },
      {
        id: "surprise",
        question: "Que cachait réellement Hélène ?",
        bareme: [
          { note: 1, critere: "Une fête ou une surprise." },
          { note: 3, critere: "Une fête surprise pour Laurent, pas un amant." },
          { note: 5, critere: "Les rendez-vous secrets étaient les préparatifs d'une fête surprise pour Laurent (traiteur Maurel, cadeau, mot) — elle ne le trompait pas." },
        ],
      },
    ],
    // Rangs par seuil de score total (choisi par seuil décroissant).
    rangs: [
      { seuil: 19, titre: "Maître enquêteur" },
      { seuil: 15, titre: "Fin limier" },
      { seuil: 9, titre: "Enquêteur compétent" },
      { seuil: 0, titre: "Affaire classée sans suite" },
    ],
  },
};

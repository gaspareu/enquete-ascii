// Exemple privé copié dans un brouillon. Il ne rejoint jamais les fichiers publics.
export function appliquerModeleInitiation(base) {
  const decors = {
    N: ["Bureau d’accueil", "le", "Un registre et quelques papiers reposent sur le bureau."],
    NE: ["Fenêtre", "la", "La fenêtre donne sur la cour tranquille du musée."],
    E: ["Vitrine", "la", "Un coussin de velours marque la place du médaillon disparu."],
    SE: ["Portemanteau", "le", "Un manteau et une écharpe sont suspendus aux patères."],
    S: ["Entrée", "l’", "La porte d’entrée est fermée pour la nuit."],
    SO: ["Banc", "le", "Un banc accueille les visiteurs devant un plan du musée."],
    O: ["Bibliothèque", "la", "Des catalogues racontent l’histoire des collections."],
    NO: ["Horloge", "l’", "Le balancier accompagne le silence de la salle."],
  };
  return {
    ...base,
    titre: "Le médaillon disparu",
    intro: "Le musée ferme dans quelques minutes. Un médaillon manque dans sa vitrine. Camille, la gardienne, vous attend au centre de la salle. Retrouvez ce qui s’est passé avant d’accuser quelqu’un.",
    personnage: {
      ...base.personnage, id: "camille", nom: "Camille",
      visage: "  .---.\n  |o o|\n  | _ |\n  '---'",
      personnalite: "Tu es Camille, la gardienne du musée. Tu parles avec retenue et tu crains les reproches. Ne révèle pas une connaissance conditionnelle avant qu’elle te soit fournie. Quand elle devient disponible, réponds honnêtement aux questions appuyées sur les indices. N’invente aucun autre suspect ou événement.",
      faitsDeBase: ["Le médaillon était exposé aujourd’hui.", "La fermeture du musée est imminente.", "Tu es restée dans cette salle pendant la dernière heure."],
    },
    zones: Object.fromEntries(Object.entries(decors).map(([direction, [nom, article, description]]) => [direction, {
      ...base.zones[direction], nom, article, description,
      objetsCaches: direction === "N" ? ["recu_atelier"] : direction === "E" ? ["etui_vide"] : [],
    }])),
    objets: {
      recu_atelier: {
        nom: "Reçu de l’atelier", aliases: ["reçu", "papier"], ramassable: true,
        description: "Un reçu daté d’aujourd’hui indique : « Médaillon confié pour réparation du fermoir. Déposé par Camille. Retour demain. »",
        observations: { papier: "Le papier est plié en deux.", encre: "Le nom de l’atelier est imprimé en bleu." },
      },
      etui_vide: {
        nom: "Étui vide", aliases: ["étui", "boîte"], ramassable: false,
        description: "L’étui est ouvert sans trace d’effraction. Un morceau de fermoir cassé est resté sur le velours, à la place du médaillon.",
        observations: { velours: "Le velours garde une empreinte ovale.", charniere: "La charnière de l’étui fonctionne normalement." },
      },
    },
    declencheurs: { "examiner:recu_atelier": "reparation_identifiee", "examiner:etui_vide": "fermoir_casse" },
    connaissances: [{
      id: "explication_camille", requiert: ["reparation_identifiee", "fermoir_casse"],
      texte: "J’ai cassé le fermoir en nettoyant le médaillon. Je l’ai confié à l’atelier pour le réparer et je n’ai rien dit par peur d’être renvoyée. Ce n’est pas un vol : le médaillon reviendra demain.",
    }],
    pistesInterrogatoire: [{ question: "Pourquoi avoir caché la réparation du médaillon ?", requiert: ["reparation_identifiee", "fermoir_casse"] }],
    solution: { coupable: true, preuvesRequises: ["reparation_identifiee", "fermoir_casse"] },
    debrief: {
      questions: [{
        id: "disparition", question: "Qu’est devenu le médaillon, et pourquoi Camille n’a-t-elle rien dit ? Appuyez votre explication sur les deux indices.",
        bareme: [
          { note: 1, critere: "La réponse accuse sans preuve ou ne retrouve pas le médaillon." },
          { note: 3, critere: "La réponse identifie la réparation par Camille, mais ne relie pas les deux indices ou n’explique pas son silence." },
          { note: 5, critere: "La réponse relie le reçu de l’atelier et le fermoir cassé : Camille a caché un accident par peur des reproches ; le médaillon revient demain." },
        ],
      }],
      rangs: [{ seuil: 0, titre: "Apprenti détective" }, { seuil: 5, titre: "Fin limier" }],
    },
  };
}

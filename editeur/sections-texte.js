import { bouton, champ, element, groupe, titre, zoneAide } from "./ui.js";

function cartePliante(libelle) {
  const details = element("details", "", "carte");
  details.open = true;
  details.append(element("summary", libelle));
  return details;
}

export function rendreDialogue(enquete) {
  const principal = element("section", "", "panneau");
  principal.append(titre("Dialogue et pistes"), zoneAide("Les connaissances ne sont ajoutées au contexte du personnage que lorsque tous leurs faits requis ont été réellement vus. Les pistes sont des suggestions : elles ne sont jamais envoyées automatiquement."));
  principal.append(titre("Connaissances conditionnelles", 3), bouton("+ Ajouter une connaissance", "ajouter-connaissance"));
  enquete.connaissances.forEach((item, index) => {
    const carte = cartePliante(item.id || `Connaissance ${index + 1}`);
    carte.append(groupe(
      champ("Identifiant", ["connaissances", index, "id"], item.id),
      champ("Texte privé donné au personnage", ["connaissances", index, "texte"], item.texte, { multiligne: true, long: true }),
      champ("Faits requis ET, un par ligne", ["connaissances", index, "requiert"], item.requiert ?? [], { liste: true }),
      champ("Événement signé si le personnage exprime ce fait", ["connaissances", index, "evenementQuandExprime"],
        item.evenementQuandExprime ?? "", { aide: "Facultatif. Utilisable ensuite dans un verrou d’action." }),
    ), bouton("Supprimer cette connaissance", "supprimer-connaissance", { index }));
    principal.append(carte);
  });
  principal.append(element("hr", "", "separateur"), titre("Pistes d’interrogatoire", 3), bouton("+ Ajouter une piste", "ajouter-piste"));
  enquete.pistesInterrogatoire.forEach((piste, index) => {
    const carte = cartePliante(piste.question || `Piste ${index + 1}`);
    carte.append(groupe(
      champ("Question proposée", ["pistesInterrogatoire", index, "question"], piste.question, { multiligne: true }),
      champ("Faits requis ET, un par ligne", ["pistesInterrogatoire", index, "requiert"], piste.requiert ?? [], { liste: true }),
      champ("Masquer si l’un de ces faits est visible, un par ligne", ["pistesInterrogatoire", index, "retireSi"],
        piste.retireSi ?? [], { liste: true }),
    ), bouton("Supprimer cette piste", "supprimer-piste", { index }));
    principal.append(carte);
  });
  const apercu = element("aside", "", "panneau");
  apercu.append(titre("Contexte du personnage", 3), zoneAide("Choisissez des faits vus pour vérifier quelles connaissances seraient jointes au prompt. Cette projection reste dans l’atelier."));
  const cochees = element("div", "", "liste-cases");
  const flags = [...new Set(Object.values(enquete.declencheurs))];
  for (const flag of flags) {
    const label = element("label"); const input = element("input");
    input.type = "checkbox"; input.dataset.action = "contexte-flag"; input.dataset.flag = flag;
    label.append(input, document.createTextNode(flag)); cochees.append(label);
  }
  apercu.append(cochees);
  const sortie = element("div"); sortie.id = "contexte-apercu";
  apercu.append(sortie);
  return { principal, secondaire: apercu };
}

export function rendreDebrief(enquete) {
  const principal = element("section", "", "panneau");
  const maximum = enquete.debrief.questions.length * 5;
  principal.append(titre("Débrief"), zoneAide("Le juge reçoit les questions, les critères 1/3/5 et les réponses à la fin de la partie. Les preuves requises ci-dessous sont déclaratives dans cette version."));
  principal.append(champ("Le personnage est le coupable", ["solution", "coupable"], enquete.solution.coupable, { booleen: true }));
  principal.append(champ("Preuves clés, un fait par ligne", ["solution", "preuvesRequises"], enquete.solution.preuvesRequises, { liste: true }));
  principal.append(element("hr", "", "separateur"), titre("Questions", 3), bouton("+ Ajouter une question", "ajouter-question"));
  enquete.debrief.questions.forEach((question, index) => {
    const carte = cartePliante(question.question || `Question ${index + 1}`);
    carte.append(groupe(
      champ("Identifiant", ["debrief", "questions", index, "id"], question.id),
      champ("Question adressée au joueur", ["debrief", "questions", index, "question"], question.question, { multiligne: true }),
      ...[1, 3, 5].map((note) => {
        const indice = question.bareme?.findIndex((critere) => critere.note === note) ?? -1;
        return champ(`Critère pour ${note} point${note > 1 ? "s" : ""}`,
          ["debrief", "questions", index, "bareme", Math.max(indice, 0), "critere"],
          question.bareme?.[indice]?.critere ?? "", { multiligne: true });
      }),
    ), bouton("Supprimer cette question", "supprimer-question", { index }));
    principal.append(carte);
  });
  principal.append(element("hr", "", "separateur"), titre("Rangs", 3),
    element("p", `Score maximal : ${maximum} points.`, "meta"), bouton("+ Ajouter un rang", "ajouter-rang"));
  enquete.debrief.rangs.forEach((rang, index) => {
    const carte = element("div", "", "carte");
    carte.append(groupe(
      champ("Seuil minimal", ["debrief", "rangs", index, "seuil"], rang.seuil, { nombre: true }),
      champ("Titre du rang", ["debrief", "rangs", index, "titre"], rang.titre),
      bouton("Supprimer ce rang", "supprimer-rang", { index }),
    ));
    principal.append(carte);
  });
  return { principal };
}

function diagnostic(item, type) {
  const bloc = element("article", "", `diagnostic ${type === "avertissement" ? "avertissement" : ""}`);
  bloc.append(element("p", item.message ?? String(item)));
  if (item.path) bloc.append(bouton(`Aller au champ ${item.path}`, "aller-diagnostic", { path: item.path }));
  return bloc;
}

export function rendreTester(enquete, resultats, sale, revision) {
  const principal = element("section", "", "panneau");
  principal.append(titre("Vérifier et tester"), zoneAide("Enregistrez, puis vérifiez la structure. L’aperçu démarre une partie avec la révision enregistrée du brouillon."));
  const actions = element("div", "", "actions");
  const verifier = bouton("Vérifier l’enquête", "valider");
  const apercu = bouton("Prévisualiser la partie", "apercu");
  apercu.disabled = sale || !revision || !resultats || resultats.erreurs?.length > 0;
  const activer = bouton("Marquer prête", "activer");
  activer.disabled = sale || !revision || !resultats || resultats.erreurs?.length > 0;
  actions.append(verifier, apercu, activer);
  principal.append(actions);
  if (sale) principal.append(element("p", "Des modifications doivent être enregistrées avant le test.", "meta"));
  if (!resultats) {
    principal.append(element("p", "Aucune vérification lancée pour cette révision.", "vide"));
    return { principal };
  }
  const erreurs = resultats.erreurs ?? [], avertissements = resultats.avertissements ?? [];
  principal.append(titre(`Erreurs bloquantes (${erreurs.length})`, 3));
  if (!erreurs.length) principal.append(element("p", "Aucune erreur bloquante."));
  for (const item of erreurs) principal.append(diagnostic(item, "erreur"));
  principal.append(titre(`Avertissements (${avertissements.length})`, 3));
  if (!avertissements.length) principal.append(element("p", "Aucun avertissement."));
  for (const item of avertissements) principal.append(diagnostic(item, "avertissement"));
  principal.append(zoneAide("Vérifiez plusieurs ordres d’actions dans l’aperçu. Un don exige un objet déjà ramassé ; un objet examiné trop tôt peut devoir être réexaminé."));
  return { principal };
}

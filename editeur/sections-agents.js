import { bouton, champ, element, groupe, titre, zoneAide } from "./ui.js";

export function rendreHooks(enquete) {
  const bloc = element("section");
  bloc.append(titre("Contextes des agents et hooks d’histoire", 3), zoneAide("Un fait privé est transmis uniquement à son destinataire après un événement validé. Les conditions restent côté serveur. L’aperçu des connaissances ci-contre concerne le dialogue historique ; testez ces hooks dans la partie prévisualisée."));
  const ajout = element("input"); ajout.id = "nouveau-fait"; ajout.placeholder = "identifiant_du_fait";
  ajout.setAttribute("aria-label", "Identifiant du nouveau fait d’histoire");
  bloc.append(ajout, bouton("+ Ajouter un fait", "ajouter-fait"));
  for (const [id, fait] of Object.entries(enquete.faitsHistoire ?? {})) {
    bloc.append(champ(`Fait privé : ${id}`, ["faitsHistoire", id, "texte"], fait.texte, { multiligne: true }),
      bouton(`Supprimer ${id}`, "supprimer-fait", { cle: id }));
  }
  const scenes = [...Object.entries(enquete.zones).map(([id, zone]) => [`zone:${id}`, zone.nom || id]),
    [`personnage:${enquete.personnage.id}`, enquete.personnage.nom || "Personnage"]];
  for (const [id, nom] of scenes) {
    for (const role of id.startsWith("personnage:") ? ["exploration", "personnage"] : ["exploration"]) {
      bloc.append(champ(`Contexte initial — ${nom} (${role})`, ["contextesScenes", id, role],
        enquete.contextesScenes?.[id]?.[role] ?? [], { liste: true, aide: "Identifiants des faits, un par ligne." }));
    }
  }
  bloc.append(bouton("+ Ajouter un hook", "ajouter-hook"));
  (enquete.hooksHistoire ?? []).forEach((hook, index) => {
    const carte = element("div", "", "carte"), path = ["hooksHistoire", index];
    carte.append(groupe(
      champ("Identifiant du hook", [...path, "id"], hook.id),
      champ("Après l’événement", [...path, "apres"], hook.apres, { aide: "fouiller:N, examiner:objet ou dialogue:événement exprimé…" }),
      champ("Flags requis au moment de l’événement", [...path, "requiertTous"], hook.requiertTous ?? [], { liste: true }),
      champ("Scène destinataire", [...path, "destinataire", "sceneId"], hook.destinataire?.sceneId, { choix: scenes }),
      champ("Rôle destinataire", [...path, "destinataire", "role"], hook.destinataire?.role,
        { choix: [["exploration", "Exploration"], ["personnage", "Personnage (scène du personnage uniquement)"]] }),
      champ("Faits à ajouter", [...path, "ajouterFaits"], hook.ajouterFaits ?? [], { liste: true }),
    ), bouton("Supprimer le hook", "supprimer-hook", { index }));
    bloc.append(carte);
  });
  return bloc;
}

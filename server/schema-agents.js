// Extension optionnelle de V1 : les enquêtes existantes ne sont pas réécrites.
const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const idSur = /^[a-z][a-z0-9_-]{0,63}$/;
export function validerAgentsScene(enquete, erreur) {
  const faits = enquete.faitsHistoire === undefined ? {} : enquete.faitsHistoire;
  if (!objet(faits) || Object.keys(faits).length > 500) erreur("faitsHistoire", "Registre de faits invalide.");
  const connus = new Set(objet(faits) ? Object.keys(faits) : []);
  for (const [id, fait] of objet(faits) ? Object.entries(faits) : []) {
    if (!idSur.test(id) || !objet(fait) || typeof fait.texte !== "string" || !fait.texte.trim() || fait.texte.length > 2000) {
      erreur(`faitsHistoire.${id}`, "Identifiant sûr et texte de 1 à 2000 caractères requis.");
    }
  }
  const zones = objet(enquete.zones) ? enquete.zones : {};
  const objets = objet(enquete.objets) ? enquete.objets : {};
  const scenes = new Set([...Object.keys(zones).map((id) => `zone:${id}`), `personnage:${enquete.personnage?.id ?? "laurent"}`]);
  const flags = new Set(Object.values(enquete.declencheurs ?? {}));
  const dialogues = new Set((Array.isArray(enquete.connaissances) ? enquete.connaissances : []).map((c) => c?.evenementQuandExprime).filter(Boolean));
  const refs = (liste, path, ensemble) => {
    if (!Array.isArray(liste) || liste.length > 500 || liste.some((id) => typeof id !== "string" || !ensemble.has(id)) || new Set(liste).size !== liste.length) {
      erreur(path, "Références uniques connues requises.");
    }
  };
  const destination = (sceneId, role) => scenes.has(sceneId) && ["exploration", "personnage"].includes(role) &&
    (role !== "personnage" || sceneId.startsWith("personnage:"));
  const initiaux = enquete.contextesScenes === undefined ? {} : enquete.contextesScenes;
  if (!objet(initiaux) || Object.keys(initiaux).length > 500) erreur("contextesScenes", "Contextes initiaux invalides.");
  for (const [sceneId, roles] of objet(initiaux) ? Object.entries(initiaux) : []) {
    if (!scenes.has(sceneId) || !objet(roles)) { erreur(`contextesScenes.${sceneId}`, "Scène ou rôles inconnus."); continue; }
    for (const [role, ids] of Object.entries(roles)) {
      if (!destination(sceneId, role)) erreur(`contextesScenes.${sceneId}.${role}`, "Rôle incompatible avec cette scène.");
      refs(ids, `contextesScenes.${sceneId}.${role}`, connus);
    }
  }
  const hooks = enquete.hooksHistoire === undefined ? [] : enquete.hooksHistoire;
  if (!Array.isArray(hooks) || hooks.length > 500) { erreur("hooksHistoire", "Liste de hooks invalide."); return; }
  const vus = new Set();
  hooks.forEach((hook, index) => {
    const path = `hooksHistoire.${index}`;
    if (!objet(hook)) { erreur(path, "Hook invalide."); return; }
    if (typeof hook.id !== "string" || !idSur.test(hook.id) || vus.has(hook.id)) erreur(`${path}.id`, "Identifiant sûr unique requis.");
    vus.add(hook.id);
    const [action, cible, autre] = typeof hook.apres === "string" ? hook.apres.split(":") : [];
    const valide = !autre && (action === "fouiller" ? Object.hasOwn(zones, cible ?? "")
      : action === "dialogue" ? dialogues.has(cible)
      : ["examiner", "ramasser", "donner"].includes(action) && Object.hasOwn(objets, cible ?? "") &&
        (action === "examiner" || objets[cible]?.ramassable === true));
    if (!valide) erreur(`${path}.apres`, "Action de jeu connue requise.");
    refs(hook.requiertTous ?? [], `${path}.requiertTous`, flags);
    if (!objet(hook.destinataire) || !destination(hook.destinataire.sceneId, hook.destinataire.role)) {
      erreur(`${path}.destinataire`, "Destinataire de scène compatible requis.");
    }
    refs(hook.ajouterFaits, `${path}.ajouterFaits`, connus);
    if (Array.isArray(hook.ajouterFaits) && !hook.ajouterFaits.length) erreur(`${path}.ajouterFaits`, "Au moins un fait requis.");
  });
}

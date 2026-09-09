// Reconnaissance ergonomique côté navigateur. Cette analyse est volontairement
// pure : elle ne consulte ni progression ni inventaire et ne décide aucun droit.

export function normaliser(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

function cibleLaPlusLongue(texte, elements) {
  return elements
    .flatMap(([id, element]) => [element.nom, ...(element.aliases ?? [])]
      .filter(Boolean)
      .map((nom) => ({ id, nom: normaliser(nom) })))
    .sort((a, b) => b.nom.length - a.nom.length)
    .find(({ nom }) => texte.includes(nom))?.id ?? null;
}

const VERBES = {
  fouiller: /\b(fouille|fouiller)\b/,
  examiner: /\b(examine|examiner|inspecte|inspecter|regarde|regarder|observe|observer)\b/,
  ramasser: /\b(ramasse|ramasser|prends|prendre|recupere|recuperer)\b/,
  donner: /\b(donne|donner|tends|tendre|presente|presenter)\b/,
};

export function intentionDepuisTexte(message, vue) {
  const texte = normaliser(message);
  if (!texte || !vue) return null;

  if (VERBES.fouiller.test(texte)) {
    const cible = cibleLaPlusLongue(texte, Object.entries(vue.zones ?? {}));
    return cible ? { action: "fouiller", cible } : null;
  }

  const cible = cibleLaPlusLongue(texte, Object.entries(vue.objets ?? {}));
  if (!cible) return null;
  for (const action of ["examiner", "ramasser", "donner"]) {
    if (VERBES[action].test(texte)) return { action, cible };
  }
  return null;
}

// Reconnaissance ergonomique côté navigateur. Cette analyse est volontairement
// pure : elle ne consulte ni progression ni inventaire et ne décide aucun droit.

export function normaliser(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
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
  fouiller: /\b(fouille|fouiller|cherche|chercher|inspecte|inspecter)\b/,
  examiner: /\b(examine|examiner|inspecte|inspecter|regarde|regarder|observe|observer)\b/,
  ramasser: /\b(ramasse|ramasser|prends|prendre|recupere|recuperer)\b/,
  donner: /\b(donne|donner|tends|tendre|presente|presenter)\b/,
};

// Les questions de découverte sont une façon naturelle de déclencher une
// fouille. Elles restent limitées à une zone explicitement citée ou observée.
const QUESTION_FOUILLE = /\b(?:qu[' ]?y\s+a|qu[' ]?il\s+y\s+a|qu[' ]?est-ce\s+qu[' ]?il\s+y\s+a|que\s+(?:trouve|contient))\b/u;

const DIRECTIONS = [
  { cible: "NE", motif: /\b(?:au|a|vers)\s+(?:nord[ -]?est)\b/u },
  { cible: "NO", motif: /\b(?:au|a|vers)\s+(?:nord[ -]?ouest)\b/u },
  { cible: "SE", motif: /\b(?:au|a|vers)\s+(?:sud[ -]?est)\b/u },
  { cible: "SO", motif: /\b(?:au|a|vers)\s+(?:sud[ -]?ouest)\b/u },
  { cible: "N", motif: /\b(?:au|a|vers)\s+nord\b/u },
  { cible: "S", motif: /\b(?:au|a|vers)\s+sud\b/u },
  { cible: "E", motif: /\b(?:au|a|vers)\s+(?:l[' ]?)?est\b/u },
  { cible: "O", motif: /\b(?:au|a|vers)\s+(?:l[' ]?)?ouest\b/u },
];

function directionCitee(texte, zones) {
  return DIRECTIONS.find(({ cible, motif }) => zones?.[cible] && motif.test(texte))?.cible ?? null;
}

export function intentionDepuisTexte(message, vue, contexte = null) {
  const texte = normaliser(message);
  if (!texte || !vue) return null;

  if (VERBES.fouiller.test(texte) || QUESTION_FOUILLE.test(texte)) {
    const cible = cibleLaPlusLongue(texte, Object.entries(vue.zones ?? {}));
    if (cible) return { action: "fouiller", cible };
    const direction = directionCitee(texte, vue.zones);
    if (direction) return { action: "fouiller", cible: direction };
    if (/\b(?:ici|cette\s+zone)\b/u.test(texte) && contexte?.type === "zone" && vue.zones?.[contexte.id]) {
      return { action: "fouiller", cible: contexte.id };
    }
  }

  const cible = cibleLaPlusLongue(texte, Object.entries(vue.objets ?? {}));
  if (!cible) return null;
  for (const action of ["examiner", "ramasser", "donner"]) {
    if (VERBES[action].test(texte)) return { action, cible };
  }
  return null;
}

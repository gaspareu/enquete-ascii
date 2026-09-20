import { bouton, element, titre, zoneAide } from "./ui.js";

export function rendreAideGeneration(generation, direction, lectureSeule = false) {
  const bloc = element("div", "", "carte");
  const ouvrir = bouton("Ajouter des éléments avec l’IA", "ouvrir-generation");
  ouvrir.disabled = lectureSeule || generation.enCours;
  if (!generation.ouverte || generation.direction !== direction) {
    bloc.append(ouvrir);
    return bloc;
  }
  bloc.append(titre("Proposer des objets", 3), zoneAide(
    "La génération utilise le titre, l’introduction, le personnage, le nom et la description de cette zone, ainsi que ses objets présents. Les propositions restent modifiables dans le brouillon.",
  ));
  const champNombre = element("div", "", "champ");
  const labelNombre = element("label", "Nombre d’éléments (1 à 8)");
  labelNombre.htmlFor = "generation-nombre";
  const nombre = element("input");
  nombre.id = "generation-nombre"; nombre.type = "number";
  nombre.min = "1"; nombre.max = "8"; nombre.step = "1";
  nombre.value = generation.nombre;
  nombre.dataset.generation = "nombre";
  nombre.disabled = lectureSeule || generation.enCours;
  champNombre.append(labelNombre, nombre);
  const champConsigne = element("div", "", "champ");
  const labelConsigne = element("label", "Instruction particulière (facultative)");
  labelConsigne.htmlFor = "generation-consigne";
  const consigne = element("textarea");
  consigne.id = "generation-consigne";
  consigne.maxLength = 1000;
  consigne.value = generation.instruction;
  consigne.dataset.generation = "instruction";
  consigne.disabled = lectureSeule || generation.enCours;
  champConsigne.append(labelConsigne, consigne);
  const actions = element("div", "", "actions");
  const generer = bouton(generation.enCours ? "Génération…" : "Générer", "generer-objets");
  generer.disabled = lectureSeule || generation.enCours;
  const annuler = bouton("Annuler", "annuler-generation");
  annuler.disabled = generation.enCours;
  actions.append(generer, annuler);
  bloc.append(champNombre, champConsigne, actions);
  return bloc;
}

export function preparerDemandeGeneration(enquete, direction, nombre, instruction) {
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 8) {
    throw new Error("Choisissez entre 1 et 8 éléments.");
  }
  const zone = enquete.zones?.[direction] ?? {};
  const noms = (zone.objetsCaches ?? []).map((id) => enquete.objets?.[id]?.nom ?? id).slice(0, 40);
  const limiter = (texte, taille) => String(texte ?? "").slice(0, taille);
  return { direction, nombre, instruction, contexte: {
    titre: limiter(enquete.titre, 200), intro: limiter(enquete.intro, 3000),
    personnage: limiter(enquete.personnage?.nom, 200),
    zoneNom: limiter(zone.nom, 200), zoneDescription: limiter(zone.description, 3000),
    objetsExistants: noms.map((nom) => limiter(nom, 200)),
  } };
}

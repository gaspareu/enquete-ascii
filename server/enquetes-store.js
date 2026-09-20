// Dépôt local des enquêtes : le JSON privé reste hors de public/ ; seules les
// images validées sont copiées dans le dossier public propre à leur enquête.

import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ID_SUR, DIRECTIONS, VERSION_SCHEMA, validerEnquete } from "./enquetes-schema.js";

const BASE = fileURLToPath(new URL("../", import.meta.url));
const RACINE_DEFAUT = join(BASE, "data", "enquetes");
const IMAGES_DEFAUT = join(BASE, "public", "images", "enquetes");
const HELENE = join(RACINE_DEFAUT, "helene", "scenario.json");
const MAX_JSON = 1_500_000;
const MAX_IMAGE = 5_000_000;
const TYPES = new Map([["image/png", ["png"]], ["image/jpeg", ["jpg", "jpeg"]], ["image/webp", ["webp"]]]);

function erreur(status, message, erreurs) {
  const e = new Error(message);
  e.status = status;
  if (erreurs) e.erreurs = erreurs;
  return e;
}

function verifierId(id) {
  if (typeof id !== "string" || !ID_SUR.test(id)) throw erreur(400, "Identifiant d'enquête invalide.");
}

function verifierJson(valeur) {
  const vus = new Set();
  let compte = 0;
  function visiter(noeud, profondeur) {
    if (++compte > 30_000 || profondeur > 40) throw erreur(413, "Enquête trop volumineuse.");
    if (noeud === null || typeof noeud === "string" || typeof noeud === "boolean") return;
    if (typeof noeud === "number" && Number.isFinite(noeud)) return;
    if (typeof noeud !== "object" || vus.has(noeud)) throw erreur(400, "Le scénario doit être un JSON sûr.");
    if (!Array.isArray(noeud) && Object.getPrototypeOf(noeud) !== Object.prototype && Object.getPrototypeOf(noeud) !== null) {
      throw erreur(400, "Le scénario doit être un JSON sûr.");
    }
    vus.add(noeud);
    for (const [cle, enfant] of Object.entries(noeud)) {
      if (["__proto__", "prototype", "constructor"].includes(cle)) throw erreur(400, "Clé JSON interdite.");
      visiter(enfant, profondeur + 1);
    }
    vus.delete(noeud);
  }
  visiter(valeur, 0);
  const contenu = JSON.stringify(valeur);
  if (Buffer.byteLength(contenu) > MAX_JSON) throw erreur(413, "Enquête trop volumineuse.");
  return contenu;
}

function canonique(valeur) {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(",")}]`;
  if (valeur !== null && typeof valeur === "object") {
    return `{${Object.keys(valeur).sort().map((cle) => `${JSON.stringify(cle)}:${canonique(valeur[cle])}`).join(",")}}`;
  }
  return JSON.stringify(valeur);
}

function revision(enquete) {
  return createHash("sha256").update(canonique(enquete)).digest("hex");
}

async function noeudSur(chemin, type, absent = false) {
  try {
    const info = await lstat(chemin);
    if (info.isSymbolicLink() || (type === "dossier" && !info.isDirectory()) || (type === "fichier" && !info.isFile())) {
      throw erreur(400, "Chemin local invalide.");
    }
    return info;
  } catch (cause) {
    if (cause.code === "ENOENT" && absent) return null;
    if (cause.code === "ENOENT") throw erreur(404, "Enquête introuvable.");
    throw cause;
  }
}

async function ecrireAtomiquement(chemin, enquete) {
  const contenu = `${JSON.stringify(enquete, null, 2)}\n`;
  const provisoire = join(dirname(chemin), `.scenario-${randomUUID()}.tmp`);
  try {
    await writeFile(provisoire, contenu, { flag: "wx", mode: 0o600 });
    await rename(provisoire, chemin);
  } finally {
    await rm(provisoire, { force: true });
  }
}

function estImage(donnees, mime) {
  if (mime === "image/png") return donnees.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return donnees.length >= 4 && donnees[0] === 0xff && donnees[1] === 0xd8 && donnees.at(-2) === 0xff && donnees.at(-1) === 0xd9;
  if (mime === "image/webp") return donnees.subarray(0, 4).toString() === "RIFF" && donnees.subarray(8, 12).toString() === "WEBP";
  return false;
}

function brouillonVide(id) {
  return {
    schemaVersion: VERSION_SCHEMA,
    id,
    statut: "brouillon",
    titre: "",
    intro: "",
    personnage: { id: "laurent", nom: "", visage: "", portraits: { neutre: "", mefiant: "", irrite: "", inquiet: "" }, personnalite: "", faitsDeBase: [] },
    zones: Object.fromEntries(DIRECTIONS.map((direction) => [direction, { nom: "", article: "", aliases: [], description: "", illustration: "", objetsCaches: [] }])),
    objets: {},
    connaissances: [],
    declencheurs: {},
    preconditions: {},
    conditionsActions: {},
    pistesInterrogatoire: [],
    solution: { coupable: false, preuvesRequises: [] },
    debrief: { questions: [], rangs: [] },
  };
}

export function creerDepotEnquetes({ racine = RACINE_DEFAUT, imagesDir = IMAGES_DEFAUT } = {}) {
  async function lireFichier(id) {
    verifierId(id);
    const fichier = id === "helene" ? HELENE : join(racine, id, "scenario.json");
    if (id !== "helene") await noeudSur(join(racine, id), "dossier");
    const info = await noeudSur(fichier, "fichier");
    if (info.size > MAX_JSON) throw erreur(413, "Enquête trop volumineuse.");
    let enquete;
    try { enquete = JSON.parse(await readFile(fichier, "utf8")); }
    catch { throw erreur(400, "JSON d'enquête invalide."); }
    verifierJson(enquete);
    if (enquete?.id !== id || enquete?.schemaVersion !== VERSION_SCHEMA) throw erreur(400, "Métadonnées d'enquête invalides.");
    return enquete;
  }

  async function imagesDisponibles(enquete) {
    const chemins = [
      ...Object.values(enquete.personnage?.portraits ?? {}),
      ...Object.values(enquete.zones ?? {}).map((zone) => zone?.illustration),
    ];
    const dossier = enquete.id === "helene" ? join(BASE, "public", "images") : join(imagesDir, enquete.id);
    if (enquete.id !== "helene") {
      try { await noeudSur(dossier, "dossier"); }
      catch (cause) {
        if (cause.status === 404) return chemins.filter(Boolean);
        throw cause;
      }
    }
    const absentes = [];
    for (const chemin of chemins) {
      if (typeof chemin !== "string" || !chemin) continue;
      const nom = basename(chemin);
      try {
        const info = await noeudSur(join(dossier, nom), "fichier");
        if (info.size > MAX_IMAGE) absentes.push(chemin);
      } catch { absentes.push(chemin); }
    }
    return absentes;
  }

  async function lire(id, { inclureBrouillons = false } = {}) {
    const enquete = await lireFichier(id);
    if (!inclureBrouillons && enquete.statut !== "prete") throw erreur(404, "Enquête introuvable.");
    if (!inclureBrouillons) {
      const { erreurs } = await diagnostiquer(enquete);
      if (erreurs.length) throw erreur(404, "Enquête introuvable.");
    }
    return { enquete, revision: revision(enquete) };
  }

  async function diagnostiquer(enquete) {
    const resultat = validerEnquete(enquete);
    if (resultat.erreurs.length) return resultat;
    const absentes = await imagesDisponibles(enquete);
    return {
      erreurs: [...resultat.erreurs, ...absentes.map((chemin) => ({
        path: "images", message: `Image absente ou trop grande : ${chemin}.`,
      }))],
      avertissements: resultat.avertissements,
    };
  }

  async function verifier(id) {
    return diagnostiquer(await lireFichier(id));
  }

  async function lister({ inclureBrouillons = false } = {}) {
    const ids = new Set(["helene"]);
    try {
      await noeudSur(racine, "dossier");
      for (const entree of await readdir(racine, { withFileTypes: true })) {
        if (entree.isDirectory() && ID_SUR.test(entree.name)) ids.add(entree.name);
      }
    } catch (cause) { if (cause.status !== 404) throw cause; }
    const items = [];
    for (const id of ids) {
      try {
        const { enquete, revision: empreinte } = await lire(id, { inclureBrouillons });
        items.push({ id, titre: enquete.titre, intro: enquete.intro, statut: enquete.statut, revision: empreinte });
      } catch (cause) { if (![400, 404, 413].includes(cause.status)) throw cause; }
    }
    return items;
  }

  async function dupliquerImages(sourceId, id, enquete) {
    const source = sourceId === "helene" ? join(BASE, "public", "images") : join(imagesDir, sourceId);
    const destination = join(imagesDir, id);
    await mkdir(imagesDir, { recursive: true });
    await noeudSur(imagesDir, "dossier");
    await mkdir(destination, { mode: 0o700 });
    try {
      const copies = new Map();
      const copier = async (chemin) => {
        if (!chemin) return chemin;
        const nom = basename(chemin);
        if (!/^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(nom)) throw erreur(400, "Image source invalide.");
        if (!copies.has(chemin)) {
          const origine = join(source, nom);
          const info = await noeudSur(origine, "fichier");
          if (info.size > MAX_IMAGE) throw erreur(413, "Image source trop volumineuse.");
          await copyFile(origine, join(destination, nom));
          copies.set(chemin, `/images/enquetes/${id}/${nom}`);
        }
        return copies.get(chemin);
      };
      for (const humeur of Object.keys(enquete.personnage?.portraits ?? {})) {
        enquete.personnage.portraits[humeur] = await copier(enquete.personnage.portraits[humeur]);
      }
      for (const zone of Object.values(enquete.zones ?? {})) zone.illustration = await copier(zone.illustration);
    } catch (cause) {
      await rm(destination, { recursive: true, force: true });
      throw cause;
    }
  }

  async function creer({ id, sourceId } = {}) {
    verifierId(id);
    if (id === "helene") throw erreur(409, "Hélène est un exemple en lecture seule.");
    if (sourceId !== undefined) verifierId(sourceId);
    const source = sourceId ? (await lire(sourceId, { inclureBrouillons: true })).enquete : null;
    await mkdir(racine, { recursive: true });
    await noeudSur(racine, "dossier");
    const dossier = join(racine, id);
    if (await noeudSur(dossier, "dossier", true)) throw erreur(409, "Cette enquête existe déjà.");
    await mkdir(dossier, { mode: 0o700 });
    let imagesCrees = false;
    try {
      const enquete = source ? { ...structuredClone(source), id, statut: "brouillon" } : brouillonVide(id);
      if (source) {
        enquete.personnage = { id: "laurent", ...(enquete.personnage ?? {}) };
        await dupliquerImages(sourceId, id, enquete);
        imagesCrees = true;
      }
      verifierJson(enquete);
      await ecrireAtomiquement(join(dossier, "scenario.json"), enquete);
      return { enquete, revision: revision(enquete) };
    } catch (cause) {
      await rm(dossier, { recursive: true, force: true });
      if (imagesCrees) await rm(join(imagesDir, id), { recursive: true, force: true });
      throw cause;
    }
  }

  async function enregistrer(id, enquete) {
    verifierId(id);
    if (id === "helene") throw erreur(403, "Hélène est en lecture seule.");
    await lireFichier(id);
    if (!enquete || typeof enquete !== "object" || Array.isArray(enquete) || enquete.id !== id || enquete.schemaVersion !== VERSION_SCHEMA) {
      throw erreur(400, "Métadonnées d'enquête invalides.");
    }
    verifierJson(enquete);
    const brouillon = { ...enquete, statut: "brouillon" };
    const resultat = validerEnquete(brouillon, { complete: false });
    if (resultat.erreurs.length) throw erreur(400, "Brouillon invalide.", resultat.erreurs);
    verifierJson(brouillon);
    await ecrireAtomiquement(join(racine, id, "scenario.json"), brouillon);
    return { enquete: brouillon, revision: revision(brouillon) };
  }

  async function activer(id) {
    verifierId(id);
    if (id === "helene") throw erreur(403, "Hélène est en lecture seule.");
    const enquete = await lireFichier(id);
    const { erreurs } = await diagnostiquer(enquete);
    if (erreurs.length) throw erreur(422, "L'enquête comporte des erreurs.", erreurs);
    const prete = { ...enquete, statut: "prete" };
    await ecrireAtomiquement(join(racine, id, "scenario.json"), prete);
    return { enquete: prete, revision: revision(prete) };
  }

  async function ajouterImage(id, { nom, mime, donnees } = {}) {
    verifierId(id);
    if (id === "helene") throw erreur(403, "Hélène est en lecture seule.");
    await lireFichier(id);
    const extensions = TYPES.get(mime);
    const extension = typeof nom === "string" ? nom.split(".").at(-1)?.toLowerCase() : null;
    if (!extensions?.includes(extension) || !/^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(nom)) {
      throw erreur(400, "Nom ou type d'image invalide.");
    }
    if (!Buffer.isBuffer(donnees) || !donnees.length || !estImage(donnees, mime)) throw erreur(400, "Contenu d'image invalide.");
    if (donnees.length > MAX_IMAGE) throw erreur(413, "Image trop volumineuse.");
    await mkdir(imagesDir, { recursive: true });
    await noeudSur(imagesDir, "dossier");
    const dossier = join(imagesDir, id);
    await mkdir(dossier, { recursive: true });
    await noeudSur(dossier, "dossier");
    const cible = join(dossier, nom);
    if (await noeudSur(cible, "fichier", true)) throw erreur(409, "Une image porte déjà ce nom.");
    await writeFile(cible, donnees, { flag: "wx", mode: 0o600 });
    return `/images/enquetes/${id}/${nom}`;
  }

  return { lister, lire, creer, enregistrer, activer, ajouterImage, verifier };
}

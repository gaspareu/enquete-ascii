// Une signature authentifie les tours visibles ; elle ne chiffre pas le contenu.
// Aucun prompt privé ni fait verrouillé n'entre dans cette mémoire.
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TOKEN = 180_000;
const MAX_TOURS_LOCAL = 12;
const MAX_TOURS_TOTAL = 48;
const cle = (sceneId, role) => `${sceneId}/${role}`;
const signer = (secret, payload) => createHmac("sha256", secret).update(payload).digest("base64url");

export function lireMemoire(secret, token, identite) {
  if (token === undefined || token === null) return { canaux: {}, sequence: 0 };
  if (typeof token !== "string" || token.length > MAX_TOKEN) throw new Error("Mémoire invalide.");
  const morceaux = token.split(".");
  if (morceaux.length !== 2) throw new Error("Mémoire invalide.");
  const [payload, signature] = morceaux;
  const attendue = Buffer.from(signer(secret, payload));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) throw new Error("Mémoire invalide.");
  const contenu = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (contenu.version !== 1 || Object.entries(identite).some(([k, v]) => contenu.identite[k] !== v)) {
    throw new Error("Mémoire d’une autre partie ou révision.");
  }
  return contenu.memoire;
}

export function signerMemoire(secret, memoire, identite) {
  const payload = Buffer.from(JSON.stringify({ version: 1, identite, memoire })).toString("base64url");
  const token = `${payload}.${signer(secret, payload)}`;
  if (token.length > MAX_TOKEN) throw new Error("Mémoire trop longue.");
  return token;
}

export function historiqueLocal(memoire, sceneId, role) {
  return (memoire?.canaux?.[cle(sceneId, role)] ?? []).map(({ role: auteur, texte }) => ({ role: auteur, texte }));
}

export function ajouterTourMemoire(memoire, sceneId, role, message, reponses) {
  const avant = memoire ?? { canaux: {}, sequence: 0 };
  let sequence = avant.sequence;
  const tours = [...(message ? [{ role: "joueur", texte: message }] : []), ...reponses]
    .map(({ role: auteur, texte }) => ({ role: auteur, texte: texte.slice(0, 2000), ordre: ++sequence }));
  const canal = cle(sceneId, role);
  const canaux = { ...avant.canaux, [canal]: [...(avant.canaux[canal] ?? []), ...tours].slice(-MAX_TOURS_LOCAL) };
  const ordres = Object.values(canaux).flat().map((tour) => tour.ordre).sort((a, b) => b - a);
  const minimum = ordres[MAX_TOURS_TOTAL - 1] ?? 0;
  let bornes = Object.fromEntries(Object.entries(canaux).map(([k, liste]) =>
    [k, liste.filter((tour) => tour.ordre >= minimum)]));
  // Borne en octets également : un caractère Unicode ne vaut pas un octet.
  while (Buffer.byteLength(JSON.stringify(bornes), "utf8") > 90_000) {
    const ancien = Math.min(...Object.values(bornes).flat().map((tour) => tour.ordre));
    bornes = Object.fromEntries(Object.entries(bornes).map(([k, liste]) => [k, liste.filter((tour) => tour.ordre !== ancien)]));
  }
  return { sequence, canaux: bornes };
}

// Reçus HMAC chaînés : le navigateur les conserve sans pouvoir ajouter, modifier
// ou réordonner un événement de progression. La clé vit uniquement en mémoire du
// processus, ce qui convient à une partie non persistée.

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const VERSION_RECU = 1;
export const MAX_RECUS = 100;
export const MAX_TAILLE_RECU = 4096;

function encoder(valeur) {
  return Buffer.from(JSON.stringify(valeur)).toString("base64url");
}

function decoder(texte) {
  return JSON.parse(Buffer.from(texte, "base64url").toString("utf8"));
}

function signer(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signatureValide(secret, payload, signature) {
  const attendue = Buffer.from(signer(secret, payload));
  const recue = Buffer.from(signature);
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}

function estContexte(contexte) {
  return (
    contexte &&
    typeof contexte === "object" &&
    ((contexte.type === "zone" && typeof contexte.id === "string") ||
      (contexte.type === "personnage" && contexte.id === "laurent"))
  );
}

function estEvenement(evenement) {
  return (
    evenement &&
    typeof evenement === "object" &&
    typeof evenement.type === "string" &&
    typeof evenement.cible === "string" &&
    evenement.cible.length > 0 &&
    evenement.cible.length <= 200 &&
    estContexte(evenement.contexte)
  );
}

export function empreinteRecu(recu) {
  return createHash("sha256").update(recu).digest("base64url");
}

export function creerRecu(
  secret,
  { partie, sequence, precedent, evenement, version = VERSION_RECU },
) {
  const contenu = { version, partie, sequence, precedent, evenement };
  const payload = encoder(contenu);
  return `${payload}.${signer(secret, payload)}`;
}

function lireRecu(secret, recu) {
  if (typeof recu !== "string" || recu.length === 0 || recu.length > MAX_TAILLE_RECU) return null;
  const segments = recu.split(".");
  if (segments.length !== 2 || !signatureValide(secret, segments[0], segments[1])) return null;
  try {
    const contenu = decoder(segments[0]);
    if (
      contenu?.version !== VERSION_RECU ||
      typeof contenu.partie !== "string" ||
      contenu.partie.length < 1 ||
      contenu.partie.length > 100 ||
      !Number.isInteger(contenu.sequence) ||
      contenu.sequence < 1 ||
      (contenu.precedent !== null && typeof contenu.precedent !== "string") ||
      !estEvenement(contenu.evenement)
    ) return null;
    return contenu;
  } catch {
    return null;
  }
}

export function verifierRecus(secret, recus) {
  if (!Array.isArray(recus) || recus.length > MAX_RECUS) return { ok: false };
  let partie = null;
  let precedent = null;
  const vus = new Set();
  const evenements = [];

  for (let index = 0; index < recus.length; index += 1) {
    const recu = recus[index];
    if (vus.has(recu)) return { ok: false };
    vus.add(recu);
    const contenu = lireRecu(secret, recu);
    if (
      !contenu ||
      contenu.sequence !== index + 1 ||
      (partie !== null && contenu.partie !== partie) ||
      contenu.precedent !== precedent
    ) return { ok: false };
    partie = contenu.partie;
    precedent = empreinteRecu(recu);
    evenements.push(contenu.evenement);
  }

  return { ok: true, partie, precedent, recus: [...recus], evenements };
}

export function emettreRecu(secret, verification, evenement) {
  if (!verification?.ok || !estEvenement(evenement)) throw new TypeError("Événement invalide.");
  return creerRecu(secret, {
    partie: verification.partie ?? randomUUID(),
    sequence: verification.evenements.length + 1,
    precedent: verification.precedent,
    evenement,
  });
}

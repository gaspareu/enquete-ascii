// Normalisation de la sortie du modèle avant toute diffusion. Une didascalie est
// décorative : elle ne peut donc provenir que d'un répertoire fermé, contrôlé ici
// côté serveur. Le navigateur ne reçoit jamais l'en-tête brut du modèle.

export const DIDASCALIES_AUTORISEES = Object.freeze([
  "Laurent reste immobile.",
  "Laurent ajuste le pli de sa manche.",
  "Laurent se redresse.",
  "Laurent joint les mains.",
  "Laurent regarde un instant vers la fenêtre.",
]);

const ENTETE_STRICT = "DIDASCALIE:";
const ENTETE_RECONNU = /^\s*didascalie\s*:\s*(.*)\s*$/iu;
const MARQUEUR_DIDASCALIE = /^\s*didascalie\b/iu;
const MARQUEUR_DIDASCALIE_LEGACY = /^\s*\*/u;

function texteCanonique(texte) {
  return texte.trim().replace(/\s+/gu, " ");
}

function didascalieAutorisee(texte) {
  const candidate = texteCanonique(texte);
  return DIDASCALIES_AUTORISEES.find((didascalie) => didascalie === candidate) ?? null;
}

function estUnDebutDeDidascalie(texte) {
  const debut = texte.trimStart().toLocaleLowerCase("fr-FR");
  const entete = ENTETE_STRICT.toLocaleLowerCase("fr-FR");
  return entete.startsWith(debut) || debut.startsWith("didascalie") || debut.startsWith("*");
}

// Produit des événements internes `{ type: "didascalie" | "delta", texte }`.
// Seule la première ligne est inspectée. Les fragments d'un éventuel en-tête sont
// retenus jusqu'au saut de ligne afin que le marqueur ne fuite jamais dans `delta`.
// Dès qu'il ne peut plus s'agir d'une didascalie, les fragments redeviennent
// immédiatement streamables, y compris pour une réponse sans saut de ligne.
export function creerFiltreReplique(emetteur) {
  let tampon = "";
  let premiereLigneTraitee = false;
  let termine = false;

  const emettreParole = (texte) => {
    if (texte) emetteur({ type: "delta", texte });
  };

  const traiterPremiereLigne = (ligne, conserveSaut = false) => {
    premiereLigneTraitee = true;
    const correspondance = ligne.match(ENTETE_RECONNU);
    if (!correspondance && !MARQUEUR_DIDASCALIE.test(ligne) && !MARQUEUR_DIDASCALIE_LEGACY.test(ligne)) {
      emettreParole(`${ligne}${conserveSaut ? "\n" : ""}`);
      return;
    }

    // Une variante d'en-tête ou un geste hors répertoire est retiré entièrement :
    // une didascalie invalide ne peut pas devenir un indice via les paroles.
    const didascalie = ligne.startsWith(ENTETE_STRICT)
      ? didascalieAutorisee(correspondance[1])
      : null;
    if (didascalie) emetteur({ type: "didascalie", texte: didascalie });
  };

  const viderPremiereLigne = () => {
    const indexSaut = tampon.indexOf("\n");
    if (indexSaut === -1) return false;
    traiterPremiereLigne(tampon.slice(0, indexSaut), true);
    const suite = tampon.slice(indexSaut + 1);
    tampon = "";
    emettreParole(suite);
    return true;
  };

  return {
    ajouter(morceau) {
      if (termine || typeof morceau !== "string" || morceau.length === 0) return;
      if (premiereLigneTraitee) {
        emettreParole(morceau);
        return;
      }

      tampon += morceau;
      if (viderPremiereLigne()) return;
      if (!estUnDebutDeDidascalie(tampon)) {
        premiereLigneTraitee = true;
        emettreParole(tampon);
        tampon = "";
      }
    },

    terminer() {
      if (termine) return;
      if (!premiereLigneTraitee) traiterPremiereLigne(tampon);
      tampon = "";
      termine = true;
    },
  };
}

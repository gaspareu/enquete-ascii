// Validation des entrées au boundary HTTP. On ne fait jamais confiance au client :
// message borné, JOURNAL DE GESTES limité aux gestes/cibles que le scénario connaît,
// historique et note bornés. Le client n'envoie plus de flags : le serveur les dérive
// du journal (cf. server/etat.js). Renvoie { ok, valeur } ou { ok: false, erreur }.

const MAX_MESSAGE = 500;
const MAX_NOTE = 200;
const MAX_HISTORIQUE = 100;
const MAX_GESTES = 100;
const GESTES_VALIDES = new Set(["ramasser", "donner", "examiner"]);

function estObjet(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Valide le journal de gestes envoyé par le client. Chaque entrée doit être un geste
// connu sur une cible connue ; on normalise à { geste, cible } (champs parasites
// écartés). Renvoie { ok, valeur } ou { ok: false, erreur }.
export function valideGestes(brut, ciblesConnues) {
  const gestesBruts = brut ?? [];
  if (!Array.isArray(gestesBruts) || gestesBruts.length > MAX_GESTES) {
    return { ok: false, erreur: "Journal de gestes invalide." };
  }
  const gestes = [];
  for (const g of gestesBruts) {
    if (
      !estObjet(g) ||
      !GESTES_VALIDES.has(g.geste) ||
      typeof g.cible !== "string" ||
      !ciblesConnues.has(g.cible)
    ) {
      return { ok: false, erreur: "Geste inconnu." };
    }
    gestes.push({ geste: g.geste, cible: g.cible });
  }
  return { ok: true, valeur: gestes };
}

export function valideRequeteChat(body, ciblesConnues) {
  if (!estObjet(body)) {
    return { ok: false, erreur: "Requête invalide." };
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0) {
    return { ok: false, erreur: "Le message est vide." };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, erreur: "Le message est trop long." };
  }

  const vg = valideGestes(body.gestes, ciblesConnues);
  if (!vg.ok) {
    return vg;
  }

  const historiqueBrut = body.historique ?? [];
  if (!Array.isArray(historiqueBrut) || historiqueBrut.length > MAX_HISTORIQUE) {
    return { ok: false, erreur: "Historique invalide." };
  }
  const historique = historiqueBrut.map((tour) => ({
    role: tour?.role === "personnage" ? "personnage" : "joueur",
    texte: String(tour?.texte ?? "").slice(0, MAX_MESSAGE),
  }));

  const note =
    typeof body.note === "string" ? body.note.slice(0, MAX_NOTE) : "";

  return { ok: true, valeur: { message, gestes: vg.valeur, historique, note } };
}

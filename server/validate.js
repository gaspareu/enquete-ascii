// Validation des entrées au boundary HTTP. On ne fait jamais confiance au client :
// message borné, flags limités à ceux que le scénario peut réellement produire,
// historique et note bornés. Renvoie { ok, valeur } ou { ok: false, erreur }.

const MAX_MESSAGE = 500;
const MAX_NOTE = 200;
const MAX_HISTORIQUE = 100;

function estObjet(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function valideRequeteChat(body, flagsConnus) {
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

  const flagsBruts = body.flags ?? [];
  if (!Array.isArray(flagsBruts)) {
    return { ok: false, erreur: "Flags invalides." };
  }
  for (const f of flagsBruts) {
    if (typeof f !== "string" || !flagsConnus.has(f)) {
      return { ok: false, erreur: "Flag inconnu." };
    }
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

  return { ok: true, valeur: { message, flags: flagsBruts, historique, note } };
}

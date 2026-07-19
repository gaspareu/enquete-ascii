// public/micro.js
// Wrapper minimal de la reconnaissance vocale du navigateur (Web Speech API).
// Aucun audio ne quitte le navigateur via NOTRE serveur (cf. note RGPD du README).
// Isolé du DOM : reçoit ses callbacks, ne connaît ni le champ de saisie ni game.js.

function ctorReco() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Le navigateur sait-il transcrire la parole ?
export function microDisponible() {
  return ctorReco() !== null;
}

// Crée un micro contrôlable. Renvoie { demarrer, arreter } ou null si non supporté.
// onTexte(transcript) est appelé au premier résultat ; onFin() à la fin d'écoute.
export function creerMicro({ langue = "fr-FR", onTexte, onFin } = {}) {
  const Ctor = ctorReco();
  if (!Ctor) return null;
  const reco = new Ctor();
  reco.lang = langue;
  reco.interimResults = false;
  reco.maxAlternatives = 1;
  reco.addEventListener("result", (e) => {
    const transcript = e.results?.[0]?.[0]?.transcript ?? "";
    if (transcript) onTexte?.(transcript);
  });
  reco.addEventListener("end", () => onFin?.());
  return {
    demarrer: () => reco.start(),
    arreter: () => reco.stop(),
  };
}

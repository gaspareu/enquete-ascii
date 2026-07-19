// public/voix.js
// Mode vocal du personnage (T-07) : récupère l'audio de la réplique via /api/voix
// et le joue. La voix est un PLUS, jamais un bloquant : toute erreur est avalée
// silencieusement (le texte reste affiché). Le `play` audio est injecté (`jouer`)
// pour garder ce module testable sans API navigateur.

export function creerModeVocal({ fetchFn = fetch, jouer } = {}) {
  let actif = false;
  return {
    estActif: () => actif,
    // Bascule l'état et renvoie la nouvelle valeur (pour mettre à jour le bouton).
    basculer() {
      actif = !actif;
      return actif;
    },
    // Vocalise `texte` si le mode est actif. No-op si inactif ou texte vide.
    async dire(texte) {
      if (!actif || !texte) return;
      try {
        const rep = await fetchFn("/api/voix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texte }),
        });
        if (!rep.ok) return; // dégradation silencieuse
        const blob = await rep.blob();
        jouer(blob);
      } catch {
        // Réseau/TTS indisponible : on garde le texte, sans bruit.
      }
    },
  };
}

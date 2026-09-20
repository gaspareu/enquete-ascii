export const ONGLETS = [
  ["cadre", "Cadre"], ["piece", "Pièce"], ["objets", "Objets"],
  ["progression", "Progression"], ["dialogue", "Dialogue"],
  ["debrief", "Débrief"], ["tester", "Vérifier / Tester"],
];

export function brancherNavigationOnglets(application, etat, rendre) {
  application?.addEventListener("keydown", (event) => {
    const cible = event.target.closest('[role="tab"][data-tab]');
    if (!cible || !application.contains(cible)) return;
    const index = ONGLETS.findIndex(([id]) => id === cible.dataset.tab);
    const suivant = event.key === "ArrowRight" ? (index + 1) % ONGLETS.length :
      event.key === "ArrowLeft" ? (index - 1 + ONGLETS.length) % ONGLETS.length :
      event.key === "Home" ? 0 : event.key === "End" ? ONGLETS.length - 1 : -1;
    if (suivant < 0) return;
    event.preventDefault();
    etat.onglet = ONGLETS[suivant][0];
    rendre();
    application.querySelector(`[data-tab="${etat.onglet}"]`)?.focus();
  });
}

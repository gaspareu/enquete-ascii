// Le suivi du flux s'arrête dès que le joueur remonte pour relire.
export function creerSuiviJournal({ journal, bouton }) {
  let suivre = true;
  bouton.hidden = true;
  const procheDuBas = () => journal.scrollHeight - journal.clientHeight - journal.scrollTop <= 48;
  journal.addEventListener("scroll", () => {
    suivre = procheDuBas();
    if (suivre) bouton.hidden = true;
  });
  bouton.addEventListener("click", () => {
    suivre = true;
    journal.scrollTop = journal.scrollHeight;
    bouton.hidden = true;
    // Le bouton va disparaître : garder un point de focus clavier stable.
    journal.focus({ preventScroll: true });
  });
  return {
    modifier(mutation, { nouveau = false } = {}) {
      const position = journal.scrollTop;
      mutation();
      if (suivre) {
        journal.scrollTop = journal.scrollHeight;
        bouton.hidden = true;
      } else {
        journal.scrollTop = position;
        if (nouveau) bouton.hidden = false;
      }
    },
  };
}

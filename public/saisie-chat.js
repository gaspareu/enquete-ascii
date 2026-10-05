// Maj+Entrée garde le retour à la ligne natif ; une composition ne soumet rien.
export function brancherSaisieChat({ form, saisie }) {
  saisie.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!saisie.disabled) form.requestSubmit();
  });
}

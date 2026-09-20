import { element, titre } from "./ui.js";

export function actualiserContexte(enquete, application) {
  const sortie = document.getElementById("contexte-apercu");
  if (!sortie) return;
  const flags = new Set([...application.querySelectorAll('[data-action="contexte-flag"]:checked')].map((item) => item.dataset.flag));
  const connues = enquete.connaissances.filter((item) => item.requiert.every((flag) => flags.has(flag)));
  sortie.replaceChildren(titre(`${connues.length} connaissance(s) visible(s)`, 3));
  for (const item of connues) sortie.append(element("p", `${item.id} : ${item.texte}`));
}

export function allerDiagnostic(path, { etat, application, rendre, annoncer }) {
  const segments = path.replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  const racine = segments[0];
  etat.onglet = racine === "zones" ? "piece" : racine === "objets" ? "objets" :
    ["declencheurs", "preconditions", "conditionsActions"].includes(racine) ? "progression" :
    ["connaissances", "pistesInterrogatoire"].includes(racine) ? "dialogue" :
    ["solution", "debrief"].includes(racine) ? "debrief" : "cadre";
  if (racine === "zones" && segments[1]) etat.direction = segments[1];
  if (racine === "objets" && segments[1]) etat.objet = segments[1];
  rendre();
  const cible = [...application.querySelectorAll("[data-path]")].find((item) => {
    const chemin = JSON.parse(item.dataset.path).map(String);
    return chemin.join(".") === segments.join(".");
  });
  const details = cible?.closest("details");
  if (details) details.open = true;
  cible?.focus();
  if (!cible) annoncer(`Section ouverte pour : ${path}`);
}

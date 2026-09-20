const liste = document.getElementById("liste-enquetes");
const statut = document.getElementById("statut-enquetes");

async function chargerEnquetes() {
  try {
    const reponse = await fetch("/api/enquetes");
    if (!reponse.ok) throw new Error("Catalogue indisponible.");
    const donnees = await reponse.json();
    const enquetes = Array.isArray(donnees.enquetes) ? donnees.enquetes : [];
    liste.replaceChildren();
    for (const enquete of enquetes) {
      if (typeof enquete.id !== "string" || typeof enquete.titre !== "string") continue;
      const item = document.createElement("li");
      const lien = document.createElement("a");
      lien.href = `/jouer/${encodeURIComponent(enquete.id)}`;
      const titre = document.createElement("strong");
      titre.textContent = enquete.titre;
      const description = document.createElement("span");
      description.textContent = enquete.intro ?? "Ouvrir cette enquête";
      lien.append(titre, description);
      item.appendChild(lien);
      liste.appendChild(item);
    }
    statut.textContent = liste.childElementCount === 0
      ? "Aucune enquête prête pour le moment."
      : `${liste.childElementCount} enquête${liste.childElementCount > 1 ? "s" : ""} disponible${liste.childElementCount > 1 ? "s" : ""}.`;
  } catch {
    statut.textContent = "Impossible de charger les enquêtes.";
  }
}

chargerEnquetes();

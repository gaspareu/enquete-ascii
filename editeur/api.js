let jeton = "";

export function definirJeton(valeur) { jeton = valeur; }

export async function api(chemin, options = {}) {
  const entetes = { ...options.headers };
  if (chemin !== "/api/editeur/session") entetes["X-Editor-Token"] = jeton;
  const reponse = await fetch(chemin, { ...options, headers: entetes, credentials: "same-origin" });
  let contenu;
  try { contenu = await reponse.json(); } catch { contenu = {}; }
  if (!reponse.ok) throw new Error(contenu.erreur ?? contenu.message ?? `Erreur HTTP ${reponse.status}`);
  return contenu;
}

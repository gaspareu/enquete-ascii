export function element(tag, texte = "", classe = "") {
  const noeud = document.createElement(tag);
  if (texte) noeud.textContent = texte;
  if (classe) noeud.className = classe;
  return noeud;
}

export function bouton(texte, action, donnees = {}) {
  const noeud = element("button", texte);
  noeud.type = "button";
  noeud.dataset.action = action;
  for (const [cle, valeur] of Object.entries(donnees)) noeud.dataset[cle] = String(valeur);
  return noeud;
}

export function titre(texte, niveau = 2) {
  return element(`h${niveau}`, texte);
}

export function groupe(...enfants) {
  const noeud = element("div", "", "grille-formulaire");
  noeud.append(...enfants.filter(Boolean));
  return noeud;
}

export function champ(libelle, chemin, valeur, options = {}) {
  const bloc = element("div", "", options.booleen ? "champ champ-boolean" : "champ");
  const id = `champ-${chemin.map(String).join("-").replace(/[^a-z0-9-]/gi, "-")}`;
  const label = element("label", libelle);
  label.htmlFor = id;
  let controle;
  if (options.choix) {
    controle = element("select");
    for (const [val, texte] of options.choix) {
      const option = element("option", texte);
      option.value = val;
      controle.append(option);
    }
    controle.value = String(valeur ?? "");
  } else if (options.booleen) {
    controle = element("input");
    controle.type = "checkbox";
    controle.checked = Boolean(valeur);
  } else if (options.multiligne || options.liste) {
    controle = element("textarea");
    controle.value = options.liste ? (valeur ?? []).join("\n") : String(valeur ?? "");
    if (options.long) controle.classList.add("long");
  } else {
    controle = element("input");
    controle.type = options.nombre ? "number" : "text";
    controle.value = String(valeur ?? "");
  }
  controle.id = id;
  controle.dataset.path = JSON.stringify(chemin);
  controle.dataset.type = options.liste ? "liste" : options.booleen ? "booleen" : options.nombre ? "nombre" : "texte";
  if (options.required) controle.required = true;
  if (options.booleen) bloc.append(controle, label);
  else bloc.append(label, controle);
  if (options.aide) bloc.append(element("p", options.aide, "aide"));
  return bloc;
}

export function champImage(libelle, chemin, valeur) {
  const bloc = groupe(champ(libelle, chemin, valeur, { aide: "Chemin public ou image importée ci-dessous." }));
  const id = `image-${chemin.join("-")}`;
  const label = element("label", "Importer une image PNG, JPEG ou WebP");
  label.htmlFor = id;
  const input = element("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp";
  input.id = id;
  input.dataset.action = "upload-image";
  input.dataset.path = JSON.stringify(chemin);
  bloc.append(label, input);
  if (typeof valeur === "string" && valeur.startsWith("/images/")) {
    const image = element("img", "", "apercu");
    image.src = valeur;
    image.alt = `Aperçu : ${libelle.toLowerCase()}`;
    image.loading = "lazy";
    bloc.append(image);
  }
  return bloc;
}

export function listeSelection(titreListe, items, selection, ajouterAction, choixAction, libelle) {
  const panneau = element("aside", "", "panneau");
  panneau.append(titre(titreListe, 2), bouton("+ Ajouter", ajouterAction));
  const liste = element("div", "", "liste-selection");
  for (const [cle, item] of items) {
    const action = bouton(libelle(item, cle), choixAction, { cle });
    action.setAttribute("aria-current", String(cle === selection));
    liste.append(action);
  }
  panneau.append(liste);
  return panneau;
}

export function zoneAide(texte) {
  return element("p", texte, "aide");
}

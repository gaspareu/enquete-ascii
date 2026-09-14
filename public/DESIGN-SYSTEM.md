# Design System — Enquête ASCII

Identité : **terminal/CRT phosphore**. Monochrome ambre sur fond sombre, accents
vert phosphore, police à chasse fixe, coins nets (pas d'arrondi), art ASCII dans
des `<pre>`. Tout doit évoquer un vieux moniteur à tube.

> **Source de vérité = [tokens.css](tokens.css).** Aucune valeur brute de couleur,
> typographie, espacement ou durée ne doit être écrite en dur dans
> [style.css](style.css) : on référence toujours une variable `--*`. Seules les
> dimensions structurelles de la grille (`rem`/`vh` de `grid-template`, `100vh`)
> restent inline. Ce fichier documente le « pourquoi ».

Ce DS est conçu pour être **ingéré par Claude Design** (lecture du CSS du repo) afin
que les itérations front restent cohérentes avec l'esthétique.

## Couleurs

| Token | Rôle |
|---|---|
| `--c-fond` | Fond global de l'écran |
| `--c-fond-panneau` | Fond des panneaux (`section`) |
| `--c-surface` / `--c-surface-survol` | Cases du plan, objets du sac (+ survol) |
| `--c-bouton` / `--c-bouton-survol` | Boutons d'action (+ survol) |
| `--c-ambre` | Texte principal |
| `--c-ambre-faible` | Texte secondaire, désactivé, titres |
| `--c-vert` | Accent : invite `>`, art ASCII, centre du plan |
| `--c-erreur` | Danger : « Accuser », erreurs |
| `--c-bordure` | Traits et contours |

Contraste : l'ambre/vert sur fond sombre doit rester lisible **même avec la lueur
CRT activée**. Ne pas introduire de couleur hors palette sans l'ajouter aux tokens.

## Typographie

Police unique à chasse fixe (`--police`). Deux tailles : `--taille-base` (corps,
dialogue, saisie) et `--taille-petite` (titres `h2`, cases du plan). Titres en
`--c-ambre-faible`, espacés (`--interlettre-titre`), soulignés d'un trait pointillé.

## Espacement

Échelle `--esp-xs` (4px) → `--esp-3xl` (24px). Utiliser un cran de l'échelle plutôt
qu'une valeur arbitraire. Gouttières de la grille de jeu : `--esp-md`.

## Composants

- **Panneau** (`section`) : fond `--c-fond-panneau`, contour `--trait solid --c-bordure`.
- **Titre de panneau** (`h2`) : petit, ambre faible, souligné pointillé.
- **Bouton d'action** : fond `--c-bouton`, contour `--c-ambre-faible`. Variante
  danger (« Accuser ») : texte et contour `--c-erreur`.
- **Case du plan / objet du sac** : fond `--c-surface`, survol `--c-surface-survol` ;
  centre du plan (l'interlocuteur) en `--c-vert`, cliquable pour revenir au face-à-face.
- **Modale** : voile sombre + boîte `--c-fond-panneau` contour `--c-ambre`.
- **Invite de saisie** : caret `>` en `--c-vert`, champ sans bordure ni fond.
- **Illustration de zone** : les scènes fournies par le scénario remplacent l'art
  ASCII dans le panneau principal. Elles remplissent toute la zone de scène, sans
  marge ni bordure interne, et sont affichées sans lissage (`image-rendering:
  pixelated`).
- **Mode mobile** : sous `48rem`, la grille devient une colonne : scène, dialogue,
  puis plan et sac côte à côte. La scène conserve le ratio
  `--ratio-scene-mobile`, calé sur les illustrations les plus larges : le portrait
  entier ou l'illustration utilise donc toute la hauteur de scène, sans recadrage.
  Le dialogue reçoit sa propre piste minimale
  (`--hauteur-dialogue-mobile-min` / `--hauteur-dialogue-mobile`) ; la page défile
  ensuite pour accéder au plan et au sac, sans réduire la scène ni créer de
  débordement horizontal. La hauteur dynamique de la vue est employée avec le repli
  `100vh` afin que les barres de Safari mobile ne masquent pas le contenu.
- **Portrait de l'interlocuteur** : un portrait pixel art peut remplacer le visage
  ASCII lors du face-à-face. Son expression évolue après les réponses du chat et
  le `figure` occupe toute la hauteur de la scène. L'image remplit cette zone avec
  `object-fit: contain` : le ratio et l'illustration complète sont conservés, les
  éventuelles marges latérales restent le fond de scène, sans carte ni bordure.
- **Journal d'interrogatoire** : chaque tour est un élément sémantique construit
  par nœuds DOM (`textContent`, jamais HTML injecté). Laurent est à gauche, le
  joueur à droite, et la narration système est centrée, atténuée et en italique.
  La largeur maximale d'un tour passe par `--largeur-tour-max`; le contenu garde
  ses retours de paragraphe avec `white-space: pre-wrap`. Une didascalie de Laurent
  validée par le serveur est un nœud `<em>` décoratif distinct de sa parole ; elle
  n'est jamais fusionnée à l'historique ni à la synthèse vocale.
- **Pistes d'interrogatoire** : sous le compositeur, `#pistes` ne présente que les
  questions déjà autorisées par le serveur et seulement en face-à-face avec Laurent.
  Chaque question est un bouton `.piste-interrogatoire` pleine largeur, discret (ambre
  faible / surface), accessible au clavier ; son activation préremplit le champ puis
  le focalise, sans jamais envoyer le message. Les pistes sont masquées lors de la
  fouille d'une zone et quand le serveur n'en fournit aucune.
- **Formulaire de débrief & écran de score (T-06)** : dans la modale, l'accusation
  ouvre un **formulaire de débrief** — un `<textarea>` par question (fond `--c-surface`,
  contour `--c-bordure`, focus → `--c-ambre`), libellés en `--c-ambre-faible` /
  `--taille-petite`. À la soumission, son état accessible (`role=status`) annonce
  l'analyse et désactive le seul bouton de verdict, sans effacer les réponses. Une
  erreur réactive ce bouton et laisse le formulaire intact. En cas de réussite, la
  modale affiche un débrief structuré : rang, score, puis une évaluation, la
  justification et, si le juge le fournit, l'élément à approfondir pour chaque
  hypothèse. `--hauteur-modale-max` assure que les quatre réponses restent lisibles
  sur petit écran. Aucune valeur brute : tout passe par les tokens ; `resize: vertical`
  reste la seule dimension structurelle.
- **Boutons icône du dialogue — micro & voix (T-07)** : `.btn-icone` (`#btn-micro`,
  `#btn-voix`), fond `--c-surface`, contour `--c-bordure`, survol `--c-surface-survol`.
  États : `#btn-voix.actif` (voix activée) en accent `--c-vert`, texte et contour —
  même accent que le centre du plan ; `#btn-micro.ecoute` (micro en écoute) en
  `--c-erreur` avec une pulsation discrète (`@keyframes pulser`, durée
  `--duree-clignotement`), neutralisée sous `prefers-reduced-motion` par la règle `*`
  déjà en place. Aucune valeur brute introduite : tout vient des tokens existants.

## Mouvement & ambiance CRT

Subtil par défaut. Tokens : `--duree-survol` (transitions), `--duree-clignotement`
(curseur), `--crt-lueur` (text-shadow phosphore), `--crt-scanline-*` (lignes de
balayage), `--crt-vignette` (assombrissement des bords).

**Accessibilité (règle dure) :** toute animation (curseur, fade, scanlines animées,
machine à écrire) doit être neutralisée sous `@media (prefers-reduced-motion: reduce)`.
Le rendu sans animation doit rester pleinement lisible et utilisable.

## Maintenir le DS à jour

À chaque évolution du front :
1. Nouveau besoin de couleur/taille/espacement/durée → **ajouter un token** dans
   `tokens.css` (jamais de valeur en dur dans `style.css`).
2. Nouveau composant ou règle d'usage → l'ajouter ici.
3. Garder ce doc et `tokens.css` synchronisés : c'est ce que Claude Design ingère.

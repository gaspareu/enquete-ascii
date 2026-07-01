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
  centre du plan (l'interlocuteur) en `--c-vert`, non cliquable.
- **Modale** : voile sombre + boîte `--c-fond-panneau` contour `--c-ambre`.
- **Invite de saisie** : caret `>` en `--c-vert`, champ sans bordure ni fond.
- **Formulaire de débrief & écran de score (T-06)** : dans la modale, l'accusation
  ouvre un **formulaire de débrief** — un `<textarea>` par question (fond `--c-surface`,
  contour `--c-bordure`, focus → `--c-ambre`), libellés en `--c-ambre-faible` /
  `--taille-petite`. À la soumission, la modale affiche l'**écran de score** : texte
  ASCII pré-formaté (rang, score global, note + justification par question), rendu par
  `rendreDebrief()` dans `#modale-contenu` (`white-space: pre-wrap`). Aucune valeur brute :
  tout passe par les tokens ; `resize: vertical` reste la seule dimension structurelle.

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

# T-07 · Enrichir le contenu — nouveau scénario « Ce que préparait Hélène » — design

Statut : validé (design). Branche : `feat/scenario-enrichi-t07`.

## Objectif

Tâche backlog T-07 : « Enrichir le contenu / scénarios multiples ». Critère
d'acceptation : étoffer `data/scenario.js` (plus de zones, d'objets, de
connaissances).

**Décisions de périmètre (validées en brainstorming) :**

- On **remplace** le scénario actuel « Mort au manoir Aldous » par un nouveau
  scénario, plus riche. **Un seul scénario à la fois** : pas d'architecture
  multi-scénarios ni de sélection au lancement (hors périmètre).
- Ampleur retenue : **enquête ramifiée riche** — les 8 directions actives,
  ~9 objets « utiles » + ~25 objets d'ambiance, un arbre de flags à préconditions
  croisées, 3 fils d'enquête convergents.
- **Aucune modification du moteur** n'est nécessaire : tout est déjà *data-driven*
  (`preuvesRequises` est une liste évaluée en `.every()`, les préconditions sont
  résolues à point fixe → chaînes ramifiées possibles). Le travail est du **contenu**
  dans `data/scenario.js`, plus l'adaptation des tests et commentaires couplés à
  l'ancien contenu.

## Thème & traitement

Le scénario aborde un **féminicide conjugal**. Traitement **digne et non
voyeuriste** : la victime est une personne entière (brillante, aimante, des
projets) ; l'horreur passe par la **révélation psychologique** (jalousie,
contrôle, possession derrière une façade respectable), jamais par des détails
morbides. C'est un ressort de prise de conscience, pas du sensationnalisme.

## L'intrigue

- **Victime — Hélène Vasseur**, architecte de renom fraîchement primée et
  médiatisée. Retrouvée morte dans **son atelier à domicile** (lieu du huis clos),
  une tasse de tisane renversée près d'elle.
- **Interlocuteur (joué par Claude) — Laurent Vasseur, son mari = le coupable.**
  Charmant, maître de lui, il **pousse activement la thèse du suicide**
  (surmenage, dépression, pression médiatique) et joue l'époux effondré. Sous la
  façade : carrière en berne dans l'ombre du succès d'Hélène, endetté, possessif.
  Il la croyait infidèle ; il l'a droguée (surdose de somnifères dans sa tisane)
  et a maquillé la scène.
- **Le pivot** : les « cachotteries » d'Hélène (rendez-vous notés en code,
  dépenses, messages) que Laurent prenait pour une liaison étaient en réalité les
  **préparatifs d'une fête surprise qu'elle lui organisait**. Découvrir la fête
  démolit d'un coup **la thèse du suicide** (elle avait des projets, de la joie de
  vivre) **et le faux mobile d'adultère**.

Le joueur doit lever un **vrai doute** (accident ? suicide ?) en établissant trois
choses : que ce n'est pas un suicide et qu'un tiers était présent (l'acte), le
mobile (la jalousie de Laurent), et l'innocence d'Hélène (la fête surprise).

## Structure de données (`data/scenario.js`)

### Personnage

- `personnage.nom` = `"Laurent"`. Visage ASCII conservé (placeholder réutilisable,
  donnée publique).
- `personnalite` : charmant et posé en surface, pousse la thèse du suicide,
  possessif/jaloux sous la façade ; flatté, il se détend et se vante ; ne révèle
  **jamais** spontanément sa culpabilité, nie si accusé sans preuve, ne dit que ce
  qu'il sait, n'invente pas de faits.
- `faitsDeBase` (dits sans condition) : il est Laurent Vasseur, mari d'Hélène ; il
  l'a trouvée inanimée hier soir dans son atelier ; il la dit surmenée par sa
  notoriété récente et redoute « l'irréparable » ; il se dit effondré.

### Les 8 zones et leurs objets

Laurent au centre, l'atelier autour. Chaque zone porte **1 objet utile** (parfois
2) et **~3 objets d'ambiance** sans valeur d'enquête, cohérents avec la zone.

| Dir. | Ambiance (zone) | Objet(s) utile(s) | Objets d'ambiance (neutres) |
|---|---|---|---|
| **N**  | Table à dessin, distinction encadrée | `distinction` | `maquette`, `crayons_plans`, `plante_fanee` |
| **NE** | Bibliothèque, classeurs | `agenda` | `monographies`, `revues_deco`, `presse_papier` |
| **E**  | Guéridon, plateau à tisane | `theiere` | `boite_tisanes`, `napperon`, `cuillere_argent` |
| **SE** | Corbeille à papier | `plaquette_somniferes` | `brouillons_froisses`, `enveloppe_pub`, `trognon_pomme` |
| **S**  | Coin salon, table basse | `mot_manuscrit` | `photos_mariage`, `plaid`, `roman_corne` |
| **SO** | Placard fermé | `cadeau_cache` | `manteaux`, `cartons_archives`, `raquette_tennis` |
| **O**  | Secrétaire près de la fenêtre | `telephone` | `courrier`, `stylo_plume`, `cartes_postales`, `cactus` |
| **NO** | Meuble-bar de Laurent | `grand_cru`, `lettre_dettes` | `verres_whisky`, `coffret_cigares`, `trophee_golf` |

**Objets d'ambiance** (~25) : aucun déclencheur, aucune précondition,
`ramassable: false`, une simple `description` savoureuse qui « raconte sa vie »
sans indice (ex. `photos_mariage` = ironie tragique du couple souriant ;
`trophee_golf` = l'ego de Laurent). Mécaniquement inoffensifs : un objet sans
`declencheurs["examiner:…"]` voit son examen renvoyer directement sa `description`
(non secrète), et `ciblesConnues()` les reconnaît automatiquement pour la
validation des gestes. Ratio ≈ 3 objets d'ambiance pour 1 objet utile.

**Objets à bascule** (`agenda`, `plaquette_somniferes`, `mot_manuscrit`) : un
`apercu` trompeur (appuie le suicide/l'adultère) servi tant que le flag d'examen
n'est pas dérivé, et une `description`-révélation servie une fois la précondition
remplie — exactement le mécanisme actuel du tableau.

- `plaquette_somniferes.apercu` ≈ « plaquette vide jetée à la corbeille : de quoi
  faire une surdose… la thèse de Laurent se tient. »
  `description` ≈ « au dos, un ticket de pharmacie : trois boîtes achetées il y a
  une semaine, **au nom de Laurent Vasseur**. »
- `mot_manuscrit.apercu` ≈ « "je n'en peux plus… pardonne-moi" — on dirait un mot
  d'adieu. » `description` ≈ « ratures et reprises : c'est le brouillon d'un
  **discours de fête** — "…pardonne-moi mes cachotteries. Ce soir, tous ceux qui
  t'aiment sont là." »
- `agenda.apercu` ≈ « rendez-vous en abrégé : "19h — M.", "régler le solde" :
  discret, presque clandestin. » `description` ≈ « recoupé au téléphone : "M." est
  le traiteur Maurel, "le solde" la facture du buffet — les préparatifs, pas un
  amant. »

### Arbre de flags

**Déclencheurs `examiner` — les 3 fils :**

```
// Fil ACTE (ce n'est pas un suicide, un tiers était là)
"examiner:theiere"             -> "double_tasse"
"examiner:plaquette_somniferes"-> "recu_laurent_vu"   // précond: double_tasse
// Fil MOBILE (la jalousie de Laurent)
"examiner:distinction"         -> "reussite_vue"
"examiner:lettre_dettes"       -> "mobile_dettes"
"examiner:telephone"           -> "controle_vu"
// Fil SURPRISE (innocence d'Hélène, anti-suicide)
"examiner:cadeau_cache"        -> "fete_decouverte"
"examiner:mot_manuscrit"       -> "invitation_lue"    // précond: fete_decouverte
"examiner:agenda"              -> "rdv_eclaircis"      // précond: controle_vu
```

**Déclencheurs `donner` — les leviers (climax dramatique) :**

```
"donner:grand_cru"             -> "confiance_gagnee"   // flatter son ego
"donner:plaquette_somniferes"  -> "aveu_acte"          // précond: recu_laurent_vu + confiance_gagnee
"donner:mot_manuscrit"         -> "aveu_mobile"        // précond: invitation_lue
```

**Préconditions :**

```
preconditions: {
  "examiner:plaquette_somniferes": ["double_tasse"],
  "examiner:mot_manuscrit":        ["fete_decouverte"],
  "examiner:agenda":               ["controle_vu"],
  "donner:plaquette_somniferes":   ["recu_laurent_vu", "confiance_gagnee"],
  "donner:mot_manuscrit":          ["invitation_lue"],
}
```

Pas de déclencheur `ramasser:*` nécessaire : le « sac » (order-strict) suffit à
conditionner les `donner` ; les objets utiles donnés (`grand_cru`,
`plaquette_somniferes`, `mot_manuscrit`) sont `ramassable: true`.

### Connaissances conditionnelles

Injectées dans le prompt seulement si **tous** leurs flags requis sont dérivés
(sinon elles n'existent pas pour le modèle — impossible à soutirer) :

- `requiert ["confiance_gagnee"]` : il se détend, se vante de sa carrière, évoque
  la soirée (« je lui ai monté sa tisane, comme chaque soir » — détail qui le
  trahit).
- `requiert ["reussite_vue"]` : amertume dès qu'on évoque les succès d'Hélène.
- `requiert ["controle_vu"]` : admet à demi-mot qu'il « gardait un œil » sur elle.
- `requiert ["aveu_acte"]` : acculé sur le reçu, il bafouille, ne peut justifier
  l'achat des somnifères.
- `requiert ["aveu_mobile"]` : effondrement — il lâche qu'il la croyait infidèle,
  réalise la fête. Point culminant.

### Solution

```
solution: {
  coupable: true,
  preuvesRequises: ["recu_laurent_vu", "fete_decouverte", "mobile_dettes"],
}
```

3 preuves **matérielles**, une par fil (acte / surprise / mobile). Les **aveux**
(`aveu_acte`, `aveu_mobile`) sont le sommet dramatique mais **non requis** pour
gagner — on récompense le jeu fin sans le punir.

### Intro

Mise en situation au lancement : Hélène Vasseur, architecte primée, retrouvée
morte dans son atelier (tisane renversée) ; son mari Laurent, qui parle de
surmenage et de dépression, attend l'interrogatoire ; fouiller, le faire parler,
démêler le vrai du faux.

## Impact hors `data/scenario.js`

- **Moteur de logique inchangé** (`server/etat.js`, `prompt.js`, `accusation.js`,
  `chat.js`, `validate.js`) : générique, aucune modification fonctionnelle.
- **Commentaires d'exemple à rafraîchir** : `server/etat.js` et `server/chat.js`
  citent `chocolats`/`tableau`/`code_coffre` comme exemples → les ré-ancrer sur le
  nouveau scénario (ex. `examiner:mot_manuscrit` exige `fete_decouverte`).
- **`CLAUDE.md`** : le codemap donne `examiner:tableau` exige `chocolats_donnes`
  comme exemple → mettre à jour.
- **Front** : vérifier que `public/render.js` et `public/game.js` rendent un
  **nombre variable d'objets par zone** et les **8 directions** (a priori déjà
  génériques — à confirmer, pas de refonte attendue).
- **`vuePublique`** : inchangée ; elle strippe déjà descriptions/aperçus secrets,
  connaissances, solution, personnalité et déclencheurs. À re-vérifier par test
  qu'aucune révélation ni aucun mapping geste→flag du nouveau contenu ne fuit.

## Tests (TDD, ≥ seuils de couverture)

- `test/scenario.test.js` : structure du nouveau scénario, `ciblesConnues()`
  couvre objets utiles **et** d'ambiance + cibles des déclencheurs.
- `test/etat.test.js` : dérivation des nouvelles chaînes —
  - fil ACTE : `theiere` → `double_tasse` débloque `examiner:plaquette` →
    `recu_laurent_vu` (et **pas** sans `double_tasse`) ;
  - fil SURPRISE : `cadeau_cache` → `fete_decouverte` débloque
    `examiner:mot_manuscrit` → `invitation_lue` ;
  - leviers : `donner:grand_cru` → `confiance_gagnee` ; `donner:plaquette` →
    `aveu_acte` seulement avec `recu_laurent_vu` + `confiance_gagnee` ; `donner`
    sans `ramasser` préalable ne pose rien (sac order-strict) ;
  - **point fixe** : ordre du journal indifférent (examen « à froid » suivi de la
    précondition tardive révèle quand même) ;
  - objets d'ambiance : aucun flag posé par leur examen/ramassage.
- `test/prompt.test.js` : chaque connaissance n'entre qu'avec ses flags requis ;
  un prompt « à froid » n'expose ni aveux ni révélations.
- `test/accusation.test.js` : gagne ssi `verdict === true` **et** les 3 preuves
  réunies ; messages « intuition juste sans preuve » et « mauvaise piste ».
- `test/routes.test.js` : `/examiner` sert l'`apercu` avant précondition et la
  `description` après (bascule des 3 objets) ; un objet d'ambiance renvoie sa
  description sans secret ; anti-triche `/chat` inchangé (flags dérivés du journal).
- `test/public-view.test.js` : `vuePublique` expose les nouveaux objets
  (`nom` + `ramassable` only) et zones ; ne fuit aucune `description`/`apercu`,
  `connaissances`, `solution`, `personnalite` ni `declencheurs`.
- `test/render.test.js` / `test/game.test.js` : adapter aux références de contenu ;
  vérifier le rendu d'un nombre variable d'objets par zone.
- `test/validate.test.js` : gestes sur les nouvelles cibles acceptés, cible
  inconnue toujours rejetée.

## Hors périmètre

- Pas d'architecture multi-scénarios ni de sélection au lancement (un seul
  scénario, on remplace l'ancien).
- Aucun changement des gestes (`ramasser`/`donner`/`examiner`) ni du moteur de
  flags.
- T-06 (sélection explicite de la preuve à l'accusation + système de points) reste
  une tâche distincte.

# Validation W-01 — première création guidée

19 octobre 2026. Base `origin/main` : `5eed3ed`. Travail réalisé dans une copie
isolée ; les modifications en cours du répertoire principal sont conservées.

## Périmètre

Modèle privé « Le médaillon disparu », sélection du modèle ou d’un brouillon
vide, guide en cinq étapes. Plan complet W-01 à W-18 et documentation produit.
Aucun compte, projet Supabase, service payant ou déploiement créé.

## Tests et preuves

- Avant ajout : 374 tests passent sur la base.
- RED : 9 échecs sur 10 nouveaux tests avant implémentation (modèle absent,
  sélections invalides acceptées, choix et guide absents).
- GREEN final : `npm test` — 384 tests, 44 fichiers passent.
- `npm run coverage` — 384 tests passent ; instructions 91,04 %, branches
  84,09 %, fonctions 94,97 %, lignes 95,57 %. Seuils inchangés.
- `git diff --check` sans erreur.
- Tests HTTP : modèle complet validé, sauvegarde et aperçu, indépendance des
  créations, absence du brouillon dans le catalogue jeu, activation locale et
  projection sans secrets ; fichier du modèle inaccessible via HTTP statique.
- Tests négatifs : modèle inconnu/traversée/null/objet, source et modèle
  simultanés, absence de jeton et origine étrangère.
- Deux ordres d’examen via `/interagir` : chaînes de reçus vérifiées, aucun
  texte de connaissance dans les réponses d’exploration ; le prompt personnage
  ne reçoit la connaissance qu’après les deux examens.
- Interface JSDOM : choix par défaut et vide, navigation sur les sept onglets,
  focus correct, guide maintenu ouvert, aucune requête ni mutation par le guide.

## Recette dans le navigateur

Serveur de recette local sur le port 3107, données temporaires distinctes des
enquêtes du dépôt, client IA absent et aucun fichier `.env` chargé.

Création de « L’enquête de mon premier auteur » depuis le modèle, enregistrement
du titre, ouverture du guide, navigation vers le test avec focus sur l’onglet.
Vérification réelle : zéro erreur et zéro avertissement ; aperçu autorisé.
Ouverture de la route jouable : Camille, visage ASCII, introduction et huit
directions affichés. Navigation vers le bureau : description attendue visible.
Capture du guide conservée comme preuve locale.

## Revues locales

Les commandes spécialisées `/code-review`, `/simplify` et `/security-review`
ne sont pas exposées dans cette session. Les trois passes ont été effectuées
manuellement sur le diff ; aucune revue indépendante n’est revendiquée.

1. **Qualité** : contrat de création rétrocompatible, modèle/brouillon vide et
   duplication conservés ; modules de moins de 400 lignes, état d’ouverture
   du guide et focus préservés ; documentation raccordée au backlog.
2. **Simplification** : modèle déterministe sans dépendance ni nouveau schéma ;
   navigation utilisant les onglets existants et lecture unique du choix du
   modèle ; aucun second moteur de progression.
3. **Sécurité** : modèle en répertoire serveur, sélection limitée à une valeur
   connue avant toute écriture ; contrôles localhost/Origin/jeton inchangés ;
   confidentialité de la projection et signatures testées. Aucun appel IA
   supplémentaire, aucun secret ni scénario auteur transmis à un tiers.

## Limites et suite

La recette valide création, stockage local, navigation et exploration. Elle ne
valide pas un dialogue Anthropic réel, la qualité narrative des réponses IA,
une connexion auteur, une publication hébergée ni une reprise multi-instance.
Pas de recette VoiceOver ou matrice mobile complète dans ce lot.

La couverture annoncée est celle du périmètre existant de Vitest ; le rendu du
guide est vérifié par ses tests DOM et le navigateur, sans taux de couverture DOM.
Le prochain lot est W-02 : configuration persistante et préproduction, suivi
de W-03/W-04 pour l’accès auteur et les données privées. Conserver W-01 dans
le backlog jusqu’à fusion, puis le retirer conformément au guide projet.

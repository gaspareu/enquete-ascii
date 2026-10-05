# Critique design du chat — 4 octobre 2026

Audit réalisé par l’agent de critique design demandé par l’utilisateur.
Aucune modification de l’interface ni appel au modèle pendant l’audit.

## Preuves et limites

Inspection visuelle réelle dans le navigateur sur `/jouer/helene`, écran initial
et navigation vers O. À 1280 × 720, le panneau dialogue mesure environ 208 px,
dont 150 px utiles au journal. L’introduction occupe quatre lignes centrées.
Les comportements de scroll, streaming et les labels ont été examinés dans le
code. Un tour SSE, le clavier mobile et un lecteur d’écran n’ont pas été testés.

## Diagnostic

Les paroles de Laurent sont déjà alignées à gauche. Les introductions,
descriptions d’examen et narrations utilisent `.tour--systeme` : centrage,
italique et ambre faible. Des informations essentielles prennent ainsi
l’apparence d’un état secondaire. Chaque nouvelle ligne commence à un endroit
différent, ce qui gêne la lecture d’une description longue.

## Recommandations par priorité

1. **Prose de scène lisible** : alignement à gauche, texte droit, ambre principal,
   paragraphes conservés. Réserver la discrétion aux petits états d’attente.
2. **Hiérarchie des tours** : identifier sobrement Vous, Laurent et Observation.
   Décaler éventuellement le bloc du joueur vers la droite, tout en alignant
   son texte à gauche. Conserver les didascalies distinctes et les portraits
   entiers, avec leur ratio préservé.
3. **Place du journal** : augmenter sa hauteur desktop et envisager une vue
   agrandie. Borner la largeur de prose en caractères avec un token, plutôt
   qu’uniquement à 80 % du panneau. Garder la scène visible.
4. **Relecture** : ne suivre automatiquement la réponse que si le joueur est
   déjà près du bas. Sinon, proposer « Nouvelle réponse » sans interrompre sa
   lecture. Vérifier l’attente aussi bien que les fragments SSE.
5. **Saisie identifiable** : ajouter un libellé accessible stable et un bouton
   Envoyer. Évaluer un champ multiligne court ; distinguer compréhension de la
   demande et attente de la parole du personnage.
6. **Mobile et annonces** : vérifier journal, clavier, saisie et pistes ensemble,
   ainsi que les annonces du journal pendant le streaming.

## Premier lot recommandé

Séparer prose de scène et états courts ; aligner la prose à gauche, enlever
son italique et renforcer son contraste. Mettre à jour `public/DESIGN-SYSTEM.md`,
qui prescrit actuellement une narration centrée. Toute valeur de style nouvelle
reste un token. Cette étape corrige le problème signalé sans toucher aux règles
ni à la progression de l’enquête.

## Validation à prévoir lors de l’implémentation

Tests de rendu distinguant scène, parole, didascalie et attente ; contrôle visuel
avec description longue et échange streamé ; mobile avec clavier ouvert ; puis
tests et couverture du projet. Les recommandations ne sont pas encore implémentées.

## Proposition retenue pour le premier lot

- prose alignée à gauche, droite et ambre principal ;
- repère discret Observation, Scène pour l’introduction, Information pour les erreurs ;
- largeur de lecture limitée par token, sans changer les panneaux ;
- attente séparée, sans repère de narration, toujours discrète ;
- contrôle DOM, tests/coverage et captures desktop/mobile après modification.

## Premier lot réalisé localement

Prose alignée à gauche, repères Scène/Observation/Information/Précision, filet
latéral et largeur de lecture limitée à 68ch. L’attente utilise un type visuel
séparé. Le DS est synchronisé. Aucun changement de règles, de serveur ou de
portrait dans ce lot.

Validation : 299 tests passent ; couverture des lignes 94,65 %. Vérification
réelle Chromium à 1280 × 720 et 390 × 844 : alignement gauche et style normal
confirmés, aucune largeur de page excessive. La réponse à « Examiner la table »
en E a été contrôlée sans indice découvert ni appel au modèle. Le clavier
mobile et VoiceOver restent à vérifier.

Les captures ont été réalisées localement et ne sont pas incluses dans le dépôt.
À cette étape, le scroll conditionnel et l’agrandissement du journal restent
des lots suivants.

## Lot relecture et saisie — plan

1. Tester d’abord le maintien de la position pendant un flux et l’attente, le
   retour au dernier message, Entrée/Maj+Entrée et la composition clavier.
2. Isoler le suivi du journal dans un petit contrôleur DOM ; suivre le bas
   seulement tant que le joueur ne relit pas plus haut.
3. Ajouter le bouton Nouvelle réponse, un textarea court avec nom accessible et
   aide clavier, et Envoyer. Désactiver les envois concurrents.
4. Préserver les pistes, le micro, les didascalies et les historiques serveur.
5. Vérifier tests/coverage et rendu desktop/mobile sans solliciter le modèle.

## Lot relecture et saisie réalisé localement

Le journal conserve la position pendant l’attente, les fragments et la fin de
réponse. Le bouton Nouvelle réponse revient au bas, réactive le suivi et garde
un focus clavier stable. Le textarea est nommé Votre message, avec aide clavier
et bouton Envoyer ; Entrée soumet, Maj+Entrée insère une ligne, la composition
clavier ne soumet pas. Le contrôle des demandes concurrentes reste en place.

La piste desktop passe à 18rem pour absorber la saisie plus haute ; scène et
portrait conservent leur fonctionnement. Vérification navigateur Chromium à
1280 × 720 et 390 × 844, avec réponses SSE simulées sans appel au modèle ni
progression serveur : relecture maintenue à 50px pendant toute la réponse,
retour au bas confirmé, focus journal confirmé et clavier Entrée/Maj+Entrée
vérifié. Aucun débordement horizontal. Le clavier iOS réel et VoiceOver n’ont
pas été exécutés. Les contrôleurs ajoutés entrent dans le périmètre de couverture.

Validation finale avant PR : 309 tests et couverture des lignes à 94,74 %
(reconfirmées avant création de la PR).

# Backlog

Ce fichier décrit uniquement le travail produit encore ouvert. Les décisions
livrées sont conservées dans `docs/superpowers/`, git et les pull requests, afin
que ce backlog reste lisible.

## Cible

Permettre à un auteur sans compétence technique de créer une enquête courte dans
son navigateur, la tester et la partager par lien. Le jeu reste immersif,
accessible au clavier et jouable sur mobile, avec une identité rétro.

Le [plan de l’atelier web](docs/plan-atelier-web.md) fixe les parcours,
l’architecture, la sécurité, l’ordre des lots et les critères d’ouverture.
Ce backlog garde les travaux existants ci-dessous. Aucun ticket n’est retiré
avant fusion ; les statuts « implémenté » ne signifient pas « disponible en ligne ».

## Atelier web — bêta sur invitation

P0 : requis avant bêta. P1 : après retour des premiers auteurs. Tailles :
S = un petit lot, M = plusieurs étapes, L = à découper en PR successives.
Chaque ticket exige test RED → GREEN, suite et couverture, revues qualité et
sécurité, PR puis fusion autorisée. Pas de calendrier promis avant les essais.

### W-01 · P0 · M · Première enquête guidée — implémentée, en attente de fusion

Dépendances : aucune. Lot initial de cette branche.
Recette et limites : [validation du lot](docs/validation-atelier-web-w01.md).

- Choix explicite : modèle court complet ou brouillon vide ; duplication conservée.
- Le modèle est copié côté serveur dans un brouillon indépendant, sans IA ni image.
- Une histoire cohérente, deux indices combinables, une connaissance conditionnelle,
  une conclusion et un barème ; validation complète sans erreur.
- Guide en cinq étapes dans l’atelier, navigation clavier et conseils d’enregistrement/test.
- Refuser modèle inconnu et combinaison modèle/source ; conserver les contrôles locaux.
- Tests HTTP du parcours, progression réelle, confidentialité et interface.

### W-02 · P0 · M · Préproduction et contrat de configuration

Dépendances : W-01 pour le scénario de recette.

- Confirmer l’hébergement Express après essai SSE/timeout/reconnexion, région et coût.
- Préparer un environnement Supabase isolé pour Auth/Postgres/Storage ; valider
  les offres avant création de ressources payantes. Aucun secret dans git ou les logs.
- Documenter variables requises, modes local/hébergé, santé et arrêt propre du serveur.
- Signature persistante par environnement et stratégie de rotation ; deux instances
  et un redémarrage acceptent les mêmes reçus valides.
- CI reproductible, préproduction privée, procédure de retour arrière.
- Acceptation : configuration manquante refusée clairement, flux SSE non bufferisé,
  aucune requête de préproduction ne lit/écrit les données de production.

### W-03 · P0 · L · Invitations et sessions auteur

Dépendances : W-02.

- Connexion email, invitation expirante à usage unique, fermeture des inscriptions libres.
- Session vérifiée serveur, logout, retour de connexion autorisé et messages d’erreur lisibles.
- Protection CSRF/Origin, cookies et renouvellement vérifiés ; accès bêta révocable
  même avec un ancien jeton encore valide. Pas de droit issu de user_metadata.
- Conserver l’API locale ; introduire l’API hébergée sans exposer le jeton local.
- Acceptation : anonyme, invitation absente/expirée/révoquée et redirection hostile
  refusés ; auteur invité reconnecté après expiration normale de session.

### W-04 · P0 · L · Dépôt privé par auteur et migration

Dépendances : W-03.

- Tables enquête/brouillon et contrat de dépôt injecté ; propriétaire issu de la session.
- RLS et droits minimaux, identifiants opaques, pagination et limites de taille.
- Garder le dépôt fichier ; tests de contrat communs et import JSON en simulation
  puis import explicite, avec sauvegarde et mapping des identifiants/images.
- Autoriser export et suppression par le propriétaire ; définir le traitement des
  publications/parties associées, sans suppression en cascade accidentelle.
- Acceptation : A ne lit/modifie/duplique/supprime jamais B, via HTTP ou API base ;
  ownership non transférable dans une requête, migrations rejouables sur base vide.

### W-05 · P0 · M · Images privées et stables

Dépendances : W-04.

- Bucket privé, droits par propriétaire/enquête, upload borné et contenu raster vérifié.
- Aperçu auteur authentifié ; publication avec chemins immuables, accès de jeu contrôlé.
- Retirer toute dépendance aux images de brouillon servies statiquement en mode hébergé.
- Acceptation : URL devinée refusée, SVG/HTML et fichiers surdimensionnés rejetés,
  remplacement de brouillon sans effet sur une publication ; nettoyage des orphelins.

### W-06 · P0 · M · Sauvegarde automatique fiable

Dépendances : W-04.

- États « Enregistrement », « Enregistré », « Hors connexion », « Conflit » accessibles.
- Révision conditionnelle côté serveur, attente courte après saisie, reprise explicite
  et alerte avant fermeture si une saisie reste non enregistrée.
- Les réponses anciennes ne remplacent jamais les modifications récentes ; ne pas
  rejouer une sauvegarde dans l’enquête ouverte ensuite ou sous un autre compte.
- Acceptation : saisie pendant requête, double onglet, réseau coupé, 401 et 409
  testés ; aucune perte silencieuse ni écrasement automatique d’un conflit.

### W-07 · P0 · L · Écrire sans vocabulaire technique

Dépendances : W-01 ; intégrer W-06 avant recette hébergée.

- Parcours vérité → personnage → lieux/indices → révélations → conclusion.
- Présenter les objets et faits par leurs noms, générer les identifiants en interne.
- Sélecteurs « après avoir découvert… », préconditions ET/alternatives lisibles.
- Réglages avancés disponibles ; garder un seul graphe et un seul format de scénario.
- Acceptation : un auteur change l’histoire du modèle, ajoute un indice et une
  révélation sans saisir un identifiant ; aller-retour sans perte des hooks existants.

### W-08 · P0 · M · Vérifier et prévisualiser en privé

Dépendances : W-07, W-04.

- Diagnostics traduits en actions concrètes, liens vers champs et incohérences bloquantes.
- Aperçu réservé au propriétaire sur une révision enregistrée, réinitialisation des essais.
- Simuler différents ordres d’indices et expliquer les révélations/verrous non atteignables.
- Acceptation : aperçu anonyme/autre auteur refusé ; aucun droit de jeu acquis par
  une case cochée dans le simulateur ; les avertissements ne promettent pas une validation narrative.

### W-09 · P0 · L · Publication figée et partage révocable

Dépendances : W-04, W-05, W-06, W-08.

- Validation serveur puis transaction : publication JSON/image immuable + partage.
- Jeton aléatoire robuste, stocké haché, absence des catalogues/sitemaps et noindex.
- Boutons copier le lien, ouvrir, révoquer, republier ; préciser « non répertorié ».
- Double clic idempotent ; édition du brouillon sans modifier publication ou partie.
- Acceptation : validation contournée, mauvaise propriété et révision périmée refusées ;
  révocation bloque nouveaux accès ET appels de parties liées, anciennes versions stables.

### W-10 · P0 · M · Jouer une publication sans compte

Dépendances : W-09, W-12.

- Accueil sans spoiler, titre/auteur, durée indicative éditoriale et démarrage explicite.
- Toutes les routes jeu/voix/débrief passent par l’autorisation du partage/publication.
- Uniquement projection publique ; aucun scénario secret, nom de fichier révélateur
  ou identifiant de brouillon dans HTML, ressources, erreurs ou réponses réseau.
- Acceptation : partie jouable jusqu’au débrief ; mélange entre enquêtes/versions,
  partage révoqué et reçus forgés rejetés ; entrée auteur affichée en texte sûr.

### W-11 · P0 · M · Reprise de partie et parcours mobile

Dépendances : W-10.

- Session joueur opaque ; sauvegarde bornée de la progression vérifiée et du journal.
- Reprise après rafraîchissement, coupure SSE, redémarrage serveur ; version conservée.
- Règle explicite de conservation/expiration et option recommencer ; pas de synchronisation
  multiappareil promise sans compte. Clavier, focus et lecture du journal préservés.
- Acceptation : reçus/mémoire atomiques, aucune lecture d’une autre partie, pas de
  débordement à 390 px, animations réduites et erreurs réseau compréhensibles.

### W-12 · P0 · L · Budget IA et protection contre les abus

Dépendances : W-02, W-04 ; requis avant tout appel IA accessible par partage.

- Quotas partagés entre instances par auteur/partie et plafond global configurable.
- Réservation atomique avant appel, limite de concurrence et de longueur/tokens/durée.
- Mesurer tokens, latence et coût sans texte privé ; distinguer exploration,
  personnage, débrief, génération et voix. Pas de prix par partie estimé sans mesure.
- Timeouts, annulation, doublons et retries bornés ; remise en état des réservations
  après crash et interrupteur global ; rejet avant appel fournisseur si budget épuisé.
- Acceptation : appels concurrents ne dépassent pas le budget, fournisseur indisponible
  sans boucle ni coût incontrôlé, message utilisateur et reprise cohérents.

### W-13 · P0 · S · Retours privés et mesure du premier succès

Dépendances : W-10.

- Retour volontaire lié à la publication : terminé/bloqué, appréciation, commentaire borné.
- Auteur voit uniquement ses retours ; contrôle anti-spam, suppression et signalement.
- Événements minimaux création/test/publication/débrief, sans dialogue ni scénario.
- Acceptation : retour inaccessible à un autre auteur, texte non exécutable ; observer
  les abandons sans identifier les joueurs ni exiger une inscription.

### W-14 · P0 · M · Données, contenus et administration de bêta

Dépendances : W-03, W-09, W-13.

- Information claire sur IA, conservation, suppression, droits d’auteur et partage par lien.
- Règles de contenu et canal de signalement ; l’auteur garde ses droits, permission
  limitée à l’hébergement et au jeu. Textes à valider avant ouverture.
- Administration minimale : invitations, suspension d’un compte/partage, suppression
  et export ; privilèges serveur distincts, actions sensibles journalisées sans contenu.
- Acceptation : suspension effective avec sessions existantes, suppression couvrant
  DB/images/parties selon délais annoncés ; export réservé au propriétaire.

### W-15 · P0 · M · Exploitation et livraison sûre

Dépendances : W-02, W-04 ; recette finale après W-09/W-12.

- Santé serveur, erreurs et métriques SSE/budget sans secrets ; alertes actionnables.
- Sauvegarde DB ET images, restauration exercée, gestion des signatures et secrets.
- Déploiements traçables, migrations compatibles et rollback ; environnement de test isolé.
- Acceptation : restauration d’une publication et de ses images, reprise d’une partie,
  retour arrière de release testé et absence de fuite dans les logs.

### W-16 · P0 · M · Recette complète et ouverture à trois auteurs

Dépendances : tous W-01 à W-15 ; aucun simple test simulé ne remplace cet essai.

- Deux comptes auteurs, un joueur anonyme : création → sauvegarde → aperçu →
  publication → partie mobile → débrief → retour → modification → republication.
- Matrice sécurité, clavier/mobile, coupure réseau et quota ; IA réelle bornée en préproduction.
- Porter les retours au backlog. Premier jalon : une enquête externe terminée et
  jouée, aide requise observée ; recrutement effectué par le porteur du projet.
- Go/no-go documenté : fonctionnalités, limites, budget, restauration et retour arrière.
  Mise en ligne et envoi d’invitations selon autorisation explicite.

### W-17 · P1 · S · Installation PWA

Dépendances : W-16 et besoin confirmé. Manifest/icônes, installation progressive,
mise à jour maîtrisée ; cache excluant API privées et secrets. Annoncer clairement
que le dialogue IA reste connecté. Vérifier installation et absence de cache privé.

### W-18 · P1 · L · Évolutions après observation

Dépendances : W-16. Prioriser à nouveau avec les auteurs : modèles additionnels,
assistance à l’écriture, plusieurs pièces/personnages, catalogue modéré, financement.
Chaque évolution doit avoir une hypothèse, une mesure et son propre cadrage.
Desktop/mobile natifs seulement si un usage mesuré justifie leur maintenance.

## En cours

### T-13 · Agents par scène — V1 à livrer

Le chat utilise `/tour`, un contexte local et une mémoire signée par scène.
Sonnet 5.5 pour le personnage, Haiku 4.5 configurable pour les zones en attendant
Haiku 5.5. Hooks privés adressés et contrôles dans l’atelier. Le moteur des
capacités et des reçus reste l’autorité. Référence :
[plan](docs/plan-agents-par-scene.md).

La PR conserve cette tâche ouverte jusqu’à sa fusion. La validation comparative
coût/latence reste à faire ; les
vraies pièces, personnages multiples et simulation dédiée des hooks dans
l’atelier restent des extensions ultérieures. Tester les hooks dans l’aperçu
de partie actuel. Retirer cette tâche uniquement après fusion.

### T-11 · Observations d'objets immersives

Une question portant sur un objet trouvé doit ouvrir son examen et donner une
description propre à cet objet. Chaque objet possède des détails d'ambiance sans
effet sur les indices. Les réponses à une date ou une cause inconnue doivent
rester prudentes ; les révélations restent sous le contrôle du serveur.

Critères d'acceptation :

- les précisions courtes (« du téléphone », « oui ») reprennent la question initiale ;
- les messages du joueur apparaissent dès l’envoi et les changements de zone sont annoncés ;
- les questions sur la distinction et la plante ne retombent plus sur la table ;
- tous les objets trouvés ont des détails d'ambiance, sans révélation à la fouille ;
- l'examen répété peut varier le détail tout en conservant les faits établis ;
- tests, couverture, accessibilité et parcours mobile restent verts.

### T-07 · 🟢 Mode vocal

La synthèse ElevenLabs et la saisie micro sont implémentées sur la branche active.
La tâche reste ici jusqu'à sa revue, sa fusion et son retrait conformément au
processus de contribution. Référence :
[spec](docs/superpowers/specs/2026-07-02-mode-vocal-elevenlabs-design.md).

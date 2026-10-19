# Atelier web d’enquêtes — plan de réalisation

Décision du 19 octobre 2026. Public initial : une personne qui aime écrire et
ne code pas. Ce document décrit la cible ; les fonctionnalités présentes et
les travaux ouverts sont distingués dans [BACKLOG.md](../BACKLOG.md).

## Résultat recherché

Un auteur ouvre un lien, crée une enquête courte, la teste et envoie un lien de
jeu à un proche. Il reçoit un retour et améliore son brouillon sans casser la
version déjà partagée. Aucun terminal ni clé API n’est demandé à l’auteur.

Premier succès : un auteur extérieur termine une enquête, un proche termine
une partie, puis l’auteur utilise son retour. Le recrutement et les messages
aux testeurs restent à la main du porteur du projet.

## Périmètre et décisions

- Application web, création prioritairement sur ordinateur ; jeu responsive.
- Conserver JavaScript ESM, Express, le moteur et le format JSON existants.
- Une pièce, huit zones, un interlocuteur ; enquêtes courtes et textuelles.
- Bêta sur invitation ; lecture par lien non répertorié, sans compte joueur.
- Modèle éditorial déterministe utilisable sans appel IA à la création.
- L’auteur écrit la vérité, les indices et les règles ; l’IA joue le personnage
  dans les limites du moteur. L’assistance IA à l’écriture reste facultative.
- Garder l’univers rétro ; privilégier la lisibilité des formulaires d’auteur.
- Desktop natif, application mobile native, PWA, catalogue communautaire,
  paiements, collaboration simultanée, plusieurs pièces/personnages : après la
  validation de la bêta, dans cet ordre à réexaminer selon les retours.

## État de départ vérifié

Base : `origin/main` à `5eed3ed`, incluant les agents par scène (PR #44).
Atelier local, création/duplication, JSON versionné par empreinte, validation,
aperçu et activation sont présents. Le jeu utilise des reçus et une mémoire
signés ; le serveur décide des droits de jeu.

L’atelier n’est accessible qu’en mode local. Le stockage est sur fichiers et
les images sont servies publiquement. Il n’existe pas encore de propriétaire,
compte auteur, publication immuable, quota partagé ni sauvegarde de partie
hébergée. Une activation locale n’équivaut pas à une publication web privée.

## Parcours à construire

1. **Découvrir** : promesse, exemple jouable, bouton « Créer mon enquête ».
2. **Entrer** : invitation, connexion par lien email, tableau des brouillons.
3. **Commencer** : titre et modèle court ; un brouillon complet est créé.
4. **Écrire** : vérité et motivation, décor, indices, révélations du personnage,
   conclusion. Les identifiants et événements techniques passent en réglages
   avancés. Une relation se formule « après avoir découvert… ».
5. **Enregistrer** : automatiquement, avec état explicite ; aucune saisie récente
   ne disparaît après une réponse réseau ancienne. Conflits de version visibles.
6. **Tester** : diagnostics avec accès au champ, aperçu privé et réinitialisable,
   simulation des dépendances ; contrôle des secrets et des chemins bloqués.
7. **Partager** : validation serveur puis création d’une version figée. Présenter
   le titre, l’auteur, la durée indicative et le caractère non répertorié du lien.
8. **Jouer** : démarrage sans inscription, reprise de la même version, débrief.
9. **Améliorer** : retours privés rattachés à une version ; le brouillon peut
   évoluer sans changer les parties existantes. Republier est explicite.

Un lien non répertorié peut être transmis par son destinataire : ne jamais le
présenter comme un accès nominatif. La prévisualisation du brouillon exige
toujours la session de son auteur.

## Architecture cible et responsabilités

```text
Navigateur auteur ── session vérifiée ── API atelier Express
                                        │ droits + validation + versions
                                        ├── dépôt PostgreSQL (privé)
                                        └── stockage images (privé)
Navigateur joueur ── lien de partage ─── API jeu Express
                                        │ version publiée + projection publique
                                        ├── capacités + reçus + mémoire signée
                                        └── Anthropic (clés uniquement serveur)
```

Choix cible : Supabase Auth, PostgreSQL et Storage, avec un serveur Express
persistant pour le jeu et le streaming SSE. Cela concentre comptes, données et
images chez un fournisseur sans réécrire le moteur. L’hébergeur Express sera
choisi au lot W-02 après un essai SSE, un devis et la vérification des régions.
Un site statique seul ne suffit pas. Un déploiement serverless reste possible
si les essais de flux, délais et reprise satisfont les mêmes critères.

Les ressources de développement, préproduction et production sont distinctes.
Aucun projet cloud, abonnement ou déploiement n’est créé par le premier lot.
Les tarifs et capacités exacts seront vérifiés au moment du provisionnement.

Le dépôt local est conservé pour les tests et l’usage existant ; un adaptateur
hébergé sera injecté. Les routes locales ne seront pas rendues publiques par
suppression du contrôle localhost : une API auteur authentifiée distincte sera
introduite avec ses contrôles de propriété et de session.

### Données et invariants

| Entité | Rôle et contraintes |
| --- | --- |
| Invitation | Email cible, expiration, usage unique, révocation ; accès bêta vérifié côté serveur |
| Enquête | UUID, propriétaire issu de la session, titre, dates, état d’archivage |
| Brouillon | JSON privé, compteur de version pour écriture conditionnelle, dernière sauvegarde |
| Publication | Copie immuable validée du JSON et des références d’images ; auteur, version, date |
| Partage | Jeton aléatoire non devinable stocké haché, publication liée, état révoqué |
| Image | Propriétaire, enquête, taille, type vérifié, clé de stockage ; chemin immuable par version |
| Partie | Publication figée, session joueur opaque, progression vérifiée, expiration |
| Retour | Publication liée, avis volontaire, texte borné, visibilité auteur et administration |
| Usage IA | Réservation, auteur/partie, modèle, tokens/coût, résultat ; aucun texte narratif |

Le scénario complet reste privé : jamais de JSON secret dans les ressources
statiques ou les tables accessibles au joueur. Les auteurs ne voient que leurs
scénarios, y compris par appel direct à la base. RLS pour les tables exposées,
politiques d’appartenance et tests avec deux auteurs ; aucune clé privilégiée
dans le front. Le propriétaire ne peut pas être modifié via le corps HTTP.

Le serveur de jeu lit la publication après validation du partage et construit
la projection actuelle. Les métadonnées publiques ne contiennent ni solution,
ni révélations ni chemin de brouillon. Les images de brouillon restent privées ;
les images jouables sont autorisées via la publication et ne révèlent pas un
nom de fichier contenant un indice futur.

Reçus et mémoire sont liés à l’identifiant/version de publication ; la clé de
signature est persistante, commune aux instances, distincte par environnement.
Prévoir identifiant de clé, rotation et maintien borné des anciennes clés.
Une republication n’invalide pas une partie déjà ouverte. La révocation du
partage bloque les nouveaux accès et les requêtes de jeu existantes associées.

Publication transactionnelle, double clic idempotent ; contrôle de concurrence
sur le brouillon. Ne jamais écraser la publication depuis une sauvegarde.
Suppression d’images seulement lorsqu’aucune publication ne les référence.

### Sessions, abus et confidentialité

- Session auteur vérifiée côté serveur ; redirections de connexion autorisées,
  protection CSRF/Origin et cookies sécurisés selon le schéma retenu en W-03.
- Pas d’inscription libre pendant la bêta ; révoquer l’accès auteur en plus de
  fermer la session, sans faire confiance aux métadonnées modifiables du compte.
- Limites de requêtes partagées entre instances, taille des entrées, nombre de
  parties et appels concurrents ; réservation atomique du budget avant appel IA.
- Plafonds configurables par auteur, partie et service ; message d’épuisement,
  annulation/timeout sans double facturation interne ; bouton de suspension IA.
- Logs techniques sans scénario, dialogue, jeton, email ni secret ; identifiants
  techniques et durées seulement. Retours en texte brut, sans HTML exécutable.
- Information sur les données envoyées à l’IA, les droits sur les contenus,
  conservation/suppression du compte et des parties, canal de signalement.
  Validation des textes et durées réelles avant ouverture de la bêta.

## Lots et ordre d’exécution

| Lot | Tickets | Résultat vérifiable |
| --- | --- | --- |
| A — première création | W-01 | Modèle court privé, guide et tests, sans dépendance cloud |
| B — socle hébergé | W-02 à W-05 | Préproduction, invitations, isolation des auteurs, brouillons/images durables |
| C — atelier accessible | W-06 à W-08 | Sauvegarde fiable, règles en langage auteur, aide au test |
| D — partager et jouer | W-09 à W-11 | Publication figée, partage révocable, reprise sur mobile |
| E — ouvrir la bêta | W-12 à W-16 | Budget maîtrisé, retours, exploitation et essai extérieur complet |

Chemin critique : W-02 → W-03 → W-04 → W-05/W-06 → W-09 → W-10 →
W-11 → W-16. W-12 commence après W-04 et bloque tout accès IA public.
W-07/W-08 et W-13/W-14/W-15 doivent être terminés avant W-16.
Les tailles du backlog sont relatives, pas des engagements calendaires.

## Premier lot autorisé maintenant : W-01

Créer un modèle « Le médaillon disparu » : un vol, une pièce, un personnage,
deux indices combinables et une révélation conditionnelle. Le modèle reste
côté serveur, copié dans un nouveau brouillon, sans images ni appel IA.

Ajouter au formulaire un choix entre ce modèle et un brouillon vide ; préserver
la duplication. Un guide dans l’atelier relie cinq étapes éditoriales aux onglets
existants. Il explique l’enregistrement et le test sans simuler une publication
web encore absente. Ce premier guide n’est pas le futur éditeur simplifié W-07.

TDD : création HTTP → sauvegarde → validation → aperçu privé, refus du modèle
inconnu et des combinaisons ambiguës, catalogue public sans brouillon, scénario
public sans secrets, progression conditionnelle, DOM/clavier et absence de XSS.
Puis `npm test`, `npm run coverage`, revue du diff, simplification et revue sécurité.

## Validation et ouverture

- Tests unitaires des règles ; tests HTTP d’autorisation avec auteur A, auteur B,
  anonyme, invitation révoquée et partage révoqué ; tests RLS sur une vraie base locale.
- Contrats identiques pour dépôts local et hébergé ; migrations rejouées sur base
  vide, import des enquêtes existantes en mode simulation, sauvegarde avant import.
- Parcours navigateur : connexion, création, édition, perte réseau, conflit de
  sauvegarde, aperçu, publication, jeu mobile/clavier et retour privé.
- Vérifier aussi débordements, focus, contrastes et réduction des animations.
- IA simulée en CI ; essai réel borné en préproduction pour latence, cohérence,
  consommation et débrief. Aucun coût par partie annoncé avant mesure réelle.
- Observabilité : erreurs, latence premier texte/fin, interruptions SSE, budget
  restant ; absence de contenu privé dans logs et erreurs.
- Sauvegarde/restauration testée ; déploiement versionné et retour arrière
  documenté. Les migrations destructives sont séparées de la mise en ligne.

Critère d’ouverture : tous les tickets P0 validés, un exercice de restauration,
un parcours complet sur préproduction et un plafond de dépenses effectif.
Objectif produit initial : trois auteurs invités, au moins une enquête externe
terminée et jouée jusqu’au débrief ; noter l’aide nécessaire et les abandons.
Si l’écriture bloque, améliorer le parcours avant d’élargir les capacités.

## Références techniques à revérifier lors des lots concernés

- [Supabase Auth côté serveur](https://supabase.com/docs/guides/auth/server-side)
- [Isolation des lignes](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Accès aux images](https://supabase.com/docs/guides/storage/security/access-control)
- [Format des enquêtes existant](FORMAT-ENQUETE.md)
- [Plan des agents de scène](plan-agents-par-scene.md)

Les documentations Auth/RLS/Storage ont été consultées pour le cadrage ; aucun
SDK Supabase, schéma SQL ou mécanisme de session hébergée n’est implémenté en W-01.

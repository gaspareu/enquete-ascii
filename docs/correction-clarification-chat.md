# Diagnostic et correction du contexte de conversation — T-11

## Cause observée dans le code

`/interpreter` reçoit un message isolé, le contexte spatial et des reçus.
Le catalogue fournit les noms publics des objets connus, mais pas le journal
qui relie une question à l’observation précédente. Les reçus établissent les
droits du joueur ; ils ne sont pas transformés en contexte conversationnel.
L’interprète ne sait donc pas que le téléphone vient d’être examiné ni que
« du téléphone » répond à sa propre demande de précision.

Le format de décision ne représente que la zone ou le personnage : une
question sur la pièce entière ne possède pas de sortie adéquate.

La première correction reconnaissait des formulations courtes puis déduisait
une action et un angle par expressions régulières. Elle contournait le manque
de contexte et pouvait choisir un examen à la place d’une autre intention.
Ces règles doivent être retirées.

## Correction retenue

1. Transmettre les derniers tours du journal, avant le message courant,
   comme contexte conversationnel borné. Ils incluent les observations et
   précisions réellement affichées. Les rôles et tailles sont validés au HTTP.
2. Ajouter au catalogue la dernière interaction issue des reçus vérifiés,
   limitée aux identifiants et noms publics. Aucun fait caché n’y est ajouté.
3. Faire interpréter à Claude le message courant avec ce contexte. Les réponses
   courtes et les pronoms conservent ainsi l’intention initiale ; une nouvelle
   demande peut remplacer cette intention. Les décisions restent validées par
   le serveur et les interactions conservent leurs contrôles de capacité.
4. Ajouter la portée « pièce » à l’observation. Sa narration est construite
   exclusivement depuis les zones publiques ; elle n’effectue aucune fouille.
5. Conserver l’affichage immédiat du joueur et l’annonce des changements de zone.

## Vérification

Tester les données réellement transmises au modèle, plusieurs objets et
intentions (examen, ramassage, don), les confirmations et les changements de
sujet, la portée pièce et l’absence de révélation cachée. Les tests simulant
Claude vérifient le contrat et l’intégration, pas sa qualité linguistique réelle.
Parcours réel effectué avec le client Anthropic configuré localement :
observation de la pièce, fouille du secrétaire, examen du téléphone, demande
d’identité des traces, réponses « du téléphone » et « oui », puis changement
explicite vers le cactus. Les décisions attendues ont été obtenues.

La phrase spécifique ajoutée au téléphone a été retirée des deux scénarios.
Quand un angle de conclusion (date, cause, identité) n’a pas de limite écrite,
le compositeur signale simplement l’absence de précision certaine ; il ne
fabrique pas de faits pour répondre à la question.

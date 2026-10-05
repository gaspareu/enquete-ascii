# Résolution des cibles dans la zone courante

Problème : le catalogue contient toutes les zones ; une demande locale peut déplacer
le joueur vers une cible homonyme ailleurs.

Plan :
1. Tester N et O avec deux tables, E sans table, les objets connus et le sac.
2. Résoudre les demandes locales simples côté serveur à partir des seuls noms et
   aliases publics ; garder les déplacements explicites et les autres intentions
   à l’interprète, en renforçant ses instructions spatiales.
3. En cas de cible absente localement, observer la zone courante et afficher une
   réponse serveur sans inventer de détails ni exposer les objets cachés.
4. Vérifier les tests, la couverture et les appels réels Sonnet 5.5.

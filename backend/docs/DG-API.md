# Préparation du branchement DG

Le backend expose les endpoints suivants, exclusivement sur PostgreSQL local :

- GET /api/dg/overview
- GET /api/dg/stock?level=zone
- GET /api/dg/filters?field=product&search=Lion

Filtres communs, noms identiques à l'interface : zone, region, department, amId, shopId, agentId, product.
product contient la référence réelle du produit, jamais un libellé de démonstration.
Les niveaux stock sont zone, region, department, amId, shopId, agentId.
Un agent filtre le détenteur courant holder_id. Les rattachements géographiques dépendent du référentiel validé.

Chaque réponse contient source=postgres_local, unit=equipment, lastImport et data.
Les valeurs bigint sont des chaînes. Les convertir avec contrôle de précision côté client si nécessaire.

## Vue d'ensemble

data.totals : equipment_total, active, available_confirmed, availability_unconfirmed, defective, deployed, kind_unclassified, without_lifecycle, source_loaded_min/max.
data.custody, regions et products : répartitions du même stock actif. Leur somme doit égaler totals.active.
Un lieu NULL signifie Non renseigné ; __central__ représente un entrepôt identifié par le référentiel.
availabilityComplete=false interdit de présenter available_confirmed comme toute la disponibilité connue.
deployed est une photographie d'état, pas une mesure des ventes sur une période.
sales et historicalStock restent null avec une raison explicite tant que leur règle/couverture n'est pas validée.

## Stock national et popup produit

data.rows fournit place, product_reference, product_name, family, active, available_confirmed, availability_unconfirmed et defective.
Les lignes sont déjà regroupées par lieu et produit ; l'interface peut calculer les totaux de cartes et ouvrir le mix produit sans charger les kits individuels.
Pour descendre d'une zone vers ses régions : conserver zone dans les filtres et passer level=region.
Les quantités non rattachées restent dans la réponse.

## Filtres

Options réelles du périmètre en base locale, pas du jeu de démonstration.
La dimension demandée est retirée de ses propres filtres. Les autres filtres restent appliqués.
200 résultats maximum, hasMore indique s'il faut préciser search.
Les lieux et familles non validés ne sont pas inventés.

## État d'erreur et fraîcheur

503 : aucun import réussi ou destination indisponible. Ne pas remplacer ces erreurs par les données fictives.
Afficher lastImport.finished_at et la date source. Aucun appel HTTP ne lance de synchronisation.
L'application reste consultable avec la dernière version publiée si le serveur UPYA devient indisponible.

## Vérification

npm run build
node scripts/bi/verify-dg.mjs

Le test HTTP vérifie les répartitions, les filtres produits, les paramètres invalides et l'accès exclusivement local en remplaçant l'adresse source par une adresse inaccessible.

## Limites de cette étape

Frontend DG branché le 7 octobre 2026 : vue exécutive, stock national et filtres utilisent /api/dg. Mix produit calculé à partir des agrégats locaux, sans chargement des kits individuels.
Le DG n'utilise plus les données de démonstration. La carte affiche le fond réel et les quantités non rattachées ; aucun GPS fictif. Les performances de vente et courbes historiques restent explicitement indisponibles tant que leurs agrégats ne sont pas validés.
Les autres profils restent en démonstration.
Lancer npm run start:dev dans backend et npm run dev dans frontend. Le proxy Vite /api pointe vers http://127.0.0.1:3000 ; API_PROXY_TARGET permet de changer cette cible. En production, configurer le reverse proxy /api vers NestJS.
Les endpoints ne portent pas encore d'authentification ni de restriction de mandat. Développement local uniquement avant mise en production.
# Rôles et statuts UPYA — validation métier du 7 octobre 2026

Correspondances explicitement fournies par l'utilisateur :
- AREA MANAGER : AM.
- POINT RELAIS : boutique.
- BA+, BA, MBA, FACO : agent.
- Administrator : entrepôt central.

Le rôle décrit le détenteur ; asset_status décrit l'état du stock. Les deux axes ne doivent pas se remplacer.
stock_daily : IN_STOCK = en stock, DEFECTIVE = défectueux, DEPLOYED = vendu/déployé à date, RESERVED = réservé.
Un DEPLOYED ne compte pas dans le stock disponible. Sa présence dans une photographie quotidienne ne constitue pas une nouvelle vente chaque jour.
holder_category=CLIENT identifie les détenteurs clients, même sans holder_role.
Les autres rôles restent non classés, sans invention de rattachement. Les quantités restent incluses.

Implémentation :
- ukit_ref.kind_from_role centralise ces correspondances.
- ukit_mart.stock_daily_classified classe le stock journalier déjà présent localement.
- GET /api/dg/stock-daily?date=YYYY-MM-DD expose une photographie unique (dernière date par défaut), sans somme de plusieurs journées.
- L'ETL importe désormais dim_agents.role pour classer les détenteurs de dim_asset. Ce rôle est prioritaire pour les correspondances métier connues ; le référentiel validé reste utilisé pour la géographie.
- Le DG courant conserve pour le moment sa source dim_asset, distincte de la couverture historique stock_daily.

Vérification locale : photographie du 4 octobre 2026 classifiée. Tests SQL des huit cas de rôle, pipeline isolé, compilation et vérification du rejet de dates invalides réussis.
La relance de l'import distant du 7 octobre est bloquée par pg_hba.conf pour l'IP 102.244.43.58. La classification quotidienne locale est active ; les détenteurs du stock courant seront actualisés par etl:once dès le rétablissement de cet accès.

Ces règles identifient les niveaux de détention, mais pas les rattachements zone/région/département. Ceux-ci restent à intégrer depuis le mapping géographique.

# Exploration UPYADataDB — relevés du 5 octobre 2026

Compte rendu finalisé le 6 octobre. Les chiffres ci-dessous sont ceux des requêtes du 5 octobre, et non une nouvelle photographie du 6 octobre.

## Méthode et périmètre
Connexion PostgreSQL en lecture seule, requêtes limitées à 30 secondes. Aucune modification distante. Inventaire des 21 tables physiques et 11 vues applicatives visibles, colonnes, contraintes, index BI et fonctions utilitaires. Comptages exacts des tables et contrôles approfondis des équipements, produits, détenteurs, événements, contrats et tables analytiques. Les données personnelles et les montants financiers ne sont pas reproduits.

Les lectures successives ne constituent pas un instantané transactionnel commun. L'exploration couvre toute la structure visible, mais ne constitue pas une vérification individuelle de chaque enregistrement ni un audit du serveur, des sauvegardes ou du pipeline ETL. Une agrégation des dates via staging a dépassé le délai de 30 secondes ; les types et volumes d'événements ont ensuite été examinés directement dans les données brutes. Les bornes historiques des événements sont des bornes textuelles ISO, pas une validation exhaustive de chaque date.

## Architecture
PostgreSQL 12.22 sur Ubuntu ; taille affichée : 5 798 MB.
- raw_upowa_schema : 14 tables CRM, 299 colonnes toutes de type text.
- staging_schema : 11 vues de nettoyage et conversion.
- bi_schema : 5 tables analytiques.
- public : 2 tables de test.
- util : 10 fonctions de nettoyage/conversion.
- 20 clés primaires relevées ; aucune clé étrangère dans raw_upowa_schema et bi_schema. Stock journalier protégé par un index unique fonctionnel.
- Aucun trigger visible dans information_schema.triggers ; cela ne renseigne pas sur les tâches de chargement externes.

| Table | Lignes exactes observées |
|---|---:|
| raw.crm_assets | 133 807 |
| raw.crm_asset_events | 1 012 860 |
| raw.crm_agents | 7 464 |
| raw.crm_products | 79 |
| raw.crm_contracts | 123 201 |
| raw.crm_contract_events | 43 586 |
| raw.crm_clients | 131 480 |
| raw.crm_repossessed | 17 559 |
| raw.crm_tasks | 35 419 |
| raw.crm_tickets | 2 607 106 |
| raw.crm_forms | 2 996 177 |
| raw.crm_payments | 1 951 217 |
| raw.crm_deals | 456 |
| raw.crm_users | 301 |
| bi.dim_asset | 133 973 |
| bi.dim_agents | 7 464 |
| bi.fct_asset_holding_periods | 209 897 |
| bi.fct_asset_lifecycle | 60 179 |
| bi.fct_asset_stock_daily | 401 661 |
| public.app_connection_test | 1 |
| public.replication_test | 4 |

raw et bi abrègent respectivement raw_upowa_schema et bi_schema.
Vues staging : agents, asset_events, assets, clients, contracts, deals, forms, payments, products, tasks, tickets.
Fonctions util : clean, to_ts, to_local_ts, to_local_date, to_date, to_num, to_int, safe_div, to_bool, to_jsonb.

## Fraîcheur
- Dernier updated_at des équipements : 3 octobre 2026 à 23:45:36, heure de Douala.
- Dernier updated_at des agents : 4 octobre à 03:10:28, heure de Douala.
- Dernier updated_at des produits : 10 septembre 2026.
- Chargement BI : 4 octobre vers 19:04, heure de Douala.
- Snapshots journaliers : 1er janvier 2025 au 3 octobre 2026 ; aucune date intermédiaire absente.
- data_as_of du stock journalier : 4 octobre à 01:54:46, champ sans fuseau.

Ces dates ne prouvent ni une synchronisation en temps réel ni la fréquence effective des mises à jour.

## Stock courant
| Statut CRM | Équipements |
|---|---:|
| DEPLOYED | 99 682 |
| INSTOCK | 27 297 |
| DEFECTIVE | 6 822 |
| WRITEOFF | 4 |
| LINKED | 2 |
| Total | 133 807 |

INSTOCK + DEFECTIVE = 34 119 équipements. Ce n'est pas encore un total certifié de kits complets : les données comprennent accessoires, pièces, produits de test et autres activités.

INSTOCK ne garantit pas la disponibilité à vendre : 207 équipements INSTOCK portent le flag « Attente Reparation ». Ce flag apparaît aussi sur 453 DEFECTIVE et 39 DEPLOYED. Les flags PAV, PPI, PDHC, PDN, URENEW, RM et Box de prospection nécessitent un dictionnaire métier validé.

Aucun statut courant « en transit » observé. TRANSFERED est un événement historique.

## Détenteurs et entrepôt
- 107 équipements INSTOCK n'ont pas de détenteur renseigné.
- Aucun détenteur renseigné dans dim_asset n'est absent de dim_agents.
- 25 787 équipements INSTOCK/DEFECTIVE sont rattachés à 24 comptes Administrator.
- 1 277 à 183 comptes Disabled.
- FACO : 2 745 ; POINT RELAIS : 1 446 ; DILE : 812 ; BA+ : 808 ; MBA : 462 ; TM : 457.
- AREA MANAGER : 141 équipements chez 8 détenteurs.
- SAV : 63 équipements chez 7 détenteurs, dont 43 INSTOCK et 20 DEFECTIVE.

Le rôle Administrator ne permet pas de conclure « entrepôt central ». Il faut identifier explicitement les comptes de stockage. Les rôles UPYA ne sont pas automatiquement équivalents aux profils et types de lieux de l'application.

## Produits
79 références produit et 86 libellés distincts dans les équipements : ces mesures ne sont pas directement comparables.

4 438 équipements ne rejoignent pas le catalogue par product_reference, dont 4 428 INSTOCK, 8 DEFECTIVE, 1 DEPLOYED et 1 LINKED.

| Famille jointe | Parc total | INSTOCK | DEFECTIVE |
|---|---:|---:|---:|
| Flash | 54 148 | 6 366 | 1 784 |
| Luciole | 28 508 | 3 581 | 3 231 |
| Lion | 21 353 | 3 003 | 1 667 |
| SunShine | 21 330 | 6 089 | 118 |
| Non résolue | 4 438 | 4 428 | 8 |
| ESF | 3 599 | 3 554 | 0 |
| Appliance | 286 | 245 | 0 |
| Susie | 64 | 15 | 4 |
| SmartSun | 40 | 1 | 0 |
| eMobility | 21 | 8 | 0 |
| Energy | 19 | 7 | 10 |
| HotSpot | 1 | 0 | 0 |

Les libellés comprennent lampes, batteries, panneaux, cartes mères, écrans, moteurs, références TEST et N/A. Définir kit complet / accessoire / pièce / autre avant de publier le nombre de kits. Prévoir une table produit → famille commerciale, sans déduction hasardeuse par nom.

## Géographie : principal blocage
Sur 34 119 équipements INSTOCK/DEFECTIVE, après jointure au détenteur :
- 32 860 sans région ;
- 33 078 sans zone ;
- 33 001 sans district.

Ces chiffres portent sur les NULL SQL ; les chaînes « NULL » s'ajoutent aux problèmes.

Dans dim_agents :
- 5 155 régions NULL SQL et 103 régions contenant le texte « NULL ».
- Variantes CENTRE/Centre/centre/CENTRE 1/CENTRE 2, tabulations et fautes telles que ADAQMAOUA.
- location_zone contient notamment Bankim, Akonolinga, Bertoua et Bafoussam : ne pas assimiler ce champ aux zones commerciales sans validation.
- Les 9 comptes AREA MANAGER n'ont aucune région/zone/district dans les champs examinés.
- team vaut [] pour 7 243 comptes sur 7 464 ; les autres valeurs sont des listes JSON textuelles.
- Seulement 6 comptes ont latitude et longitude renseignées ; valeurs dans les bornes mondiales autorisées, sans validation de leur exactitude terrain.

Aucune table dédiée visible ne décrit la chaîne zone → région → département → AM → boutique → agent. Il faut un référentiel validé, idéalement avec dates de validité. Les quantités non rattachées doivent rester visibles et non être affectées arbitrairement. La carte de démonstration ne peut pas devenir une carte réelle par simple branchement.

## Historique et événements
1 012 860 événements, 25 types, 256 308 valeurs brutes distinctes de numéro de série. Ce dernier nombre ne représente pas le parc de kits.

| Type | Événements | Séries distinctes |
|---|---:|---:|
| TRANSFERED | 84 646 | 42 008 |
| INSTOCK | 65 845 | 54 518 |
| DEPLOYED | 38 405 | 37 854 |
| DEFECTIVE | 5 515 | 5 250 |
| RESTORED | 225 | 219 |
| AFTER SALES | 8 397 | 25 |

Autres volumes : LINKED 200 412 ; PART ADDED 200 395 ; RESERVED 13 250.
188 878 événements LINKED ne rejoignent pas un équipement CRM, contre aucun PART ADDED. Leur sens doit être confirmé : ne pas les compter comme nouveaux kits.
AFTER SALES concentré sur 25 séries mérite une investigation métier, pas une suppression automatique.

66 316 équipements CRM n'ont aucun événement correspondant par numéro de série exact. Les principaux historiques observés débutent en janvier 2025 ; le parcours complet du parc ancien n'est donc pas établi.

DEPLOYED : 38 055 événements ont un ancien détenteur, aucun n'a un nouveau détenteur, 38 358 ont un nouveau propriétaire client. La performance doit être attribuée à l'acteur historique, pas au détenteur courant. Distinguer première vente, redéploiement, remplacement et retour.

## Couverture et divergences BI
dim_asset contient 166 séries avec in_crm=false.
lifecycle couvre 60 179 séries dont 60 013 du CRM. 73 794 équipements CRM n'ont pas de ligne lifecycle, dont 7 831 INSTOCK et 1 540 DEFECTIVE.

4 832 équipements INSTOCK/DEFECTIVE présents dans lifecycle ont un détenteur différent entre dim_asset et lifecycle, NULL inclus dans la comparaison.

Exemples de statuts divergents :
- 305 DEFECTIVE CRM mais IN_STOCK BI ;
- 190 DEPLOYED CRM mais IN_STOCK BI ;
- 93 DEPLOYED CRM mais RESERVED BI.

Dernier snapshot : 60 179 équipements, dont 34 993 DEPLOYED, 20 113 IN_STOCK, 4 979 DEFECTIVE, 94 RESERVED. Ne pas le présenter comme le total national de 133 807 équipements.

Contrôles positifs : aucune fin de période antérieure au début, aucun chevauchement entre périodes consécutives, aucune série avec plusieurs périodes courantes, aucune période courante clôturée, aucun stock journalier négatif, aucune date manquante dans la plage des snapshots. Cela ne garantit pas la complétude de la reconstruction.

fct_asset_stock_daily ne contient pas de produit : impossible d'en tirer seule une courbe historique filtrée par famille.

## Contrats et SAV
123 201 contrats, dont 57 316 sans numéro de série exploitable. Les 65 885 autres rejoignent un équipement CRM ; 44 séries apparaissent dans plusieurs contrats.
Statuts : PAIDOFF 49 710 ; LOCKED 43 421 ; ENABLED 14 767 ; REPOSSESSED 14 283 ; WRITEOFF 1 011 ; ADDED 9.

Ne pas confondre nombre de contrats, équipements actuellement DEPLOYED et événements DEPLOYED sur une période.

Les 2 607 106 tickets ne sont pas tous du SAV : Recouvrement 1 215 330, type absent 1 018 306, Technique - SAV Codes 38 041, Technique - SAV Maintenance 9 392, Plaintes SAV 168, entre autres. Plusieurs tickets peuvent concerner le même kit.

Le SAV doit distinguer DEFECTIVE, flag de réparation, détenteur SAV, ticket ouvert et historique AFTER SALES. Dédupliquer les équipements au lieu d'additionner ces catégories.

Aucune table dédiée aux comptages physiques identifiée. Les formulaires ou événements CHECKED peuvent contenir des éléments utiles, mais n'ont pas été validés comme source d'inventaire. Un écart CRM/BI n'est pas une perte physique.

## Conséquences pour les menus
| Fonction | État |
|---|---|
| Totaux par statut | Exploitables au niveau équipement ; périmètre kit à valider |
| Stock par produit | Exploitable avec catégorie Non résolue visible |
| Disponible à vendre | Règles de flags/réservation/réparation à valider |
| Entrepôt central / terrain | Comptes de stockage à identifier |
| Stock par territoire et carte | Référentiel géographique à compléter |
| Traçabilité | Exploitable pour les équipements couverts, avec limite historique affichée |
| Performance | Événements disponibles ; définition de vente et attribution à valider |
| Besoins de stock | Dépend du stock disponible, des ventes et du rattachement boutique |
| SAV | Sources présentes ; règles des cas ouverts et déduplication nécessaires |
| Écarts physiques | Source de comptage non démontrée |

Les paiements sont hors du périmètre fonctionnel demandé. Aucun montant financier à introduire dans les vues commerciales. Ne pas réintroduire Ville, un état en transit ou un KPI Réservés au DC du seul fait de champs présents dans UPYA.

## Ordre recommandé
1. Valider kit/accessoire, familles, flags, vente, SAV et correspondance des rôles.
2. Identifier les comptes de l'entrepôt et créer les rattachements territoriaux.
3. Réconcilier CRM et BI, documenter la couverture historique.
4. Construire une couche de lecture backend commune : stock courant, produits, détenteurs, événements, ventes et SAV.
5. Brancher les menus progressivement : stock produit/statut et traçabilité, puis géographie, performance et besoins.
6. Afficher date de référence, couverture et quantités non classées ; vérifier séparément le suivi du pipeline.

Conclusion : les données essentielles existent, mais une connexion directe des dashboards aux tables BI actuelles produirait des totaux incomplets et des répartitions géographiques trompeuses.

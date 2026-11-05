# upOwa — conception du pilotage des stocks

Document de travail du 21 septembre 2026. Propositions de business analysis et de contrôle interne à valider avec upOwa. Les règles ci-dessous ne décrivent pas une procédure déjà approuvée par l’entreprise.

## 1. Objectif et périmètre

Correction métier confirmée par l’utilisateur : UPYA ne remonte pas l’état « en transit ». Cet état, ses indicateurs et ses alertes sont retirés. La plateforme restitue le dernier détenteur enregistré et les transferts confirmés, sans inventer de localisation intermédiaire. La vue d’ensemble est limitée aux filtres, KPI et graphiques ; les tableaux restent dans les autres menus.

Répondre à six questions : quels kits existent, où sont-ils, qui en répond, lesquels sont vendables, quels événements expliquent leur situation et quelles anomalies nécessitent une action ? Le parcours nominal est fournisseur → magasin central → AM → boutique → agent → client. Le stock terrain exclut le magasin central ; le stock national le comprend. Les tableaux actuels affichent le national, avec une ventilation explicite par type de détenteur.

La version livrée repose sur 1 440 kits sérialisés, un journal d’événements et des comptages fictifs. Les cinq menus du Directeur Général sont : vue exécutive, stock national, risques et exceptions, traçabilité des kits et performance du réseau. Arbitrages et approbations ainsi que Rapports de direction ont été supprimés à la demande de l’utilisateur. Les nouveaux menus des quatre autres profils sont uniquement des pages « À venir » ; leurs vues d’ensemble existantes sont conservées. Le profil auditeur reste une proposition.

Aucun transfert réel, scan caméra, enregistrement serveur, authentification ou échange UPYA n’est exécuté. La sidebar se replie en icônes et conserve cette préférence localement. Un bouton Filtres en haut à droite ouvre les critères sur toutes les pages, à la place du sélecteur de profil de démonstration. Le détail ci-dessous reste la conception cible : seules les fonctions signalées comme livrées sont implémentées.

## 2. Principes issus des recherches

Une trace doit relier objet, date, lieu et contexte métier. Ce principe motive le journal d’événements par kit, sans prétendre implémenter intégralement EPCIS. [GS1 — EPCIS](https://www.gs1.org/standards/epcis)

Un contrôle d’inventaire compare les registres aux comptages physiques ; les mouvements du périmètre compté doivent être maîtrisés pendant le comptage. La fréquence peut dépendre de la rotation et du risque. Nous proposons des comptages cycliques et des contrôles ciblés. [Logistics Cluster — Monitoring and Counting](https://log.logcluster.org/en/monitoring-and-counting)

Les pièces de réception et de sortie doivent permettre de relier les mouvements aux niveaux de stock. D’où la référence documentaire obligatoire dans notre journal. [Logistics Cluster — Systematic Recording and Support Documentation](https://log.logcluster.org/en/systematic-recording-and-support-documentation)

Les équipements endommagés doivent être identifiés et traités séparément. Dans notre modèle, ils restent traçables mais ne sont pas disponibles pour vente. [Logistics Cluster — Physical Storage Guidelines](https://log.logcluster.org/en/physical-storage-guidelines)

Les autorisations doivent être contrôlées côté serveur, selon le rôle et la relation avec la ressource ; un filtre d’interface ne constitue pas une protection. [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## 3. Référentiels et axes de stock

Séparer la géographie (zone commerciale, région, département, site) de la hiérarchie de responsabilité (AM, boutique, agent). Un AM peut couvrir plusieurs départements. Une zone n’est pas nécessairement une division administrative. Les dates de validité des affectations devront préserver l’historique lors d’une réorganisation.

Les zones Centre-Sud, Littoral-Ouest, Grand Nord et Est, ainsi que les rattachements de la démo, sont fictifs. Les départements et boutiques présentés ne constituent pas un référentiel exhaustif ou approuvé. L’AM de démonstration est AM Centre. Les filtres proposent zone → région → département → ville → AM → boutique → agent, le type produit étant indépendant. Modifier un parent réinitialise ses descendants, sans modifier le produit.

| Dimension | Valeurs proposées | Règle |
|---|---|---|
| Cycle logistique | Non réceptionné, en stock, vendu, perdu, réformé | Une seule valeur à la fois |
| État technique | Bon état, défectueux, en réparation, en quarantaine | Distinct de la localisation |
| Réservation | Libre ou réservé | Une réservation ne déplace pas le kit |
| Responsabilité | Central, AM, boutique, agent ; client après livraison | Identifiant stable, pas un simple nom |
| Localisation physique | Dernier site connu, client, inconnue | Afficher le détenteur enregistré |
| Contrôle physique | Attendu, observé, manquant, inattendu | Résultat d’un comptage daté, pas un statut de vente |
| Paiement PAYGO | À mapper depuis UPYA | Indépendant du stock et de l’état technique |

Le code de démonstration conserve le dernier détenteur commercial sur un kit vendu pour les analyses territoriales ; la fiche indique « client final » comme localisation. En production, distinguer explicitement `custodianId`, `locationId`, `lastSellerId` et `customerRef`.

Avant la réception, suivre commandes et conteneurs au niveau des lignes produit et quantités. Ne créer des kits individuels que lorsque leurs numéros de série sont connus. Ajouter plus tard : commandé, préparé fournisseur, expédié international, arrivé port, dédouané, livré central. Ne pas compter une commande et ses kits réceptionnés deux fois.

## 4. Dictionnaire des indicateurs

| Indicateur | Définition et précautions |
|---|---|
| Parc suivi | Tous les kits connus ; démo : actif + vendu + perdu + réformé |
| Stock actif | Kits enregistrés en stock, tous états techniques |
| Stock théorique détenu | Kits enregistrés en stock chez un détenteur ; inclut les manquants non régularisés |
| Disponible | En stock, bon état, non réservé et non manquant au dernier comptage pertinent |
| Défauts | État technique défectueux, hors réparation et quarantaine pour éviter le double compte |
| Stock bloqué qualité | Défectueux + réparation + quarantaine |
| Stock boutique consolidé | Stock détenu directement par la boutique + stock de ses agents |
| Stock AM consolidé | Stock direct AM + boutiques et agents rattachés ; ne pas ajouter ce total à ses enfants |
| Manquants | Identifiants attendus absents du comptage |
| Inattendus | Identifiants observés non attendus ; à identifier avant intégration au disponible |
| Écart net | Quantité comptée − quantité théorique |
| Écarts bruts | Nombre de manquants + nombre d’inattendus ; aucune compensation |
| Vendu | Dans la démo, vente documentée avec référence client et livraison ; à mapper aux événements UPYA |
| Couverture en jours, future | Disponible / ventes moyennes quotidiennes sur période choisie ; « non calculable » si pas de consommation |
| Taux d’écart, futur | Nombre d’identifiants théoriques manquants / nombre théorique contrôlé ; inattendus affichés séparément |
| Valeur à risque, future | Quantités concernées × coût unitaire validé ; devise et méthode de coût explicites |

Les états qualité, réservations et anomalies peuvent se recouper : ne pas additionner tous les indicateurs comme une partition du parc. Les courbes de stock reconstruisent l’état à la fin du mois. Les flux sont affectés au territoire au moment de l’événement, pas au territoire actuel. Une réception de transfert peut concerner plusieurs fois le même kit ; elle n’est pas une nouvelle entrée dans le parc national. Septembre est partiel, arrêté au 21.

## 5. Règles de transfert et d’audit

1. Un numéro de série unique désigne un seul kit ; les références produit et détenteur doivent exister.
2. Circuit nominal : central → AM → boutique de cet AM → agent de cette boutique. Les transferts entre boutiques, entre AM et les retours logistiques devront utiliser des workflows distincts avec motif et approbation.
3. L’expédition vérifie le détenteur actuel, le bon état, l’absence de réservation et d’opération concurrente. Un manquant au comptage doit également être bloqué par le futur service transactionnel jusqu’à résolution.
4. La plateforme met à jour la détention lorsqu’un transfert enregistré est reçu de la source ; elle ne déduit aucun état intermédiaire.
5. Le transfert conserve l’origine, la destination, la date, l’acteur et la référence documentaire fournis par la source.
6. Si la source expose ce détail, les réceptions partielles se traitent par identifiant : reçu, restant à rapprocher, refusé, endommagé. Un lot incomplet n’est pas marqué entièrement reçu.
7. Une vente exige un kit en stock chez l’agent, en bon état, une référence client, une référence de vente et une preuve de livraison. Confirmer si UPYA distingue vente contractuelle et livraison physique ; la démo les regroupe.
8. Un retour client entre en quarantaine ; diagnostic puis contrôle qualité avant remise à disposition. Conserver le lien à la vente initiale et, pour un remplacement, le lien ancien/nouveau numéro de série.
9. Une perte ou réforme exige motif, justificatif et approbateur distinct. Le kit reste dans l’historique et sort de l’actif. Un manquant n’est pas automatiquement une perte.
10. Un événement déjà reçu ne doit pas être rejoué ; un identifiant identique avec contenu différent déclenche une anomalie. Un événement tardif doit être rapproché avant recalcul, pas ignoré silencieusement.
11. Aucune suppression d’événement métier en production : corriger par une écriture compensatrice référencée, avec avant/après et approbation.
12. Ajouter des contrôles de concurrence et une transaction atomique côté serveur pour empêcher deux expéditions simultanées d’un kit.

Le moteur local vérifie le circuit nominal, les états, références, dates et idempotence. Il ne constitue pas un dispositif d’autorisation ni un registre d’audit sécurisé.

## 6. Comptage et résolution des écarts

Workflow cible : préparer le périmètre → figer le théorique à une heure précise → comptage à l’aveugle → rapprochement → recomptage indépendant → investigation → proposition d’ajustement → approbation → publication dans le système maître → clôture.

Le comptage doit identifier le lieu observé, le compteur, l’heure, les séries et éventuellement les photos. Documenter les mouvements autour de la coupure afin de distinguer erreur de synchronisation, mauvais rattachement, transfert en cours, erreur de scan et perte réelle. Un numéro trouvé dans une autre boutique doit apparaître comme une anomalie de localisation, pas comme un second kit. Les doublons de scan sont à signaler, sans gonfler les quantités comptées.

Pour chaque dossier d’écart : attendu, observé, différence, cause présumée puis confirmée, responsable de traitement, échéance, pièces, recomptage, validateur et date de résolution. L’initiateur ne valide pas son propre ajustement. L’IT répare l’intégration, sans décider qu’un kit est perdu.

## 7. Périmètres des rôles

| Profil | Lecture | Actions métier proposées | Restrictions |
|---|---|---|---|
| DG | National, risques, performances, historique | Arbitrages et approbations au-delà des seuils | Pas de correction directe d’historique |
| DC | National commercial, disponible, couverture, agents | Demandes de réallocation et priorités commerciales | Pas d’ajustement d’inventaire unilatéral |
| Supply Chain | Central et terrain, mouvements, qualité, inventaires | Préparer/transférer/réceptionner selon site, investiguer, proposer ajustements | Approbation distincte des opérations sensibles |
| AM | Périmètre affecté, boutiques et agents | Confirmer ses réceptions, demander du stock, suivre défauts et comptages | Aucune visibilité sur un autre AM hors mandat |
| IT | Intégration et qualité technique, référentiels autorisés | Reprises de synchronisation, gestion technique des accès | Pas de validation métier de pertes ou réformes |
| Auditeur, recommandé | Lecture du périmètre de mission et pièces | Demandes de preuve, constats, suivi recommandations | Lecture seule, aucun ajustement |

Les boutiques, magasiniers et agents restent des acteurs nécessaires au workflow, même si leur saisie est réalisée dans UPYA et non dans cette plateforme. Définir des délégations temporaires avec date d’expiration et revue périodique des droits.

## 8. Menus proposés et contenu par profil

P1 : essentiel pour une première version opérationnelle. P2 : enrichissement après fiabilisation. Tous les écrans doivent conserver les filtres autorisés, l’heure des données et le chemin vers les kits justificatifs.

### Directeur Général

| Menu | Contenu | Décision attendue | Priorité |
|---|---|---|---|
| Vue exécutive | Parc, disponible, qualité, écarts bruts, tendances, couverture des données | Identifier les priorités nationales | P1 |
| Stock national | Cartes de quantités exactes : zone → région → département → ville → boutique → agent ; détails produit, sans tableau ni explorateur de kits | Localiser le stock sans double compte | P1 |
| Risques et exceptions | Retours SAV ouverts, kits endommagés et en réparation ; motif, détenteur, date et historique | Suivre les problèmes qualité et le SAV | P1 |
| Traçabilité des kits | Recherche exacte ou résultats multiples, chronologie, pièces, derniers acteurs | Répondre à une question sur un kit | P1 |
| Performance du réseau | Disponibilité, vieillissement, vitesse de vente, historique des transferts ; comparaison à périmètre comparable | Prioriser les ressources | P2 |

### Directeur Commercial

| Menu | Contenu | Décision attendue | Priorité |
|---|---|---|---|
| Disponibilité commerciale | Disponible par produit et territoire, réservations, qualité exclue | Promettre uniquement le stock mobilisable | P1 |
| Réseau commercial | AM, boutiques, agents, stock direct et consolidé, contacts métier | Identifier le détenteur à solliciter | P1 |
| Couverture et réapprovisionnement | Stock disponible, consommation, demandes, seuils par produit/site | Prévenir ruptures et surstocks | P2 |
| Ventes et conversion du stock | Kits attribués puis vendus, délai attribution/vente, retours ; paiements distincts | Comprendre l’immobilisation commerciale | P1 |
| Stock dormant et réallocation | Ancienneté, derniers mouvements, propositions origine/destination | Redistribuer avant nouvelle commande | P2 |
| Alertes commerciales | Boutiques sans disponible, agents avec stock ancien, réservations expirées | Affecter des actions aux AM | P1 |
| Rapports commerciaux | Période, territoire, produit, exports et détail justificatif | Préparer revues réseau | P2 |

### Supply Chain

| Menu | Contenu | Décision attendue | Priorité |
|---|---|---|---|
| État du stock | Théorique, disponible, réservé, défauts, réparation, quarantaine | Connaître les quantités réellement mobilisables | P1 |
| Approvisionnements | Commandes, fournisseur, lignes produit, conteneur, ETA, quantités attendues/reçues, reliquats | Anticiper les arrivées | P2 |
| Réceptions | Numéros de série, contrôle qualité, document d’entrée, réserves de livraison | Accepter et documenter l’entrée | P1 |
| Transferts et réceptions terrain | Origine, destination, transporteur, séries, expédition, réception partielle, retards | Fermer chaque transfert avec preuve | P1 |
| Réseau de détention | Central, AM, boutiques, agents ; responsable et stock consolidé | Localiser le stock | P1 |
| Inventaires et écarts | Campagnes, comptages, recomptages, rapprochements, ajustements approuvés | Fiabiliser le théorique | P1 |
| SAV, retours et défauts | Motifs, diagnostic, localisation, pièces, garantie, réparation, remplacement, réforme | Remettre en service ou sortir avec justification | P1 |
| Réapprovisionnement | Seuils, besoins, demandes validées, propositions de distribution | Planifier les sorties | P2 |
| Journal et justificatifs | Événements, bons, scans, acteurs, corrections et approbations | Prouver le mouvement de chaque kit | P1 |

### Area Manager

| Menu | Contenu | Décision attendue | Priorité |
|---|---|---|---|
| Mon stock | Stock direct, boutiques, agents, disponible et bloqué | Organiser le périmètre quotidiennement | P1 |
| Mes boutiques | Fiche boutique, département, responsable, produits, défauts et écarts | Prioriser visites et réapprovisionnements | P1 |
| Mes agents | Kits détenus, durée de détention, ventes, retours, rattachement | Relancer et contrôler la prise en charge | P1 |
| Mes transferts | Entrants à réceptionner, sorties, preuve de remise, reliquats | Confirmer les responsabilités | P1 |
| Mes demandes de stock | Besoin par boutique/produit, justification, décision, livraison attendue | Demander et suivre les besoins | P2 |
| Défauts et retours | Signalement documenté, statut SAV, kit de remplacement, délai | Éviter la remise en vente d’un kit défectueux | P1 |
| Inventaires et écarts | Comptages assignés, manquants, trouvés ailleurs, preuves, investigation | Résoudre les anomalies locales | P1 |
| Mes alertes et actions | Priorité, responsable, échéance, état et preuve de résolution | Piloter les suites concrètes | P1 |

### Pôle IT

| Menu | Contenu | Décision attendue | Priorité |
|---|---|---|---|
| Santé des intégrations | Dernier succès, retard, volumes lus/acceptés/rejetés, disponibilité API | Détecter une alimentation dégradée | P1 |
| Synchronisations et reprises | Lots, curseurs, erreurs, tentatives, rejouabilité et idempotence | Reprendre sans doublons | P1 |
| Qualité des données | Séries dupliquées, références absentes, états inconnus, événements tardifs | Corriger ou faire arbitrer les mappings | P1 |
| Référentiels | Correspondances UPYA/upOwa, produits, sites, zones, départements, affectations datées | Maintenir des regroupements fiables | P1 |
| Utilisateurs et habilitations | Rôles, périmètres, délégations, désactivations, journal des changements | Garantir le bon accès au bon périmètre | P1 |
| Journal technique et audit | Accès, exports, changements de configuration, anomalies de flux | Expliquer une anomalie sans modifier les faits métier | P1 |
| Paramètres de supervision | Seuils techniques, règles de mapping, configuration versionnée | Contrôler les changements | P2 |

### Profil auditeur conseillé

Menus : missions et périmètres ; piste d’audit des kits ; inventaires et ajustements ; contrôles de séparation des tâches ; anomalies et recommandations ; pièces et exports de preuve. Chaque constat doit relier critère, fait observé, preuve, impact, cause, responsable et date cible. Les captures seules ne remplacent pas un export horodaté et une référence à la source.

## 9. Alertes et traitement

Périmètre DG actuel : la page Risques et exceptions est exclusivement consacrée au SAV et aux kits endommagés. Les alertes génériques ci-dessous restent une conception pour les autres profils ; elles ne sont plus affichées dans ce menu DG. Un retour dont le bon état a été rétabli est exclu des dossiers SAV actifs. Les catégories retour/endommagé/réparation peuvent se recouper ; le total des kits suivis est dédupliqué. Les villes ajoutées au jeu de démonstration doivent être validées avec le référentiel upOwa.


| Alerte | Règle proposée | Responsable | Suite |
|---|---|---|---|
| Stock dormant | Démo : disponible sans mouvement depuis plus de 30 jours | DC + AM | Relance, réallocation ou contrôle |
| Qualité bloquée | Défaut, réparation ou quarantaine | Supply Chain / SAV | Ticket, diagnostic, échéance |
| Écart d’inventaire | Au moins un identifiant manquant ou inattendu | Contrôle stock | Recomptage et investigation |
| Faible disponibilité | Démo : moins de 3 kits dans une boutique, agents inclus ; produit sélectionné pris en compte | AM + Supply Chain | Vérifier demande et réapprovisionner |
| Synchronisation obsolète, future | Retard supérieur à la cadence et tolérance contractuelles | IT | Reprise puis rapprochement |
| Donnée incohérente, future | Série dupliquée, état inconnu ou détenteur absent | IT + propriétaire métier | Mise en attente, correction validée |

Les seuils 30 jours / 3 kits sont des exemples. Les règles finales doivent varier par trajet, produit et boutique. Une alerte n’est pas un constat de fraude. Prévoir ouverture, assignation, accusé de prise en charge, investigation, résolution justifiée, clôture et réouverture ; éviter les doublons de notifications. Aucun message n’est envoyé par la démo.

## 10. Données UPYA : confirmé publiquement et à vérifier

UPYA présente publiquement le suivi de détention, les événements d’équipements, les transferts, les scans, les défauts et les remplacements. Cela indique une proximité fonctionnelle avec le besoin ; cela ne prouve pas leur disponibilité dans l’abonnement ou l’API du compte upOwa. [UPYA — Inventory Management](https://upya.io/inventory-management/)

L’éditeur annonce des API ouvertes et des données aux niveaux client, agent, boutique ou équipement. Les endpoints, schémas, droits, limites et modes d’accès restent à obtenir. [UPYA — Informal Trades](https://upya.io/informal-trades/)

| Objet attendu | Champs minimaux du contrat cible | Disponibilité à confirmer |
|---|---|---|
| Kit | ID UPYA, série, produit, état, détenteur, dates création/modification | Noms, unicité, pagination, archivage |
| Produit | ID, SKU, libellé, gamme, sérialisé/non sérialisé | Catégories et pièces séparées |
| Détenteur/site | ID, type, parent, AM, boutique, adresse, géographie | Profondeur et historique des rattachements |
| Mouvement | ID, kit(s), type, origine, destination, dates opération/saisie/synchronisation, auteur | Historique complet ou état courant seulement |
| Réception | Transfert lié, séries reçues/refusées, réceptionnaire, date, justificatif | Confirmation distincte et réception partielle |
| Vente/livraison | ID vente, kit, client pseudonymisé, date, vendeur, livraison, annulation | Distinction contrat/activation/livraison |
| Défaut/SAV | Kit, motif, diagnostic, état, date, technicien, ticket, remplacement | Taxonomie et historique |
| Inventaire | Session, périmètre, coupure, séries attendues/observées, validation | Module/export existant ou collecte complémentaire |
| Achat/transport | Commande, fournisseur, conteneur, produits, quantités, ETA | Peut provenir d’un autre système |
| Coûts | Coût unitaire, devise, méthode, date | Source finance validée, accès restreint |

Ne pas inventer une URL API. Demander documentation, environnement de test et exemples anonymisés de kit actif, vendu, retourné, défectueux et transféré. Vérifier authentification, scopes, pagination, filtres temporels, identifiant d’événement stable, webhooks éventuels, limites de débit, fuseaux, suppressions et profondeur historique.

Hypothèse cible : UPYA reste maître des mouvements existants ; la plateforme consulte et réconcilie. Si des inventaires/alertes sont gérés localement, leur propriété et la publication d’éventuels ajustements doivent être contractualisées. Ne pas créer deux registres concurrents.

## 11. Architecture cible et critères d’acceptation

Architecture proposée : UPYA / imports autorisés → adaptateur serveur → validation et journal d’import → stockage des événements et référentiels → agrégations cohérentes → API contrôlant les périmètres → dashboards. Les secrets restent serveur. Une extraction initiale est suivie de mises à jour incrémentales, avec curseur, reprise, doublons maîtrisés et rapprochement périodique des totaux. Afficher la dernière synchronisation réussie et le retard, jamais un indicateur vert statique.

Conserver séparément date métier, date de saisie et date d’intégration. Un état non mappé entre dans un dossier d’anomalie plutôt que d’être assimilé à « disponible ». Un historique indisponible ne doit pas être inventé à partir de l’état actuel. Les identifiants clients suffisent au dashboard ; réserver les données personnelles aux besoins autorisés.

Critères d’acceptation prioritaires :

- Même périmètre, même date et même définition donnent les mêmes totaux pour DG/DC/Supply.
- Un AM ne lit ni n’exporte les données d’un autre AM, y compris par modification d’URL ou d’identifiant.
- Un kit ne peut être expédié deux fois simultanément ; chaque réception correspond à une expédition.
- Un kit défectueux, réservé ou manquant ne contribue pas au disponible.
- Tous les niveaux géographiques et le produit filtrent indicateurs, listes, comptages et alertes.
- Les états vides restent lisibles ; le stock central ne reçoit pas de boutique fictive.
- Chaque chiffre peut être expliqué par la liste des séries et la règle de calcul.
- Les retours, corrections et réorganisations préservent la chronologie.
- Un écart opposé ne masque pas un manquant ; la régularisation exige une approbation.
- Une panne UPYA affiche un état dégradé et l’heure des dernières données fiables.

Ordre conseillé : valider définitions et référentiels → obtenir les échantillons UPYA → mapping et intégration de lecture → droits serveur → pilote central + un AM + boutiques → rapprochement terrain → extension → workflows et approbations → analyses de couverture/coût.

## 12. Questions métier ouvertes

1. Quelles sont les zones officielles, leurs régions et les affectations AM/boutiques/agents ?
2. Quand la responsabilité change-t-elle : scan expéditeur, remise physique ou scan réceptionnaire ?
3. La vente UPYA correspond-elle à un contrat, une activation ou une livraison ?
4. Quels transferts hors circuit nominal sont autorisés et par qui ?
5. Qui compte, recompte et approuve les ajustements, selon quels seuils ?
6. Où sont traités SAV, réparations et réformes ; qui autorise le retour en disponible ?
7. Quels indicateurs et extractions UPYA sont effectivement accessibles aujourd’hui ?
8. Quels délais d’alerte, fréquences de comptage et données de coût sont pertinents ?

Ces réponses conditionnent la mise en production ; elles n’empêchent pas de valider l’ergonomie sur le jeu fictif commun.

## Livraison des interfaces Directeur Commercial

Les sept menus du DC sont implémentés, en complément de sa vue d’ensemble sans tableau : disponibilité par produit et région ; réseau AM/boutiques/agents ; couverture et réapprovisionnement ; ventes et conversion ; stock dormant et réallocation ; alertes commerciales ; rapports commerciaux.

- Même parc, sidebar repliable et filtres partagés que le DG. Accès aux kits justificatifs et à leur historique depuis les vues détaillées.
- Ventes et retours : événements dans une fenêtre de 30/60/90/180 jours, au rattachement actuel du kit. Courbes et KPI utilisent exactement cette fenêtre. Conversion : kits attribués pendant la fenêtre et vendus ensuite avant l’arrêté, divisés par les kits attribués pendant la fenêtre. Aucun paiement PAYGO n’est déduit.
- Couverture : disponible / ventes journalières moyennes ; sans vente, non calculable. Cible : maximum du minimum choisi et des ventes moyennes multipliées par les jours cibles, arrondi à l’entier supérieur. Le périmètre boutique inclut ses agents sélectionnés. Les couples boutique/produit sans stock restent visibles.
- Réallocation : propositions entre boutiques pour le même produit, limitées aux excédents disponibles et aux besoins, sans réutiliser le même budget d’origine. Simulation uniquement, sous réserve des règles logistiques à définir.
- Alertes : absence de disponible, insuffisance selon les hypothèses, disponibles sans mouvement depuis plus de 30 jours chez les agents. Aucune expiration de réservation inventée.
- Brouillons, propositions retenues et marquages restent en mémoire dans la page. Changer de menu, recharger ou modifier le périmètre les réinitialise. Aucun transfert, envoi ou approbation serveur n’est effectué.
- Rapports : synthèse imprimable, JSON avec agrégats et contexte, CSV des kits justificatifs avec arrêté et filtres. Données fictives, UPYA non connecté.

Le contenu Pôle IT reste à implémenter dans une prochaine étape.

## Livraison des interfaces Supply Chain

Les neuf menus sont accessibles sous `/supply-chain`, avec filtres partagés, sidebar repliable et historique par kit : état du stock, approvisionnements, réceptions, transferts, détention, inventaires, SAV, réapprovisionnement et journal.

Les états de stock utilisent le détenteur actuel. Les flux et exports du journal utilisent la localisation à la date de l’opération, avec la destination pour les transferts. Les réceptions centrales ne sont donc pas attribuées aux régions où les kits se trouvent aujourd’hui. Aucun état intermédiaire de transport n’est créé.

Les commandes fournisseurs sont illustratives : une ligne par produit, reliée aux numéros de série effectivement réceptionnés dans le jeu commun. Fournisseur, conteneur, quantités restant à recevoir et ETA sont fictifs et explicitement signalés. Les reliquats ne sont pas du stock et ne possèdent pas de séries inventées. Ces commandes sont destinées au central ; les filtres territoriaux du central et produit s’appliquent.

Les comptages affichent séparément manquants, inattendus et écart brut. Le SAV couvre les retours ouverts, dommages, réparations, quarantaines et réformes documentées. Les garanties, diagnostics atelier, transporteurs et pièces jointes restent non renseignés. Le réapprovisionnement reprend les hypothèses ajustables et les brouillons locaux du DC. Il ne constitue pas une demande validée côté serveur.

Cette livraison porte sur les interfaces de consultation et de simulation : aucun scan, enregistrement réel de réception/transfert, ajustement de stock ou traitement serveur n’est effectué. Les références du journal sont consultables et exportables, sans prétendre disposer des fichiers justificatifs.
## Livraison des interfaces Area Manager

Les huit menus AM sont disponibles sous `/am` : stock, boutiques, agents, transferts, demandes, défauts, inventaires et alertes. Le profil de démonstration est affecté à AM Centre (`am-0`). Les filtres affinent ce mandat ; un autre AM dans l’URL ne donne aucune donnée, aucun acteur, transfert ou besoin. Ce contrôle client illustre le périmètre ; l’autorisation définitive devra être appliquée côté serveur.

Le stock distingue détention directe AM et réseau. Les fiches boutiques/agents affichent disponibilité, réservations, qualité, écarts bruts, ventes et retours sur 90 jours, ancienneté de détention et stock dormant. Les comptages conservent les manquants et inattendus séparés. Les transferts sont des opérations enregistrées dans le réseau, avec filtre sur la destination historique ; aucun état de transport ni réception à confirmer n’est inventé.

Les demandes utilisent les hypothèses ajustables de couverture et les brouillons locaux par boutique/produit. Les alertes proposent une prise en charge locale, une échéance et une note de suivi. Ces informations restent dans la page et sont effacées au rechargement, au changement de menu ou de filtres. Elles ne valent ni envoi de demande, ni résolution d’écart, ni modification du stock.

Le SAV et la liste qualité donnent accès aux kits et à leur historique. Signalements serveur, preuves jointes, remplacements, décisions et livraisons attendues restent à connecter. Les contacts responsables ne sont pas inventés. La vue d’ensemble demeure sans tableau.
## Mise à jour du 22 septembre 2026 — menus de direction partagés

Les profils Commercial et Supply Chain disposent en complément de leurs menus spécialisés des quatre vues détaillées du DG : Stock national, Risques et exceptions, Traçabilité des kits et Performance du réseau. Leur vue d’ensemble existante est conservée, sans ajout de Vue exécutive. Les composants et définitions métier sont communs ; les filtres sont conservés dans la navigation.

Risques et exceptions présente désormais un tableau paginé de tous les kits concernés, une ligne par kit, avec recherche, filtre de situation, détenteur, localisation, motif, dernier événement SAV et ancienneté. L’identifiant ouvre l’historique. Ce tableau remplace les cartes et KPI de ce menu. Les menus spécialisés SAV Supply Chain et défauts AM restent inchangés.

Les vérifications navigateur utilisent les assertions DOM, interactions, erreurs JavaScript et dimensions de page, sans capture d’écran. Les caches Vite des tests et du serveur de développement sont séparés.

## Simplification du DC — version validée

Le DC dispose de six menus : Vue d’ensemble ; Stock et disponibilité ; Réseau et performance ; Besoins de stock ; SAV et kits endommagés ; Traçabilité des kits. Les anciens liens sont redirigés vers le menu correspondant en conservant les filtres.

La vue d’ensemble affiche quatre KPI : stock actif, disponible, ventes enregistrées sur la période (nombre de kits) et disponibles sans mouvement depuis plus de 30 jours. Une courbe de ventes, une répartition du stock par région et des barres de kits vendus par produit complètent la synthèse sans tableau. Les périodes proposées sont 30, 60, 90 et 180 jours. Les stocks et l’immobilisation sont mesurés à l’arrêté ; la période concerne les ventes.

Stock et disponibilité regroupe disponibilité produit et exploration géographique. Réseau et performance regroupe les volumes vendus, retours, conversion des attributions, dormant, histogrammes simples et fiches du réseau. Besoins de stock regroupe couverture, ruptures, brouillons, réallocations et alertes dans des onglets. L’export des ventes est accessible depuis Performance et ne contient que les kits et références de vente. Aucun montant, revenu, marge ou encaissement n’est géré.

Les KPI Risques et exceptions sont rétablis au-dessus du tableau pour les vues communes : kits concernés distincts, retours SAV ouverts, endommagés, réparations. Ils suivent les filtres globaux ; recherche et situation affinent uniquement le tableau. Les catégories peuvent se recouper, leur somme ne doit pas remplacer le total distinct.

La Supply Chain conserve ses menus actuels ; sa simplification n’est pas livrée dans cette étape. Les tests restent sans captures d’écran.

## Simplification Supply Chain — périmètre livré

La navigation comporte six menus : Vue d’ensemble ; Stock et détention ; Distribution et besoins ; Inventaires et écarts ; SAV et kits endommagés ; Traçabilité et justificatifs. Le menu Approvisionnements et réceptions est exclu de cette livraison et de la navigation. Les anciens écrans dédiés aux commandes et réceptions ne sont plus accessibles ; les événements de réception existants restent dans le journal historique des kits.

Stock et détention regroupe localisation géographique, agrégations par région/produit/détenteur et liste des kits dans trois onglets. Distribution et besoins regroupe couverture et besoins, transferts enregistrés et propositions de réallocation. Les brouillons et propositions restent locaux, sans mouvement réel de stock. Inventaires conserve les manquants, inattendus et écarts bruts séparés. Le SAV regroupe le tableau avec KPI des retours/dommages et une rubrique quarantaines/réformes. Traçabilité regroupe recherche par kit et journal filtrable/exportable.

La vue d’ensemble reste sans tableau, avec stock actif, disponible, écarts bruts de comptage et blocages qualité. Les filtres restent communs. Les anciens liens correspondant aux rubriques regroupées redirigent vers les nouveaux menus avec leurs filtres. Aucun état de transport ou montant financier n’est ajouté. Les vérifications restent sans captures d’écran.

## Carte du stock et mix produit — 30 septembre 2026

Le DG dispose désormais de quatre menus : Vue exécutive, Stock national, Carte du stock et Performance du réseau. Risques et exceptions et Traçabilité des kits sont retirés uniquement du DG. Les vues métier correspondantes restent disponibles dans les autres profils.

Le stock géographique partagé propose deux actions à chaque niveau (zone, région, département, ville, boutique, agent) : le clic sur le lieu ouvre le mix produit en popup ; Explorer conserve le parcours vers les enfants. La popup propose aussi Explorer lorsqu’un niveau inférieur existe. Les kits hors boutiques ou agents restent comptés à part et disposent de leur propre mix. Ce composant est utilisé dans le stock national du DG, la localisation du DC, le stock Supply Chain et Mon stock de l’AM, avec son périmètre limité.

Carte du stock est accessible au DG, au DC et à la Supply Chain. Le choix d’un lieu zoome sur son emprise, les compteurs ouvrent le mix produit, et le parcours permet de descendre vers les lieux rattachés. La carte respecte les filtres globaux et les remet en cohérence avec le parcours local lors d’un changement. Les boutiques colocalisées sont regroupées ; leurs quantités ne sont pas dupliquées. Les lieux sans repère restent comptés et explicitement listés. Les totaux portent sur les kits actifs, tous états techniques, à la date d’arrêté commune.

Le fond régional embarqué provient de geoBoundaries/Wikimedia (limites 2016, licence CC BY 3.0, attribution dans la carte et src/data/CARTOGRAPHY.md). Les couleurs de zone suivent le référentiel commercial fictif. Les repères des villes sont approximatifs ; boutiques et agents sont placés au repère de leur ville, sans coordonnées GPS individuelles inventées. La mise en production exige un référentiel géographique métier validé. Aucun service de tuiles ou géocodage n’est appelé pendant l’utilisation.

Le mix utilise les types de produits existants (SmartSun M, SmartSun L, SmartSun Lite 2, Sunshine, SmartSun XL, Lion). Aucun regroupement supplémentaire en familles métier n’est supposé. Les contrôles vérifient les totaux, filtres, regroupements, popup, navigation clavier, zoom et affichage mobile sans captures d’écran.

## Recentrage du Directeur Commercial — 1er octobre 2026

Disponibilité affiche les quantités immédiatement disponibles par région et un poste Entrepôt central séparé. Le KPI Réservés et les accès aux numéros de série sont supprimés de cette vue. Les répartitions du DG, DC et Supply Chain présentent désormais l’entrepôt central comme un poste distinct du terrain ; ses kits ne sont plus inclus simultanément dans une région terrain. Les filtres géographiques s’appliquent toujours au stock sélectionné. Le central n’est pas affiché dans le périmètre d’un AM.

Performance remplace Réseau et performance. Les comparaisons couvrent zone, région, département, ville, AM, boutique et agent, avec volumes vendus, catégories de produits et classement par quantité (ex æquo conservés). Le vendeur et le territoire retenus sont ceux de l’événement de vente, même après un retour du kit. Les stocks restent rattachés au détenteur actuel. Les courbes et classements utilisent la même fenêtre d’observation. Aucune donnée financière n’est utilisée.

Besoins de stock est une synthèse par lieu et produit : cible = plafond(ventes / jours observés × jours de couverture souhaitée) ; besoin = max(0, cible − disponible). Aucune vente observée donne un besoin non estimable, sans minimum arbitraire. Le central n’est pas une destination commerciale à réapprovisionner selon cette formule. Chaque niveau est recalculé séparément ; les niveaux ne s’additionnent pas. L’agrégation régionale peut compenser des excédents et déficits entre boutiques, d’où l’intérêt du détail par niveau. Les effets de saisonnalité, délais fournisseurs et ventes perdues pendant une rupture ne sont pas modélisés.

Le SAV DC affiche des KPI et des agrégats par lieu (y compris le central) : total distinct, retours ouverts, endommagés et réparations. Les catégories peuvent se recouper. Aucun identifiant de kit ni historique individuel n’est affiché dans ces synthèses. Traçabilité des kits est le seul menu du DC proposant les séries et leurs historiques. Les popups géographiques restent des mix produits agrégés.

Les tests contrôlent notamment l’attribution au vendeur après retour, les classements, les besoins différents par produit/lieu, le central sans double comptage, l’absence de tables hors traçabilité DC et les interactions navigateur sans captures d’écran.

## Correction des vues DC — cartes produits et remontée des besoins

Cette section remplace les définitions antérieures de la disponibilité DC, de sa performance et de ses besoins.

Disponibilité : une carte par type de produit, sans histogramme. Chaque carte affiche exactement le disponible terrain, le disponible entrepôt central et le nombre de kits en stock dont l’état est Défectueux. Réparation et quarantaine ne sont pas assimilées à Défectueux. Les filtres globaux restent applicables. Dans Localisation du stock du DC, l’entrepôt central n’apparaît qu’au niveau Zone ; les autres niveaux affichent uniquement le terrain, avec une indication explicite.

Performance : onglets Zones, Régions, Départements, Area Managers, Boutiques et Agents. Chaque onglet présente les acteurs classés par nombre de kits vendus ; cliquer sur un acteur affiche ses ventes par produit. Les acteurs sans vente restent visibles dans leur périmètre. La courbe d’évolution est supprimée de ce menu. Les périodes et attributions historiques au vendeur sont conservées.

Besoins : le calcul est effectué uniquement par boutique et produit, en incluant les kits de ses agents rattachés. Besoin boutique = max(0, plafond(ventes boutique / jours observés × couverture souhaitée) − disponible boutique). Un besoin de 3 kits est repris comme 3 dans les totaux de son AM, département, région et zone. Les niveaux supérieurs additionnent les besoins des boutiques ; ils ne recalculent pas un besoin net et ne compensent pas les déficits avec les excédents d’autres boutiques. Sans vente observée, le couple boutique/produit est non estimable, et le total parent précise le nombre de couples sans historique. Aucun besoin individuel d’agent n’est calculé. Un filtre agent identifie sa boutique, dont le besoin complet est calculé.

Navigation Besoins : Zone → Région → Département → AM → Boutique, par cartes cliquables et fil d’Ariane. Quand un AM couvre plusieurs départements, sa carte dans un département porte uniquement sur les boutiques de ce département. Les niveaux ne s’additionnent jamais entre eux.

SAV DC : cartes de synthèse cliquables avec le même parcours, prolongé jusqu’aux agents lorsque le rattachement existe. L’histogramme est retiré. Les KPI suivent le périmètre parcouru ; retours, endommagés et réparations peuvent se recouper mais le total des kits est dédupliqué.

Ville est retiré des filtres et niveaux de navigation partagés, y compris la carte. Les données de ville sont conservées en interne pour les repères cartographiques approximatifs et les adresses, sans constituer un niveau de pilotage. Les détails individuels restent uniquement dans Traçabilité pour le DC.

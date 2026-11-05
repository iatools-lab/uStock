# ETL planifié et base de visualisation locale

## Architecture

Serveur UPYA (bi_schema) → processus cron ETL → transformation et contrôles → PostgreSQL local → API NestJS → dashboards.

Seul le processus ETL possède un client source. Les requêtes HTTP n'exécutent pas l'ETL et ne se connectent jamais à la source, y compris en cas d'échec local. Une indisponibilité source laisse le dernier import réussi consultable.

bi_schema reste le périmètre d'extraction choisi. Ses tables sont des entrées à préparer pour les écrans ; leurs statuts, rattachements et couvertures ne sont pas présumés fiables.

## Exécution depuis backend

- npm run bi:check : contrôle les connexions et les clés des cinq tables BI.
- npm run bi:migrate : initialise les tables du projet.
- npm run etl:once : exécute extraction, transformation, contrôles et publication.
- npm run etl:cron : démarre le processus planificateur, séparément de l'API.
- npm run start:dev : démarre l'API locale.
- npm run test:bi : tests unitaires.

Planification par défaut : tous les jours à 02 h 00, fuseau Africa/Douala.
Variables facultatives :
ETL_CRON=0 2 * * *
ETL_TIMEZONE=Africa/Douala
ETL_RUN_ON_START=false

La fréquence est configurable ; le processus doit rester actif sous un gestionnaire de services pour tourner en permanence. Aucun service système installé ; pour activer la planification, lancer et maintenir le processus etl:cron.
Une alternative Linux consiste à lancer etl:once par cron système. Utiliser un seul mode de planification. Le verrou PostgreSQL empêche deux publications concurrentes même si plusieurs workers tournent.

## Connexions

Source : SOURCE_DB_HOST/PORT/DATABASE/USER/PASSWORD, ou anciennes clés server:, database:, port:, user:, password: du .env.
Destination : TARGET_DATABASE_URL, puis DATABASE_URL, sinon TARGET_DB_HOST/PORT/DATABASE/USER/PASSWORD.
Ne jamais partager le mot de passe dans les logs.

SSL source par défaut : require (chiffrement sans vérification du certificat). Utiliser verify-full et SOURCE_DB_SSL_CA_FILE pour vérifier le certificat.
Destination locale : disable par défaut ; configurer SSL pour une destination distante. URL : paramètre sslmode.
L'API supporte une URL PostgreSQL de destination ou les variables TARGET_DB_ ; elle n'utilise aucune variable SOURCE_DB_.
postgres peut être un nom de service Docker ; depuis Windows il faut une adresse résoluble et le port publié.

## Traitement et publication

1. Transaction source REPEATABLE READ, READ ONLY.
2. Extraction par curseur, lots de 5 000 lignes, exclusivement sur les colonnes utilisées des cinq tables BI. Transfert compact en tableaux JSON, sans noms de champs répétés sur le réseau.
3. Tables de travail temporaires PostgreSQL ON COMMIT DROP. Aucun stockage permanent des payloads bruts.
4. Nettoyage/type des valeurs et jointure avec les référentiels métier locaux.
5. Production des tables finales et agrégats.
6. Vérification des volumes source/copie, clés uniques, réconciliation du stock et quantités négatives.
7. COMMIT unique sur la destination. Sur échec : ROLLBACK et maintien du dernier état réussi.

Le remplacement utilise DELETE/INSERT transactionnels : les lecteurs MVCC continuent de voir la version publiée précédente pendant la transformation.
L'API ouvre elle aussi une transaction de lecture cohérente pour associer données et date d'import.
Les référentiels locaux ne sont jamais effacés par l'ETL.
Une extraction vide est refusée. Un arrêt brutal peut laisser un import marqué running, sans publication partielle ; sa reprise nécessite de vérifier l'absence de worker actif.

## Tables locales préparées

ukit_etl.import_run : suivi des exécutions, dates, volumes et erreurs expurgées.
ukit_ref.product : famille et nature kit/pièce/accessoire/autre, disponibilité validée.
ukit_ref.holder : rôle physique, entrepôt/terrain, zone/région/département/AM/boutique et coordonnées validées.

ukit_mart.asset_current : état courant enrichi et indicateurs de qualité.
ukit_mart.stock_summary : agrégats par produit, famille, statut, disponibilité et territoire.
ukit_mart.stock_daily : historique agrégé BI, conservé avec sa couverture propre.
ukit_mart.holding_period : périodes de détention typées.
ukit_mart.lifecycle : étapes du cycle de vie typées.
ukit_mart.quality_summary : comptes des rattachements absents et divergences.

Les historiques quotidiens ne représentent pas nécessairement tout le parc et ne possèdent pas de dimension produit. Ne pas leur ajouter un filtre produit fictif.
Pas de famille ni de territoire inventé : les valeurs BI originales restent identifiables ; les référentiels validés gouvernent les agrégations.
« available » exige INSTOCK, absence de flag, règle produit approuvée et détenteur physique validé. Sinon INSTOCK reste « unconfirmed », jamais assimilé à zéro.
Les compteurs représentent des équipements ; asset_kind=kit exige une qualification métier préalable.
Les règles de vente, retour SAV ouvert et besoins boutiques restent à valider avant création de ces agrégats spécifiques.

## API locale

GET /api/dashboard/overview : stock, disponible central/terrain, défectueux, disponibilité incertaine et région inconnue.
GET /api/dashboard/stock?groupBy=family : ventilation. groupBy autorisé : zone, region, department, am_id, shop_id, product_reference, family, asset_kind, holder_kind, crm_status, availability.
Ces mêmes champs servent de filtres sur les deux endpoints.
GET /api/dashboard/quality : indicateurs de qualité globaux.
Réponse : source=postgres_local, unit=equipment, lastImport et data.
Les entiers PostgreSQL bigint sont renvoyés sous forme de chaînes pour conserver leur précision.
Aucun import réussi ou base locale indisponible : réponse 503, sans accès distant de secours.
Les filtres SQL sont paramétrés et les regroupements limités à une liste autorisée.
Ces endpoints ne définissent pas encore d'authentification ni de mandat par profil ; ils restent destinés au développement local avant mise en production.

## Validation et état

Tests sur serveur PostgreSQL temporaire avec données synthétiques : premier import, jointures, réimport sans doublons, référentiels conservés, absence de copie brute persistante, rollback après quantités invalides, lecture API avec SOURCE_DB_HOST volontairement inaccessible.
Compilation NestJS et tests de configuration vérifiés sans captures.

Accès source et destination rétablis le 6 octobre 2026. Premier import réel réussi : run 3, publié à 14 h 33, heure de Douala.
Volumes extraits : 133 973 équipements BI, 7 464 comptes, 210 164 périodes, 60 182 cycles de vie, 402 712 lignes de stock journalier.
Stock local présent dans le CRM : 27 219 INSTOCK et 6 822 DEFECTIVE, soit 34 041 équipements. 99 760 sont DEPLOYED.
Les référentiels locaux étant encore à valider, les familles/territoires restent non classés et les 27 219 disponibilités INSTOCK non confirmées. Ne pas les présenter comme des zéros métier.
Les essais HTTP des endpoints DG passent avec une adresse source volontairement inaccessible. Aucune copie brute permanente ne subsiste.
Le frontend conserve sa présentation et ses données de démonstration jusqu'au branchement explicite des écrans ; le backend DG est prêt, voir DG-API.md.
Deux tentatives ont été annulées avant ce succès : coupure réseau, puis indicateur nullable pour séries BI sans statut CRM. Gestion réseau et calcul corrigés, cas de régression testé.
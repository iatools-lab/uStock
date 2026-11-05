# upOwa — visibilité et traçabilité du stock

Démonstration React/Vite fondée sur une base unique de 1 440 kits et leur historique. Les chiffres sont fictifs, arrêtés au 21 septembre 2026 ; UPYA n’est pas connecté.

## Démarrer

- `npm install` (ou `npm ci` pour respecter le fichier de verrouillage)
- `npm run dev`
- `npm run build` pour compiler
- `npm test` pour les règles métier
- `npm run test:render` pour le rendu React des cinq routes

## Profils

| Route | Profil |
|---|---|
| /directeur | DG |
| /dc | Directeur Commercial |
| /supply-chain | Supply Chain |
| /am | AM Centre, périmètre fictif limité |
| /it | IT, couverture des données de démonstration |

Les profils sont accessibles par leurs routes ; le sélecteur de démonstration a été retiré. Aucune authentification ni autorisation serveur n’est implémentée.

## Fonctions disponibles

La vue d’ensemble affiche uniquement filtres, KPI et graphiques. Les tableaux et dossiers restent dans les menus détaillés. Chaque menu possède une icône dédiée.

- Bouton Filtres en haut à droite sur toutes les pages : zone, région, département, ville, AM, boutique, agent ; type produit indépendant.
- Indicateurs et ventilations calculés depuis les mêmes kits pour tous les profils.
- Disponible, défauts, réparation, quarantaine, réservations, vendu, perdu et réformé.
- Historique de réception, transferts enregistrés, vente/livraison, défauts et retours.
- Recherche avec résultats multiples, pagination et fiche accessible par clavier.
- Comptages, identifiants manquants/inattendus et alertes sans compensation des écarts.
- Courbes reconstituées à partir des événements, avec valeurs tabulaires.
- Alertes d’immobilisation, qualité, écarts et faible disponibilité.
- Cinq menus DG : vue exécutive, stock national, risques et exceptions, traçabilité, performance.
- Filtres conservés dans l’URL lors de la navigation ; liens partageables dans la démonstration.
- Performance par région/AM/boutique, fenêtres de ventes 30/60/90/180 jours et formules explicites.
- Sidebar repliable en icônes, libellés accessibles et défilement discret.
- Stock national : cartes géographiques et par détenteur, sans tableaux ; les kits non rattachés à une boutique/agent restent comptés à part.
- Risques : uniquement retours SAV ouverts, endommagés et réparations, avec historique par kit.
- Directeur Commercial : disponibilité, réseau, couverture et besoins, ventes et conversion, stock dormant et réallocation, alertes, rapports exportables.
- Menus IT préparés avec pages « À venir », vues d’ensemble existantes conservées.

La boutique inclut ses agents. Le central n’a pas d’AM ni de boutique. La position correspond au dernier détenteur enregistré ; aucun état intermédiaire n’est déduit. Les zones et affectations doivent être remplacées par le référentiel officiel. Un kit manquant demeure dans le théorique mais sort du disponible.

## Structure active

- `src/domain/stock.js` : référentiels, génération déterministe, transitions, filtres, agrégations, comptages et alertes.
- `src/pages/StockDashboard.jsx` : vues configurées par profil.
- `src/components/` : filtres, graphiques, listes et chronologie.
- `src/styles/operations.css`, `tracking.css` : styles partagés.
- `tests/` : contrôles métier et rendu.
- `docs/CONCEPTION-METIER.md` : définitions, règles, matrice de rôles, menus proposés, sources et contrat UPYA à confirmer.

Les fichiers sous `src/roles/` et `src/styles/dg.css` sont les anciennes maquettes, conservées comme référence ; ils ne sont plus importés par l’application active. Leurs jeux fictifs indépendants n’alimentent plus aucun dashboard.

## Limites et suite

Pas de formulaire de transfert, scan caméra, persistance serveur, API UPYA ni traitement réel des alertes. La préférence de sidebar réduite est conservée dans le navigateur. Le moteur local vérifie des transitions de démonstration ; les transactions, autorisations et approbations définitives devront être implémentées côté serveur. Le document métier distingue les fonctions livrées du backlog proposé.

Les pages DG sont `/directeur`, `/directeur/stock-national`, `/directeur/risques`, `/directeur/tracabilite`, `/directeur/performance`. En hébergement statique, prévoir le renvoi des routes applicatives vers `index.html`.
Les interfaces commerciales sont accessibles depuis `/dc`. Les besoins préparés, propositions retenues et marquages de suivi restent locaux à la page et sont réinitialisés en changeant de menu ou de périmètre. Les rapports JSON/CSV sont téléchargeables et la synthèse imprimable. Les KPI de ventes et leurs courbes utilisent la même fenêtre glissante et le rattachement actuel des kits. Les seuils de couverture sont des hypothèses de démonstration, ajustables dans la page dédiée.

Les neuf menus Supply Chain sont disponibles sous /supply-chain : stock, commandes illustratives, réceptions, transferts enregistrés, détention, inventaires, SAV, besoins et journal exportable. Les flux sont filtrés selon le lieu historique de l’opération. Les mouvements réels et ajustements serveur restent à connecter.

Les huit menus Area Manager sont disponibles sous /am, limités à AM Centre dans la démonstration : stock, boutiques, agents, transferts, demandes, qualité, inventaires et suivi des alertes. Les demandes et notes de suivi sont locales à la page. L’authentification et les autorisations serveur restent à implémenter.

Les quatre menus détaillés du DG sont également disponibles sous `/dc` et `/supply-chain`, en complément de leurs menus spécialisés. Le menu Risques et exceptions affiche un tableau de kits avec recherche, filtre, pagination et historique. Les tests navigateur (`node tests/browser-review.mjs`, après compilation) ne produisent plus de captures d’écran.

Le DC est désormais organisé en six menus, avec onglets, KPI en kits, courbe de ventes et histogrammes simples. Les anciens liens redirigent vers les menus regroupés. Les risques disposent de quatre KPI de synthèse au-dessus du tableau. La Supply Chain conserve son organisation actuelle.


Supply Chain : six menus simplifiés avec onglets. Approvisionnements et réceptions exclus. Les anciennes rubriques regroupées redirigent vers Stock, Distribution, SAV ou Journal ; les filtres sont conservés. Vue d’ensemble sans tableau, avec KPI de stock, disponible, écarts et qualité.


Carte du stock : `/directeur/carte`, `/dc/carte`, `/supply-chain/carte`. Sélection et zoom par lieu, compteurs ouvrant le mix produit. Le fond est embarqué ; les repères de boutiques sont approximatifs (centre de ville), à remplacer par un référentiel GPS validé. Source et licence dans `src/data/CARTOGRAPHY.md`.

Le stock géographique ouvre le mix produit dès le clic sur un lieu ; le bouton Explorer poursuit la hiérarchie. Cette interaction est partagée entre DG, DC, Supply Chain et AM. La navigation DG ne contient plus Risques et exceptions ni Traçabilité. Les tests continuent sans capture d’écran.

DC : disponibilité par région, Performance du territoire à l’agent, besoins calculés selon les volumes vendus par produit et lieu, SAV agrégé. Les numéros de série et historiques individuels sont uniquement dans Traçabilité. Le stock de l’entrepôt central est distinct du terrain dans les répartitions nationales, cartes et agrégats concernés. Les besoins sans ventes observées sont non estimables ; aucun seuil minimal n’est inventé.

DC corrigé : disponibilité en cartes produit (terrain, entrepôt central, défectueux), performance par onglets d’acteurs sans courbe d’évolution, besoins calculés en boutique puis additionnés aux niveaux parents, SAV en cartes hiérarchiques sans histogramme. Ville retiré des niveaux et filtres. Le central reste visible uniquement dans Zone dans la localisation du DC. Tests sans captures d’écran.

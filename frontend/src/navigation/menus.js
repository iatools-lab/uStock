export const ROLE_ROUTES = { dg: '/directeur', dc: '/dc', supply: '/supply-chain', am: '/am', it: '/it' };
const entries = rows => rows.map(([path, label]) => ({ path, label }));
export const MENUS = {
  dg: entries([['', 'Vue exécutive'], ['stock-national', 'Stock national'], ['carte', 'Carte du stock'], ['performance', 'Performance par zone'], ['previsions', 'Prévisions de besoins'], ['analytique', 'Analytique']]),
  dc: entries([['', 'Vue d’ensemble'], ['disponibilite', 'Stock et disponibilité'], ['carte', 'Carte du stock'], ['reseau', 'Performance'], ['couverture', 'Besoins de stock'], ['risques', 'SAV et kits endommagés'], ['tracabilite', 'Traçabilité des kits']]),
  supply: entries([['', 'Vue d’ensemble'], ['stock', 'Stock et détention'], ['carte', 'Carte du stock'], ['distribution', 'Distribution et besoins'], ['inventaires', 'Inventaires et écarts'], ['sav', 'SAV et kits endommagés'], ['journal', 'Traçabilité et justificatifs']]),
  am: entries([['', 'Vue d’ensemble'], ['stock', 'Mon stock'], ['boutiques', 'Mes boutiques'], ['agents', 'Mes agents'], ['transferts', 'Mes transferts'], ['demandes', 'Mes demandes de stock'], ['defauts', 'Défauts et retours'], ['inventaires', 'Inventaires et écarts'], ['alertes', 'Mes alertes et actions']]),
  it: entries([['', 'Vue d’ensemble'], ['integrations', 'Santé des intégrations'], ['synchronisations', 'Synchronisations et reprises'], ['qualite', 'Qualité des données'], ['referentiels', 'Référentiels'], ['habilitations', 'Utilisateurs et habilitations'], ['journal', 'Journal technique et audit'], ['parametres', 'Paramètres de supervision']])
};

// Les vues détaillées de direction sont communes aux trois profils nationaux.
export const SHARED_DIRECTOR_PATHS = ['stock-national', 'risques', 'tracabilite', 'performance'];

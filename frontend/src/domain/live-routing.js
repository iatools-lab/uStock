export const LIVE_VIEWS = {
  dg: { '':'overview', 'stock-national':'stock', carte:'map', performance:'performance' },
  dc: { '':'overview', disponibilite:'availability', carte:'map', reseau:'performance', couverture:'needs', risques:'quality', tracabilite:'assets' },
  supply: { '':'overview', stock:'stock', carte:'map', distribution:'needs', inventaires:'inventory', sav:'quality', journal:'assets' },
  am: { '':'overview', stock:'stock', boutiques:'actors', agents:'actors', transferts:'transfers', demandes:'needs', defauts:'quality', inventaires:'inventory', alertes:'alerts' },
  it: { '':'technical', integrations:'technical', synchronisations:'technical', qualite:'technical', referentiels:'references', habilitations:'permissions', journal:'technical', parametres:'technical' },
};
export function liveView(role, menu) { return LIVE_VIEWS[role]?.[menu] ?? null; }
export const LIVE_LEVELS = [['zone','Zone'],['region','Région'],['department','Département'],['arrondissement','Arrondissement'],['amId','AM'],['shopId','Boutique'],['holderId','Détenteur']];

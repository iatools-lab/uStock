export const LIVE_VIEWS = {
  dg: { '':'overview', 'stock-national':'stock', carte:'map', performance:'performance', previsions:'forecast', analytique:'analytics' },
};
export function liveView(role, menu) { return LIVE_VIEWS[role]?.[menu] ?? null; }
export const LIVE_LEVELS = [['zone','Zone'],['region','Région'],['department','Département'],['arrondissement','Arrondissement'],['amId','AM'],['shopId','Boutique'],['holderId','Détenteur']];

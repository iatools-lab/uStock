export const ROLE_ROUTES = { dg: '/directeur' };
const entries = rows => rows.map(([path, label]) => ({ path, label }));
export const MENUS = {
  dg: entries([['', 'Vue exécutive'], ['stock-national', 'Stock national'], ['carte', 'Carte du stock'], ['performance', 'Comparaison des performances'], ['previsions', 'Prévisions de besoins'], ['analytique', 'Analytique']]),
};


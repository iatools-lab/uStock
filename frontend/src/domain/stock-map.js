import { stockDistribution } from './director-views.js';

// Repères de démonstration [longitude, latitude], proches des centres-villes.
// Ce ne sont PAS les positions GPS des boutiques ou des agents.
export const CITY_POINTS = {
  'Yaoundé': [11.52, 3.87], 'Mfou': [11.64, 3.72], 'Awaé': [11.90, 3.98],
  'Douala': [9.70, 4.05], 'Nkongsamba': [9.94, 4.95], 'Loum': [9.74, 4.72],
  'Bafoussam': [10.42, 5.48], 'Dschang': [10.05, 5.45], 'Santchou': [9.97, 5.28],
  'Maroua': [14.32, 10.59], 'Kousséri': [15.03, 12.08], 'Makary': [14.45, 12.57],
  'Garoua': [13.40, 9.30], 'Guider': [13.95, 9.93], 'Figuil': [14.11, 9.76],
  'Ngaoundéré': [13.58, 7.33], 'Meiganga': [14.29, 6.52], 'Djohong': [14.70, 6.84],
  'Bertoua': [13.68, 4.58], 'Batouri': [14.36, 4.43], 'Kenzou': [14.89, 4.09],
  'Ebolowa': [11.15, 2.92], 'Kribi': [9.91, 2.94], 'Campo': [9.82, 2.37]
};
export const REGION_NAMES = { 'Far North': 'Extrême-Nord', North: 'Nord', 'North-West': 'Nord-Ouest', East: 'Est', South: 'Sud', 'South-West': 'Sud-Ouest', West: 'Ouest' };
export const REGION_ZONES = { Centre: 'Centre-Sud', Sud: 'Centre-Sud', Littoral: 'Littoral-Ouest', Ouest: 'Littoral-Ouest', Nord: 'Grand Nord', 'Extrême-Nord': 'Grand Nord', Adamaoua: 'Grand Nord', Est: 'Est' };
export const ZONE_COLORS = { 'Centre-Sud': '#2457a7', 'Littoral-Ouest': '#2b9b95', 'Grand Nord': '#df8244', Est: '#8874bb' };
export const project = ([lon, lat]) => [lon * 100 * Math.cos(7 * Math.PI / 180), -lat * 100];
export function geometryRings(geometry) { return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat(); }
export function geometryPoints(geometry) { return geometryRings(geometry).flat().map(project); }
export function geometryPath(geometry) {
  return geometryRings(geometry).map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${project(p).map(n => n.toFixed(2)).join(',')}`).join(' ') + 'Z').join(' ');
}
export function fitMap(points, minimum = 35) {
  if (!points.length) return [820, -1360, 1060, 795];
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const height = Math.max(minimum, (bottom - top) * 1.3, (right - left) * 1.3 * .75);
  const width = height * 4 / 3;
  return [(left + right - width) / 2, (top + bottom - height) / 2, width, height];
}
export function rowPoints(row, field, features) {
  if (field === 'zone' || field === 'region') {
    const relevant = features.filter(f => field === 'region' ? f.name === row.id : REGION_ZONES[f.name] === row.id);
    if (relevant.length) return relevant.flatMap(f => geometryPoints(f.geometry));
  }
  return [...new Set(row.kits.map(k => k.city))].flatMap(city => CITY_POINTS[city] ? [project(CITY_POINTS[city])] : []);
}
export function mapStock(selected, field, trail = [], features = []) {
  const { scoped, rows } = stockDistribution(selected, field, trail);
  const mapped = [], unlocated = [];
  for (const row of rows) {
    const points = rowPoints(row, field, features);
    if (!points.length) { unlocated.push(row); continue; }
    const [x, y, w, h] = fitMap(points);
    mapped.push({ ...row, point: [x + w / 2, y + h / 2], points });
  }
  // Boutiques d'une même ville : un seul compteur, jamais des marqueurs superposés.
  const groups = new Map();
  for (const row of mapped) {
    const key = row.point.map(n => n.toFixed(3)).join(',');
    if (!groups.has(key)) groups.set(key, { key, point: row.point, rows: [], kits: [], active: 0 });
    const group = groups.get(key); group.rows.push(row); group.kits.push(...row.kits); group.active += row.active;
  }
  return { scoped, rows, mapped, unlocated, markers: [...groups.values()] };
}
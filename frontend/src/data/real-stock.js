// Contrat du frontend : aucune donnée de démonstration ne sert de secours.
export const METRICS = [
  ['active', 'Stock suivi'], ['available', 'Disponible confirmé'],
  ['availabilityUnconfirmed', 'Disponibilité à confirmer'], ['defective', 'Défectueux'],
  ['deployed', 'Déployés à date'], ['sales', 'Ventes sur la période'],
];
export function quantity(value) {
  if (value === null || value === undefined) return 'Non renseigné';
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value)) || (typeof value === 'number' && !Number.isSafeInteger(value))) throw new Error('Quantité invalide');
  return BigInt(value).toLocaleString('fr-FR');
}
export function validateSnapshot(data) {
  if (!data || data.schemaVersion !== 1 || data.source !== 'ukit' || !data.sourceLoadedAt || !Number.isFinite(Date.parse(data.sourceLoadedAt))) throw new Error('Source ou date des données invalide');
  if (!data.scope || typeof data.scope.label !== 'string' || typeof data.scope.authorized !== 'boolean') throw new Error('Périmètre absent');
  if (!['complete', 'partial'].includes(data.coverage?.status) || typeof data.coverage?.note !== 'string') throw new Error('Couverture absente');
  if (!data.metrics || typeof data.metrics !== 'object') throw new Error('Indicateurs absents');
  for (const [key] of METRICS) {
    const metric = data.metrics[key];
    if (!metric || !['known', 'partial', 'unavailable'].includes(metric.status) || typeof metric.reason !== 'string') throw new Error('Indicateur incomplet : ' + key);
    if (metric.status === 'unavailable' && metric.value !== null) throw new Error('Une mesure indisponible doit être null');
    if (metric.status !== 'unavailable' && metric.value == null) throw new Error('Valeur absente : ' + key);
    quantity(metric.value);
  }
  if (!Array.isArray(data.products) || !Array.isArray(data.custody) || !Array.isArray(data.assets?.rows) || typeof data.assets.hasMore !== 'boolean') throw new Error('Répartitions ou liste absentes');
  for (const rows of [data.products, data.custody]) {
    const keys = new Set();
    for (const row of rows) {
      if (typeof row.key !== 'string' || keys.has(row.key) || typeof row.label !== 'string' || row.quantity == null) throw new Error('Répartition invalide');
      keys.add(row.key); quantity(row.quantity);
    }
    const total=data.metrics.total||data.metrics.active;
    if (total.status === 'known' && rows.reduce((sum, row) => sum + BigInt(row.quantity), 0n) !== BigInt(total.value)) throw new Error('Répartition différente du parc analysé');
  }
  const ids = new Set();
  for (const asset of data.assets.rows) {
    if (typeof asset.serialNumber !== 'string' || !asset.serialNumber || ids.has(asset.serialNumber)) throw new Error('Identifiant équipement invalide');
    ids.add(asset.serialNumber);
    if (!['available', 'unavailable', 'unconfirmed'].includes(asset.availability)) throw new Error('Disponibilité absente');
    if (asset.periods != null && !Array.isArray(asset.periods)) throw new Error('Périodes invalides');
  }
  return data;
}
export async function loadSnapshot(endpoint, { role, page, filters = {}, view, level, days, signal, fetcher = fetch }) {
  if (!endpoint) throw new Error('La source de données réelles reste à configurer.');
  const url = new URL(endpoint, globalThis.location?.origin || 'http://localhost');
  if (url.origin !== (globalThis.location?.origin || 'http://localhost')) throw new Error('La source doit utiliser la même origine que le site.');
  url.searchParams.set('role', role); url.searchParams.set('page', String(page));
  for (const key of ['date', 'startDate', 'endDate', 'granularity', 'product', 'region', 'zone', 'department', 'arrondissement', 'amId', 'shopId', 'holderId', 'holderKind', 'status', 'search']) if (filters[key]) url.searchParams.set(key, filters[key]);
  for (const [key,value] of Object.entries({view,level,days})) if(value) url.searchParams.set(key,String(value));
  const response = await fetcher(url.pathname + url.search, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Données indisponibles (${response.status}).`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('La source ne renvoie pas de JSON.');
  return validateSnapshot(await response.json());
}

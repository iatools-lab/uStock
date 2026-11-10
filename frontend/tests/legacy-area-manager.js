import { DEMO_AM, selectKits, selectInventories, buildAlerts } from './legacy-stock.js';
import { networkRows } from './legacy-commercial.js';
import { supplyEvents } from './legacy-supply.js';

export function areaData(filters = {}) {
  const denied = Boolean(filters.amId && filters.amId !== DEMO_AM);
  const scope = { ...filters, amId: DEMO_AM };
  const selected = denied ? [] : selectKits('am', scope);
  const counts = denied ? [] : selectInventories('am', scope);
  const shops = denied ? [] : networkRows(selected, scope, 'shop').map(r => r.location);
  return { denied, scope, selected, counts, shops, alerts: buildAlerts(selected, counts, shops) };
}
export function areaTransfers(filters = {}, days = 0) {
  if (filters.amId && filters.amId !== DEMO_AM) return [];
  return supplyEvents({ ...filters, amId: DEMO_AM }, 'transfer', days);
}
export function areaActors(filters = {}, type = 'shop') {
  const data = areaData(filters);
  return data.denied ? [] : networkRows(data.selected, data.scope, type);
}

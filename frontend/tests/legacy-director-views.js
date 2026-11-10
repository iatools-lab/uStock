import { AS_OF, isAvailable, locationLabel, summarize } from './legacy-stock.js';

export const STOCK_LEVELS = [['zone', 'Zone'], ['region', 'Région'], ['department', 'Département'], ['shopId', 'Boutique'], ['agentId', 'Agent']];
export const CENTRAL_BUCKET = '__central__';
const labels = { shopId: 'Stock hors boutiques', agentId: 'Stock hors agents' };
export function stockDistribution(selected, field, trail = []) {
  const scoped = selected.filter(k => k.lifecycle === 'in_stock' && trail.every(step => step.value === CENTRAL_BUCKET ? k.holderId === 'central' : k.holderId !== 'central' && (k[step.field] || '') === step.value));
  const groups = new Map();
  for (const kit of scoped) {
    const value = kit.holderId === 'central' ? CENTRAL_BUCKET : kit[field] || '';
    if (!groups.has(value)) groups.set(value, { id: value, central: value === CENTRAL_BUCKET, name: value === CENTRAL_BUCKET ? 'Entrepôt central' : value ? (['amId', 'shopId', 'agentId'].includes(field) ? locationLabel(value) : value) : labels[field] || 'Non renseigné', kits: [], active: 0, available: 0, damaged: 0 });
    const row = groups.get(value); row.kits.push(kit); row.active++;
    if (isAvailable(kit)) row.available++;
    if (kit.condition !== 'good') row.damaged++;
  }
  return { scoped, rows: [...groups.values()].sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'fr')) };
}

// Répartition nationale : l'entrepôt est affiché séparément du stock terrain.
export function territorySummary(selected, field, counts = []) {
  return stockDistribution(selected, field).rows.map(row => ({
    ...row,
    ...summarize(row.kits, counts.filter(c => row.central ? c.holderId === 'central' : c.holderId !== 'central' && (c[field] || '') === row.id))
  }));
}

// Un historique de retour n'est pas un SAV ouvert après remise en bon état.
export function serviceCases(selected) {
  return selected.filter(k => k.lifecycle === 'in_stock').flatMap(kit => {
    const lastReturn = kit.history.findLast(e => e.type === 'return');
    const lastRestore = kit.history.findLast(e => e.type === 'restore');
    const returned = !!lastReturn && kit.condition !== 'good' && (!lastRestore || Date.parse(lastReturn.at) > Date.parse(lastRestore.at));
    const damaged = kit.condition === 'defective';
    const inRepair = kit.condition === 'repair';
    if (!returned && !damaged && !inRepair) return [];
    const event = kit.history.findLast(e => ['defect', 'repair', 'return'].includes(e.type));
    return [{ ...kit, returned, damaged, inRepair, serviceEvent: event, reason: event?.reason || 'Motif non renseigné', daysOpen: event ? Math.max(0, Math.floor((Date.parse(AS_OF) - Date.parse(event.at)) / 86400000)) : null }];
  });
}

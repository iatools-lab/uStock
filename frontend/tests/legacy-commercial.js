import { AS_OF, PRODUCTS, locations, locationById, isAvailable, matches, summarize } from './legacy-stock.js';
import { saleFacts, stockTarget } from './legacy-commercial-planning.js';
const DAY = 86400000;
export const elapsedDays = at => Math.max(0, Math.floor((Date.parse(AS_OF) - Date.parse(at)) / DAY));

export function commercialSales(selected, days = 90) {
  const start = Date.parse(AS_OF) - days * DAY;
  const within = e => Date.parse(e.at) >= start && Date.parse(e.at) <= Date.parse(AS_OF);
  const sales = [], returns = [], cohort = [];
  for (const kit of selected) {
    const assignments = kit.history.filter(e => e.type === 'transfer' && locationById[e.to]?.type === 'agent');
    for (const e of kit.history.filter(e => e.type === 'sell' && within(e))) {
      const assignment = assignments.findLast(a => a.at <= e.at);
      sales.push({ kit, event: e, delay: assignment ? (Date.parse(e.at) - Date.parse(assignment.at)) / DAY : null });
    }
    returns.push(...kit.history.filter(e => e.type === 'return' && within(e)).map(event => ({ kit, event })));
    const assigned = assignments.find(within);
    if (assigned) cohort.push({ kit, sold: kit.history.some(e => e.type === 'sell' && e.at >= assigned.at && e.at <= AS_OF) });
  }
  const delays = sales.map(s => s.delay).filter(v => v !== null);
  return { sales, returns, cohort, converted: cohort.filter(c => c.sold).length, conversion: cohort.length ? cohort.filter(c => c.sold).length / cohort.length * 100 : null, delay: delays.length ? delays.reduce((n, d) => n + d, 0) / delays.length : null };
}
export function coverageRows(selected, filters, days = 90, targetDays = 30) {
  const facts = saleFacts(filters, days);
  const shops = locations.filter(l => l.type === 'shop' && matches({ ...l, product: filters.product, agentId: filters.agentId }, filters) && (!filters.agentId || locationById[filters.agentId]?.shopId === l.id));
  return shops.flatMap(shop => (filters.product ? [filters.product] : PRODUCTS).map(product => {
    const members = selected.filter(k => k.shopId === shop.id && k.product === product);
    const available = members.filter(isAvailable).length, sales = facts.filter(f => f.shopId === shop.id && f.product === product).length;
    const target = stockTarget(sales, days, targetDays);
    return { id: `${shop.id}|${product}`, shop, product, kits: members, available, sales, target, need: target === null ? null : Math.max(0, target - available), surplus: target === null ? 0 : Math.max(0, available - target), coverage: sales ? available / (sales / days) : null };
  }));
}
export function allocationSuggestions(rows) {
  const budget = new Map(rows.map(r => [r.id, r.surplus]));
  const suggestions = [];
  for (const target of rows.filter(r => r.need > 0).sort((a, b) => b.need - a.need)) {
    let need = target.need;
    for (const source of rows.filter(r => r.product === target.product && r.shop.id !== target.shop.id).sort((a, b) => b.surplus - a.surplus)) {
      const quantity = Math.min(need, budget.get(source.id));
      if (!quantity) continue;
      suggestions.push({ id: `${source.id}>${target.id}`, source, target, product: target.product, quantity });
      budget.set(source.id, budget.get(source.id) - quantity); need -= quantity;
      if (!need) break;
    }
  }
  return suggestions;
}
export function networkRows(selected, filters, type) {
  const eligible = locations.filter(l => matches({ ...l, product: filters.product }, filters));
  return locations.filter(l => l.type === type && eligible.some(child => type === 'agent' ? child.id === l.id : child[type === 'am' ? 'amId' : 'shopId'] === l.id)).map(location => {
    const field = type === 'am' ? 'amId' : type === 'shop' ? 'shopId' : 'holderId';
    const members = selected.filter(k => k[field] === location.id), total = summarize(members);
    return { location, members, ...total, direct: members.filter(k => k.holderId === location.id && k.lifecycle === 'in_stock').length };
  }).sort((a, b) => b.active - a.active);
}
export function salesSeries(selected, days) {
  const data = commercialSales(selected, days), buckets = new Map();
  const start = new Date(Date.parse(AS_OF) - days * DAY);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= new Date(AS_OF)) {
    buckets.set(cursor.toISOString().slice(0, 7), { month: cursor.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }), sales: 0, returns: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const field of ['sales', 'returns']) for (const row of data[field]) buckets.get(row.event.at.slice(0, 7))[field]++;
  return [...buckets.values()];
}
export function commercialAlerts(selected, rows) {
  const dormant = selected.filter(k => isAvailable(k) && elapsedDays(k.updatedAt) > 30);
  return [
    ...rows.filter(r => r.available === 0).map(r => ({ id: `empty-${r.id}`, title: `${r.shop.name} · ${r.product}`, reason: 'Aucun kit disponible', owner: r.shop.amId, kits: r.kits, priority: 'Haute' })),
    ...rows.filter(r => r.available > 0 && r.need > 0).map(r => ({ id: `low-${r.id}`, title: `${r.shop.name} · ${r.product}`, reason: `Besoin indicatif : ${r.need} kits`, owner: r.shop.amId, kits: r.kits, priority: 'Moyenne' })),
    ...locations.filter(l => l.type === 'agent').flatMap(agent => {
      const kits = dormant.filter(k => k.holderId === agent.id);
      return kits.length ? [{ id: `dormant-${agent.id}`, title: agent.name, reason: `${kits.length} kits disponibles sans mouvement depuis plus de 30 jours`, owner: agent.amId, kits, priority: 'Moyenne' }] : [];
    })
  ];
}
export function exportCommercial(selected, filters, days) {
  const sales = commercialSales(selected, days);
  return { title: 'Situation commerciale upOwa — démonstration', asOf: AS_OF, filters, windowDays: days, scope: 'Rattachement actuel des kits, central inclus si non filtré', totals: summarize(selected), sales: sales.sales.length, returns: sales.returns.length, cohort: sales.cohort.length, converted: sales.converted, conversion: sales.conversion, averageAssignmentToSaleDays: sales.delay, kits: selected.map(k => ({ id: k.id, product: k.product, region: k.region, city: k.city, holder: k.holder, status: k.lifecycle, condition: k.condition, available: isAvailable(k), updatedAt: k.updatedAt })) };
}
export function csv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const quote = value => { const raw = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(raw) ? "'" : '') + raw.replaceAll('"', '""')}"`; };
  return '\uFEFF' + [keys.map(quote).join(';'), ...rows.map(r => keys.map(k => quote(r[k])).join(';'))].join('\r\n');
}

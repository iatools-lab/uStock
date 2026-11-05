import { AS_OF, isAvailable, groupStock, kits, summarize, locationLabel } from './stock.js';
import { saleFacts } from './commercial-planning.js';

const DAY = 86400000;
export const ageDays = at => Math.floor((Date.parse(AS_OF) - Date.parse(at)) / DAY);
export function networkPerformance(selected, counts, days = 30, field = 'region', filters = null) {
  const facts = saleFacts(filters || {}, days, filters ? kits : selected);
  const rows = groupStock(selected, counts, field);
  for (const fact of facts) {
    const id = fact[field];
    if (id && !rows.some(row => row.id === id)) rows.push({ id, name: locationLabel(id), ...summarize([]) });
  }
  return rows.map(row => {
    const members = selected.filter(k => k[field] === row.id);
    const sales = facts.filter(fact => fact[field] === row.id);

    const active = members.filter(k => k.lifecycle === 'in_stock');
    return { ...row, sales: sales.length, dailySales: sales.length / days, availability: row.active ? row.available / row.active * 100 : null,
      dormant: members.filter(k => isAvailable(k) && ageDays(k.updatedAt) > 30).length,
      age: active.length ? active.reduce((n, k) => n + ageDays(k.receivedAt), 0) / active.length : null,
      coverage: sales.length ? row.available / (sales.length / days) : null };
  });
}


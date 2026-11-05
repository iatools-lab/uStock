import { kits, AS_OF, locationById, locations, matches, PRODUCTS, isAvailable, locationLabel } from './stock.js';
export const COMMERCIAL_LEVELS = [['zone', 'Zone'], ['region', 'Région'], ['department', 'Département'], ['amId', 'AM'], ['shopId', 'Boutique'], ['agentId', 'Agent']];
const DAY = 86400000;
export function stockTarget(sold, days, horizon) {
  return sold > 0 ? Math.ceil(sold / days * horizon) : null;
}

// Le vendeur est celui de l'événement de vente, même si le kit a été retourné ensuite.
export function saleFacts(filters = {}, days = 90, source = kits) {
  const start = Date.parse(AS_OF) - days * DAY, end = Date.parse(AS_OF);
  return source.flatMap(kit => {
    let holder = null;
    const rows = [];
    for (const event of kit.history) {
      if (event.to) holder = locationById[event.to];
      if (event.type !== 'sell' || Date.parse(event.at) < start || Date.parse(event.at) > end) continue;
      const fact = { ...holder, product: kit.product, kitId: kit.id, eventId: event.id, at: event.at };
      if (matches(fact, filters)) rows.push(fact);
    }
    return rows;
  });
}
export function salesRanking(facts, field) {
  const groups = new Map();
  for (const fact of facts) {
    const id = fact[field] || '';
    if (!groups.has(id)) groups.set(id, { id, name: locationLabel(id) || 'Non rattaché', value: 0 });
    groups.get(id).value++;
  }
  const rows = [...groups.values()].sort((a,b) => b.value - a.value || a.name.localeCompare(b.name, 'fr'));
  let rank = 0, last = null;
  return rows.map((row,i) => { if (row.value !== last) rank = i + 1; last = row.value; return { ...row, rank }; });
}
export function saleTrend(facts, days) {
  const start = new Date(Date.parse(AS_OF) - days * DAY), cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)), buckets = new Map();
  while (cursor <= new Date(AS_OF)) {
    buckets.set(cursor.toISOString().slice(0,7), { month: cursor.toLocaleDateString('fr-FR', { month:'short', timeZone:'UTC' }), sales:0 });
    cursor.setUTCMonth(cursor.getUTCMonth()+1);
  }
  for (const fact of facts) if (buckets.has(fact.at.slice(0,7))) buckets.get(fact.at.slice(0,7)).sales++;
  return [...buckets.values()];
}

export const NEED_LEVELS = COMMERCIAL_LEVELS.filter(([field])=>field !== 'agentId');
export function demandFilters(filters) {
  const agent = filters.agentId ? locationById[filters.agentId] : null;
  return { ...filters, agentId:'', ...(agent && !filters.shopId ? { shopId:agent.shopId } : {}) };
}
export function demandByPlace(selected, filters, field, days = 90, horizon = 30, source = kits) {
  if (!NEED_LEVELS.some(([key])=>key===field)) return [];
  const scope = demandFilters(filters), sales = saleFacts(scope,days,source);
  const shops = locations.filter(l=>l.type==='shop' && matches({...l,product:scope.product},scope));
  const products = scope.product ? [scope.product] : PRODUCTS;
  const groups = new Map();
  for (const shop of shops) {
    const id = shop[field];
    if (!id) continue;
    if (!groups.has(id)) groups.set(id,{id,name:locationLabel(id),shopIds:[],rows:products.map(product=>({product,sold:0,available:0,target:0,need:0,unknown:0,known:0}))});
    const group = groups.get(id); group.shopIds.push(shop.id);
    for (const row of group.rows) {
      const sold = sales.filter(f=>f.shopId===shop.id&&f.product===row.product).length;
      const available = selected.filter(k=>k.shopId===shop.id&&k.product===row.product&&matches(k,scope)&&isAvailable(k)).length;
      const target = stockTarget(sold, days, horizon);
      row.sold += sold; row.available += available;
      if (target === null) row.unknown++; else { row.known++; row.target += target; row.need += Math.max(0,target-available); }
    }
  }
  return [...groups.values()].map(group=>({
    ...group, rows:group.rows.map(row=>({...row,target:row.known?row.target:null,need:row.known?row.need:null})),
    need:group.rows.reduce((n,r)=>n+r.need,0), sales:group.rows.reduce((n,r)=>n+r.sold,0)
  })).sort((a,b)=>b.need-a.need || b.sales-a.sales || a.name.localeCompare(b.name,'fr'));
}

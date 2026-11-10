import test from 'node:test';
import assert from 'node:assert/strict';
import { kits } from './legacy-stock.js';
import { supplyEvents, supplyOrders } from './legacy-supply.js';
test('Les réceptions centrales réconcilient exactement le parc et les commandes', () => {
  assert.equal(supplyEvents({}, 'receive').length, kits.length);
  assert.equal(supplyOrders().reduce((n, r) => n + r.received, 0), kits.length);
  for (const r of supplyOrders()) assert.equal(r.ordered, r.received + r.remaining);
  assert.equal(supplyOrders({ amId: 'am-0' }).length, 0);
});
test('Les flux suivent la destination historique et les filtres produit et date', () => {
  const rows = supplyEvents({ shopId: 'shop-0-2', product: 'SmartSun M' }, 'transfer');
  assert.ok(rows.length);
  assert.ok(rows.every(e => e.place.shopId === 'shop-0-2' && e.product === 'SmartSun M'));
  assert.equal(supplyEvents({ region: 'Ouest' }, 'receive').length, 0);
  assert.ok(supplyEvents({}, '', 30).every(e => Date.parse(e.at) >= Date.parse('2026-09-21T10:00:00Z') - 30 * 86400000));
  assert.equal(new Set(supplyEvents().map(e => e.id)).size, supplyEvents().length);
});

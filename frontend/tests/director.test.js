import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, selectKits, selectInventories, summarize, AS_OF } from './legacy-stock.js';
import { networkPerformance } from './legacy-director.js';
import { MENUS, ROLE_ROUTES } from '../src/navigation/menus.js';

test('les menus des profils sont uniques et la carte respecte le périmètre demandé', () => {
  assert.equal(MENUS.dg.length, 6);
  assert.deepEqual(Object.keys(MENUS),['dg']);
  assert.ok(!MENUS.dg.some(m => ['risques', 'tracabilite'].includes(m.path)));
  assert.ok(MENUS.dg.some(m => m.path === 'carte'));
  for (const role of Object.keys(ROLE_ROUTES)) {
    assert.equal(new Set(MENUS[role].map(m => m.path)).size, MENUS[role].length);
    assert.equal(MENUS[role][0].path, '');
  }
});
test('performance : agrégations explicables, absence de vente non extrapolée', () => {
  const kits = selectKits('dg'), counts = selectInventories('dg');
  const rows = networkPerformance(kits, counts, 90);
  assert.equal(rows.reduce((n, r) => n + r.active, 0), summarize(kits, counts).active);
  const expectedSales = kits.flatMap(k => k.history).filter(e => e.type === 'sell' && Date.parse(e.at) >= Date.parse(AS_OF) - 90 * 86400000).length;
  assert.equal(rows.reduce((n, r) => n + r.sales, 0), expectedSales);
  assert.ok(rows.every(r => !Object.hasOwn(r, 'receiptDays')));
  assert.ok(networkPerformance(kits, counts, 1).every(r => r.coverage === null));
  assert.deepEqual(networkPerformance([], [], 30), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { areaData, areaTransfers, areaActors } from '../src/domain/area-manager.js';
import { coverageRows } from '../src/domain/commercial.js';
test('AM : stocks, comptages, acteurs, alertes et demandes restent dans le mandat', () => {
  const data = areaData();
  assert.ok(data.selected.length);
  assert.ok(data.selected.every(k => k.amId === 'am-0'));
  assert.ok(data.counts.every(c => c.amId === 'am-0'));
  for (const type of ['shop', 'agent']) assert.ok(areaActors({}, type).every(r => r.location.amId === 'am-0'));
  assert.ok(coverageRows(data.selected, data.scope).every(r => r.shop.amId === 'am-0'));
  assert.ok(data.alerts.flatMap(a => a.kitIds).every(id => data.selected.some(k => k.id === id)));
});
test('AM : une URL hors mandat ne donne ni données ni propositions', () => {
  for (const filters of [{ amId: 'am-1' }, { region: 'Ouest' }, { shopId: 'shop-1-0' }, { agentId: 'agent-1-0-0' }]) {
    assert.equal(areaData(filters).selected.length, 0);
    assert.equal(areaData(filters).counts.length, 0);
    assert.equal(areaActors(filters).length, 0);
    assert.equal(areaTransfers(filters).length, 0);
  }
});
test('AM : entrées et distributions sont attribuées au réseau historique', () => {
  const rows = areaTransfers();
  assert.ok(rows.some(e => e.from === 'central' && e.to === 'am-0'));
  assert.ok(rows.some(e => e.to.startsWith('agent-0-')));
  assert.ok(rows.every(e => e.place.amId === 'am-0'));
  assert.ok(areaTransfers({ shopId: 'shop-0-2' }).every(e => e.place.shopId === 'shop-0-2'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKits, locations, isAvailable } from './legacy-stock.js';
import { networkRows, commercialSales, salesSeries, coverageRows, allocationSuggestions, exportCommercial, csv } from './legacy-commercial.js';
const kits = selectKits('dc', {});
test('Le réseau conserve les parents avec un filtre boutique ou agent', () => {
  for (const shop of locations.filter(l => l.type === 'shop')) {
    const filters = { shopId: shop.id };
    const rows = networkRows(selectKits('dc', filters), filters, 'am');
    assert.deepEqual(rows.map(r => r.location.id), [shop.amId]);
  }
  const agent = locations.find(l => l.type === 'agent');
  assert.deepEqual(networkRows([], { agentId: agent.id }, 'shop').map(r => r.location.id), [agent.shopId]);
});
test('Les courbes totalisent exactement les ventes et retours des KPI', () => {
  for (const days of [30, 60, 90, 180]) {
    const data = commercialSales(kits, days), chart = salesSeries(kits, days);
    for (const field of ['sales', 'returns']) assert.equal(chart.reduce((n, r) => n + r[field], 0), data[field].length);
    assert.ok(data.converted <= data.cohort.length);
  }
});
test('Les réallocations respectent produit, besoin et budget de chaque origine', () => {
  const rows = coverageRows(kits, {}), proposals = allocationSuggestions(rows);
  for (const row of rows) {
    assert.equal(row.available, row.kits.filter(isAvailable).length);
    assert.ok(proposals.filter(p => p.source.id === row.id).reduce((n, p) => n + p.quantity, 0) <= row.surplus);
    assert.ok(proposals.filter(p => p.target.id === row.id).reduce((n, p) => n + p.quantity, 0) <= row.need);
  }
  for (const p of proposals) { assert.equal(p.source.product, p.target.product); assert.notEqual(p.source.shop.id, p.target.shop.id); }
});
test('Les exports respectent le filtre et neutralisent les formules CSV', () => {
  const filters = { region: 'Centre' }, selected = selectKits('dc', filters), report = exportCommercial(selected, filters, 30);
  assert.equal(report.kits.length, selected.length);
  assert.ok(report.kits.every(k => k.region === 'Centre'));
  assert.equal(report.sales, commercialSales(selected, 30).sales.length);
  assert.ok(csv([{ label: '=1+1' }]).includes("'=1+1"));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKits, EMPTY_FILTERS, applyEvent, blankKit, FILTERS, filterOptions } from '../src/domain/stock.js';
import { STOCK_LEVELS, stockDistribution, serviceCases } from '../src/domain/director-views.js';

test('chaque ventilation, y compris villes et agents, réconcilie exactement le stock', () => {
  const selected = selectKits('dg');
  for (const [field] of STOCK_LEVELS) {
    const { scoped, rows } = stockDistribution(selected, field);
    assert.equal(rows.reduce((n, row) => n + row.active, 0), selected.filter(k => k.lifecycle === 'in_stock').length);
    assert.equal(new Set(rows.flatMap(r => r.kits.map(k => k.id))).size, scoped.length);
  }
  assert.ok(stockDistribution(selected, 'agentId').rows.some(r => !r.id));
  assert.ok(selected.every(k => k.city));
});
test('le parcours territorial et les filtres globaux se croisent sans fuite de périmètre', () => {
  const selected = selectKits('dg', { ...EMPTY_FILTERS, product: 'SmartSun M' });
  const { scoped, rows } = stockDistribution(selected, 'city', [{ field: 'region', value: 'Centre' }]);
  assert.ok(scoped.length);
  assert.ok(rows.flatMap(r => r.kits).every(k => k.region === 'Centre' && k.product === 'SmartSun M'));
  const agent = selectKits('dg', { ...EMPTY_FILTERS, agentId: 'agent-0-0-0' });
  assert.ok(agent.length && agent.every(k => k.holderId === 'agent-0-0-0'));
  assert.ok(!FILTERS.some(([k]) => k === 'city'));
  assert.ok(filterOptions('am', EMPTY_FILTERS).agentId.every(o => o.value.startsWith('agent-0-')));
});
test('SAV : seuls retours ouverts, dommages et réparations apparaissent', () => {
  const cases = serviceCases(selectKits('dg'));
  assert.ok(cases.some(k => k.returned));
  assert.ok(cases.some(k => k.damaged));
  assert.ok(cases.some(k => k.inRepair));
  assert.ok(cases.every(k => k.lifecycle === 'in_stock' && (k.returned || k.damaged || k.inRepair)));
  assert.equal(new Set(cases.map(k => k.id)).size, cases.length);
  assert.deepEqual(serviceCases([]), []);
});
test('retour résolu et quarantaine sans retour sont exclus du SAV', () => {
  const source = selectKits('dg').find(k => k.history.some(e => e.type === 'return'));
  const restored = applyEvent(source, { id: 'RESTORE-TEST', type: 'restore', at: '2026-09-21T09:00:00.000Z', actor: 'Technicien', reference: 'QC-TEST', reason: 'Contrôle qualité réussi' });
  assert.deepEqual(serviceCases([restored]), []);
  const quarantine = selectKits('dg').find(k => k.condition === 'quarantine' && !k.history.some(e => e.type === 'return'));
  assert.deepEqual(serviceCases([quarantine]), []);
});
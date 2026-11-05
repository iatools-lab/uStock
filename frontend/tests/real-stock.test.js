import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshot, quantity, loadSnapshot, METRICS } from '../src/data/real-stock.js';
import { stockTarget } from '../src/domain/commercial-planning.js';
import { networkPerformance } from '../src/domain/director.js';
import { coverageRows } from '../src/domain/commercial.js';
import { AS_OF } from '../src/domain/stock.js';
import { selectedDate, selectedPeriod } from '../server/stock-query.mjs';
test('les bornes de période sont inclusives, valides et ordonnées',()=>{
  assert.deepEqual(selectedPeriod(new URLSearchParams('startDate=2026-10-01&endDate=2026-10-31'),'2026-11-04'),{start:'2026-10-01',end:'2026-10-31'});
  assert.deepEqual(selectedPeriod(new URLSearchParams(),'2026-11-04'),{start:null,end:'2026-11-04'});
  for(const query of ['startDate=2026-11-02&endDate=2026-10-31','startDate=2026-02-30','endDate=2027-01-01'])assert.throws(()=>selectedPeriod(new URLSearchParams(query),'2026-11-04'));
});
const snapshot = () => ({ schemaVersion: 1, source: 'ukit', sourceLoadedAt: '2026-10-11T18:04:32Z', scope: { label: 'National', authorized: true }, coverage: { status: 'partial', note: 'Historique partiel' }, metrics: Object.fromEntries(METRICS.map(([key]) => [key, { value: null, status: 'unavailable', reason: 'Non fourni' }])), products: [], custody: [], assets: { rows: [], hasMore: false } });
test('les inconnus et les bigint gardent leur sens et leur précision', () => {
  assert.equal(quantity(null), 'Non renseigné');
  assert.equal(quantity('9007199254740993').replace(/\D/g, ''), '9007199254740993');
  assert.throws(() => quantity(9007199254740993));
  assert.equal(validateSnapshot(snapshot()).metrics.sales.value, null);
  const data = snapshot(); data.metrics.sales.value = 0; assert.throws(() => validateSnapshot(data));
});
test('une répartition ne peut perdre des équipements', () => {
  const data = snapshot(); data.metrics.active = { value: '2', status: 'known', reason: 'Stock' };
  assert.throws(() => validateSnapshot(data));
  data.products = [{ key: 'unknown', label: 'Non renseigné', quantity: '2' }]; data.custody = [...data.products];
  assert.equal(validateSnapshot(data), data);
});
test('une panne ou une page HTML ne devient pas un jeu fictif', async () => {
  await assert.rejects(loadSnapshot('', { role: 'dg', page: 1 }), /configurer/);
  await assert.rejects(loadSnapshot('/stock', { role: 'dg', page: 1, fetcher: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(loadSnapshot('/stock', { role: 'dg', page: 1, fetcher: async () => ({ ok: true, headers: new Headers({ 'content-type': 'text/html' }) }) }), /JSON/);
});
test('les demandes sont paginées et la cible reste inconnue sans vente', async () => {
  let requested;
  await loadSnapshot('/stock', { role: 'am', page: 2, fetcher: async url => { requested = url; return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => snapshot() }; } });
  assert.equal(requested, '/stock?role=am&page=2');
  assert.equal(stockTarget(0, 90, 30), null); assert.equal(stockTarget(10, 90, 30), 4);
});
test('une vente reste dans sa région historique après un changement de détenteur', () => {
  const selected = [{ id: 'test', product: 'Lion', region: 'Littoral', lifecycle: 'sold', condition: 'good', history: [{ type: 'transfer', to: 'agent-0-0-0', at: AS_OF }, { type: 'sell', at: AS_OF }] }];
  const rows = networkPerformance(selected, [], 30, 'region');
  assert.equal(rows.find(row => row.id === 'Centre').sales, 1);
  assert.equal(rows.find(row => row.id === 'Littoral').sales, 0);
  assert.equal(rows.reduce((n, row) => n + row.sales, 0), 1);
});
test('sans ventes observées un besoin inconnu ne génère aucun surplus à réallouer', () => {
  const rows = coverageRows([], {}, 1);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.target === null && row.need === null && row.surplus === 0));
});
test('la date par défaut est aujourd’hui et les dates impossibles ou futures sont refusées',()=>{
  assert.equal(selectedDate(null,'2026-10-30'),'2026-10-30');
  assert.equal(selectedDate('2026-10-01','2026-10-30'),'2026-10-01');
  for(const invalid of ['2026-02-30','2026-11-01','30/10/2026'])assert.throws(()=>selectedDate(invalid,'2026-10-30'));
});

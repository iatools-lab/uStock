import test from 'node:test';
import assert from 'node:assert/strict';
import { AS_OF, DEMO_AM, EMPTY_FILTERS, FILTERS, PRODUCTS, ROLE_LABELS, applyEvent, blankKit, buildAlerts, buildTrend, changeFilter, filterOptions, groupStock, inventories, inventoryDiff, isAvailable, kits, locationById, locations, replayKit, selectInventories, selectKits, summarize } from './legacy-stock.js';

const e = (id, type, extras = {}) => ({ id, type, at: `2026-09-${String(id).padStart(2, '0')}T08:00:00.000Z`, actor: 'Expéditeur', reference: `REF-${id}`, ...extras });
const received = () => applyEvent(blankKit('TEST-1', PRODUCTS[0]), e(1, 'receive', { to: 'central' }));
test('tous les kits sont uniques, référencés et reproductibles à partir du journal', () => {
  assert.equal(new Set(kits.map(k => k.id)).size, kits.length);
  for (const kit of kits) {
    assert.ok(PRODUCTS.includes(kit.product));
    assert.ok(locationById[kit.holderId]);
    assert.ok(kit.history.every(event => event.at <= AS_OF));
    assert.deepEqual(replayKit(kit), kit);
  }
});
test('les totaux nationaux DG, DC, Supply Chain et IT sont identiques', () => {
  const expected = summarize(selectKits('dg'), selectInventories('dg'));
  for (const role of ['dc', 'supply', 'it']) assert.deepEqual(summarize(selectKits(role), selectInventories(role)), expected);
  assert.equal(expected.total, expected.active + expected.sold + expected.lost + expected.writtenOff);
  assert.equal(expected.active, expected.onHand);
  assert.equal(expected.active, expected.central + expected.am + expected.shop + expected.agent);
});
test('régions et produits partitionnent les stocks sans double compte', () => {
  const selected = selectKits('dg'), counts = selectInventories('dg'), total = summarize(selected, counts);
  for (const field of ['zone', 'region', 'department', 'holderId', 'product']) {
    const rows = groupStock(selected, counts, field);
    for (const key of ['total', 'active', 'available', 'defective', 'missing', 'unexpected']) assert.equal(rows.reduce((n, r) => n + r[key], 0), total[key], `${field}/${key}`);
  }
});
test('périmètre AM appliqué aux kits, options et inventaires, même avec un autre AM forcé', () => {
  assert.ok(selectKits('am').length > 0);
  assert.ok(selectKits('am').every(k => k.amId === DEMO_AM));
  assert.ok(selectInventories('am').every(k => k.amId === DEMO_AM));
  assert.deepEqual(filterOptions('am', EMPTY_FILTERS).amId.map(o => o.value), [DEMO_AM]);
  assert.equal(selectKits('am', { ...EMPTY_FILTERS, amId: 'am-1' }).length, 0);
  assert.equal(selectKits('unknown').length, 0);
});
test('les six filtres se combinent, et la cascade réinitialise les descendants', () => {
  const filters = { ...EMPTY_FILTERS, zone: 'Centre-Sud', region: 'Centre', department: 'Mfoundi', amId: 'am-0', shopId: 'shop-0-0', product: PRODUCTS[0] };
  const rows = selectKits('dg', filters);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(k => FILTERS.every(([field]) => !filters[field] || k[field] === filters[field])));
  assert.deepEqual(changeFilter(filters, 'zone', 'Grand Nord'), { ...EMPTY_FILTERS, zone: 'Grand Nord', product: PRODUCTS[0] });
  assert.ok(!selectKits('dg', { ...filters, region: 'Littoral' }).length);
  assert.ok(selectKits('dg', { ...EMPTY_FILTERS, shopId: 'shop-0-0' }).every(k => ['shop', 'agent'].includes(k.holderType)));
});
test('le filtre central est géographique sans AM ni boutique fictivement attribués', () => {
  const selected = selectKits('dg');
  assert.ok(selected.some(k => k.holderType === 'central'));
  assert.ok(selected.filter(k => k.holderType === 'central').every(k => !k.amId && !k.shopId && k.department === 'Mfoundi'));
});
test('un transfert enregistré change le détenteur sans état intermédiaire', () => {
  const before = received();
  const after = applyEvent(before, e(2, 'transfer', { from: 'central', to: 'am-0' }));
  assert.equal(before.holderId, 'central');
  assert.equal(after.holderId, 'am-0');
  assert.equal(after.lifecycle, 'in_stock');
  assert.equal(before.history.length, 1);
  assert.ok(kits.every(k => !Object.hasOwn(k, 'pending') && k.lifecycle !== 'transit'));
  assert.ok(!Object.hasOwn(summarize(selectKits('dg')), 'transit'));
});
test('transfert interdit depuis une mauvaise origine, hors circuit ou avec un défaut', () => {
  const kit = received();
  assert.throws(() => applyEvent(kit, e(2, 'transfer', { from: 'central', to: 'shop-0-0' })), /circuit/);
  assert.throws(() => applyEvent(kit, e(2, 'transfer', { from: 'am-0', to: 'am-1' })), /Origine/);
  const defect = applyEvent(kit, e(2, 'defect', { reason: 'Batterie' }));
  assert.throws(() => applyEvent(defect, e(3, 'transfer', { from: 'central', to: 'am-0' })), /bon état/);
});
test('parcours complet central → AM → boutique → agent → client avec preuves', () => {
  let kit = received();
  const path = ['central', 'am-0', 'shop-0-0', 'agent-0-0-0'];
  for (let n = 1; n <= 3; n++) {
    kit = applyEvent(kit, e(n * 2, 'transfer', { from: path[n - 1], to: path[n] }));
  }
  assert.throws(() => applyEvent(kit, e(8, 'sell')), /preuve/);
  kit = applyEvent(kit, e(8, 'sell', { customerRef: 'C-1', deliveryRef: 'L-1' }));
  assert.equal(kit.lifecycle, 'sold'); assert.equal(kit.history.length, 5); assert.equal(isAvailable(kit), false);
  assert.throws(() => applyEvent(kit, e(9, 'sell', { customerRef: 'C-2', deliveryRef: 'L-2' })), /en stock/);
  kit = applyEvent(kit, e(9, 'return', { to: 'shop-0-0', reason: 'SAV' }));
  assert.equal(kit.condition, 'quarantine'); assert.equal(kit.lifecycle, 'in_stock'); assert.equal(isAvailable(kit), false);
  kit = applyEvent(kit, e(10, 'repair', { reason: 'Diagnostic' }));
  kit = applyEvent(kit, e(11, 'restore', { reason: 'Contrôle qualité réussi' }));
  assert.equal(isAvailable(kit), true);
});
test('réservations, pertes, réformes et approbations sont contrôlées', () => {
  const kit = received(), reserved = applyEvent(kit, e(2, 'reserve'));
  assert.equal(isAvailable(reserved), false);
  assert.throws(() => applyEvent(reserved, e(3, 'transfer', { from: 'central', to: 'am-0' })), /réservation/);
  assert.equal(isAvailable(applyEvent(reserved, e(3, 'release'))), true);
  assert.throws(() => applyEvent(kit, e(2, 'lose', { reason: 'Perte', approver: 'Expéditeur' })), /distinct/);
  assert.equal(applyEvent(kit, e(2, 'write_off', { reason: 'Irréparable', approver: 'Contrôleur' })).lifecycle, 'written_off');
});
test('événements idempotents, conflits et dates invalides refusés', () => {
  const kit = received();
  assert.equal(applyEvent(kit, kit.history[0]), kit);
  assert.throws(() => applyEvent(kit, { ...kit.history[0], actor: 'Autre' }), /réutilisé/);
  assert.throws(() => applyEvent(kit, e(2, 'reserve', { at: '2025-01-01T00:00:00.000Z' })), /antidaté/);
  assert.throws(() => applyEvent(kit, e(2, 'reserve', { at: 'invalide' })), /incomplet/);
});
test('comptages : les écarts opposés ne se compensent pas et les manquants ne sont pas disponibles', () => {
  assert.deepEqual(inventoryDiff({ expectedIds: ['A', 'B'], observedIds: ['B', 'C'] }), { missing: ['A'], unexpected: ['C'] });
  const counts = selectInventories('dg'), total = summarize(selectKits('dg'), counts);
  assert.ok(total.missing > 0 && total.unexpected > 0);
  assert.equal(total.grossVariance, total.missing + total.unexpected);
  const missing = new Set(counts.flatMap(s => s.missing));
  assert.ok(kits.filter(k => missing.has(k.id)).every(k => !isAvailable(k)));
  assert.equal(counts.reduce((n, s) => n + s.expectedIds.length, 0), total.onHand);
  assert.ok(inventories.every(s => new Set(s.expectedIds).size === s.expectedIds.length));
});
test('courbes reconstituées : dernier point égal aux indicateurs pour chaque profil et produit', () => {
  for (const role of Object.keys(ROLE_LABELS)) {
    for (const product of ['', PRODUCTS[0]]) {
      const filters = { ...EMPTY_FILTERS, product };
      assert.equal(buildTrend(role, filters).at(-1).active, summarize(selectKits(role, filters)).active);
    }
  }
  const trend = buildTrend('dg', EMPTY_FILTERS);
  assert.equal(trend.reduce((n, m) => n + m.receipts, 0), kits.length);
  assert.equal(trend.reduce((n, m) => n + m.sales - m.returns, 0), summarize(selectKits('dg')).sold);
});
test('alertes dérivées et bornées au périmètre sélectionné', () => {
  const rows = selectKits('am'), counts = selectInventories('am');
  const alerts = buildAlerts(rows, counts);
  assert.ok(alerts.length > 0);
  assert.ok(alerts.every(a => a.kitIds.every(id => rows.some(k => k.id === id))));
  assert.equal(alerts.find(a => a.key === 'variance').count, summarize(rows, counts).grossVariance);
  assert.deepEqual(buildAlerts([], [], []), []);
  const low = buildAlerts([], [], locations.filter(l => l.type === 'shop'));
  assert.equal(low[0].count, locations.filter(l => l.type === 'shop').length);
});

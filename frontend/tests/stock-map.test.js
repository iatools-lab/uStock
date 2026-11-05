import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectKits, summarize, groupStock } from '../src/domain/stock.js';
import { STOCK_LEVELS, stockDistribution } from '../src/domain/director-views.js';
import { mapStock, REGION_NAMES, geometryPoints, geometryPath, fitMap } from '../src/domain/stock-map.js';

const geo = JSON.parse(readFileSync(new URL('../src/data/cameroon-regions.json', import.meta.url), 'utf8'));
const features = geo.features.map(f => ({ ...f, name: REGION_NAMES[f.properties.shapeName] || f.properties.shapeName }));
test('La carte possède dix régions et des emprises valides', () => {
  assert.equal(features.length, 10);
  for (const f of features) {
    const points = geometryPoints(f.geometry), box = fitMap(points);
    assert.ok(geometryPath(f.geometry).startsWith('M'));
    assert.ok(box.every(Number.isFinite));
    assert.ok(points.every(([x,y]) => x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3]));
  }
});
test('Chaque niveau cartographique réconcilie le stock et les produits sans double compte', () => {
  for (const role of ['dg', 'dc', 'supply', 'am']) for (const filters of [{}, { product: 'Lion' }, { region: 'Centre' }, { shopId: 'shop-0-0' }]) {
    const selected = selectKits(role, filters);
    for (const [field] of STOCK_LEVELS) {
      const data = mapStock(selected, field, [], features);
      assert.equal(data.markers.reduce((n,r) => n+r.active,0) + data.unlocated.reduce((n,r) => n+r.active,0), summarize(selected).active);
      const ids = data.markers.flatMap(m => m.kits.map(k => k.id));
      assert.equal(new Set(ids).size, ids.length);
      for (const marker of data.markers) assert.equal(groupStock(marker.kits, [], 'product').reduce((n,r) => n+r.active,0), marker.active);
    }
  }
});
test('Zoom, filtrage territorial et scope AM restent cohérents', () => {
  const trail = [{ field: 'region', value: 'Centre' }, { field: 'city', value: 'Yaoundé' }];
  const data = mapStock(selectKits('dg'), 'shopId', trail, features);
  assert.ok(data.scoped.length && data.scoped.every(k => k.region === 'Centre' && k.city === 'Yaoundé'));
  assert.equal(data.scoped.length, stockDistribution(selectKits('dg'), 'shopId', trail).scoped.length);
  assert.equal(mapStock(selectKits('am'), 'region', [{ field:'region', value:'Ouest' }], features).scoped.length, 0);
  const national = fitMap(features.flatMap(f => geometryPoints(f.geometry)));
  assert.ok(fitMap(data.mapped.flatMap(r => r.points))[2] < national[2]);
});
test('Les lieux sans coordonnées sont comptés explicitement ; les boutiques colocalisées sont groupées', () => {
  const selected = selectKits('dg').filter(k => k.lifecycle === 'in_stock');
  const unknown = { ...selected[0], city: 'Ville inconnue' };
  const empty = mapStock([unknown], 'city', [], features);
  assert.equal(empty.markers.length,0); assert.equal(empty.unlocated[0].active,1);
  const data = mapStock(selected, 'shopId', [{ field:'city', value:'Yaoundé' }], features);
  assert.ok(data.markers.some(m => m.rows.length > 1));
});

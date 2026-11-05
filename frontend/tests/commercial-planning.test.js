import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKits, locationById } from '../src/domain/stock.js';
import { saleFacts, salesRanking, saleTrend, demandByPlace, COMMERCIAL_LEVELS } from '../src/domain/commercial-planning.js';
import { CENTRAL_BUCKET, stockDistribution, territorySummary } from '../src/domain/director-views.js';

function soldKit(id, product, seller) {
  return { id, product, history: [{ type:'transfer',to:seller,at:'2026-09-01T08:00:00.000Z' }, { id:id+'-sale',type:'sell',at:'2026-09-02T08:00:00.000Z' }, { type:'return',to:locationById[seller].shopId,at:'2026-09-03T08:00:00.000Z' }] };
}
test('Ventes attribuées au véritable agent de vente même après retour',()=>{
  const source = [soldKit('fixture','Sunshine','agent-4-0-0')];
  const facts = saleFacts({agentId:'agent-4-0-0'},30,source);
  assert.equal(facts.length,1); assert.equal(facts[0].region,'Nord');
  assert.equal(saleFacts({agentId:'agent-7-0-0'},30,source).length,0);
  assert.equal(saleFacts({},1,source).length,0);
});
test('Les classements de tous les niveaux et la courbe réconcilient les ventes',()=>{
  const facts = saleFacts({},90);
  for (const [field] of [...COMMERCIAL_LEVELS,['product','Produit']]) assert.equal(salesRanking(facts,field).reduce((n,r)=>n+r.value,0),facts.length);
  assert.equal(saleTrend(facts,90).reduce((n,r)=>n+r.sales,0),facts.length);
  assert.deepEqual(salesRanking([{region:'A'},{region:'B'}],'region').map(r=>r.rank),[1,1]);
});
test('Besoins différenciés par lieu et produit : vitesse de vente moins disponible',()=>{
  const source = [...Array.from({length:30},(_,i)=>soldKit('n'+i,'Sunshine','agent-4-0-0')), ...Array.from({length:60},(_,i)=>soldKit('s'+i,'Lion','agent-7-0-0'))];
  const stock = [...Array.from({length:2},(_,i)=>({...locationById['shop-4-0'],holderId:'shop-4-0',id:'stock-n'+i,product:'Sunshine',lifecycle:'in_stock',condition:'good',reserved:false})), {...locationById['shop-7-0'],holderId:'shop-7-0',id:'stock-s',product:'Lion',lifecycle:'in_stock',condition:'good',reserved:false}];
  const rows = demandByPlace(stock,{},'region',90,30,source);
  assert.equal(rows.find(r=>r.id==='Nord').rows.find(r=>r.product==='Sunshine').need,8);
  assert.equal(rows.find(r=>r.id==='Sud').rows.find(r=>r.product==='Lion').need,19);
  assert.equal(rows.find(r=>r.id==='Nord').rows.find(r=>r.product==='Lion').need,null);
  assert.ok(demandByPlace(stock,{region:'Nord',product:'Sunshine'},'region',90,30,source).find(r=>r.id==='Nord').rows.every(r=>r.product==='Sunshine'));
});
test('Entrepôt central distinct à tous les niveaux sans double comptage',()=>{
  const selected = selectKits('dg'), central = selected.filter(k=>k.holderId==='central'&&k.lifecycle==='in_stock').length;
  for (const [field] of COMMERCIAL_LEVELS) {
    const rows = territorySummary(selected,field);
    assert.equal(rows.find(r=>r.central).active,central);
    assert.equal(rows.reduce((n,r)=>n+r.active,0),selected.filter(k=>k.lifecycle==='in_stock').length);
    assert.ok(rows.filter(r=>!r.central).flatMap(r=>r.kits).every(k=>k.holderId!=='central'));
  }
  assert.equal(stockDistribution(selected,'city',[{field:'region',value:CENTRAL_BUCKET}]).scoped.length,central);
  assert.ok(stockDistribution(selected,'city',[{field:'region',value:'Centre'}]).scoped.every(k=>k.holderId!=='central'));
  assert.ok(!territorySummary(selectKits('am'),'region').some(r=>r.central));
});
test('Un déficit boutique remonte intégralement sans compensation par une autre boutique',()=>{
  const source = Array.from({length:9},(_,i)=>soldKit('deficit'+i,'Sunshine','agent-4-0-0'));
  const stock = Array.from({length:100},(_,i)=>({...locationById['shop-4-1'],holderId:'shop-4-1',id:'surplus'+i,product:'Sunshine',lifecycle:'in_stock',condition:'good',reserved:false}));
  for (const [field,id] of [['shopId','shop-4-0'],['amId','am-4'],['department','Bénoué'],['region','Nord'],['zone','Grand Nord']]) {
    const rows=demandByPlace(stock,{},field,90,30,source);
    assert.equal(rows.find(r=>r.id===id).rows.find(r=>r.product==='Sunshine').need,3);
    assert.equal(rows.reduce((n,r)=>n+r.need,0),3);
  }
  assert.deepEqual(demandByPlace(stock,{},'agentId',90,30,source),[]);
});

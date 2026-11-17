import test from 'node:test';
import assert from 'node:assert/strict';
import { queryStock } from '../server/queries/stock-query.mjs';
import { client } from './director-data.mjs';
import { MENUS } from '../src/navigation/menus.js';
import { liveView } from '../src/domain/live-routing.js';
test('seul le directeur conserve ses menus',()=>{
 assert.deepEqual(Object.keys(MENUS),['dg']);
 for(const role of ['dc','supply','am','it'])assert.equal(liveView(role,''),null);
});
test('le mix sans rattachement conserve produits et etats sans doubler les totaux',async()=>{
 for(const level of ['zone','amId','holderId']){
  const data=await queryStock(client,new URLSearchParams({role:'dg',view:'stock',level}));
  const rows=data.territories.rows.filter(r=>r.key==='__unknown__');
  assert.equal(rows.length,2);
  assert.equal(data.stockCustody.reduce((n,r)=>n+Number(r.quantity),0),7);
  assert.ok(data.stockCustody.every(r=>r.key!=='client'));
  for(const [key,expected] of [['quantity',10],['instock',7],['deployed',2],['defective',1]])assert.equal(rows.reduce((n,r)=>n+r[key],0),expected);
  assert.equal(Number(data.metrics.total.value),10);assert.equal(data.territories.unassigned.quantity,10);
  assert.equal(data.defectiveHolders.reduce((n,row)=>n+Number(row.quantity),0),Number(data.metrics.defective.value));
  assert.equal(data.products.reduce((n,row)=>n+row.defective,0),Number(data.metrics.defective.value));
  assert.equal(data.mapRegionProducts.reduce((n,r)=>n+r.quantity,0),10);
 }
});

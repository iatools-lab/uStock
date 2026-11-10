import test from 'node:test';
import assert from 'node:assert/strict';
import { agingStock, concentration, redistribution, riskMatrix, stockPositions } from '../src/domain/strategic-stock.js';
import { buildAnalysis } from '../server/analytics.mjs';
const row=(zone,product,status,quantity,extra={})=>({zone,product,productName:product,status,quantity,month:'2026-10',...extra});
const analysis=rows=>({window:{days:30,start:'2026-10-01',end:'2026-10-30'},months:['2026-10'],rows});

test('la couverture distingue zéro stock, seuils 15/30 jours et absence de ventes',()=>{
  const data=analysis([row('Zone 1','P0','DEPLOYED',30),row('Zone 1','P15','DEPLOYED',30),row('Zone 1','P15','INSTOCK',15),row('Zone 1','P30','DEPLOYED',30),row('Zone 1','P30','INSTOCK',30),row('Zone 2','P0','INSTOCK',10)]);
  const p=stockPositions(data);
  assert.equal(p.find(r=>r.product==='P0'&&r.zone==='Zone 1').risk,'critical');
  assert.equal(p.find(r=>r.product==='P15').risk,'warning');
  assert.equal(p.find(r=>r.product==='P30').risk,'healthy');
  assert.equal(p.find(r=>r.zone==='Zone 2').coverage,null);
  const m=riskMatrix(data);assert.equal(m.cells.get(JSON.stringify(['Zone 2','P30'])),undefined);
});
test('les références différentes ne se compensent pas et seul le dernier stock est utilisé',()=>{
  const data=analysis([row('Zone 1','P1','DEPLOYED',30),row('Zone 1','P1','INSTOCK',5),row('Zone 1','P2','INSTOCK',100),row('Zone 1','P1','INSTOCK',900,{month:'2026-09'})]);
  assert.equal(stockPositions(data).find(r=>r.product==='P1').need,25);
});
test('la redistribution conserve les quantités, la référence et 30 jours chez chaque donneur',()=>{
  const data=analysis([row('Zone 1','P1','DEPLOYED',30),row('Zone 1','P1','INSTOCK',100),row('Zone 2','P1','DEPLOYED',50),row('Zone 3','P1','DEPLOYED',40),row('Zone 4','P2','INSTOCK',500)]);
  const plan=redistribution(data);assert.equal(plan.need,90);assert.equal(plan.transferable,70);assert.equal(plan.remaining,20);
  assert.ok(plan.plans.every(r=>r.product==='P1'&&r.from==='Zone 1'&&r.from!==r.to));
  assert.equal(plan.plans.reduce((n,r)=>n+r.quantity,0),70);
  assert.equal(plan.plans.filter(r=>r.to==='Zone 2').reduce((n,r)=>n+r.quantity,0),50);
});
test('les lieux inconnus et stocks sans vente observée ne sont pas des donneurs automatiques',()=>{
  const data=analysis([row(null,'P1','INSTOCK',100),row('Zone 1','P1','INSTOCK',50),row('Zone 2','P1','DEPLOYED',30)]);
  assert.equal(redistribution(data).transferable,0);assert.equal(riskMatrix(data).unassigned,100);
});
test('la concentration réconcilie toutes les ventes et inclut les lieux inconnus',()=>{
  const rows=concentration(analysis([row('Zone 1','P1','DEPLOYED',60),row('Zone 2','P1','DEPLOYED',30),row(null,'P2','DEPLOYED',10),row('Zone 1','P1','INSTOCK',100)]),'zone');
  assert.equal(rows.length,3);assert.equal(rows[0].share,60);assert.equal(rows.at(-1).cumulative,100);assert.equal(rows.reduce((n,r)=>n+r.quantity,0),100);
  assert.deepEqual(concentration(analysis([]),'product'),[]);
});
test('les classes d’ancienneté partitionnent le stock final et gardent les inconnus',()=>{
  const data=analysis([row('Zone 1','P1','INSTOCK',10,{ageUnder30:3,age30to59:2,age60to89:1,age90plus:3}),row('Zone 2','P2','INSTOCK',4),row('Zone 1','P1','INSTOCK',100,{month:'2026-09',age90plus:100})]);
  const age=agingStock(data);assert.equal(Object.values(age.totals).reduce((n,r)=>n+r,0),14);assert.equal(age.totals.age90plus,3);assert.equal(age.totals.ageUnknown,5);
});
test('l’agrégation serveur conserve les classes d’ancienneté sans perdre de kits',()=>{
  const data=buildAnalysis([row('Zone 1','P1','INSTOCK',5,{ageUnder30:2,age90plus:3}),row('Zone 1','P1','INSTOCK',3,{age30to59:3})],{start:'2026-10-01',end:'2026-10-30'});
  assert.equal(data.rows.length,1);assert.equal(data.rows[0].quantity,8);assert.equal(data.rows[0].age90plus,3);assert.equal(data.rows[0].age30to59,3);
});

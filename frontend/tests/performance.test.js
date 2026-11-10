import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonPeriod } from '../server/performance-period.mjs';
import { performanceRows } from '../src/domain/performance.js';
import { loadSnapshot } from '../src/data/real-stock.js';
test('comparaisons calendaires : mois, trimestre et periode en cours',()=>{
 assert.deepEqual(comparisonPeriod({start:'2026-10-01',end:'2026-10-31',days:31}),{start:'2026-09-01',end:'2026-09-30',mode:'previous'});
 assert.deepEqual(comparisonPeriod({start:'2026-10-01',end:'2026-12-31',days:92}),{start:'2026-07-01',end:'2026-09-30',mode:'previous'});
 assert.deepEqual(comparisonPeriod({start:'2026-11-01',end:'2026-11-10',days:10}),{start:'2026-10-01',end:'2026-10-10',mode:'previous'});
 assert.deepEqual(comparisonPeriod({start:'2026-10-01',end:'2026-11-10',days:41}),{start:'2026-07-01',end:'2026-08-10',mode:'previous'});
 assert.deepEqual(comparisonPeriod({start:'2024-02-01',end:'2024-02-29',days:29},'year'),{start:'2023-02-01',end:'2023-02-28',mode:'year'});
 assert.deepEqual(comparisonPeriod({start:'2026-10-15',end:'2026-10-21',days:7}),{start:'2026-10-08',end:'2026-10-14',mode:'previous'});
 assert.throws(()=>comparisonPeriod({start:'2026-10-01',end:'2026-10-31',days:31},'bad'),/INVALID/);
});
test('ventilations : conservation des ventes, baisses, absences et stock final seulement',()=>{
 const row=(zone,status,quantity,month='2026-10')=>({zone,amId:zone,product:zone,productName:zone,status,quantity,month});
 const analysis={months:['2026-09','2026-10'],window:{days:31},rows:[row('A','DEPLOYED',5),row('B','DEPLOYED',2),row(null,'DEPLOYED',1),row('A','INSTOCK',10),row('A','INSTOCK',999,'2026-09')],previous:{rows:[row('A','DEPLOYED',10),row('C','DEPLOYED',3)]}};
 for(const dimension of ['zone','amId','product']){
  const rows=performanceRows(analysis,dimension);
  assert.equal(rows.reduce((n,r)=>n+r.current,0),8);assert.equal(rows.reduce((n,r)=>n+r.previous,0),13);
  assert.equal(rows.reduce((n,r)=>n+r.delta,0),-5);assert.equal(rows.reduce((n,r)=>n+r.stock,0),10);
  assert.equal(rows.find(r=>r.key==='A').growth,-50);assert.equal(rows.find(r=>r.key==='A').coverage,62);
  assert.equal(rows.find(r=>r.key==='B').growth,null);assert.equal(rows.find(r=>r.key==='C').coverage,null);
 }
});
test('le choix de comparaison est transmis a la source',async()=>{
 let requested;
 await assert.rejects(loadSnapshot('/api/local-stock',{role:'dg',page:1,view:'performance',filters:{comparison:'year'},fetcher:async url=>{requested=url;return {ok:false,status:503};}}));
 assert.ok(requested.includes('comparison=year'));
});

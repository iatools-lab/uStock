import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalysis, analysisWindow } from '../server/analytics.mjs';
import { forecastNeeds, monthlySeries, needsMatrix } from '../src/domain/live-analysis.js';

const window={start:'2026-10-01',end:'2026-10-30',days:30};
const row=(product,status,quantity,region='CENTRE',amId='AM1',month='2026-10')=>({product,productName:product,status,quantity,region,amId,zone:'Zone 1',month});

test('un surplus de produit ou de territoire ne masque pas un besoin',()=>{
  const a=buildAnalysis([row('P1','DEPLOYED',30),row('P1','INSTOCK',5),row('P2','INSTOCK',100),row('P1','INSTOCK',100,'NORD','AM2')],window);
  for(const dimension of ['zone','region','amId','product']){
    const f=forecastNeeds(a,dimension,30,0);
    assert.equal(f.totals.need,25);assert.equal(f.totals.stock,205);assert.equal(f.totals.sold,30);
  }
});

test('la prévision utilise le stock final et une marge en jours, pas la somme des stocks mensuels',()=>{
  const a=buildAnalysis([row('P1','DEPLOYED',30),row('P1','INSTOCK',500,'CENTRE','AM1','2026-09'),row('P1','INSTOCK',5)],{start:'2026-09-01',end:'2026-10-30',days:60});
  const f=forecastNeeds(a,'product',30,10);
  assert.equal(f.totals.stock,5);assert.equal(f.totals.target,20);assert.equal(f.totals.need,15);
  const noSales=forecastNeeds(buildAnalysis([row('P2','INSTOCK',5)],window),'product',30,10);
  assert.equal(noSales.detail[0].coverage,null);assert.equal(noSales.totals.need,0);
});

test('toutes les séries restent distinctes et réconcilient chaque mois',()=>{
  const rows=Array.from({length:8},(_,i)=>row('P'+i,'DEPLOYED',i+1));
  const a=buildAnalysis(rows,{start:'2026-09-01',end:'2026-10-30',days:60});
  const chart=monthlySeries(a,'product','DEPLOYED');
  assert.equal(chart.series.length,8);assert.ok(!chart.series.some(s=>s.key==='others'));
  assert.equal(chart.series.reduce((n,s)=>n+chart.data[0][s.key],0),0);
  assert.equal(chart.series.reduce((n,s)=>n+chart.data[1][s.key],0),36);
  assert.equal(chart.ranking.reduce((n,r)=>n+r.quantity,0),36);
});

test('les périodes partielles et le passage décembre-janvier restent inclusifs',()=>{
  assert.equal(analysisWindow(new URLSearchParams(),'2026-11-06','forecast').days,90);
  assert.deepEqual(buildAnalysis([],{start:'2025-12-20',end:'2026-01-03',days:15}).months,['2025-12','2026-01']);
});
test('un mois sélectionné affiche chaque jour, avec stock final et ventes réconciliés',()=>{
  const w=analysisWindow(new URLSearchParams('startDate=2026-10-01'),'2026-10-31','analytics');
  assert.equal(w.granularity,'day');assert.equal(w.days,31);
  const a=buildAnalysis([row('P1','DEPLOYED',4,'CENTRE','AM1','2026-10-02'),row('P1','INSTOCK',100,'CENTRE','AM1','2026-10-30'),row('P1','INSTOCK',90,'CENTRE','AM1','2026-10-31')],w);
  assert.equal(a.months.length,31);assert.equal(a.months[0],'2026-10-01');assert.equal(a.months.at(-1),'2026-10-31');
  const chart=monthlySeries(a,'product','DEPLOYED');
  assert.equal(chart.data.reduce((n,r)=>n+r.s0,0),4);
  assert.equal(forecastNeeds(a,'zone',30,0).totals.stock,90);
  assert.equal(analysisWindow(new URLSearchParams('startDate=2026-10-01&granularity=month'),'2026-10-31','analytics').granularity,'month');
});
test('la matrice regroupe les types après le calcul des besoins sans perdre les quantités',()=>{
  const f={rows:[{id:'Z1',label:'Zone 1'}],detail:[{id:'Z1',product:'JUAX',productName:'Jua X',need:5},{id:'Z1',product:'JUA_PRO',productName:'Jua Pro',need:7},{id:'Z1',product:'SunShine_Spark',productName:'Sunshine',need:3}],totals:{need:15}};
  const m=needsMatrix(f);assert.deepEqual(m.products,['Jua','Sunshine']);assert.deepEqual(m.rows,[['Zone 1',12,3,15]]);assert.deepEqual(m.totals,['Total',12,3,15]);
});

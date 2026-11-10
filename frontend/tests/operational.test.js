import test from 'node:test';
import assert from 'node:assert/strict';
import { salesRanking } from './legacy-operational.js';
import { buildAnalysis, queryAnalysis } from '../server/analytics.mjs';

test('les classements commerciaux conservent les vendeurs et les ventes des deux periodes',()=>{
  const rows=[{status:'DEPLOYED',holderId:'A',holderName:'Alice',quantity:5},{status:'INSTOCK',holderId:'A',quantity:100},{status:'DEPLOYED',holderId:null,quantity:2}];
  const previous={rows:[{status:'DEPLOYED',holderId:'A',holderName:'Alice',quantity:10},{status:'DEPLOYED',holderId:'B',holderName:'Bob',quantity:3}]};
  const ranking=salesRanking({rows,previous},'holderId');
  assert.equal(ranking.reduce((n,r)=>n+r.sold,0),7);
  assert.equal(ranking.reduce((n,r)=>n+r.previous,0),13);
  assert.equal(ranking.find(r=>r.key==='A').growth,-50);
  assert.equal(ranking.find(r=>r.key==='B').delta,-3);
  assert.equal(ranking.find(r=>r.key==='__unknown__').growth,null);
  assert.ok(Math.abs(ranking.reduce((n,r)=>n+r.share,0)-100)<0.001);
});

test('les vendeurs distincts dans une meme zone ne sont pas fusionnes par le serveur',()=>{
  const base={month:'2026-10',product:'JUA',status:'DEPLOYED',zone:'Z1',quantity:2};
  const result=buildAnalysis([{...base,holderId:'A'},{...base,holderId:'B'}],{start:'2026-10-01',end:'2026-10-31',days:31,granularity:'month'});
  assert.equal(result.rows.length,2);assert.equal(result.rows.reduce((n,r)=>n+r.quantity,0),4);
});

test('la comparaison ne recalcule pas le stock et le detail vendeur reste reserve aux vues commerciales',async()=>{
  let sql;
  const c={query:async text=>{sql=text;return {rows:['A','B'].map(holder_id=>({month:'2026-10',status:'DEPLOYED',product_reference:'JUA',holder_id,holder_name:holder_id,quantity:2}))};}};
  const args={params:new URLSearchParams({startDate:'2026-10-01'}),selection:{rules:[]},asOfDate:'2026-10-31',view:'forecast',decorate:r=>({...r,productReference:r.product_reference,zone:'Z1'}),matchesGroup:()=>true,salesOnly:true};
  const detailed=await queryAnalysis(c,{...args,includeActors:true});
  assert.ok(sql.includes('WHERE false'));assert.equal(detailed.rows.length,2);
  const grouped=await queryAnalysis(c,args);assert.equal(grouped.rows.length,1);assert.equal(grouped.rows[0].quantity,4);
});

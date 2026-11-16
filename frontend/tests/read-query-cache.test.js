import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadQueryCache } from '../server/read-query-cache.mjs';

test('les menus partagent les SELECT, sans partager les filtres ou les versions source',async()=>{
 let reads=0,loaded='2026-11-15';
 const client={query:async sql=>({rows:sql.includes('current_database()')?[{loaded,today:'2026-11-16'}]:[{value:++reads}]})};
 const cache=createReadQueryCache();
 const reader=async namespace=>{const c=cache.reader(client,namespace);await c.query('SELECT current_database()');return c;};
 const a=await reader('revision:1'),b=await reader('revision:1');
 const first=await a.query('SELECT stock WHERE product=$1',['A']);first.rows[0].value=99;
 assert.equal((await b.query('SELECT stock WHERE product=$1',['A'])).rows[0].value,1);
 assert.equal((await b.query('SELECT stock WHERE product=$1',['B'])).rows[0].value,2);
 assert.equal((await (await reader('revision:2')).query('SELECT stock WHERE product=$1',['A'])).rows[0].value,3);
 loaded='2026-11-16';
 assert.equal((await (await reader('revision:1')).query('SELECT stock WHERE product=$1',['A'])).rows[0].value,4);
 cache.clear();assert.equal((await (await reader('revision:1')).query('SELECT stock WHERE product=$1',['A'])).rows[0].value,5);
});

test('le cache SQL expire et une duree nulle impose une nouvelle lecture',async()=>{
 let time=0,reads=0;
 const client={query:async sql=>({rows:sql.includes('current_database()')?[{loaded:'same',today:'2026-11-16'}]:[{n:++reads}]})};
 for(const ttl of [10,0]){
  const cache=createReadQueryCache({ttl,now:()=>time}),c=cache.reader(client,'r');await c.query('SELECT current_database()');
  const first=await c.query('SELECT stock'),next=await c.query('SELECT stock');
  assert.equal(next.rows[0].n,first.rows[0].n+(ttl===0?1:0));
  time+=11;assert.ok((await c.query('SELECT stock')).rows[0].n>next.rows[0].n);
 }
});

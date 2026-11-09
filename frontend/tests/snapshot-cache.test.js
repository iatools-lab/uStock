import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotCache,snapshotKey } from '../server/snapshot-cache.mjs';

test('le cache expire, protège les valeurs et partage les lectures simultanées',async()=>{
  let time=0,reads=0,release;
  const cache=createSnapshotCache({ttl:10,now:()=>time});
  const loader=async()=>{reads++;await new Promise(done=>release=done);return {n:reads};};
  const one=cache.get('same',loader),two=cache.get('same',loader);
  await Promise.resolve();release();const first=await one;assert.deepEqual(await two,{n:1});assert.equal(reads,1);
  first.n=99;assert.deepEqual(await cache.get('same',loader),{n:1});
  time=11;assert.deepEqual(await cache.get('same',async()=>({n:++reads})),{n:2});
});
test('invalider pendant une lecture ne réintroduit pas une ancienne sélection',async()=>{
  const cache=createSnapshotCache();let release;
  const old=cache.get('a',()=>new Promise(done=>release=done));await Promise.resolve();
  cache.clear();assert.equal(await cache.get('a',async()=>2),2);release(1);assert.equal(await old,1);
  assert.equal(await cache.get('a',async()=>3),2);
});
test('les échecs ne sont pas conservés et les limites mémoire expulsent les entrées',async()=>{
  const cache=createSnapshotCache({maxEntries:1,maxBytes:100});
  await assert.rejects(cache.get('error',async()=>{throw Error('offline');}));
  assert.equal(await cache.get('error',async()=>1),1);
  await cache.get('other',async()=>2);assert.equal(await cache.get('error',async()=>3),3);
  await cache.get('large',async()=>'a'.repeat(200));
  assert.equal(await cache.get('large',async()=>4),4);
});
test('la clé distingue les filtres, rôles, révisions, référentiels et dates',()=>{
  const c={revision:1,reference:'file1',date:'2026-11-09'},params=new URLSearchParams('role=dg&view=overview');
  const key=snapshotKey(params,c);assert.equal(key,snapshotKey(new URLSearchParams('view=overview&role=dg'),c));
  for(const next of [{...c,revision:2},{...c,reference:'file2'},{...c,date:'2026-11-10'}])assert.notEqual(key,snapshotKey(params,next));
  assert.notEqual(key,snapshotKey(new URLSearchParams('role=am&view=overview'),c));
});
test('une durée nulle désactive la réutilisation des résultats',async()=>{
  let n=0;const cache=createSnapshotCache({ttl:0});
  assert.equal(await cache.get('key',async()=>++n),1);assert.equal(await cache.get('key',async()=>++n),2);
});

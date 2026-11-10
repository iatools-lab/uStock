import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductionServer } from '../server/production.mjs';
import { productionSelection } from '../server/production-selection.mjs';

test('le serveur production sert la SPA, protège les fichiers et conserve les API',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'ukit-prod-'));let closed=false;
  await mkdir(join(folder,'assets'));await writeFile(join(folder,'index.html'),'<html>dashboard</html>');await writeFile(join(folder,'assets','app.js'),'let x=1;'.repeat(300));
  const app=createProductionServer({dist:folder,database:{snapshot:async params=>({role:params.get('role'),payload:'x'.repeat(2000)}),administration:async()=>({total:1}),saveSelection:async()=>({revision:2}),health:async()=>{},close:async()=>{closed=true;}}});
  try{
    await new Promise(done=>app.server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${app.server.address().port}`;
    const page=await fetch(base+'/directeur/analytique',{headers:{accept:'text/html'}});assert.equal(await page.text(),'<html>dashboard</html>');assert.equal(page.headers.get('cache-control'),'no-cache');
    const js=await fetch(base+'/assets/app.js');assert.equal(js.headers.get('content-encoding'),'gzip');assert.ok(js.headers.get('cache-control').includes('immutable'));
    assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server/local-database.mjs')).status,404);assert.equal((await fetch(base+'/assets/missing.js')).status,404);
    const data=await fetch(base+'/api/local-stock?role=dg');assert.deepEqual(await data.json(),{role:'dg',payload:'x'.repeat(2000)});assert.equal(data.headers.get('cache-control'),'no-store');assert.equal(data.headers.get('content-encoding'),'gzip');
    assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await fetch(base+'/readyz')).status,200);
    const blocked=await fetch(base+'/api/analysis-selection',{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,403);
    const saved=await fetch(base+'/api/analysis-selection',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({kind:'product',keys:['JUAX'],included:false})});assert.equal(saved.status,200);assert.equal((await saved.json()).revision,2);
    assert.equal((await fetch(base+'/api/local-stock',{method:'POST'})).status,405);
  }finally{await app.close();await rm(folder,{recursive:true,force:true});}
  assert.equal(closed,true);
});

test('les exclusions de production persistent sans resemer les decisions supprimees',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'ukit-selection-prod-'));
  const filename=join(folder,'selection.sqlite');let store;
  try{
    store=productionSelection(filename);
    assert.equal(store.read().rules.length,86);
    store.save({kind:'product',keys:['JUAX'],included:false});
    store.save({kind:'product',keys:['ZEM-MOT'],included:null});
    const revision=store.read().revision;store.close();store=productionSelection(filename);
    assert.equal(store.read().revision,revision);
    assert.equal(store.read().rules.find(r=>r.key==='JUAX').included,false);
    assert.equal(store.read().rules.some(r=>r.key==='ZEM-MOT'),false);
  }finally{store?.close();await rm(folder,{recursive:true,force:true});}
});

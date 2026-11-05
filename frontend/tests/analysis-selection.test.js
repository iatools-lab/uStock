import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSelectionStore, inclusionSQL } from '../server/analysis-selection.mjs';

test('les décisions persistent après fermeture et peuvent être annulées',()=>{
  const folder=mkdtempSync(join(tmpdir(),'ukit-selection-')),file=join(folder,'selection.sqlite');let store=openSelectionStore(file);
  try{
    assert.deepEqual(store.read().rules,[]);
    store.save({kind:'product',keys:['PRODUCT-1'],included:false,reason:'Produit de test'});
    store.save({kind:'asset',keys:['SERIAL-1'],included:true});
    store.close();store=openSelectionStore(file);
    assert.equal(store.read().rules.length,2);assert.equal(store.read().revision,2);
    assert.ok(store.read().rules.find(r=>r.key==='SERIAL-1').included);
    store.save({kind:'asset',keys:['SERIAL-1'],included:null});assert.equal(store.read().rules.length,1);
  }finally{store.close();unlinkSync(file);rmdirSync(folder);}
});
test('les sélections invalides ne modifient pas les règles',()=>{
  const store=openSelectionStore(':memory:');try{
    for(const payload of [{kind:'other',keys:['X'],included:false},{kind:'asset',keys:[],included:false},{kind:'asset',keys:['X'],included:'false'},{kind:'asset',keys:[''],included:true}])assert.throws(()=>store.save(payload),/INVALID_SELECTION/);
    assert.equal(store.read().revision,0);
    const values=['date'];const sql=inclusionSQL({rules:[{kind:'asset',key:'safe\' OR true',included:false}]},values);
    assert.ok(!sql.includes('safe'));assert.deepEqual(values[2],["safe' OR true"]);
  }finally{store.close();}
});

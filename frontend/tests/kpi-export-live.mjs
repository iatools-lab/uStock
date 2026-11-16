import assert from 'node:assert/strict';
import {createLocalDatabase} from '../server/local-database.mjs';
import {productionSelection} from '../server/production-selection.mjs';
const db=createLocalDatabase({selectionStore:productionSelection(':memory:')});
try{
 const filters={role:'dg',view:'overview',startDate:'2026-10-01',endDate:'2026-10-31'};
 const data=await db.snapshot(new URLSearchParams(filters));
 for(const [key,status] of [['total',''],['instock','INSTOCK'],['defective','DEFECTIVE']]){
  const params=new URLSearchParams({...filters,exportDetails:'true',revision:String(data.selection.revision),expectedCount:data.metrics[key].value});
  if(status)params.set('status',status);
  const result=await db.exportSales(params);assert.equal(result.total,Number(data.metrics[key].value));
  if(status)assert.ok(result.rows.every(r=>r.status===status));
  if(key==='instock')assert.ok(result.rows.every(r=>r.productReference&&r.serialNumber));
  const identities=result.rows.map(r=>r.serialNumber||'contract:'+r.contractNumber);assert.equal(new Set(identities).size,result.total);
  console.log(`${key}: ${result.total} lignes, identifiants et KPI concordent.`);
 }
 const admin=await db.administration(new URLSearchParams());
 const excluded=await db.exportSales(new URLSearchParams({adminExport:'true',exportDetails:'true',scope:'excluded',revision:String(admin.selection.revision),expectedCount:String(admin.counts.excluded)}));
 assert.ok(excluded.rows.every(r=>!r.included));console.log(`Administration: ${excluded.total} exclusions exportees.`);
}finally{await db.close();}

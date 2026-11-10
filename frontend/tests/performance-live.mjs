import assert from 'node:assert/strict';
import { createLocalDatabase } from '../server/local-database.mjs';
import { productionSelection } from '../server/production-selection.mjs';
const database=createLocalDatabase({selectionStore:productionSelection(':memory:')});
try{
 const data=await database.snapshot(new URLSearchParams({role:'dg',view:'performance',startDate:'2026-10-01',endDate:'2026-10-31'}));
 const sales=data.analysis.rows.filter(r=>r.status==='DEPLOYED').reduce((n,r)=>n+r.quantity,0);
 assert.equal(sales,Number(data.metrics.deployed.value));
 assert.equal(data.analysis.previous.window.start,'2026-09-01');assert.equal(data.analysis.previous.window.end,'2026-09-30');
 console.log(`Lecture distante : ${sales} premieres ventes, total identique au KPI du meme perimetre. Reference septembre validee.`);
}finally{await database.close();}

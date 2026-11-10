import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createProductionServer } from '../server/production.mjs';
import { queryStock } from '../server/stock-query.mjs';
import { client } from './director-data.mjs';
const app=createProductionServer({database:{snapshot:params=>queryStock(client,params),health:async()=>{},close:async()=>{}}});let browser;
try{
 await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/directeur/stock-national');
 for(const label of ['Zone','Area manager','Détenteur']){
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.locator('.territory-card--unassigned .territory-mix-button').click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.equal(await dialog.locator('tbody tr').count(),2);
  assert.ok((await dialog.innerText()).includes('Kit Alpha'));
  await page.getByRole('button',{name:'Fermer le mix produit'}).click();
 }
 await page.goto(base+'/directeur/carte');
 await page.getByRole('button',{name:'Région non renseignée',exact:true}).click();
 await page.getByRole('dialog').waitFor();assert.equal(await page.locator('dialog tbody tr').count(),2);
 await page.getByRole('button',{name:'Fermer le mix produit'}).click();
 for(const path of ['/dc','/supply-chain','/am','/it']){await page.goto(base+path);await page.waitForURL(base+'/directeur');}
 async function chartBeforeTables(){
  await page.locator('.live-stock > p[role="status"]').waitFor({state:'hidden'});
  await page.locator('.apexcharts-canvas').first().waitFor();
  assert.ok(await page.evaluate(()=>{const nodes=[...document.querySelectorAll('.live-stock .apex-chart,.live-stock .table-panel')];const firstTable=nodes.findIndex(n=>n.classList.contains('table-panel'));return firstTable<0||nodes.slice(firstTable).every(n=>!n.classList.contains('apex-chart'));}));
 }
 await page.goto(base+'/directeur/previsions?startDate=2026-10-01&endDate=2026-10-31');await chartBeforeTables();
 for(const label of ['Par area manager','Par kit']){await page.getByRole('tab',{name:label,exact:true}).click();await chartBeforeTables();}
 await page.goto(base+'/directeur/analytique?startDate=2026-10-01&endDate=2026-10-31');await chartBeforeTables();
 for(const label of ['Kit','État']){await page.getByRole('tab',{name:label,exact:true}).click();await chartBeforeTables();}
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/directeur/stock-national');
 await page.locator('.territory-card--unassigned .territory-mix-button').click();await page.getByRole('dialog').waitFor();
 assert.deepEqual(errors,[]);
 console.log('DG seul, mix sans rattachement (3 niveaux + region), graphiques avant tableaux et mobile : OK.');
}finally{await browser?.close();await app.close();}

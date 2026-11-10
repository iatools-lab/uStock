import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createProductionServer } from '../server/production.mjs';
import { queryStock } from '../server/stock-query.mjs';
import { client } from './director-data.mjs';
const memo=new Map();
const fixture={query:async(sql,values=[])=>{const data=await client.query(sql,values);if(sql.includes('GROUP BY month,product_reference,status,holder_id,routing_shop_id')&&values[0]<'2026-10-01')return {rows:data.rows.map(r=>({...r,quantity:r.status==='DEPLOYED'?r.quantity*2:r.quantity}))};return data;}};
const database={snapshot:params=>{const key=params.toString();if(!memo.has(key))memo.set(key,queryStock(fixture,params));return memo.get(key);},health:async()=>{},close:async()=>{}};
const app=createProductionServer({database});let browser;
try{
 await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${app.server.address().port}`,period='?startDate=2026-10-01&endDate=2026-10-31';
 await page.goto(base+'/directeur/performance'+period);
 await page.getByRole('heading',{name:'Comparaison détaillée des performances'}).waitFor({timeout:60000});
 assert.ok((await page.locator('.decision-kpis').innerText()).includes('−2'));
 for(const tab of ['Zones','Area managers','Produits']){
  await page.getByRole('tab',{name:tab,exact:true}).click();
  assert.equal(await page.locator('#performance-panel > .chart-frame').count(),3);
  for(const frame of await page.locator('#performance-panel > .chart-frame').all()){
   const info=frame.locator(':scope > .chart-info button').first();await info.click();
   assert.ok((await frame.getByRole('note').innerText()).length>100);await info.press('Escape');
   assert.equal(await frame.getByRole('note').count(),0);
  }
 }
 const yearly=page.waitForResponse(r=>r.url().includes('comparison=year')&&r.status()===200);
 yearly.catch(()=>{});
 await page.getByLabel('Période de référence',{exact:true}).selectOption('year');const data=await(await yearly).json();assert.equal(data.analysis.previous.window.start,'2025-10-01');
 await page.locator('.live-stock > p[role="status"]').waitFor({state:'hidden'});
 const frame=page.locator('#performance-panel > .chart-frame').first();await frame.getByRole('button',{name:/Agrandir/}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:/Comprendre/}).click();await dialog.getByRole('note').waitFor();
 await dialog.getByRole('button',{name:/Comprendre/}).press('Escape');assert.equal(await dialog.isVisible(),true);
 await dialog.getByRole('button',{name:'Fermer le graphique agrandi'}).click();
 for(const route of ['', '/previsions','/analytique']){
  await page.goto(base+'/directeur'+route+period);await page.locator('.live-stock > p[role="status"]').waitFor({state:'hidden'});
  for(const chart of await page.locator('.chart-frame').all())assert.equal(await chart.locator(':scope > .chart-info button').count(),1);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/directeur/performance'+period);
 await page.getByRole('heading',{name:'Comparaison détaillée des performances'}).waitFor();await page.getByRole('button',{name:/Comprendre/}).first().click();
 const bounds=await page.getByRole('note').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
 assert.deepEqual(errors,[]);console.log('Comparaison, onglets, reference annuelle, aides, agrandissement et mobile : OK.');
}catch(error){console.error(error);throw error;}finally{await browser?.close();await app.close();}

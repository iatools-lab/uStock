import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createProductionServer } from '../server/production.mjs';
import { queryStock } from '../server/queries/stock-query.mjs';
import { client } from './director-data.mjs';

let release,analysisRequested=false;
const gate=new Promise(done=>release=done);
const app=createProductionServer({database:{
 async snapshot(params){if(params.get('section')==='analysis'){analysisRequested=true;await gate;}return queryStock(client,params);},
 health:async()=>{},close:async()=>{},
}});
let browser;
try{
 await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${app.server.address().port}/directeur`);
 await page.locator('.overview-metric strong').first().waitFor();
 await page.getByRole('status').filter({hasText:'Chargement des courbes'}).waitFor();
 assert.ok(analysisRequested);
 assert.equal(Number((await page.locator('.overview-metric strong').nth(1).innerText()).replace(/\D/g,'')),7);
 release();
 await page.getByRole('heading',{name:'Évolution des ventes',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Évolution des ventes par kit',exact:true}).waitFor();
 assert.equal(await page.getByRole('alert').count(),0);
 console.log('KPI affiches avant les courbes, puis trois graphiques de ventes charges sans bloquer la page.');
}finally{release();await browser?.close();await app.close();}

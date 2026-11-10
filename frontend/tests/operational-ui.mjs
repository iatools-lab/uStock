import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createProductionServer } from '../server/production.mjs';
import { createLocalDatabase } from '../server/local-database.mjs';
import { productionSelection } from '../server/production-selection.mjs';

// Lecture distante reelle, decisions de test uniquement en memoire.
const database=createLocalDatabase({selectionStore:productionSelection(':memory:')});
// Les parcours UI reutilisent le meme instantane reel pour ne pas relancer
// neuf fois les memes lectures nationales sur la source distante.
let snapshot;
const app=createProductionServer({database:{...database,snapshot:params=>snapshot??=database.snapshot(new URLSearchParams({...Object.fromEntries(params),role:'dc',view:'commercial'}))}});let browser;
try{
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const period='?startDate=2026-10-01&endDate=2026-10-31';
  for(const path of ['/dc','/dc/reseau','/dc/opportunites','/dc/analytique','/supply-chain','/supply-chain/distribution','/supply-chain/redistribution','/supply-chain/traitement','/supply-chain/approvisionnements']){
    await page.goto(base+path+period);
    await page.locator('[data-live-view]').first().waitFor();
    await page.locator('.live-stock > p[role="status"]').waitFor({state:'hidden',timeout:180000});
    assert.equal(await page.getByRole('alert').count(),0,path);
    assert.ok(await page.locator('.live-stock .panel').count()>0,path);
    if(path==='/dc/reseau'){
      for(const title of ['Area managers','Vendeurs','Produits'])await page.getByRole('button',{name:title,exact:true}).click();
      assert.ok(await page.getByRole('heading',{name:'Objectifs commerciaux'}).count());
    }
    if(path==='/supply-chain/traitement')for(const title of ['Défectueux','Rattachements à compléter'])await page.getByRole('button',{name:title,exact:true}).click();
    console.log(`Parcours valide : ${path}`);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/dc/opportunites'+period);
  await page.locator('.live-stock > p[role="status"]').waitFor({state:'hidden',timeout:180000});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Interfaces DC / supply chain validees avec PostgreSQL distant.');
}finally{await browser?.close();await app.close();}

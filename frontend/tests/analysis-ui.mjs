import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import readExcel from 'read-excel-file/node';
import { forecastNeeds } from '../src/domain/live-analysis.js';

const folder=mkdtempSync(join(tmpdir(),'ukit-analysis-'));
const previous=process.env.UKIT_SELECTION_FILE;
process.env.UKIT_SELECTION_FILE=join(folder,'selection.sqlite');
const server=await createServer({server:{host:'127.0.0.1',port:0}});
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  async function visit(path,view){
    const response=page.waitForResponse(r=>r.url().includes('/api/local-stock?')&&r.url().includes(`view=${view}`)&&r.status()===200,{timeout:90000});
    await page.goto(origin+path);
    const data=await(await response).json();
    await page.locator(`[data-live-view="${view}"]`).last().waitFor({timeout:90000});
    console.log(`Vue ${view} chargée.`);
    return data;
  }
  const data=await visit('/directeur/previsions?startDate=2026-10-01&endDate=2026-10-31','forecast');
  await page.getByRole('heading',{name:'Récapitulatif des besoins'}).waitFor();
  assert.equal(data.analysis.window.days,31);assert.equal(data.analysis.window.granularity,'day');assert.equal(data.analysis.months.length,31);
  const matrix=page.locator('section').filter({has:page.getByRole('heading',{name:'Besoins par zone et type de produit',exact:true})}).last();
  const xlsxResponse=page.waitForEvent('download');
  await matrix.getByRole('button',{name:'Télécharger Excel : Besoins par zone et type de produit',exact:true}).click();
  const xlsx=await xlsxResponse;assert.ok(xlsx.suggestedFilename().endsWith('.xlsx'));
  const xlsxPath=join(folder,'besoins.xlsx');await xlsx.saveAs(xlsxPath);
  const exported=await readExcel(xlsxPath);const sheet=exported.find(s=>s.sheet==='Donnees').data;
  assert.equal(sheet[0][0],'Zone');assert.equal(sheet.at(-1).at(-1),forecastNeeds(data.analysis,'zone',90,14).totals.need);
  assert.equal(await page.getByRole('heading',{name:'Détail par lieu et produit'}).count(),0);

  const totals=['zone','amId','product'].map(d=>forecastNeeds(data.analysis,d,90,14).totals.need);
  assert.equal(totals[0],totals[1]);assert.equal(totals[1],totals[2]);
  for(const title of ['Par zone','Par area manager','Par kit']){
    await page.getByRole('tab',{name:title,exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:title,exact:true}).getAttribute('aria-selected'),'true');
    await page.locator('.live-analysis .apexcharts-canvas').nth(1).waitFor();
  }
  assert.equal(await page.getByLabel('Horizon de prévision',{exact:true}).count(),0);
  assert.equal(await page.getByLabel('Marge de sécurité',{exact:true}).count(),0);
  assert.equal(await page.locator('.live-analysis select').count(),0);
  const analyticsData=await visit('/directeur/analytique?startDate=2026-10-01&endDate=2026-10-31','analytics');
  const expand=page.getByRole('button',{name:'Agrandir : Quelles zones gagnent ou perdent des ventes ?',exact:true});
  await expand.click();
  const detail=page.locator('.chart-detail-dialog');
  await detail.waitFor();
  await detail.locator('.apexcharts-canvas').waitFor();
  const compact=await expand.boundingBox();assert.ok(compact.width<=32&&compact.height<=32);
  await detail.locator('.apexcharts-zoom-icon').waitFor();
  await detail.locator('.apexcharts-pan-icon').click();
  await detail.locator('.apexcharts-zoom-icon').click();
  await detail.locator('.apexcharts-menu-icon').click();
  const csvResponse=page.waitForEvent('download');
  await detail.locator('.apexcharts-menu .exportCSV').click();
  const download=await csvResponse;assert.ok(download.suggestedFilename().endsWith('.csv'));assert.equal(await download.failure(),null);
  const regions=new Set(analyticsData.analysis.rows.filter(r=>r.status==='DEPLOYED').map(r=>r.zone||'__unknown__'));
  assert.equal(await detail.locator('.chart-legend button').count(),regions.size);
  assert.equal(await detail.locator('thead th').count(),regions.size+1);
  assert.ok(!(await detail.locator('.chart-legend').innerText()).includes('Autres'));
  await detail.getByRole('button',{name:'Tout masquer',exact:true}).click();
  assert.equal(await detail.locator('[data-chart-type="line"]').count(),0);
  await detail.getByRole('button',{name:'Tout afficher',exact:true}).click();
  await detail.locator('.apexcharts-canvas').waitFor();
  await page.waitForFunction(n=>document.querySelectorAll('.chart-detail-dialog .apexcharts-line-series .apexcharts-series').length===n,regions.size);
  await detail.getByLabel('Rechercher une série').fill('Zone 1');
  assert.equal(await detail.locator('.chart-legend button').count(),1);
  await page.keyboard.press('Escape');
  await detail.waitFor({state:'hidden'});
  assert.equal(await expand.evaluate(e=>e===document.activeElement),true);
  assert.equal(analyticsData.analysis.months.length,31);
  const monthResponse=page.waitForResponse(r=>r.url().includes('granularity=month')&&r.status()===200,{timeout:90000});
  await page.getByRole('button',{name:/^Filtres/}).click();
  await page.getByLabel('Pas de temps',{exact:true}).selectOption('month');
  const monthly=await(await monthResponse).json();assert.equal(monthly.analysis.months.length,1);
  assert.equal(monthly.analysis.rows.filter(r=>r.status==='DEPLOYED').reduce((n,r)=>n+r.quantity,0),analyticsData.analysis.rows.filter(r=>r.status==='DEPLOYED').reduce((n,r)=>n+r.quantity,0));
  await page.getByRole('button',{name:'Fermer les filtres',exact:true}).click();
  await page.getByText('Voir les chiffres de la période',{exact:true}).click();
  await page.getByRole('heading',{name:'Récapitulatif mensuel',exact:true}).waitFor();

  for(const title of ['Lieu','Kit','État']){
    await page.getByRole('tab',{name:title,exact:true}).click();
    await page.locator('.live-analysis .apexcharts-canvas').nth(1).waitFor();
    assert.ok(await page.getByRole('heading',{name:'Récapitulatif mensuel'}).isVisible());
  }
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.getByRole('tab',{name:'État',exact:true}).isVisible());
  assert.equal(await page.locator('.analysis-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);
  await page.setViewportSize({width:1440,height:1000});
  const stock=await visit('/directeur/stock-national','stock');
  assert.deepEqual(await page.locator('.distribution-controls .level-tabs button').allTextContents(),['Zone','Area manager','Détenteur']);
  assert.ok(!(await page.locator('main').innerText()).includes('Situation au'));

  await page.locator('.territory-mix-button').first().click();
  await page.getByRole('dialog').waitFor();
  await page.locator('.product-mix-dialog [data-chart-type="donut"] .apexcharts-canvas').waitFor({state:'visible',timeout:30000});
  assert.ok(await page.getByRole('region',{name:'Mix produit par état'}).isVisible());
  await page.getByRole('dialog').getByRole('button',{name:'Agrandir : Parc analysé par produit',exact:true}).click();
  await page.locator('.chart-detail-dialog [data-chart-type="donut"] .apexcharts-canvas').waitFor({state:'visible',timeout:30000});
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.product-mix-dialog').isVisible());
  const place=await page.locator('#product-mix-title').textContent();
  assert.equal(await page.locator('.product-state-table tbody tr').count(),new Set(stock.territories.rows.filter(r=>r.label===place).map(r=>r.productReference)).size);
  await visit('/directeur/performance?startDate=2026-10-01&endDate=2026-10-31','performance');
  await page.getByRole('heading',{name:'Résultats par zone',exact:true}).waitFor();
  assert.equal(await page.locator('.director-menu-content[data-live-view=performance] select').count(),0);
  assert.ok(await page.locator('.zone-performance-card').count()>0);
  assert.ok(!(await page.locator('main').innerText()).includes('Situation au'));
  if(process.env.UKIT_REVIEW_SCREENSHOT)await page.screenshot({path:process.env.UKIT_REVIEW_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Chrome : prévisions, totaux des trois dimensions, horizon, onglets analytiques, mobile et mix par état vérifiés sur la base distante.');
}finally{
  await browser?.close();await server.close();
  if(previous===undefined)delete process.env.UKIT_SELECTION_FILE;else process.env.UKIT_SELECTION_FILE=previous;
  rmSync(folder,{recursive:true,force:true});
}

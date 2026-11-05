// Revue Chromium locale sans dépendance supplémentaire (Node 24).
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 4179, strictPort: true } });
const profile = await mkdtemp(join(tmpdir(), 'upowa-review-'));
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9347', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let pages;
  for (let i = 0; i < 60; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9347/json/list')).json(); if (pages.length) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(pages?.length, 'Chromium indisponible');
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const requests = new Map(), errors = [], apiCalls = [];
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/dg/')) apiCalls.push(message.params.request.url);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.id) { const pending = requests.get(message.id); requests.delete(message.id); if (!pending) return; message.error ? pending.reject(message.error) : pending.resolve(message.result); }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    const timer = setTimeout(() => { requests.delete(current); reject(new Error('CDP timeout: ' + method)); }, 15000);
    requests.set(current, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const ready = async () => {
    for (let i = 0; i < 50; i++) { if (await evaluate('!!document.querySelector(".overview, .director-menu-content, .commercial-content")')) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error('Page non chargée');
  };
  await call('Network.enable'); await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width:1366, height:768, deviceScaleFactor:1, mobile:false });
  async function navigate(path) {
    await call('Page.navigate', { url:'http://127.0.0.1:4179'+path }); await ready();
  }
  async function clickText(text) {
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.innerText===' + JSON.stringify(text) + ').click()');
  }
  async function select(label, value) {
    await evaluate('(()=>{const e=document.querySelector(' + JSON.stringify('[aria-label="'+label+'"]') + ');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');
  }
  // Les tableaux individuels sont réservés à la traçabilité du DC.
  for (const menu of ['', 'disponibilite', 'reseau', 'couverture', 'risques', 'carte']) {
    await navigate('/dc/'+menu);
    assert.equal(await evaluate('document.querySelectorAll(".role-menu a").length'),7);
    assert.equal(await evaluate('document.querySelectorAll("main table").length'),0,menu);
    assert.equal(await evaluate('document.querySelectorAll("#dc-detail,#commercial-inspection,#explorer").length'),0,menu);
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),menu+' mobile');
    await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  }
  await navigate('/dc/disponibilite');
  assert.ok(await evaluate('document.querySelector("main").innerText.toLowerCase().includes("entrepôt central")'));
  assert.equal(await evaluate('document.querySelectorAll(".dc-availability .bar-track").length'),0);
  assert.equal(await evaluate('document.querySelectorAll(".dc-availability-card").length'),6);
  assert.equal(await evaluate('document.querySelectorAll(".dc-availability-card dd").length'),18);
  assert.equal(await evaluate('document.querySelector("main").innerText.includes("Voir les kits disponibles")'),false);
  await clickText('Localisation du stock');
  assert.ok(await evaluate('[...document.querySelectorAll(".territory-card")].some(e=>e.innerText.includes("Entrepôt central"))'));
  await clickText('Région');
  assert.ok(await evaluate('![...document.querySelectorAll(".territory-card")].some(e=>e.innerText.includes("Entrepôt central"))'));
  assert.equal(await evaluate('[...document.querySelectorAll(".level-tabs button")].some(b=>b.innerText==="Ville")'),false);
  await evaluate('document.querySelector(".territory-mix-button").focus();document.querySelector(".territory-mix-button").click()');
  assert.ok(await evaluate('!!document.querySelector(".product-mix-dialog[open]")'));
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.ok(await evaluate('document.activeElement.classList.contains("territory-mix-button")'));
  await navigate('/dc/reseau');
  assert.equal(await evaluate('document.querySelector("h1").innerText'),'Performance');
  for (const tab of ['Zones','Régions','Départements','Area Managers','Boutiques','Agents']) {
    await clickText(tab);
    assert.equal(await evaluate('document.querySelectorAll("main table, .temporal-chart").length'),0);
    assert.ok(await evaluate('document.querySelectorAll(".dc-performance-card").length>0'));
  }
  await evaluate('document.querySelector(".dc-performance-card").click()');
  assert.ok(await evaluate('document.querySelector("main").innerText.includes("ventes par produit")'));
  await clickText('← Tous les acteurs');
  const salesBefore=await evaluate('document.querySelector(".commercial-metrics strong").innerText');
  await select('Période de vente','30');
  assert.notEqual(await evaluate('document.querySelector(".commercial-metrics strong").innerText'),salesBefore);
  await navigate('/dc/couverture');
  assert.ok(await evaluate('document.querySelector("main").innerText.includes("Chaque besoin est calculé à la boutique")'));
  for (let step=0;step<4;step++) {
    assert.ok(await evaluate('document.querySelectorAll(".dc-need-card").length>0'));
    const parent=await evaluate('document.querySelector(".dc-need-card .dc-place-total").innerText');
    await evaluate('document.querySelector(".dc-need-card .dc-place-open").click()');
    assert.equal(await evaluate('document.querySelector(".commercial-metrics strong").innerText'),parent.split(' ')[0]);
  }
  assert.equal(await evaluate('document.querySelectorAll(".dc-need-card .dc-place-open").length'),0);
  assert.equal(await evaluate('document.querySelectorAll("form,main table").length'),0);
  await navigate('/dc/risques');
  assert.equal(await evaluate('document.querySelectorAll(".commercial-metrics article").length'),4);
  assert.equal(await evaluate('document.querySelectorAll(".bar-track,main table").length'),0);
  const savParent=await evaluate('document.querySelector(".dc-service-card .dc-place-open").closest("article").querySelector(".dc-place-total").innerText');
  await evaluate('document.querySelector(".dc-service-card .dc-place-open").click()');
  assert.equal(await evaluate('document.querySelector(".commercial-metrics strong").innerText'),savParent.split(' ')[0]);
  assert.ok(await evaluate('document.querySelector(".stock-breadcrumbs").innerText.length>16'));
  await navigate('/dc/tracabilite');
  assert.ok(await evaluate('document.querySelectorAll("main table").length>0'));
  await evaluate('document.querySelector("tbody button").click()');
  assert.ok(await evaluate('!!document.querySelector("dialog[open]")'));
  await evaluate('document.querySelector("dialog button").click()');
  for (const role of ['directeur','dc','supply-chain']) {
    await navigate('/'+role+'/carte?product=Lion');
    assert.equal(await evaluate('document.querySelectorAll(".cameroon-map>svg>path").length'),10);
    assert.ok(await evaluate('document.querySelector(".map-places").innerText.includes("Entrepôt central")'));
    const initial = await evaluate('document.querySelector(".cameroon-map>svg").getAttribute("viewBox")');
    await evaluate('document.querySelector(".map-place-name").click()');
    assert.notEqual(await evaluate('document.querySelector(".cameroon-map>svg").getAttribute("viewBox")'),initial);
    await evaluate('document.querySelector(".map-count").click()');
    assert.ok(await evaluate('document.querySelector("dialog").innerText.includes("Lion")'));
    await evaluate('document.querySelector("dialog .icon-button").click()');
    await evaluate('document.querySelector(".filter-trigger").click()');
    await evaluate('(()=>{const s=document.querySelector("#filter-region");s.value="Ouest";s.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await evaluate('document.querySelector(".filter-close").click()');
    for (let attempt=0; attempt<50; attempt++) {
      if (await evaluate('location.search.includes("region=Ouest") && document.querySelector(".stock-breadcrumbs").innerText==="Cameroun"')) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(await evaluate('!document.querySelector(".map-places").innerText.includes("Entrepôt central")'));
    assert.equal(await evaluate('document.querySelector(".stock-breadcrumbs").innerText'),'Cameroun');
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'carte mobile');
    await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  }
  for (const menu of ['stock','distribution','inventaires','sav','journal']) {
    await navigate('/supply-chain/'+menu);
    assert.ok(await evaluate('!!document.querySelector(".supply-content")'));
  }
  await navigate('/am/stock');
  assert.ok(await evaluate('!!document.querySelector(".national-stock")'));
  assert.ok(await evaluate('!document.querySelector(".national-stock").innerText.includes("Entrepôt central")'));

  await navigate('/directeur');
  assert.ok(await evaluate('document.querySelector("main").innerText.includes("UPYA non connecté")'));
  await navigate('/directeur/stock-national?product=Lion');
  for (const level of ['Zone','Région','Département','Boutique','Agent']) {
    await clickText(level);
    await evaluate('document.querySelector(".territory-mix-button").click()');
    assert.ok(await evaluate('document.querySelector("dialog").innerText.includes("Lion")'));
    await evaluate('document.querySelector("dialog .icon-button").click()');
  }
  await navigate('/directeur/risques');
  assert.equal(await evaluate('location.pathname'),'/directeur');
  assert.deepEqual(apiCalls,[], 'Le frontend ne doit pas appeler les endpoints DG');
  assert.deepEqual(errors,[]);

  console.log('Navigateur : synthèses DC, classements, besoins, SAV agrégé, traçabilité, entrepôt central, carte, filtres, popups et mobile validés sans captures.');
  await call('Browser.close');
} finally {
  ws?.close(); browser.kill(); await new Promise(resolve=>server.httpServer.close(resolve));
}
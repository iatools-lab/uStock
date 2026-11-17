import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MENUS, ROLE_ROUTES } from '../src/navigation/menus.js';
const server=await createServer({cacheDir:'node_modules/.vite-render',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const {default:App}=await server.ssrLoadModule('/src/App.jsx');
 assert.deepEqual(Object.keys(ROLE_ROUTES),['dg']);
 for(const menu of MENUS.dg){
  const route='/directeur'+(menu.path?'/'+menu.path:'')+'?region=Centre';
  const html=renderToString(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(App)));
  for(const marker of ['role-operations','app-shell','sidebar__brand','brand__tagline','main-content','topbar','filter-trigger'])assert.ok(html.includes(marker),route+': '+marker);
  assert.ok(html.includes('<h1>'+menu.label+'</h1>'));
  assert.ok(html.includes('aria-current="page"'));
  assert.ok(html.includes('region=Centre'));
  assert.ok(html.includes('Lecture directe de PostgreSQL distant'));
  assert.ok(!html.includes('NaN'));
  for(const retired of ['/dc','/am/','/it/'])assert.ok(!html.includes('href="'+retired));
  console.log('Rendu DG valide : '+route);
 }
 const admin=renderToString(React.createElement(MemoryRouter,{initialEntries:['/admin']},React.createElement(App)));
 assert.ok(admin.includes('role-admin'));assert.ok(admin.includes('/directeur'));assert.ok(!admin.includes('NaN'));
 console.log('Rendu administration valide.');
 for(const [route,title] of [['/area-manager/dashboard','R\u00e9sum\u00e9'],['/commercial/dashboard','R\u00e9sum\u00e9'],['/supply-chain/dashboard','R\u00e9sum\u00e9'],['/area-manager','Mon stock'],['/area-manager/besoins','Mes besoins'],['/area-manager/livraisons','Mes livraisons'],['/area-manager/activite','Mon activité'],['/commercial','Besoins des Area managers'],['/supply-chain','Demandes à approvisionner']]){
  const html=renderToString(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(App)));
  assert.ok(html.includes(title));assert.ok(html.includes('supply-workspace'));assert.ok(!html.includes('NaN'));
  console.log('Rendu approvisionnement valide : '+route);
 }
}finally{await server.close();}

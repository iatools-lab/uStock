import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MENUS, ROLE_ROUTES, SHARED_DIRECTOR_PATHS } from '../src/navigation/menus.js';

const server = await createServer({
  cacheDir: 'node_modules/.vite-render',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom'
});
try {
  const { default: RealApp } = await server.ssrLoadModule('/src/App.jsx');
  const { default: StockDashboard } = await server.ssrLoadModule('/src/pages/StockDashboard.jsx');
  for (const route of Object.values(ROLE_ROUTES)) {
    const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(RealApp)));
    assert.ok(html.includes('Lecture directe de PostgreSQL distant') && html.includes('Chargement des données'));
    assert.ok(!html.includes('Voir la démonstration'));
    for (const marker of ['role-operations', 'app-shell', 'sidebar__brand', 'brand__tagline', 'main-content', 'topbar', 'filter-trigger']) assert.ok(html.includes(marker), `${route}: mise en page d’origine absente (${marker})`);
    assert.ok(!html.includes('real-workspace') && !html.includes('real-navigation'));
    assert.ok(!html.includes('1 440') && !html.includes('NaN'));
  }
  function App() {
    return React.createElement(Routes, null, ...Object.entries(ROLE_ROUTES).map(([role, path]) => React.createElement(Route, { key: role, path: path + '/*', element: React.createElement(StockDashboard, { role }) })));
  }
  for (const route of ['/directeur', '/dc', '/supply-chain', '/am', '/it']) {
    const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(App)));
    for (const label of ['filter-trigger', 'UPYA non connecté']) assert.ok(html.includes(label), `${route}: ${label} absent`);
    assert.ok(!html.includes('NaN'), `${route}: valeur NaN`);
    assert.ok(!html.includes('<table'), `${route}: tableau présent dans la vue d’ensemble`);
    assert.ok(!html.toLowerCase().includes('transit'), `${route}: transit encore affiché`);
    assert.ok(html.includes('Où sont les kits'), `${route}: répartition absente`);
    console.log(`Rendu React validé : ${route}`);
  }
  for (const [role, menus] of Object.entries(MENUS)) {
    for (const menu of menus.filter(m => m.path)) {
      const route = `${ROLE_ROUTES[role]}/${menu.path}?region=Centre`;
      const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(App)));
      assert.ok(html.includes(`<h1>${menu.label.replaceAll('&', '&amp;')}</h1>`), `${route}: titre absent`);
      assert.ok(html.includes('aria-current="page"'), `${route}: menu actif absent`);
      assert.ok(html.includes('region=Centre'), `${route}: filtres perdus dans la navigation`);
      if (menu.path === 'carte') {
        assert.ok(html.includes('stock-map-page') && html.includes('cameroon-map'), 'Carte absente');
        assert.ok(html.includes('geoBoundaries') && !html.includes('NaN'));
      } else if ((role === 'dg' && SHARED_DIRECTOR_PATHS.includes(menu.path) || role === 'dc' && menu.path === 'tracabilite')) {
        assert.ok(html.includes('filter-trigger'), `${route}: bouton filtres absent`);
        if (menu.path === 'stock-national') assert.ok(!html.includes('<table'), `${route}: tableau hors périmètre`);
        if (menu.path === 'risques') { assert.ok(html.includes('service-risk-table') && html.includes('<table') && html.includes('risk-summary')); assert.ok(!html.includes('service-card') && !html.includes('service-kpis')); }
        assert.ok(!html.includes('Arbitrages et approbations') && !html.includes('Rapports de direction'));
        assert.ok(!html.includes('Son contenu sera développé'), `${route}: contenu non développé`);
      } else if (['dc', 'supply', 'am'].includes(role)) {
        assert.ok(html.includes('commercial-content'));
        assert.ok(!html.includes('Son contenu sera développé'));
      } else if (!(role==='dg'&&['previsions','analytique'].includes(menu.path))) {
        assert.ok(html.includes('Son contenu sera développé'), `${route}: page future absente`);
        assert.ok(!html.includes('territory-card'), `${route}: contenu métier ajouté hors périmètre`);
      }
      if (role === 'dc' && menu.path !== 'tracabilite') {
        assert.ok(!html.includes('<table'), 'Le DC ne doit pas voir de tableau de kits hors traçabilité');
        assert.ok(!html.includes('Explorer le stock et son historique'));
      }
      assert.ok(!html.includes('NaN'), `${route}: valeur NaN`);
    }
    console.log(`Menus validés : ${role} (${menus.length})`);
  }
} finally { await server.close(); }

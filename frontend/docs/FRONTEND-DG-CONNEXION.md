# DG — données fictives

Le frontend DG utilise de nouveau les données fictives communes aux interfaces. Les appels API DG et le proxy Vite sont retirés. Les vues et filtres fonctionnent sans backend.

Le backend, le pipeline BI et les bases sont conservés.

Démarrage : npm run dev depuis frontend. Redémarrer Vite si nécessaire.

Tests sans captures : npm test, npm run test:render, npm run build puis node tests/browser-review.mjs.

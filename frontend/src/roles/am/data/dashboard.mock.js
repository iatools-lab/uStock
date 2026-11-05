export const dashboardData = {
  meta: { lastSync: '10:02', source: 'UPYA', period: 'Janvier — Septembre 2026', perimeter: 'Centre · Yaoundé' },
  kpis: {
    parc: 1240,
    stockActif: 1090,
    chezMoi: 180,
    boutiques: 620,
    agents: 290,
    vendus: 150
  },
  activityTrend: [
    { month: 'Jan', transfers: 62, sales: 11 }, { month: 'Fév', transfers: 78, sales: 13 },
    { month: 'Mar', transfers: 86, sales: 14 }, { month: 'Avr', transfers: 95, sales: 15 },
    { month: 'Mai', transfers: 102, sales: 16 }, { month: 'Juin', transfers: 118, sales: 17 },
    { month: 'Juil', transfers: 127, sales: 19 }, { month: 'Août', transfers: 139, sales: 21 },
    { month: 'Sept', transfers: 148, sales: 24 }
  ],
  stockTrend: [
    { month: 'Jan', active: 860 }, { month: 'Fév', active: 900 }, { month: 'Mar', active: 935 },
    { month: 'Avr', active: 970 }, { month: 'Mai', active: 1005 }, { month: 'Juin', active: 1035 },
    { month: 'Juil', active: 1050 }, { month: 'Août', active: 1070 }, { month: 'Sept', active: 1090 }
  ],
  boutiquesBars: [
    { label: 'Bastos', value: 285 }, { label: 'Essos', value: 230 }, { label: 'Mvog-Mbi', value: 215 }, { label: 'Nsam', value: 180 }
  ],
  products: [
    { label: 'SmartSun M', value: 300 }, { label: 'SmartSun L', value: 240 }, { label: 'Lite 2', value: 180 },
    { label: 'Sunshine', value: 130 }, { label: 'SmartSun XL', value: 110 }, { label: 'Lite 1', value: 90 },
    { label: 'SmartSun XXL', value: 40 }
  ],
  boutiques: [
    { name: 'Boutique Bastos', boutique: 190, agents: 95, total: 285, vendus: 50 },
    { name: 'Boutique Essos', boutique: 160, agents: 70, total: 230, vendus: 40 },
    { name: 'Boutique Mvog-Mbi', boutique: 150, agents: 65, total: 215, vendus: 35 },
    { name: 'Boutique Nsam', boutique: 120, agents: 60, total: 180, vendus: 25 }
  ],
  agents: [
    { name: 'Agent 014', boutique: 'Bastos', kits: 44, produit: 'SmartSun M / L' },
    { name: 'Agent 021', boutique: 'Bastos', kits: 38, produit: 'Lite 2 / M' },
    { name: 'Agent 033', boutique: 'Essos', kits: 35, produit: 'SmartSun L / XL' },
    { name: 'Agent 041', boutique: 'Mvog-Mbi', kits: 31, produit: 'Sunshine / M' },
    { name: 'Agent 056', boutique: 'Nsam', kits: 28, produit: 'Lite 1 / M' }
  ]
};

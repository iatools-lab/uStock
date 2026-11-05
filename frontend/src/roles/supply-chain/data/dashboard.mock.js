export const dashboardData = {
  meta: { lastSync: '10:02', source: 'UPYA', period: 'Janvier — Septembre 2026' },
  kpis: {
    stockActif: 11742,
    central: 2722,
    areaManagers: 1960,
    boutiques: 4280,
    agents: 2780,
    vendus: 6710
  },
  flowsTrend: [
    { month: 'Jan', receipts: 1180, distributed: 1010 },
    { month: 'Fév', receipts: 1060, distributed: 970 },
    { month: 'Mar', receipts: 1240, distributed: 1120 },
    { month: 'Avr', receipts: 1160, distributed: 1090 },
    { month: 'Mai', receipts: 1320, distributed: 1210 },
    { month: 'Juin', receipts: 1410, distributed: 1330 },
    { month: 'Juil', receipts: 1280, distributed: 1250 },
    { month: 'Août', receipts: 1510, distributed: 1430 },
    { month: 'Sept', receipts: 1470, distributed: 1390 }
  ],
  centralTrend: [
    { month: 'Jan', active: 3180 }, { month: 'Fév', active: 3090 }, { month: 'Mar', active: 3210 },
    { month: 'Avr', active: 3025 }, { month: 'Mai', active: 2980 }, { month: 'Juin', active: 2895 },
    { month: 'Juil', active: 2810 }, { month: 'Août', active: 2760 }, { month: 'Sept', active: 2722 }
  ],
  regions: [
    { label: 'Centre', value: 2670 }, { label: 'Littoral', value: 2250 }, { label: 'Ouest', value: 1700 },
    { label: 'Sud', value: 1090 }, { label: 'Adamaoua', value: 1050 }, { label: 'Nord', value: 1020 },
    { label: 'Est', value: 980 }, { label: 'Extrême-Nord', value: 982 }
  ],
  products: [
    { label: 'SmartSun M', value: 3000 }, { label: 'SmartSun L', value: 2500 }, { label: 'SmartSun XL', value: 1700 },
    { label: 'Lite 1', value: 1400 }, { label: 'Lite 2', value: 1250 }, { label: 'Sunshine', value: 900 },
    { label: 'SmartSun XXL', value: 600 }, { label: 'Lion', value: 392 }
  ],
  regionsDetail: [
    { name: 'Centre', am: 420, boutiques: 1230, agents: 1020, total: 2670 },
    { name: 'Littoral', am: 360, boutiques: 1080, agents: 810, total: 2250 },
    { name: 'Ouest', am: 290, boutiques: 810, agents: 600, total: 1700 },
    { name: 'Sud', am: 170, boutiques: 520, agents: 400, total: 1090 },
    { name: 'Adamaoua', am: 200, boutiques: 490, agents: 360, total: 1050 }
  ],
  holders: [
    { name: 'Magasin Central Yaoundé', type: 'Magasin', region: 'Centre', kits: 2722 },
    { name: 'AM Yaoundé Centre', type: 'Area Manager', region: 'Centre', kits: 420 },
    { name: 'AM Douala', type: 'Area Manager', region: 'Littoral', kits: 360 },
    { name: 'Boutique Bastos', type: 'Boutique', region: 'Centre', kits: 212 },
    { name: 'Boutique Akwa', type: 'Boutique', region: 'Littoral', kits: 198 }
  ]
};

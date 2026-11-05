export const dashboardData = {
  meta: { lastSync: '10:02', source: 'UPYA', period: 'Janvier — Septembre 2026' },
  kpis: {
    stockActif: 11742,
    areaManagers: 1960,
    boutiques: 4280,
    agents: 2780,
    vendus: 6710,
    detenteurs: 176
  },
  salesTrend: [
    { month: 'Jan', sales: 510, assignments: 620 },
    { month: 'Fév', sales: 590, assignments: 690 },
    { month: 'Mar', sales: 620, assignments: 730 },
    { month: 'Avr', sales: 690, assignments: 760 },
    { month: 'Mai', sales: 720, assignments: 810 },
    { month: 'Juin', sales: 780, assignments: 860 },
    { month: 'Juil', sales: 860, assignments: 920 },
    { month: 'Août', sales: 940, assignments: 980 },
    { month: 'Sept', sales: 1000, assignments: 1040 }
  ],
  stockTrend: [
    { month: 'Jan', active: 13040 }, { month: 'Fév', active: 12910 }, { month: 'Mar', active: 12780 },
    { month: 'Avr', active: 12660 }, { month: 'Mai', active: 12490 }, { month: 'Juin', active: 12280 },
    { month: 'Juil', active: 12090 }, { month: 'Août', active: 11910 }, { month: 'Sept', active: 11742 }
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
  areaManagers: [
    { name: 'AM Yaoundé Centre', region: 'Centre', stock: 620, boutiques: 6, agents: 31, vendus: 740 },
    { name: 'AM Douala', region: 'Littoral', stock: 570, boutiques: 5, agents: 28, vendus: 690 },
    { name: 'AM Bafoussam', region: 'Ouest', stock: 430, boutiques: 4, agents: 23, vendus: 510 },
    { name: 'AM Garoua', region: 'Nord', stock: 340, boutiques: 3, agents: 17, vendus: 300 }
  ],
  holders: [
    { name: 'Boutique Bastos', type: 'Boutique', region: 'Centre', kits: 212 },
    { name: 'Boutique Akwa', type: 'Boutique', region: 'Littoral', kits: 198 },
    { name: 'AM Yaoundé Centre', type: 'Area Manager', region: 'Centre', kits: 184 },
    { name: 'Boutique Bafoussam 1', type: 'Boutique', region: 'Ouest', kits: 176 },
    { name: 'Agent Commercial 021', type: 'Agent', region: 'Centre', kits: 84 }
  ]
};

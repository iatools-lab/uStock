const regions = [
  { name: 'Centre', active: 1860, am: 340, boutiques: 900, agents: 620, sold: 1740 },
  { name: 'Littoral', active: 1590, am: 290, boutiques: 760, agents: 540, sold: 1320 },
  { name: 'Ouest', active: 1300, am: 260, boutiques: 620, agents: 420, sold: 910 },
  { name: 'Extrême-Nord', active: 990, am: 220, boutiques: 460, agents: 310, sold: 620 },
  { name: 'Nord', active: 860, am: 190, boutiques: 400, agents: 270, sold: 520 },
  { name: 'Adamaoua', active: 770, am: 180, boutiques: 350, agents: 240, sold: 430 },
  { name: 'Est', active: 830, am: 220, boutiques: 360, agents: 250, sold: 382 },
  { name: 'Sud', active: 800, am: 220, boutiques: 360, agents: 220, sold: 320 }
];

const products = [
  { name: 'SmartSun M', active: 2860, sold: 1550 },
  { name: 'SmartSun L', active: 2310, sold: 1280 },
  { name: 'SmartSun Lite 2', active: 1980, sold: 960 },
  { name: 'Sunshine', active: 1640, sold: 870 },
  { name: 'SmartSun XL', active: 1320, sold: 650 },
  { name: 'Lion 32 / 40', active: 1100, sold: 542 },
  { name: 'Autres', active: 1000, sold: 390 }
];

const shopsByRegion = {
  Centre: ['Boutique Bastos', 'Boutique Mvog-Mbi', 'Boutique Essos', 'Boutique Nsam'],
  Littoral: ['Boutique Douala Akwa', 'Boutique Bonamoussadi', 'Boutique Bépanda'],
  Ouest: ['Boutique Bafoussam 1', 'Boutique Bafoussam 2', 'Boutique Mbouda', 'Boutique Dschang'],
  'Extrême-Nord': ['Boutique Maroua 1', 'Boutique Maroua 2', 'Boutique Kousséri'],
  Nord: ['Boutique Garoua 1', 'Boutique Garoua 2', 'Boutique Guider'],
  Adamaoua: ['Boutique Ngaoundéré 1', 'Boutique Ngaoundéré 2'],
  Est: ['Boutique Bertoua 1', 'Boutique Bertoua 2', 'Boutique Batouri'],
  Sud: ['Boutique Ebolowa', 'Boutique Kribi', 'Boutique Sangmélima']
};

const agentNames = [
  'Junior N.', 'Carine M.', 'Serge T.', 'Nadine F.', 'Armand K.', 'Brice D.', 'Mireille E.', 'Landry P.',
  'Yvan S.', 'Grace B.', 'Patrick A.', 'Alice N.', 'Steve M.', 'Marthe K.', 'Christian F.', 'Estelle T.'
];

function expandProducts(field) {
  const list = [];
  products.forEach((product) => {
    for (let i = 0; i < product[field]; i += 1) list.push(product.name);
  });
  return list;
}

function formatUpdated(index) {
  const day = 21 - (index % 7);
  const hour = 8 + (index % 10);
  const minute = (index * 7) % 60;
  return `${String(day).padStart(2, '0')} sept. 2026 · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function makeKit({ serial, product, status, statusKey, region, areaManager, shop, holder, index }) {
  return {
    id: `UPW-${String(serial).padStart(8, '0')}`,
    product,
    status,
    statusKey,
    region,
    areaManager,
    shop,
    holder,
    updatedAt: formatUpdated(index)
  };
}

function generateKits() {
  const activeProducts = expandProducts('active');
  const soldProducts = expandProducts('sold');
  const kits = [];
  let serial = 10000001;
  let activeProductIndex = 0;
  let soldProductIndex = 0;
  let globalIndex = 0;

  // Stock magasin central : 3 210 kits.
  for (let i = 0; i < 3210; i += 1) {
    kits.push(makeKit({
      serial: serial++,
      product: activeProducts[activeProductIndex++],
      status: 'Magasin central',
      statusKey: 'central',
      region: 'Centre',
      areaManager: '—',
      shop: '—',
      holder: 'Magasin Central Yaoundé',
      index: globalIndex++
    }));
  }

  regions.forEach((region) => {
    for (let i = 0; i < region.am; i += 1) {
      kits.push(makeKit({
        serial: serial++, product: activeProducts[activeProductIndex++], status: 'Chez Area Manager', statusKey: 'am', region: region.name,
        areaManager: `AM ${region.name}`, shop: '—', holder: `AM ${region.name}`, index: globalIndex++
      }));
    }

    for (let i = 0; i < region.boutiques; i += 1) {
      const shops = shopsByRegion[region.name];
      const shop = shops[i % shops.length];
      kits.push(makeKit({
        serial: serial++, product: activeProducts[activeProductIndex++], status: 'En boutique', statusKey: 'boutique', region: region.name,
        areaManager: `AM ${region.name}`, shop, holder: shop, index: globalIndex++
      }));
    }

    for (let i = 0; i < region.agents; i += 1) {
      const shops = shopsByRegion[region.name];
      const shop = shops[i % shops.length];
      const agent = agentNames[(i + regions.indexOf(region) * 3) % agentNames.length];
      kits.push(makeKit({
        serial: serial++, product: activeProducts[activeProductIndex++], status: 'Chez agent', statusKey: 'agent', region: region.name,
        areaManager: `AM ${region.name}`, shop, holder: `${agent} · ${shop.replace('Boutique ', '')}`, index: globalIndex++
      }));
    }
  });

  regions.forEach((region) => {
    for (let i = 0; i < region.sold; i += 1) {
      const shops = shopsByRegion[region.name];
      const shop = shops[i % shops.length];
      kits.push(makeKit({
        serial: serial++, product: soldProducts[soldProductIndex++], status: 'Vendu', statusKey: 'sold', region: region.name,
        areaManager: `AM ${region.name}`, shop, holder: 'Client final', index: globalIndex++
      }));
    }
  });

  return kits;
}

const kits = generateKits();

function aggregateHolders() {
  const map = new Map();
  kits.filter((kit) => kit.statusKey !== 'sold').forEach((kit) => {
    const type = kit.statusKey === 'central' ? 'Magasin' : kit.statusKey === 'am' ? 'Area Manager' : kit.statusKey === 'boutique' ? 'Boutique' : 'Agent';
    const key = `${type}|${kit.holder}`;
    if (!map.has(key)) {
      map.set(key, {
        name: kit.holder,
        type,
        region: kit.region,
        location: kit.shop !== '—' ? kit.shop : (type === 'Magasin' ? 'Yaoundé' : kit.region),
        value: 0
      });
    }
    map.get(key).value += 1;
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

const holders = aggregateHolders();

export const directeurMock = {
  meta: {
    apiSource: 'UPYA',
    syncStatus: 'Connecté',
    lastSync: '21 sept. 2026 · 09:58',
    refreshInterval: '5 min',
    endpoint: '/directeur'
  },
  kpis: {
    parcTotal: 18452,
    stockActif: 12210,
    magasinCentral: 3210,
    areaManagers: 1920,
    boutiques: 4210,
    agents: 2870,
    vendus: 6242
  },
  regions,
  products,
  holders,
  topHolders: holders.slice(0, 7),
  kits,
  timeSeries: {
    flows: [
      { label: 'Jan', entries: 920, sales: 510 },
      { label: 'Fév', entries: 1180, sales: 590 },
      { label: 'Mar', entries: 860, sales: 640 },
      { label: 'Avr', entries: 1340, sales: 710 },
      { label: 'Mai', entries: 1260, sales: 760 },
      { label: 'Juin', entries: 1510, sales: 690 },
      { label: 'Juil', entries: 1420, sales: 820 },
      { label: 'Août', entries: 1670, sales: 910 },
      { label: 'Sept', entries: 1210, sales: 612 }
    ],
    stock: [
      { label: 'Jan', active: 9450 },
      { label: 'Fév', active: 10040 },
      { label: 'Mar', active: 10260 },
      { label: 'Avr', active: 10890 },
      { label: 'Mai', active: 11390 },
      { label: 'Juin', active: 12210 },
      { label: 'Juil', active: 12810 },
      { label: 'Août', active: 13570 },
      { label: 'Sept', active: 12210 }
    ]
  }
};

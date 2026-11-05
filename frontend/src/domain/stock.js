// Modèle de démonstration indépendant d'UPYA. Aucun endpoint fournisseur supposé.
export const AS_OF = '2026-09-21T10:00:00.000Z';
export const DEMO_AM = 'am-0';
export const PRODUCTS = ['SmartSun M', 'SmartSun L', 'SmartSun Lite 2', 'Sunshine', 'SmartSun XL', 'Lion'];
export const FILTERS = [['zone', 'Zone'], ['region', 'Région'], ['department', 'Département'], ['amId', 'AM'], ['shopId', 'Boutique'], ['agentId', 'Agent'], ['product', 'Type produit']];
export const EMPTY_FILTERS = Object.fromEntries(FILTERS.map(([key]) => [key, '']));
export const LIFE_LABELS = { in_stock: 'En stock', sold: 'Vendu', lost: 'Perdu', written_off: 'Réformé' };
export const CONDITION_LABELS = { good: 'Bon état', defective: 'Défectueux', repair: 'En réparation', quarantine: 'En quarantaine' };
export const EVENT_LABELS = { receive: 'Réception magasin central', transfer: 'Transfert enregistré', sell: 'Vente et livraison', defect: 'Défaut signalé', quarantine: 'Mise en quarantaine', repair: 'Départ en réparation', restore: 'Contrôle qualité validé', reserve: 'Réservation', release: 'Libération de réservation', return: 'Retour client reçu', lose: 'Perte approuvée', write_off: 'Réforme approuvée' };
export const ROLE_LABELS = { dg: 'Directeur Général', dc: 'Directeur Commercial', supply: 'Supply Chain', am: 'Area Manager', it: 'Pôle IT' };

// Zones commerciales et rattachements fictifs, à remplacer par le référentiel upOwa.
const territories = [
  ['Centre-Sud', 'Centre', ['Mfoundi', 'Méfou-et-Afamba'], ['Bastos', 'Essos', 'Mfou', 'Awaé']],
  ['Littoral-Ouest', 'Littoral', ['Wouri', 'Moungo'], ['Akwa', 'Bonamoussadi', 'Nkongsamba', 'Loum']],
  ['Littoral-Ouest', 'Ouest', ['Mifi', 'Menoua'], ['Bafoussam 1', 'Bafoussam 2', 'Dschang', 'Santchou']],
  ['Grand Nord', 'Extrême-Nord', ['Diamaré', 'Logone-et-Chari'], ['Maroua 1', 'Maroua 2', 'Kousséri', 'Makary']],
  ['Grand Nord', 'Nord', ['Bénoué', 'Mayo-Louti'], ['Garoua 1', 'Garoua 2', 'Guider', 'Figuil']],
  ['Grand Nord', 'Adamaoua', ['Vina', 'Mbéré'], ['Ngaoundéré 1', 'Ngaoundéré 2', 'Meiganga', 'Djohong']],
  ['Est', 'Est', ['Lom-et-Djérem', 'Kadey'], ['Bertoua 1', 'Bertoua 2', 'Batouri', 'Kenzou']],
  ['Centre-Sud', 'Sud', ['Mvila', 'Océan'], ['Ebolowa 1', 'Ebolowa 2', 'Kribi', 'Campo']]
];
const demoCities = [
  ['Yaoundé', 'Yaoundé', 'Mfou', 'Awaé'], ['Douala', 'Douala', 'Nkongsamba', 'Loum'], ['Bafoussam', 'Bafoussam', 'Dschang', 'Santchou'],
  ['Maroua', 'Maroua', 'Kousséri', 'Makary'], ['Garoua', 'Garoua', 'Guider', 'Figuil'], ['Ngaoundéré', 'Ngaoundéré', 'Meiganga', 'Djohong'],
  ['Bertoua', 'Bertoua', 'Batouri', 'Kenzou'], ['Ebolowa', 'Ebolowa', 'Kribi', 'Campo']
];
export const locations = [{ id: 'central', name: 'Magasin central Yaoundé', type: 'central', zone: 'Centre-Sud', region: 'Centre', department: 'Mfoundi', city: 'Yaoundé', amId: '', shopId: '', agentId: '' }];
territories.forEach(([zone, region, departments, shops], r) => {
  const amId = `am-${r}`;
  locations.push({ id: amId, name: `AM ${region}`, type: 'am', zone, region, department: departments[0], city: demoCities[r][0], amId, shopId: '', agentId: '' });
  shops.forEach((name, s) => {
    const shopId = `shop-${r}-${s}`;
    const geography = { zone, region, department: departments[Math.floor(s / 2)], city: demoCities[r][s], amId, shopId };
    locations.push({ id: shopId, name: `Boutique ${name}`, type: 'shop', ...geography, agentId: '' });
    for (let a = 0; a < 2; a++) locations.push({ id: `agent-${r}-${s}-${a}`, name: `Agent ${r + 1}${s + 1}${a + 1} · ${name}`, type: 'agent', ...geography, agentId: `agent-${r}-${s}-${a}` });
  });
});
export const locationById = Object.fromEntries(locations.map(l => [l.id, l]));
export function locationLabel(id) { return locationById[id]?.name || id || 'Non rattaché'; }
const fail = message => { throw new Error(message); };

// Réducteur pur : une opération validée produit un nouvel état et conserve l'historique.
export function applyEvent(kit, event) {
  if (!event.id || !event.actor || !event.reference || !Number.isFinite(Date.parse(event.at))) fail('Événement incomplet.');
  if (kit.history.some(e => e.id === event.id)) {
    if (JSON.stringify(kit.history.find(e => e.id === event.id)) !== JSON.stringify(event)) fail('Identifiant événement réutilisé avec un contenu différent.');
    return kit;
  }
  if (kit.updatedAt && Date.parse(event.at) < Date.parse(kit.updatedAt)) fail('Événement antidaté : rapprochement nécessaire.');
  const next = { ...kit, history: [...kit.history, event], updatedAt: event.at };
  const stock = () => { if (kit.lifecycle !== 'in_stock') fail('Le kit doit être en stock.'); };
  const healthy = () => { if (kit.condition !== 'good') fail('Le kit doit être en bon état.'); };
  switch (event.type) {
    case 'receive':
      if (kit.lifecycle !== 'unreceived' || event.to !== 'central') fail('Réception initiale invalide.');
      Object.assign(next, { lifecycle: 'in_stock', holderId: 'central', condition: 'good', receivedAt: event.at }); break;
    case 'transfer': {
      stock(); healthy();
      if (kit.reserved) fail('Libérer la réservation avant le transfert.');
      const from = locationById[kit.holderId], to = locationById[event.to];
      if (event.from !== kit.holderId || !to) fail('Origine ou destination invalide.');
      const allowed = (from.type === 'central' && to.type === 'am') ||
        (from.type === 'am' && to.type === 'shop' && from.amId === to.amId) ||
        (from.type === 'shop' && to.type === 'agent' && from.shopId === to.shopId);
      if (!allowed) fail('Transfert hors du circuit autorisé.');
      Object.assign(next, { holderId: event.to }); break;
    }
    case 'sell':
      stock(); healthy();
      if (locationById[kit.holderId]?.type !== 'agent' || !event.customerRef || !event.deliveryRef) fail('Agent, référence client et preuve de livraison requis.');
      Object.assign(next, { lifecycle: 'sold', soldAt: event.at, customerRef: event.customerRef, reserved: false }); break;
    case 'return':
      if (kit.lifecycle !== 'sold' || locationById[event.to]?.type !== 'shop' || !event.reason) fail('Retour client invalide.');
      Object.assign(next, { lifecycle: 'in_stock', holderId: event.to, condition: 'quarantine', customerRef: null, reserved: false }); break;
    case 'defect': case 'quarantine': case 'repair': case 'restore':
      stock();
      if (!event.reason) fail('Motif ou résultat du contrôle requis.');
      if (event.type === 'repair' && !['defective', 'quarantine'].includes(kit.condition)) fail('Réparation sans défaut ou quarantaine.');
      if (event.type === 'restore' && kit.condition === 'good') fail('Kit déjà en bon état.');
      next.condition = { defect: 'defective', quarantine: 'quarantine', repair: 'repair', restore: 'good' }[event.type];
      if (event.type !== 'restore') next.reserved = false;
      break;
    case 'reserve': stock(); healthy(); if (kit.reserved) fail('Kit déjà réservé.'); next.reserved = true; break;
    case 'release': stock(); if (!kit.reserved) fail('Kit non réservé.'); next.reserved = false; break;
    case 'lose': case 'write_off':
      stock();
      if (!event.reason || !event.approver || event.approver === event.actor) fail('Motif et approbateur distinct requis.');
      Object.assign(next, { lifecycle: event.type === 'lose' ? 'lost' : 'written_off', reserved: false }); break;
    default: fail('Type d’événement inconnu.');
  }
  return next;
}
export function blankKit(id, product) { return { id, product, lifecycle: 'unreceived', condition: 'good', holderId: null, reserved: false, history: [] }; }
export function replayKit(kit, cutoff = AS_OF) {
  return kit.history.filter(e => e.at <= cutoff).reduce(applyEvent, blankKit(kit.id, kit.product));
}
function createDemo() {
  const kits = [];
  for (let i = 0; i < 1440; i++) {
    let kit = blankKit(`UPW-${String(10000001 + i)}`, PRODUCTS[i % PRODUCTS.length]);
    const region = Math.floor(i / 6) % 8, shop = Math.floor(i / 48) % 4, agent = Math.floor(i / 192) % 2;
    const path = ['central', `am-${region}`, `shop-${region}-${shop}`, `agent-${region}-${shop}-${agent}`];
    let time = Date.UTC(2026, i % 8, 1 + (i % 12), 8);
    const add = (type, args = {}) => {
      const id = `${kit.id}-e${kit.history.length + 1}`;
      kit = applyEvent(kit, { id, type, at: new Date(time).toISOString(), actor: 'Opérateur démonstration', reference: `DOC-${id}`, ...args });
      time += 86400000;
    };
    add('receive', { to: 'central', actor: 'Magasinier central' });
    const stage = Math.floor(i / 7) % 5;
    for (let p = 1; p <= Math.min(stage, 3); p++) {
      const reference = `TR-${i}-${p}`;
      add('transfer', { from: path[p - 1], to: path[p], actor: `Réceptionnaire ${path[p]}`, reference });
    }
    if (stage === 4) {
      add('sell', { actor: locationLabel(path[3]), customerRef: `CLIENT-DEMO-${i}`, deliveryRef: `LIV-${i}` });
      if (i % 31 === 0) add('return', { to: path[2], reason: 'Retour client pour diagnostic' });
    } else if (i % 37 === 0) {
      add('lose', { reason: 'Perte confirmée après enquête', approver: 'Responsable contrôle' });
    } else if (i % 41 === 0) {
      add('defect', { reason: 'Batterie non conforme au contrôle' });
      add('write_off', { reason: 'Réparation impossible', approver: 'Responsable contrôle' });
    } else if (i % 11 === 0) {
      add('defect', { reason: 'Batterie ou connectique à contrôler' });
      if (i % 22 === 0) add('repair', { reason: 'Diagnostic atelier en cours' });
    } else if (i % 17 === 0) add('quarantine', { reason: 'Contrôle qualité en attente' });
    else if (i % 13 === 0) add('reserve', { reason: 'Demande commerciale confirmée' });

    kits.push(kit);
  }
  return kits;
}
export const kits = createDemo();
export function decorate(kit) { return { ...kit, ...locationById[kit.holderId], id: kit.id, holderId: kit.holderId, holder: locationLabel(kit.holderId), holderType: locationById[kit.holderId]?.type }; }
export function inScope(record, role) { return Object.hasOwn(ROLE_LABELS, role) && (role !== 'am' || record.amId === DEMO_AM); }
export function matches(record, filters = EMPTY_FILTERS) { return FILTERS.every(([key]) => !filters[key] || record[key] === filters[key]); }
export function selectKits(role, filters = EMPTY_FILTERS, source = kits) { return source.map(decorate).filter(k => inScope(k, role) && matches(k, filters)); }
export function filterOptions(role, filters) {
  return Object.fromEntries(FILTERS.map(([key], index) => {
    if (key === 'product') return [key, PRODUCTS.map(p => ({ value: p, label: p }))];
    const parents = FILTERS.slice(0, index).map(([k]) => k);
    const candidates = locations.filter(l => inScope(l, role) && parents.every(p => !filters[p] || l[p] === filters[p]));
    const values = [...new Set(candidates.map(l => l[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    return [key, values.map(value => ({ value, label: ['amId', 'shopId', 'agentId'].includes(key) ? locationLabel(value) : value }))];
  }));
}
export function changeFilter(filters, key, value) {
  const next = { ...filters, [key]: value }, index = FILTERS.findIndex(([k]) => k === key);
  if (key !== 'product') FILTERS.slice(index + 1).forEach(([child]) => { if (child !== 'product') next[child] = ''; });
  return next;
}

// Comptage figé au 21 septembre, par détenteur et produit. Les inconnus ne deviennent pas des kits disponibles.
export const inventories = (() => {
  const groups = new Map();
  selectKits('supply').filter(k => k.lifecycle === 'in_stock').forEach(k => {
    const key = `${k.holderId}|${k.product}`;
    if (!groups.has(key)) groups.set(key, { id: `INV-${groups.size + 1}`, holderId: k.holderId, product: k.product, expectedIds: [] });
    groups.get(key).expectedIds.push(k.id);
  });
  return [...groups.values()].map((g, index) => ({ ...g, at: AS_OF, counter: 'Compteur démo', reviewer: 'Contrôleur démo', observedIds: [...g.expectedIds.slice(index % 19 === 0 ? 1 : 0), ...(index % 29 === 0 ? [`INCONNU-${index}`] : [])] }));
})();
export function inventoryDiff(session) {
  return { missing: session.expectedIds.filter(id => !session.observedIds.includes(id)), unexpected: session.observedIds.filter(id => !session.expectedIds.includes(id)) };
}
export function selectInventories(role, filters = EMPTY_FILTERS) {
  return inventories.map(s => ({ ...s, ...locationById[s.holderId], id: s.id, ...inventoryDiff(s) })).filter(s => inScope(s, role) && matches(s, filters));
}
const missingIds = new Set(inventories.flatMap(s => inventoryDiff(s).missing));
export function isAvailable(k) { return k.lifecycle === 'in_stock' && k.condition === 'good' && !k.reserved && !missingIds.has(k.id); }
export function summarize(selected, counts = []) {
  const count = test => selected.filter(test).length;
  const result = { total: selected.length, active: count(k => k.lifecycle === 'in_stock'), onHand: count(k => k.lifecycle === 'in_stock'), available: count(isAvailable), defective: count(k => k.lifecycle === 'in_stock' && k.condition === 'defective'), repair: count(k => k.lifecycle === 'in_stock' && k.condition === 'repair'), quarantine: count(k => k.lifecycle === 'in_stock' && k.condition === 'quarantine'), reserved: count(k => k.lifecycle === 'in_stock' && k.reserved), sold: count(k => k.lifecycle === 'sold'), lost: count(k => k.lifecycle === 'lost'), writtenOff: count(k => k.lifecycle === 'written_off'), missing: counts.reduce((n, s) => n + s.missing.length, 0), unexpected: counts.reduce((n, s) => n + s.unexpected.length, 0) };
  result.grossVariance = result.missing + result.unexpected;
  result.netVariance = result.unexpected - result.missing;
  for (const type of ['central', 'am', 'shop', 'agent']) result[type] = count(k => k.lifecycle === 'in_stock' && k.holderType === type);
  return result;
}
export function groupStock(selected, counts, field) {
  const keys = [...new Set([...selected.map(k => k[field]), ...counts.map(s => s[field])])].filter(Boolean);
  return keys.map(key => ({ id: key, name: ['holderId', 'shopId', 'amId'].includes(field) ? locationLabel(key) : key, ...summarize(selected.filter(k => k[field] === key), counts.filter(s => s[field] === key)) })).sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'fr'));
}
export function buildTrend(role, filters) {
  return Array.from({ length: 9 }, (_, month) => {
    const start = new Date(Date.UTC(2026, month, 1)).toISOString();
    const cutoff = month === 8 ? AS_OF : new Date(Date.UTC(2026, month + 1, 1) - 1).toISOString();
    let receipts = 0, sales = 0, transfers = 0, returns = 0;
    const snapshots = [];
    kits.forEach(kit => {
      let state = blankKit(kit.id, kit.product);
      for (const event of kit.history) {
        if (event.at > cutoff) break;
        state = applyEvent(state, event);
        const row = decorate(state);
        if (event.at >= start && inScope(row, role) && matches(row, filters)) {
          if (event.type === 'receive') receipts++;
          if (event.type === 'sell') sales++;
          if (event.type === 'transfer') transfers++;
          if (event.type === 'return') returns++;
        }
      }
      if (state.lifecycle !== 'unreceived') snapshots.push(state);
    });
    return { month: new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(start)), active: summarize(selectKits(role, filters, snapshots)).active, receipts, sales, transfers, returns };
  });
}
export const ALERT_RULES = { dormantDays: 30, lowStock: 3 };
export function buildAlerts(selected, counts, shops = []) {
  const alerts = [];
  const add = (key, title, rows, severity, owner) => { if (rows.length) alerts.push({ key, title, count: rows.length, kitIds: rows.map(k => k.id), severity, owner }); };
  const days = date => (Date.parse(AS_OF) - Date.parse(date)) / 86400000;
  add('quality', 'Kits défectueux, en réparation ou en quarantaine', selected.filter(k => k.lifecycle === 'in_stock' && k.condition !== 'good'), 'Haute', 'Supply Chain / SAV');
  add('dormant', `Disponibles sans mouvement depuis plus de ${ALERT_RULES.dormantDays} jours`, selected.filter(k => isAvailable(k) && days(k.updatedAt) > ALERT_RULES.dormantDays), 'Moyenne', 'DC / AM');
  const diff = counts.reduce((n, s) => n + s.missing.length + s.unexpected.length, 0);
  if (diff) alerts.push({ key: 'variance', title: 'Identifiants en écart de comptage (sans compensation)', count: diff, kitIds: counts.flatMap(s => s.missing), severity: 'Haute', owner: 'Contrôle stock' });
  const low = shops.filter(shop => selected.filter(k => k.shopId === shop.id && isAvailable(k)).length < ALERT_RULES.lowStock);
  if (low.length) alerts.push({ key: 'low', title: `Boutiques avec moins de ${ALERT_RULES.lowStock} kits disponibles, agents inclus`, count: low.length, kitIds: [], severity: 'Moyenne', owner: 'AM / Supply Chain', details: low.map(l => l.name).join(', ') });
  return alerts;
}
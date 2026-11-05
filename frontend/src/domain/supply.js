import { kits, PRODUCTS, AS_OF, locationById, matches, EVENT_LABELS } from './stock.js';

// Les flux suivent le lieu de l'opération, et non le détenteur actuel.
export function supplyEvents(filters = {}, type = '', days = 0) {
  return kits.flatMap(kit => kit.history.filter(event => (!type || event.type === type) && event.at <= AS_OF && (!days || Date.parse(event.at) >= Date.parse(AS_OF) - days * 86400000)).map(event => {
    const preceding = kit.history.filter(e => e.at <= event.at && e.to).at(-1);
    const place = locationById[event.to || event.from || preceding?.to];
    return { ...event, kitId: kit.id, product: kit.product, place, label: EVENT_LABELS[event.type] };
  })).filter(e => matches({ ...e.place, product: e.product }, filters)).sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

// Commandes illustratives liées aux réceptions réelles du jeu de démonstration.
export function supplyOrders(filters = {}) {
  const receipts = supplyEvents({}, 'receive');
  return PRODUCTS.flatMap((product, i) => {
    if (!matches({ ...locationById.central, product }, filters)) return [];
    const received = receipts.filter(e => e.product === product);
    return [{ id: `CMD-DEMO-${i + 1}`, product, supplier: 'Fournisseur solaire — démonstration', container: `CONT-DEMO-${i + 1}`, ordered: received.length + 40 + i * 5, received: received.length, remaining: 40 + i * 5, eta: `2026-10-${String(5 + i * 3).padStart(2, '0')}`, receipts: received }];
  });
}

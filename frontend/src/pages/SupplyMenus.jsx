import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useStockFilters from '../navigation/useStockFilters.js';
import { selectKits, selectInventories, summarize, groupStock, locationLabel, EVENT_LABELS, AS_OF } from '../domain/stock.js';
import { territorySummary } from '../domain/director-views.js';
import { supplyEvents } from '../domain/supply.js';
import { csv } from '../domain/commercial.js';
import { KitExplorer, StockTable, InventoryTable } from '../components/StockTables.jsx';
import KitHistory, { formatDate } from '../components/KitHistory.jsx';
import NationalStock from './NationalStock.jsx';
import ServiceRiskTable from './ServiceRiskTable.jsx';
import { Coverage, Dormant } from './CommercialMenus.jsx';

function Metrics({ items }) { return <div className="commercial-metrics">{items.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value.toLocaleString('fr-FR')}</strong><small>{note}</small></article>)}</div>; }
function download(rows) {
  const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'upowa-journal-supply-2026-09-21.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Events({ filters, type = '', open }) {
  const [query, setQuery] = useState(''), [days, setDays] = useState(0), [kind, setKind] = useState(type), [page, setPage] = useState(0);
  const events = useMemo(() => supplyEvents(filters, kind, days), [filters, kind, days]);
  const rows = events.filter(e => [e.kitId, e.reference, e.actor, e.product, locationLabel(e.from), locationLabel(e.to)].join(' ').toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')));
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 15) - 1));
  return <><Metrics items={[["Opérations", rows.length], ['Kits distincts', new Set(rows.map(e => e.kitId)).size], ['Références documentaires', new Set(rows.map(e => e.reference)).size], ['Sites concernés', new Set(rows.map(e => e.place?.id)).size]]} />
    <section className="panel"><h2>{type === 'receive' ? 'Entrées au magasin central' : type === 'transfer' ? 'Transferts enregistrés' : 'Journal des opérations'}</h2><p>Filtres territoriaux appliqués au lieu de l’opération (destination pour les transferts). Une référence documentaire ne constitue pas une pièce jointe disponible.</p>
    <div className="commercial-toolbar"><input aria-label="Rechercher une opération" placeholder="Kit, référence, acteur, site…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /><label className="commercial-control">Période<select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(0); }}><option value={0}>Tout l’historique</option>{[30, 90, 180].map(n => <option key={n} value={n}>{n} jours</option>)}</select></label>{!type && <label className="commercial-control">Opération<select value={kind} onChange={e => { setKind(e.target.value); setPage(0); }}><option value="">Toutes</option>{Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}<button className="secondary-button" disabled={!rows.length} onClick={() => download(rows.map(e => ({ arrete: AS_OF, date: e.at, kit: e.kitId, produit: e.product, operation: e.label, origine: e.from ? locationLabel(e.from) : '', destination: e.to ? locationLabel(e.to) : '', acteur: e.actor, reference: e.reference, motif: e.reason || '' })))}>Exporter le journal filtré</button></div>
    <div className="table-scroll"><table><thead><tr><th>Date / opération</th><th>Kit / produit</th><th>Origine</th><th>Destination / site</th><th>Acteur / référence</th></tr></thead><tbody>{rows.slice(current * 15, current * 15 + 15).map(e => <tr key={e.id}><td>{formatDate(e.at)}<small className="cell-note">{e.label}</small></td><td><button className="link-button" onClick={() => open(e.kitId)}>{e.kitId}</button><small className="cell-note">{e.product}</small></td><td>{e.from ? locationLabel(e.from) : '—'}</td><td>{e.to ? locationLabel(e.to) : e.place?.name || '—'}</td><td>{e.actor}<small className="cell-note">{e.reference}</small></td></tr>)}</tbody></table></div>{!rows.length && <p className="table-empty">Aucune opération dans cette sélection.</p>}<div className="pagination-controls"><span>{rows.length} opérations · page {current + 1} / {Math.max(1, Math.ceil(rows.length / 15))}</span><button className="secondary-button" disabled={!current} onClick={() => setPage(current - 1)}>Précédent</button><button className="secondary-button" disabled={(current + 1) * 15 >= rows.length} onClick={() => setPage(current + 1)}>Suivant</button></div></section>
    {type && <p className="notice">{type === 'receive' ? 'Le journal prouve les entrées par numéro de série. Les réserves de livraison et le contrôle qualité à réception ne sont pas renseignés ; l’état actuel du kit est consultable dans son historique.' : 'Chaque ligne correspond à un transfert enregistré. Transporteur, remise séparée, réception partielle et retard ne sont pas déduits des données disponibles.'}</p>}
  </>;
}
export default function SupplyMenus({ menu }) {
  const [filters] = useStockFilters(), { search } = useLocation();
  return <SupplyContent key={`${menu}-${search}`} menu={menu} filters={filters} />;
}
function SupplyContent({ menu, filters }) {
  const selected = useMemo(() => selectKits('supply', filters), [filters]);
  const counts = useMemo(() => selectInventories('supply', filters), [filters]);
  const all = useMemo(() => selectKits('supply'), []), totals = summarize(selected, counts);
  const [opened, setOpened] = useState(null), [inspection, setInspection] = useState(null), [field, setField] = useState('region'), [tab, setTab] = useState('');
  const open = id => setOpened(all.find(k => k.id === id));
  const inspectIds = ids => { setInspection(all.filter(k => ids.includes(k.id))); setTimeout(() => document.getElementById('supply-inspection')?.scrollIntoView({ behavior: 'smooth' }), 30); };
  return <div className="commercial-content supply-content">
    {['stock', 'distribution', 'journal', 'sav'].includes(menu) && <div className="level-tabs commercial-toolbar" aria-label="Rubriques du menu">{(menu === 'stock' ? [['', 'Localisation'], ['etat', 'États et détenteurs'], ['kits', 'Liste des kits']] : menu === 'distribution' ? [['', 'Besoins du réseau'], ['transferts', 'Transferts enregistrés'], ['reallocation', 'Réallocations']] : menu === 'journal' ? [['', 'Rechercher un kit'], ['operations', 'Journal et exports']] : [['', 'Retours et dommages'], ['qualite', 'Quarantaines et réformes']]).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setInspection(null); }}>{label}</button>)}</div>}
    {menu === 'stock' && <>{!tab ? <NationalStock selected={selected} /> : <><Metrics items={[["Stock théorique", totals.active], ['Disponible', totals.available], ['Réservé', totals.reserved], ['Bloqué qualité', totals.defective + totals.repair + totals.quarantine]]} />{tab === 'kits' ? <KitExplorer kits={selected} onOpen={setOpened} /> : <><div className="commercial-toolbar"><label className="commercial-control">Regrouper par<select value={field} onChange={e => setField(e.target.value)}>{[['region', 'Région'], ['product', 'Produit'], ['holderId', 'Détenteur']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label></div><StockTable rows={field === 'product' ? groupStock(selected, counts, field) : territorySummary(selected, field, counts)} title="Situation détaillée du stock" subtitle="Chaque kit est rattaché à son détenteur actuel ; les écarts de comptage restent séparés." onDrill={id => inspectIds(selected.filter(k => id === '__central__' ? k.holderId === 'central' : k.holderId !== 'central' && k[field] === id).map(k => k.id))} /></>}</>}</>}
    {menu === 'distribution' && (!tab ? <Coverage selected={selected} filters={filters} inspect={rows => inspectIds(rows.map(k => k.id))} /> : tab === 'transferts' ? <Events filters={filters} type="transfer" open={open} /> : <Dormant selected={selected} filters={filters} inspect={rows => inspectIds(rows.map(k => k.id))} />)}
    {menu === 'inventaires' && <><Metrics items={[["Lignes de comptage", counts.length], ['Manquants', totals.missing], ['Inattendus', totals.unexpected], ['Écart brut', totals.grossVariance, 'Manquants + inattendus, sans compensation']]} /><InventoryTable counts={counts} onOpenKit={open} /><p className="notice">Les écarts restent à investiguer. Aucun recomptage, justificatif joint ou ajustement approuvé n’est inventé ; aucun stock n’est modifié automatiquement.</p></>}
    {menu === 'sav' && (!tab ? <ServiceRiskTable selected={selected} onOpen={setOpened} /> : <><Metrics items={[["Quarantaines", totals.quarantine], ['Réformes', totals.writtenOff], ['Défectueux', totals.defective], ['Réparations', totals.repair]]} /><KitExplorer kits={selected.filter(k => (k.lifecycle === 'in_stock' && k.condition === 'quarantine') || k.lifecycle === 'written_off')} onOpen={setOpened} /><p className="notice">Garanties, pièces consommées et diagnostics atelier ne sont pas renseignés. Les motifs documentés sont consultables dans l’historique.</p></>)}
    {menu === 'journal' && (!tab ? <><Metrics items={[["Kits du périmètre", selected.length], ['En stock', totals.active], ['Vendus', totals.sold], ['Perdus ou réformés', totals.lost + totals.writtenOff]]} /><KitExplorer kits={selected} onOpen={setOpened} /></> : <Events filters={filters} open={open} />)}
    {inspection && <section id="supply-inspection"><div className="commercial-heading"><h2>Kits justificatifs</h2><button className="secondary-button" onClick={() => setInspection(null)}>Fermer le détail</button></div><KitExplorer key={inspection.map(k => k.id).join(',')} kits={inspection} onOpen={setOpened} /></section>}
    {opened && <KitHistory kit={opened} onClose={() => setOpened(null)} />}
  </div>;
}
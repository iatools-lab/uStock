import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { CONDITION_LABELS, LIFE_LABELS, locationLabel, isAvailable } from '../domain/stock.js';

export function StockTable({ rows, title, subtitle, onDrill }) {
  return <section className="panel table-panel"><div className="panel__head"><div><h2>{title}</h2><p className="panel__subtitle">{subtitle}</p></div></div>
    {!rows.length ? <p className="table-empty">Aucun résultat dans ce périmètre.</p> : <div className="table-scroll"><table><thead><tr><th>Périmètre</th><th className="numeric">Actif</th><th className="numeric">Disponible</th><th className="numeric">Défectueux</th><th className="numeric">Réparation</th><th className="numeric">Quarantaine</th><th className="numeric">Manquants</th><th className="numeric">Inattendus</th><th className="numeric">Vendus</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{onDrill ? <button className="link-button" onClick={() => onDrill(r.id)}>{r.name}</button> : r.name}</td>{['active', 'available', 'defective', 'repair', 'quarantine', 'missing', 'unexpected', 'sold'].map(key => <td key={key} className="numeric">{r[key]}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}
export function KitExplorer({ kits, onOpen, initialIds = null, onClearAlert }) {
  const [search, setSearch] = useState(''), [state, setState] = useState(''), [page, setPage] = useState(0);
  const term = search.trim().toLocaleLowerCase('fr');
  const rows = kits.filter(k => (!initialIds || initialIds.includes(k.id)) && (!term || [k.id, k.product, k.holder].some(v => v.toLocaleLowerCase('fr').includes(term))) && (!state || (state === 'available' ? isAvailable(k) : k.lifecycle === state || k.condition === state)));
  const pages = Math.max(1, Math.ceil(rows.length / 15)), current = Math.min(page, pages - 1);
  const reset = setter => e => { setter(e.target.value); setPage(0); };
  return <section id="explorer" className="panel table-panel"><div className="panel__head"><div><p className="eyebrow">Du chiffre au kit</p><h2>Explorer le stock et son historique</h2><p className="panel__subtitle">Recherche et état ci-dessous limités à cette liste. Cliquer sur un identifiant pour ouvrir sa fiche.</p></div><span className="count-badge" role="status">{rows.length} kits</span></div>
    <div className="explorer-tools"><label className="search-field"><Search size={16} /><input aria-label="Rechercher un identifiant, produit ou détenteur" placeholder="Identifiant, produit ou détenteur…" value={search} onChange={reset(setSearch)} /></label>
      <label className="state-select">État <select aria-label="État dans la liste des kits" value={state} onChange={reset(setState)}><option value="">Tous</option><option value="available">Disponible</option>{Object.entries(LIFE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}{Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {initialIds && <button className="secondary-button" onClick={onClearAlert}>Retirer le filtre d’alerte</button>}
    </div>
    {!rows.length ? <p className="table-empty">Aucun kit ne correspond à ces critères. Modifiez les filtres ou la recherche.</p> : <div className="table-scroll"><table><thead><tr><th>Identifiant</th><th>Produit</th><th>Responsable / dernier vendeur</th><th>Région / département</th><th>État logistique</th><th>État technique</th><th>Disponibilité</th></tr></thead><tbody>{rows.slice(current * 15, (current + 1) * 15).map(k => <tr key={k.id}><td><button className="link-button" onClick={() => onOpen(k)}>{k.id}</button></td><td>{k.product}</td><td>{k.holder}</td><td>{k.region}<small className="cell-note">{k.department}</small></td><td>{LIFE_LABELS[k.lifecycle]}</td><td>{CONDITION_LABELS[k.condition]}</td><td>{isAvailable(k) ? 'Disponible' : k.reserved ? 'Réservé' : 'Indisponible'}</td></tr>)}</tbody></table></div>}
    <div className="pagination-controls"><span>Page {current + 1} sur {pages}</span><button className="icon-button" disabled={current === 0} aria-label="Page précédente" onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><button className="icon-button" disabled={current === pages - 1} aria-label="Page suivante" onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div>
  </section>;
}
export function InventoryTable({ counts, onOpenKit }) {
  const [onlyDiff, setOnlyDiff] = useState(true), [page, setPage] = useState(0);
  const rows = counts.filter(s => !onlyDiff || s.missing.length || s.unexpected.length);
  const pages = Math.max(1, Math.ceil(rows.length / 10)), current = Math.min(page, pages - 1);
  return <section id="inventaires" className="panel table-panel"><div className="panel__head"><div><p className="eyebrow">Rapprochement physique</p><h2>Comptages et écarts</h2><p className="panel__subtitle">Comptage figé au 21 septembre 2026. Un écart reste à investiguer ; aucun ajustement automatique du stock.</p></div></div>
    <div className="inventory-summary"><span>{counts.length} lignes de comptage</span><span>{counts.reduce((n, s) => n + s.expectedIds.length, 0)} kits théoriques contrôlés</span><label><input type="checkbox" checked={onlyDiff} onChange={e => { setOnlyDiff(e.target.checked); setPage(0); }} /> Écarts uniquement</label></div>
    {!rows.length ? <p className="table-empty">{counts.length ? 'Aucun écart sur les comptages sélectionnés.' : 'Aucun comptage dans ce périmètre.'}</p> : <div className="table-scroll"><table><thead><tr><th>Comptage / détenteur</th><th>Produit</th><th className="numeric">Théorique</th><th className="numeric">Compté</th><th className="numeric">Écart net</th><th>Manquants</th><th>Inattendus</th></tr></thead><tbody>{rows.slice(current * 10, (current + 1) * 10).map(s => <tr key={s.id}><td>{s.id}<small className="cell-note">{locationLabel(s.holderId)}</small></td><td>{s.product}</td><td className="numeric">{s.expectedIds.length}</td><td className="numeric">{s.observedIds.length}</td><td className="numeric">{s.observedIds.length - s.expectedIds.length}</td><td>{s.missing.length ? s.missing.map(id => <button className="link-button" key={id} onClick={() => onOpenKit(id)}>{id}</button>) : '0'}</td><td>{s.unexpected.join(', ') || '0'}</td></tr>)}</tbody></table></div>}
    <div className="pagination-controls"><span>{rows.length} lignes · Page {current + 1} / {pages}</span><button className="icon-button" disabled={!current} aria-label="Comptages précédents" onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><button className="icon-button" disabled={current === pages - 1} aria-label="Comptages suivants" onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div>
  </section>;
}

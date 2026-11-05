import { useMemo, useState } from 'react';
import { MapPin, ChevronRight, ArrowLeft, Store, UsersRound, Boxes } from 'lucide-react';
import { STOCK_LEVELS, stockDistribution } from '../domain/director-views.js';
import { summarize } from '../domain/stock.js';
import ProductMixDialog from '../components/ProductMixDialog.jsx';

export default function NationalStock({ selected, rootLabel = 'Stock national', centralAtZoneOnly = false }) {
  const [level, setLevel] = useState(0), [trail, setTrail] = useState([]), [search, setSearch] = useState(''), [focus, setFocus] = useState(null);
  const [field, label] = STOCK_LEVELS[level];
  const { scoped, rows } = useMemo(() => stockDistribution(centralAtZoneOnly && field !== 'zone' ? selected.filter(k => k.holderId !== 'central') : selected, field, trail), [selected, field, trail, centralAtZoneOnly]);
  const totals = summarize(scoped), visible = rows.filter(r => r.name.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
  function drill(row) {
    setSearch('');
    if (level < STOCK_LEVELS.length - 1 && row.id && !row.central) { setTrail([...trail, { field, value: row.id, label: row.name, level }]); setLevel(level + 1); setFocus(null); }
    else setFocus(row);
  }
  function back(index) { const step = trail[index]; setTrail(trail.slice(0, index)); setLevel(step.level); setFocus(null); setSearch(''); }
  const Icon = field === 'agentId' ? UsersRound : field === 'shopId' ? Store : MapPin;
  return <div className="national-stock">
    <div className="national-summary"><div><p className="eyebrow">Stock détenu</p><strong>{totals.active.toLocaleString('fr-FR')} <span>kits</span></strong><p>{trail.length ? trail.at(-1).label : 'Ensemble du périmètre sélectionné'}</p></div><div><span>Disponibles</span><strong>{totals.available.toLocaleString('fr-FR')}</strong></div><div><span>Bloqués qualité</span><strong>{totals.defective + totals.repair + totals.quarantine}</strong></div><div><span>{label === 'Zone' ? 'Zones' : label === 'Région' ? 'Régions' : label === 'Département' ? 'Départements' : label === 'Boutique' ? 'Boutiques' : 'Agents'}</span><strong>{rows.filter(r => r.id).length}</strong></div></div>
    <nav className="stock-breadcrumbs" aria-label="Chemin du stock"><button onClick={() => { setTrail([]); setLevel(0); setSearch(''); setFocus(null); }}>{rootLabel}</button>{trail.map((step, index) => <span key={`${step.field}-${step.value}`}><ChevronRight size={13} /><button onClick={() => back(index)} title={`Revenir au niveau ${STOCK_LEVELS[step.level][1]}`}>{step.label}</button></span>)}</nav>
    <section className="panel distribution-panel"><div className="distribution-heading"><div><h2>Répartition par {label.toLocaleLowerCase('fr')}</h2><p className="panel__subtitle">Quantités exactes de kits non vendus, au dernier détenteur enregistré. {centralAtZoneOnly && field !== 'zone' && 'Stock terrain uniquement ; entrepôt central disponible dans Zone.'}</p></div>{trail.length > 0 && <button className="secondary-button" onClick={() => back(trail.length - 1)}><ArrowLeft size={15} /> Retour</button>}</div>
      <div className="distribution-controls"><div className="level-tabs" role="group" aria-label="Niveau de détail">{STOCK_LEVELS.map(([key, title], index) => <button key={key} aria-pressed={level === index} onClick={() => { setLevel(index); setTrail([]); setSearch(''); setFocus(null); }}>{title}</button>)}</div><input aria-label={`Rechercher ${label.toLocaleLowerCase('fr')}`} placeholder={`Rechercher ${label.toLocaleLowerCase('fr')}…`} value={search} onChange={e => setSearch(e.target.value)} /></div>
      <p className="commercial-caption">Cliquez sur un lieu pour consulter son mix produit. « Explorer » affiche les lieux rattachés.</p>
      <div className="territory-grid">{visible.map(row => <article className={`territory-card ${!row.id ? 'territory-card--unassigned' : ''}`} key={row.id}>
        <button className="territory-mix-button" onClick={() => setFocus(row)} aria-label={`${row.name}, ${row.active} kits, ouvrir le mix produit`}>
          <div className="territory-card-heading"><span className="territory-icon">{row.id ? <Icon size={20} /> : <Boxes size={20} />}</span><span>{row.name}</span></div>
          <strong>{row.active.toLocaleString('fr-FR')} <small>kits</small></strong>
          <div className="territory-progress"><i style={{ width: `${totals.active ? row.active / totals.active * 100 : 0}%` }} /></div>
          <div className="territory-card-footer"><span>{row.available} disponibles</span><span>{row.damaged} bloqués qualité</span></div>
          <span className="territory-mix-hint">Voir le mix produit</span>
        </button>
        {row.id && !row.central && level < STOCK_LEVELS.length - 1 && <button className="secondary-button territory-explore" onClick={() => drill(row)} aria-label={`Explorer ${row.name} par ${STOCK_LEVELS[level + 1][1].toLocaleLowerCase('fr')}`}>Explorer · {STOCK_LEVELS[level + 1][1]}<ChevronRight size={16} /></button>}
        {!row.id && <small className="unassigned-note">Stock détenu directement en amont ; inclus dans le total.</small>}
      </article>)}</div>
      {!visible.length && <p className="table-empty">Aucun stock ne correspond à cette sélection.</p>}
      <p className="distribution-note">Boutique : stock direct et agents rattachés. Agent : stock détenu directement. L’entrepôt central est présenté séparément et exclu des volumes terrain. Les cartes d’un même niveau se réconcilient avec le total ; les niveaux ne s’additionnent pas.</p>
    </section>
    {focus && <ProductMixDialog name={focus.name} kits={focus.kits} onClose={() => setFocus(null)} onExplore={focus.id && !focus.central && level < STOCK_LEVELS.length - 1 ? () => drill(focus) : undefined} exploreLabel={level < STOCK_LEVELS.length - 1 ? `Explorer · ${STOCK_LEVELS[level + 1][1]}` : undefined} />}
  </div>;
}
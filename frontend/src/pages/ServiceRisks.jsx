import { useMemo, useState } from 'react';
import { RotateCcw, Wrench, PackageX, ArrowUpRight } from 'lucide-react';
import { serviceCases } from '../domain/director-views.js';
import { CONDITION_LABELS } from '../domain/stock.js';
import { formatDate } from '../components/KitHistory.jsx';

export default function ServiceRisks({ selected, onOpen }) {
  const cases = useMemo(() => serviceCases(selected), [selected]);
  const [category, setCategory] = useState('all'), [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const returns = cases.filter(k => k.returned), damaged = cases.filter(k => k.damaged), repair = cases.filter(k => k.inRepair);
  const visible = cases.filter(k => (category === 'all' || (category === 'return' ? k.returned : category === 'damaged' ? k.damaged : k.inRepair)) && [k.id, k.product, k.holder, k.region].some(v => v.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))));
  const pages = Math.max(1, Math.ceil(visible.length / 12)), current = Math.min(page, pages - 1);
  return <div className="service-risks"><div className="service-kpis">{[['return', 'Retours au SAV', returns.length, RotateCcw], ['damaged', 'Kits endommagés', damaged.length, PackageX], ['repair', 'En réparation', repair.length, Wrench]].map(([key, label, value, Icon]) => <button key={key} aria-pressed={category === key} onClick={() => { setCategory(category === key ? 'all' : key); setPage(0); }}><Icon size={22} /><span>{label}</span><strong>{value}</strong><small>Voir les kits concernés</small></button>)}</div>
    <section className="panel"><div className="service-heading"><div><p className="eyebrow">Qualité et service après-vente</p><h2>{category === 'return' ? 'Kits retournés au SAV' : category === 'damaged' ? 'Kits endommagés' : category === 'repair' ? 'Kits en réparation' : 'Retours SAV et kits endommagés'}</h2><p className="panel__subtitle">{cases.length} kits distincts à suivre. Un retour endommagé peut apparaître dans plusieurs catégories.</p></div><button className="secondary-button" onClick={() => { setCategory('all'); setSearch(''); setPage(0); }}>Tous les dossiers</button></div>
      <input className="service-search" aria-label="Rechercher un kit SAV" placeholder="Identifiant, produit, détenteur ou région…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <div className="service-grid">{visible.slice(current * 12, (current + 1) * 12).map(kit => <article className="service-card" key={kit.id}><div className="service-card-top"><strong>{kit.id}</strong><span className={`status-tag ${kit.damaged ? 'status-tag--warning' : ''}`}>{CONDITION_LABELS[kit.condition]}</span></div><h3>{kit.product}</h3>{kit.returned && <span className="return-label"><RotateCcw size={13} /> Retour client au SAV</span>}<p className="service-reason">{kit.reason}</p><dl><div><dt>Détenteur enregistré</dt><dd>{kit.holder}</dd></div><div><dt>Localisation</dt><dd>{kit.city} · {kit.region}</dd></div><div><dt>Dernier événement SAV</dt><dd>{kit.serviceEvent ? formatDate(kit.serviceEvent.at) : 'Non renseigné'}</dd></div></dl><div className="service-card-footer"><span>{kit.daysOpen === null ? 'Date inconnue' : `${kit.daysOpen} j depuis cet événement`}</span><button className="link-button" onClick={() => onOpen(kit)}>Historique <ArrowUpRight size={14} /></button></div></article>)}</div>
      {!visible.length && <p className="table-empty">Aucun kit SAV ou endommagé dans cette sélection.</p>}
      <div className="pagination-controls"><span>{visible.length} kits · page {current + 1} / {pages}</span><button className="secondary-button" disabled={current === 0} onClick={() => setPage(current - 1)}>Précédent</button><button className="secondary-button" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Suivant</button></div>
      <p className="distribution-note">Un retour SAV reste ouvert tant que son état technique n’est pas rétabli. Une quarantaine sans retour client documenté n’est pas assimilée à un retour SAV. La localisation affichée est le détenteur connu, pas un atelier supposé.</p>
    </section>
  </div>;
}

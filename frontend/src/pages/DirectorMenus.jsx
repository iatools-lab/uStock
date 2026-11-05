import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import KitHistory from '../components/KitHistory.jsx';
import { KitExplorer } from '../components/StockTables.jsx';
import useStockFilters from '../navigation/useStockFilters.js';
import { selectKits, selectInventories } from '../domain/stock.js';
import { networkPerformance } from '../domain/director.js';
import NationalStock from './NationalStock.jsx';
import ServiceRiskTable from './ServiceRiskTable.jsx';

const number = value => value === null ? 'Non calculable' : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
function Performance({ selected, counts, filters, onInspect }) {
  const [days, setDays] = useState(90), [field, setField] = useState('region');
  const rows = useMemo(() => networkPerformance(selected, counts, days, field, filters), [selected, counts, days, field, filters]);
  return <>
    <div className="analysis-controls"><label>Fenêtre de ventes <select value={days} onChange={e => setDays(Number(e.target.value))}>{[30, 60, 90, 180].map(n => <option key={n} value={n}>{n} jours</option>)}</select></label><label>Comparer par <select value={field} onChange={e => setField(e.target.value)}><option value="region">Région</option><option value="amId">AM</option><option value="shopId">Boutique</option></select></label></div>
    <section className="panel table-panel"><h2>Disponibilité et rotation du réseau</h2><p className="panel__subtitle">Même fenêtre pour tous les territoires. Ventes brutes des kits sélectionnés, attribuées au lieu de la vente ; les retours ne sont pas déduits. Couverture indicative, sans prévision de demande.</p>
      {!rows.length ? <p className="table-empty">Aucun périmètre à comparer.</p> : <div className="table-scroll"><table className="performance-table"><thead><tr>{['Périmètre', 'Actif', 'Disponible / actif', `Ventes sur ${days} j`, 'Ventes / jour', 'Couverture (j)', 'Âge moyen actif (j)', 'Dormants > 30 j'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><button className="link-button" onClick={() => onInspect(selected.filter(k => k[field] === r.id).map(k => k.id))}>{r.name}</button></td><td>{r.active}</td><td>{number(r.availability)}{r.availability !== null && ' %'}</td><td>{r.sales}</td><td>{number(r.dailySales)}</td><td>{number(r.coverage)}</td><td>{number(r.age)}</td><td>{r.dormant}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel"><h2>Méthodes de calcul</h2><ul className="readable-list"><li>Disponibilité = disponible / actif. Un dénominateur nul affiche « Non calculable ».</li><li>Couverture = disponible / ventes quotidiennes moyennes. Sans vente sur la fenêtre, aucune durée n’est extrapolée.</li><li>Âge actif = temps depuis la réception centrale ; dormant = disponible sans événement depuis plus de 30 jours.</li><li>Les zones diffèrent en taille et en assortiment : ces résultats permettent une comparaison descriptive, sans classement de performance individuelle.</li></ul></section>
  </>;
}


export default function DirectorMenus({ menu, role = 'dg' }) {
  const [filters] = useStockFilters(), { search } = useLocation();
  const [opened, setOpened] = useState(null), [inspectIds, setInspectIds] = useState(null);
  const selected = useMemo(() => selectKits(role, filters), [role, filters]);
  const counts = useMemo(() => selectInventories(role, filters), [role, filters]);
  return <div className="director-menu-content">
    {menu === 'stock-national' && <NationalStock key={search} selected={selected} />}
    {menu === 'risques' && <ServiceRiskTable key={search} selected={selected} onOpen={setOpened} />}
    {menu === 'tracabilite' && <><section className="panel"><h2>Retrouver un kit et expliquer son parcours</h2><p>Recherchez un identifiant, un produit ou un détenteur. Ouvrez une fiche pour consulter les opérations enregistrées.</p></section><KitExplorer key={search} kits={selected} onOpen={setOpened} /></>}
    {menu === 'performance' && <><Performance selected={selected} counts={counts} filters={filters} onInspect={setInspectIds} />{inspectIds && <KitExplorer key={search} kits={selected} initialIds={inspectIds} onClearAlert={() => setInspectIds(null)} onOpen={setOpened} />}</>}
    {opened && <KitHistory kit={opened} onClose={() => setOpened(null)} />}
  </div>;
}

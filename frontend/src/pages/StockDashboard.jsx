import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Boxes, PackageCheck, CheckCircle2, AlertTriangle, Warehouse, BriefcaseBusiness, Store, UsersRound, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import RoleNavigation from '../navigation/RoleNavigation.jsx';
import { MENUS, ROLE_ROUTES, SHARED_DIRECTOR_PATHS } from '../navigation/menus.js';
import useStockFilters from '../navigation/useStockFilters.js';
import CommercialDashboard from './CommercialDashboard.jsx';
import SupplyMenus from './SupplyMenus.jsx';
import AreaManagerMenus from './AreaManagerMenus.jsx';
import DirectorMenus from './DirectorMenus.jsx';
import { territorySummary } from '../domain/director-views.js';
import StockMap from './StockMap.jsx';
import HeaderFilters from '../components/HeaderFilters.jsx';
import { ProductChart, StockBars, TrendChart } from '../components/Charts.jsx';
import { ROLE_LABELS, selectKits, selectInventories, summarize, groupStock, buildTrend } from '../domain/stock.js';

const custody = [['central', 'Entrepôt central', Warehouse, '#001a70'], ['am', 'Area Managers', BriefcaseBusiness, '#3265b5'], ['shop', 'Boutiques', Store, '#73a4d9'], ['agent', 'Agents', UsersRound, '#fe5716']];
function Metric({ label, value, helper, icon: Icon, primary }) {
  return <article className={`overview-metric ${primary ? 'overview-metric--primary' : ''}`}><div><span>{label}</span><Icon size={19} /></div><strong>{value.toLocaleString('fr-FR')}</strong><small>{helper}</small></article>;
}
function Overview({ role, filters }) {
  const selected = useMemo(() => selectKits(role, filters), [role, filters]);
  const counts = useMemo(() => selectInventories(role, filters), [role, filters]);
  const totals = useMemo(() => summarize(selected, counts), [selected, counts]);
  const trend = useMemo(() => buildTrend(role, filters), [role, filters]);
  const regions = useMemo(() => territorySummary(selected, 'region'), [selected]);
  const products = useMemo(() => groupStock(selected, [], 'product'), [selected]);
  return <div className="overview">
    <section className="overview-kpis" aria-label="Indicateurs clés">
      <Metric label="Stock de l’entreprise" value={totals.active} helper="Kits non vendus enregistrés en stock" icon={Boxes} primary />
      <Metric label="Disponible à la vente" value={totals.available} helper="Bon état · non réservé · non manquant" icon={PackageCheck} />
      <Metric label={role === 'supply' ? 'Écarts de comptage' : 'Kits vendus'} value={role === 'supply' ? totals.grossVariance : totals.sold} helper={role === 'supply' ? 'Manquants + inattendus · sans compensation' : 'Livraisons enregistrées aux clients'} icon={CheckCircle2} />
      <Metric label="Stock bloqué qualité" value={totals.defective + totals.repair + totals.quarantine} helper="Défauts · réparations · quarantaine" icon={AlertTriangle} />
    </section>
    <section className="panel custody-panel" aria-labelledby="custody-title"><div className="custody-heading"><div><p className="eyebrow">Localisation du stock</p><h2 id="custody-title">Où sont les kits ?</h2></div><span>{totals.active.toLocaleString('fr-FR')} kits · dernier détenteur enregistré</span></div>
      <div className="custody-track" role="img" aria-label={custody.map(([key, label]) => `${label} : ${totals[key]} kits`).join(', ')}>{custody.map(([key, label, , color]) => <div key={key} style={{ width: `${totals.active ? totals[key] / totals.active * 100 : 0}%`, background: color }} title={`${label} : ${totals[key]} kits`} />)}</div>
      <div className="custody-grid">{custody.map(([key, label, Icon, color]) => <div key={key} className="custody-item"><span className="custody-icon" style={{ color }}><Icon size={21} /></span><div><span>{label}</span><strong>{totals[key].toLocaleString('fr-FR')}</strong></div><small>{totals.active ? (totals[key] / totals.active * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : 0} %</small></div>)}</div>
    </section>
    <div className="overview-distribution"><StockBars rows={regions} title="Répartition par région" /><ProductChart rows={products} /></div>
    <div className="overview-trends"><TrendChart showValues={false} data={trend} title="Évolution du stock" subtitle="Stock enregistré en fin de mois · septembre au 21." series={[{ key: 'active', label: 'Kits en stock' }]} /><TrendChart showValues={false} data={trend} title={role === 'am' ? 'Transferts et ventes' : 'Réceptions et ventes'} subtitle="Volumes mensuels · périmètre à la date de l’opération." series={[{ key: role === 'am' ? 'transfers' : 'receipts', label: role === 'am' ? 'Transferts enregistrés' : 'Réceptions centrales' }, { key: 'sales', label: 'Ventes' }]} /></div>
  </div>;
}
export default function StockDashboard({ role }) {
  const navigate = useNavigate(), { '*': page = '' } = useParams();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('upowa:sidebar:collapsed') === 'true'; } catch { return false; } });
  const toggleSidebar = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem('upowa:sidebar:collapsed', String(next)); } catch {} };
  const menu = MENUS[role].find(item => item.path === page);
  const [filters, setFilters] = useStockFilters();
  const legacyDC = { 'stock-national': 'disponibilite', performance: 'reseau', ventes: 'reseau', 'stock-dormant': 'couverture', alertes: 'couverture', rapports: 'reseau' };
  if (role === 'dc' && legacyDC[page]) return <Navigate to={{ pathname: '/dc/' + legacyDC[page], search: new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString() }} replace />;
  const legacySupply = { 'stock-national': 'stock', detention: 'stock', performance: 'stock', transferts: 'distribution', reapprovisionnement: 'distribution', risques: 'sav', tracabilite: 'journal' };
  if (role === 'supply' && legacySupply[page]) return <Navigate to={{ pathname: '/supply-chain/' + legacySupply[page], search: new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString() }} replace />;
  if (!menu) return <Navigate to={ROLE_ROUTES[role]} replace />;
  return <div className={`role-operations role-${role} ${collapsed ? 'sidebar-collapsed' : ''}`}><a className="skip-link" href="#dashboard">Aller au contenu</a><div className="app-shell">
    <aside className="sidebar"><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'} title={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><div className="sidebar__brand"><div className="brand" aria-label="upOwa"><span className="brand__up">up</span><span className="brand__o">o</span><span className="brand__wa">wa</span><small className="brand__tagline">tracking des kits</small></div></div><div className="sidebar__eyebrow">Pilotage</div><RoleNavigation role={role} /><div className="sidebar__bottom"><div className="profile-card"><div className="avatar">{role.toUpperCase().slice(0, 2)}</div><div><strong>{ROLE_LABELS[role]}</strong><span>{role === 'am' ? 'AM Centre' : 'Vue nationale'}</span></div></div></div></aside>
    <main id="dashboard" className="main-content" tabIndex={-1}><header className="topbar"><div><p className="page-kicker">{ROLE_LABELS[role]}</p><h1>{menu.label}</h1><p className="page-subtitle">{page ? 'Pilotage du stock upOwa' : 'Une vue claire du stock et de sa répartition.'}</p></div><HeaderFilters role={role} filters={filters} onChange={setFilters} /></header>
    <div className="overview-meta"><span><i /> Données fictives · UPYA non connecté</span><span>Situation au 21 septembre 2026 · 11 h</span></div>
    {page === 'carte' ? <StockMap role={role} /> : page ? (role === 'dg' && SHARED_DIRECTOR_PATHS.includes(page) || role === 'dc' && page === 'tracabilite') ? <DirectorMenus key={page} menu={page} role={role} /> : role === 'dc' ? <CommercialDashboard key={page} menu={page} /> : role === 'supply' ? <SupplyMenus key={page} menu={page} /> : role === 'am' ? <AreaManagerMenus key={page} menu={page} /> : <section className="panel planned-page"><p className="eyebrow">À venir</p><h2>{menu.label}</h2><p>Ce menu est préparé. Son contenu sera développé lors d’une prochaine étape consacrée au profil {ROLE_LABELS[role]}.</p><button className="secondary-button" onClick={() => navigate(ROLE_ROUTES[role])}>Retour à la vue d’ensemble</button></section> : role === 'dc' ? <CommercialDashboard /> : <Overview role={role} filters={filters} />}
    </main></div></div>;
}
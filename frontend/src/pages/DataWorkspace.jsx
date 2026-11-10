import WorkspaceFilters, { FilterToolbar } from '../components/WorkspaceFilters.jsx';
import '../styles/workspace-refinement.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { liveView } from '../domain/live-routing.js';
import { LiveNationalStock, LiveStockMap } from './LiveDirectorViews.jsx';
import StrategicPerformance from './StrategicPerformance.jsx';
import { LiveAnalytics, LiveForecast } from './LiveAnalytics.jsx';
import RoleNavigation from '../navigation/RoleNavigation.jsx';
import { Boxes, PackageCheck, CheckCircle2, AlertTriangle, Warehouse, BriefcaseBusiness, Store, UsersRound, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { MENUS, ROLE_ROUTES } from '../navigation/menus.js';
import { ProductChart, BarChart } from '../components/ApexCharts.jsx';
import { ChartInfo } from '../components/ChartFrame.jsx';
const ROLE_LABELS={dg:'Directeur général'};
import { loadSnapshot, quantity } from '../data/real-stock.js';
import '../styles/real-stock.css';

const text = value => value == null || value === '' ? 'Non renseigné' : String(value);
const date = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(new Date(value)) : 'Non renseigné';
const todayInDouala = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const filterKeys = ['date','startDate','endDate','granularity','comparison','product','region','zone','department','arrondissement','amId','shopId','holderId','holderKind','status','search'];
export default function DataWorkspace() {
  const role='dg';
  const { '*': menu = '' } = useParams();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [state, setState] = useState({ loading: true });
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('upowa:sidebar:collapsed') === 'true'; } catch { return false; } });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleSidebar = () => { const value = !collapsed; setCollapsed(value); try { localStorage.setItem('upowa:sidebar:collapsed', String(value)); } catch {} };
  const menuLabel = MENUS[role].find(item => item.path === menu)?.label || 'Vue d’ensemble';
  const endpoint = '/api/local-stock';
  const view = liveView(role, menu);
  const [levels,setLevels] = useState({}), [days, setDays] = useState(90);
  const effectiveLevel = view === 'map' ? 'region' : view === 'performance' ? 'zone' : levels[view] || 'zone';
  const setLevel = value => setLevels(current=>({...current,[view]:value}));
  const [params, setParams] = useSearchParams();
  const latestParams = useRef(params);
  useEffect(() => { latestParams.current=params; }, [params]);
  const filters = useMemo(() => Object.fromEntries(filterKeys.map(key => [key, params.get(key) || ''])), [params]);
  const setFilters = update => {
    const current = Object.fromEntries(filterKeys.map(key => [key, latestParams.current.get(key) || '']));
    const next = typeof update === 'function' ? update(current) : update;
    const query = new URLSearchParams(latestParams.current);
    for (const key of filterKeys) { if (next[key]) query.set(key,next[key]); else query.delete(key); }
    latestParams.current=query;
    setParams(query);
  };
  const updateFilters = patch => { setPage(1); const datesChanged=['date','startDate','endDate'].some(key=>key in patch); setFilters(current => ({...current,...patch,...(datesChanged?{granularity:'auto'}:{})})); };
  useEffect(() => { setPage(1); }, [menu, view]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    setState({ loading: true });
    async function refresh() {
      if (pending) return;
      pending = true;
      try { const data = await loadSnapshot(endpoint, { role, page: 1, filters: filters, view, level: effectiveLevel, days, signal: controller.signal }); if (!controller.signal.aborted) setState({ data }); }
      catch (error) { if (!controller.signal.aborted) setState({ error: error.message }); }
      finally { pending = false; }
    }
    refresh();
    const timer = setInterval(refresh, ['analytics','forecast','performance'].includes(view)?60000:15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [role, page, retry, filters, view, effectiveLevel, days]);
  const choosePeriod = kind => {
    const end=todayInDouala(),year=Number(end.slice(0,4)),month=Number(end.slice(5,7));
    const first=kind==='month'?month:kind==='quarter'?Math.floor((month-1)/3)*3+1:kind==='semester'?Math.floor((month-1)/6)*6+1:1;
    updateFilters({date:'',startDate:kind==='all'?'':`${year}-${String(first).padStart(2,'0')}-01`,endDate:kind==='all'?'':end});
  };
  const data = state.data;
  const filterData=useRef(null);
  if(data)filterData.current=data;
  if (!view) return <Navigate to={ROLE_ROUTES[role]} replace />;
  return <div className={`role-operations role-${role} ${collapsed ? 'sidebar-collapsed' : ''}`}><a className="skip-link" href="#dashboard">Aller au contenu</a><div className="app-shell">
    <aside className="sidebar"><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'} title={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><div className="sidebar__brand"><div className="brand" aria-label="upOwa"><span className="brand__up">up</span><span className="brand__o">o</span><span className="brand__wa">wa</span><small className="brand__tagline">tracking des kits</small></div></div><div className="sidebar__eyebrow">Pilotage</div><RoleNavigation role={role} /><div className="sidebar__bottom"><div className="profile-card"><div className="avatar">{role.toUpperCase().slice(0, 2)}</div><div><strong>{ROLE_LABELS[role]}</strong><span>{role === 'am' ? 'Affectation à compléter' : 'Vue nationale'}</span></div></div></div></aside>
    <main id="dashboard" className="main-content" tabIndex={-1}><header className="topbar"><div><p className="page-kicker">{ROLE_LABELS[role]}</p><h1>{menuLabel}</h1><p className="page-subtitle">{menu ? 'Pilotage du stock upOwa' : 'Une vue claire du stock et de sa répartition.'}</p></div><FilterToolbar filters={filters} open={filtersOpen} onToggle={()=>setFiltersOpen(v=>!v)} onRefresh={()=>setRetry(n=>n+1)}/></header>
    <div className={`${view === 'overview' ? 'overview' : 'commercial-content'} live-stock`} data-live-view={view}>
    <p className="sr-only">Lecture directe de PostgreSQL distant · actualisation toutes les 15 secondes.</p>
      <WorkspaceFilters open={filtersOpen} onClose={()=>setFiltersOpen(false)} filters={filters} data={data||filterData.current} view={view} onChange={updateFilters} onReset={()=>{setPage(1);setFilters({});}} onPeriod={choosePeriod} today={data?.today||filterData.current?.today||todayInDouala()}/>
    {state.loading && <p role="status">Chargement des données…</p>}
    {state.error && <section className="panel" role="alert"><h2>Données réelles indisponibles</h2><p>{state.error}</p><p>La connexion à la base distante est indisponible. Réessayez dans quelques instants.</p><button onClick={() => setRetry(n => n + 1)}>Réessayer</button></section>}
    {data && !data.scope.authorized && <section className="panel" role="alert"><h2>Périmètre non accessible</h2><p>Votre affectation doit être confirmée par la source de données.</p></section>}
    {data?.scope.authorized && <>

      <>
        {view === 'overview' && <><section className="overview-kpis" aria-label="Indicateurs réels">{[['total','Parc analysé',Boxes],['instock','En stock',PackageCheck],['deployed',data.period?.start?'Vendus sur la période':'Équipements déployés / vendus',CheckCircle2],['defective',data.period?.start?'Défauts sur la période':'Stock défectueux',AlertTriangle]].map(([key,label,Icon], index) => <article key={key} className={`overview-metric ${index === 0 ? 'overview-metric--primary' : ''}`}><div><span>{label}</span><Icon size={19} /></div><strong>{data.metrics[key].value == null ? '—' : quantity(data.metrics[key].value)}</strong></article>)}</section>
        <section className="panel custody-panel"><div className="custody-heading"><div><p className="eyebrow">Localisation du stock</p><h2>Où sont les kits ?</h2><ChartInfo align="left" title="Où sont les kits ?" explanation="Chaque couleur montre à qui les kits sont rattachés : entrepôts, area managers, boutiques, agents ou clients après une vente. Une grande partie signifie beaucoup de kits. Les nombres sous la barre donnent le détail."/></div><span>{quantity(data.metrics.total.value)} équipements · dernier détenteur déclaré</span></div>
          <div className="custody-track" role="img" aria-label="Répartition du stock par détenteur">{data.custody.map((row,index) => <div key={row.key} style={{width:`${Number(data.metrics.total.value) ? Number(row.quantity)/Number(data.metrics.total.value)*100 : 0}%`,background:['#001a70','#3265b5','#73a4d9','#fe5716','#a5b0c0'][index%5]}} title={`${row.label} : ${quantity(row.quantity)}`} />)}</div>
          <div className="custody-grid">{data.custody.map(row => { const Icon = {central:Warehouse,am:BriefcaseBusiness,shop:Store,agent:UsersRound}[row.key] || Boxes; return <div className="custody-item" key={row.key}><span className="custody-icon"><Icon size={21}/></span><div><span>{row.label}</span><strong>{quantity(row.quantity)}</strong></div></div>; })}</div>
        </section>
        <div className="overview-distribution"><BarChart title="Répartition par zone" rows={(data.mapZones||[]).map(r=>({...r,quantity:Number(r.quantity)}))} unit="équipements"/><ProductChart rows={chartProducts(data.products)} title="Parc analysé par produit" unit="équipements" /></div>
        </>}
        {view === 'stock' && <LiveNationalStock data={data} level={effectiveLevel} onLevel={setLevel} filters={filters} onFilter={updateFilters}/>}
        {view === 'map' && <LiveStockMap data={data} filters={filters} onFilter={updateFilters}/>}
        {view === 'performance' && <StrategicPerformance data={data} comparison={filters.comparison} onComparison={comparison=>updateFilters({comparison})}/>}
        {view === 'forecast' && <LiveForecast data={data}/>}
        {view === 'analytics' && <LiveAnalytics data={data}/>}
      </>
    </>}
  </div></main></div></div>;
}
function chartProducts(rows) {
  return rows.map(row => ({id:row.key,name:row.label,active:Number(row.quantity)}));
}

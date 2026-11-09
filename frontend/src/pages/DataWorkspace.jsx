import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { liveView } from '../domain/live-routing.js';
import { LiveNationalStock, LiveStockMap, LivePerformance } from './LiveDirectorViews.jsx';
import { LiveAnalytics, LiveForecast } from './LiveAnalytics.jsx';
import RoleNavigation from '../navigation/RoleNavigation.jsx';
import { Boxes, PackageCheck, CheckCircle2, AlertTriangle, Warehouse, BriefcaseBusiness, Store, UsersRound, PanelLeftClose, PanelLeftOpen, Filter, RefreshCw } from 'lucide-react';
import { MENUS, ROLE_ROUTES } from '../navigation/menus.js';
import { ProductChart, BarChart } from '../components/ApexCharts.jsx';
import { ROLE_LABELS } from '../domain/stock.js';
import { loadSnapshot, quantity } from '../data/real-stock.js';
import '../styles/real-stock.css';

const text = value => value == null || value === '' ? 'Non renseigné' : String(value);
const date = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(new Date(value)) : 'Non renseigné';
const todayInDouala = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const filterKeys = ['date','startDate','endDate','granularity','product','region','zone','department','arrondissement','amId','shopId','holderId','holderKind','status','search'];
const missingSources = {
  needs: 'Les besoins exigent une règle de vente et de disponibilité validée, puis un historique commercial complet.',
  inventory: 'Les comptages physiques et leurs écarts ne figurent pas dans la base étudiée.',
  actors: 'Le mandat de l’utilisateur AM doit être fourni pour afficher uniquement son réseau.',
  transfers: 'Les mouvements sont disponibles dans les périodes ; leur circuit opérationnel reste à qualifier.',
  alerts: 'Les règles d’alerte et la conservation des actions restent à définir.',
  technical: 'Les journaux de synchronisation et de supervision ne figurent pas dans les cinq tables de ukit.',
  permissions: 'Les identités utilisateurs et leurs mandats restent à fournir.',
};
export default function DataWorkspace({ role }) {
  const { '*': menu = '' } = useParams();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [state, setState] = useState({ loading: true }), [opened, setOpened] = useState(null);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('upowa:sidebar:collapsed') === 'true'; } catch { return false; } });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleSidebar = () => { const value = !collapsed; setCollapsed(value); try { localStorage.setItem('upowa:sidebar:collapsed', String(value)); } catch {} };
  const menuLabel = MENUS[role].find(item => item.path === menu)?.label || 'Vue d’ensemble';
  const endpoint = '/api/local-stock';
  const view = liveView(role, menu);
  const [levels,setLevels] = useState({}), [days, setDays] = useState(90);
  const effectiveLevel = view === 'map' ? 'region' : levels[view] || (view === 'performance' ? 'region' : 'zone');
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
  useEffect(() => { setPage(1); setOpened(null); }, [menu, view]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    setState({ loading: true }); setOpened(null);
    async function refresh() {
      if (pending) return;
      pending = true;
      try { const data = await loadSnapshot(endpoint, { role, page: ['assets','quality'].includes(view) ? page : 1, filters: view === 'quality' ? {...filters,status:'DEFECTIVE'} : filters, view, level: effectiveLevel, days, signal: controller.signal }); if (!controller.signal.aborted) setState({ data }); }
      catch (error) { if (!controller.signal.aborted) setState({ error: error.message }); }
      finally { pending = false; }
    }
    refresh();
    const timer = setInterval(refresh, ['analytics','forecast'].includes(view)?60000:15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [role, page, retry, filters, view, effectiveLevel, days]);
  const choosePeriod = kind => {
    const end=todayInDouala(),year=Number(end.slice(0,4)),month=Number(end.slice(5,7));
    const first=kind==='month'?month:kind==='quarter'?Math.floor((month-1)/3)*3+1:kind==='semester'?Math.floor((month-1)/6)*6+1:1;
    updateFilters({date:'',startDate:kind==='all'?'':`${year}-${String(first).padStart(2,'0')}-01`,endDate:kind==='all'?'':end});
  };
  const data = state.data;
  const reason = missingSources[view];
  if (!view) return <Navigate to={ROLE_ROUTES[role]} replace />;
  return <div className={`role-operations role-${role} ${collapsed ? 'sidebar-collapsed' : ''}`}><a className="skip-link" href="#dashboard">Aller au contenu</a><div className="app-shell">
    <aside className="sidebar"><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'} title={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'} aria-expanded={!collapsed}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><div className="sidebar__brand"><div className="brand" aria-label="upOwa"><span className="brand__up">up</span><span className="brand__o">o</span><span className="brand__wa">wa</span><small className="brand__tagline">tracking des kits</small></div></div><div className="sidebar__eyebrow">Pilotage</div><RoleNavigation role={role} /><div className="sidebar__bottom"><div className="profile-card"><div className="avatar">{role.toUpperCase().slice(0, 2)}</div><div><strong>{ROLE_LABELS[role]}</strong><span>{role === 'am' ? 'Affectation à compléter' : 'Vue nationale'}</span></div></div></div></aside>
    <main id="dashboard" className="main-content" tabIndex={-1}><header className="topbar"><div><p className="page-kicker">{ROLE_LABELS[role]}</p><h1>{menuLabel}</h1><p className="page-subtitle">{menu ? 'Pilotage du stock upOwa' : 'Une vue claire du stock et de sa répartition.'}</p></div><div className="live-toolbar"><label className="live-date-filter">Période<select aria-label="Période" value="" onChange={e=>choosePeriod(e.target.value)}><option value="" disabled>Choisir</option><option value="all">Toutes les périodes</option><option value="month">Ce mois</option><option value="quarter">Ce trimestre</option><option value="semester">Ce semestre</option><option value="year">Cette année</option></select></label><label className="live-date-filter">Du<input aria-label="Début de période" type="date" max={filters.endDate||filters.date||state.data?.today||todayInDouala()} value={filters.startDate} onChange={e=>updateFilters({startDate:e.target.value})}/></label><label className="live-date-filter">Situation au<input aria-label="Situation au" type="date" max={state.data?.today||todayInDouala()} min={filters.startDate||undefined} value={filters.endDate||filters.date||state.data?.today||todayInDouala()} onChange={e=>updateFilters({date:e.target.value,endDate:e.target.value})}/></label><button className="filter-trigger" aria-expanded={filtersOpen} aria-controls="live-filters" onClick={() => setFiltersOpen(value => !value)}><Filter size={17} /> Filtres</button></div></header>
    <div className={`${view === 'overview' ? 'overview' : 'commercial-content'} live-stock`} data-live-view={view}>
    <p className="sr-only">Lecture directe de PostgreSQL distant · actualisation toutes les 15 secondes.</p>
    {state.loading && <p role="status">Chargement des données…</p>}
    {state.error && <section className="panel" role="alert"><h2>Données réelles indisponibles</h2><p>{state.error}</p><p>La connexion à la base distante est indisponible. Réessayez dans quelques instants.</p><button onClick={() => setRetry(n => n + 1)}>Réessayer</button></section>}
    {data && !data.scope.authorized && <section className="panel" role="alert"><h2>Périmètre non accessible</h2><p>Votre affectation doit être confirmée par la source de données.</p></section>}
    {data?.scope.authorized && <>
      <div className="overview-meta"><span title={`Données chargées le ${date(data.sourceLoadedAt)}`}>{data.period?.start?`Du ${data.period.start} au ${data.asOfDate}`:`Situation au ${data.asOfDate}`}</span><button className="secondary-button" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={14}/> Actualiser</button></div>
      <section id="live-filters" hidden={!filtersOpen} className="panel filter-panel live-filters" aria-label="Filtres du stock">
        <label>Produit<select value={filters.product} onChange={e => { setPage(1); setFilters(f => ({...f, product:e.target.value})); }}><option value="">Tous les produits</option>{(data.options?.products || []).map(p => <option key={p.value} value={p.value}>{p.label || p.value}</option>)}</select></label>
        {[['zone','Zone','zones'],['region','Région','regions'],['department','Département','departments'],['arrondissement','Arrondissement','arrondissements'],['amId','Area manager','ams'],['shopId','Boutique','shops']].map(([field,label,option])=><label key={field}>{label}<select value={filters[field]} onChange={e=>updateFilters({[field]:e.target.value})}><option value="">Tous les lieux</option>{(data.options?.[option]||[]).map(item=><option key={item.value} value={item.value}>{item.label||item.value}</option>)}</select></label>)}
        {view!=='forecast'&&<label>État CRM<select value={filters.status} onChange={e => { setPage(1); setFilters(f => ({...f, status:e.target.value})); }}><option value="">Tous les états</option>{(data.statuses||[]).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>}
        <form onSubmit={e => { e.preventDefault(); setPage(1); setFilters(f => ({...f, search:new FormData(e.currentTarget).get('search')})); }}><label>Rechercher<input name="search" defaultValue={filters.search} placeholder="Numéro de série, produit, détenteur" maxLength={200} /></label><button type="submit">Rechercher</button></form>
      </section>
      {filterKeys.some(key=>filters[key]&&key!=='granularity'&&(view!=='forecast'||key!=='status'))&&<div className="live-filter-summary"><span>Périmètre filtré : {filterKeys.filter(key=>filters[key]&&key!=='granularity'&&(view!=='forecast'||key!=='status')).map(key=>filters[key]).join(' · ')}</span><button className="secondary-button" onClick={()=>{setPage(1);setFilters({});}}>Réinitialiser les filtres</button></div>}
      {reason ? <section className="panel"><h2>Informations à compléter</h2><p>{reason}</p></section> : <>
        {view === 'overview' && <><section className="overview-kpis" aria-label="Indicateurs réels">{[['total','Parc analysé',Boxes],['instock','En stock',PackageCheck],['deployed',data.period?.start?'Vendus sur la période':'Équipements déployés / vendus',CheckCircle2],['defective',data.period?.start?'Défauts sur la période':'Stock défectueux',AlertTriangle]].map(([key,label,Icon], index) => <article key={key} className={`overview-metric ${index === 0 ? 'overview-metric--primary' : ''}`}><div><span>{label}</span><Icon size={19} /></div><strong>{data.metrics[key].value == null ? '—' : quantity(data.metrics[key].value)}</strong></article>)}</section>
        <section className="panel custody-panel"><div className="custody-heading"><div><p className="eyebrow">Localisation du stock</p><h2>Où sont les kits ?</h2></div><span>{quantity(data.metrics.total.value)} équipements · dernier détenteur déclaré</span></div>
          <div className="custody-track" role="img" aria-label="Répartition du stock par détenteur">{data.custody.map((row,index) => <div key={row.key} style={{width:`${Number(data.metrics.total.value) ? Number(row.quantity)/Number(data.metrics.total.value)*100 : 0}%`,background:['#001a70','#3265b5','#73a4d9','#fe5716','#a5b0c0'][index%5]}} title={`${row.label} : ${quantity(row.quantity)}`} />)}</div>
          <div className="custody-grid">{data.custody.map(row => { const Icon = {central:Warehouse,am:BriefcaseBusiness,shop:Store,agent:UsersRound}[row.key] || Boxes; return <div className="custody-item" key={row.key}><span className="custody-icon"><Icon size={21}/></span><div><span>{row.label}</span><strong>{quantity(row.quantity)}</strong></div></div>; })}</div>
        </section>
        <div className="overview-distribution"><BarChart title="Répartition par zone" rows={(data.mapZones||[]).map(r=>({...r,quantity:Number(r.quantity)}))} unit="équipements"/><ProductChart rows={chartProducts(data.products)} title="Parc analysé par produit" unit="équipements" /></div>
        </>}
        {view === 'stock' && <LiveNationalStock data={data} level={effectiveLevel} onLevel={setLevel} filters={filters} onFilter={updateFilters}/>}
        {view === 'map' && <LiveStockMap data={data} filters={filters} onFilter={updateFilters}/>}
        {view === 'performance' && <LivePerformance data={data} level={effectiveLevel} onLevel={setLevel} days={days} onDays={setDays}/>}
        {view === 'forecast' && <LiveForecast data={data} granularity={filters.granularity||'auto'} onGranularity={value=>updateFilters({granularity:value})}/>}
        {view === 'analytics' && <LiveAnalytics data={data} granularity={filters.granularity||'auto'} onGranularity={value=>updateFilters({granularity:value})}/>}
        {view === 'availability' && <div className="commercial-content" data-live-view="availability"><p className="notice"></p><div className="commercial-card-grid">{data.products.map(product=><article className="panel dc-availability-card" key={product.key}><h2>{product.label}</h2><dl><div><dt>Stock suivi</dt><dd>{quantity(product.quantity)}</dd></div><div><dt>En stock</dt><dd>{quantity(product.instock)}</dd><dt>Déployés / vendus</dt><dd>{quantity(product.deployed)}</dd><dt>Défectueux</dt><dd>{quantity(product.defective)}</dd></div></dl></article>)}</div></div>}
        {view === 'references' && <section className="panel" data-live-view="references"><h2>Répartition des lieux</h2><p>{quantity(data.mapping?.rows)} lignes géographiques exploitables dans le fichier Excel.</p><p>{quantity(data.mapping?.unmappedRegion)} équipements sans région certaine · {quantity(data.mapping?.unmappedZone)} sans zone certaine.</p><p>{quantity(data.mapping?.conflicts)} équipements avec un rattachement géographique en conflit.</p></section>}
        {view === 'quality' && <section className="panel"><h2>Équipements défectueux</h2><p>{quantity(data.metrics.defective.value)} équipements déclarés DEFECTIVE. Cet état ne prouve pas qu’un dossier SAV est ouvert.</p></section>}
        {['assets','quality'].includes(view) && <section className="panel table-panel" data-live-view={view}><h2>Équipements · page {page}</h2><p>Liste fournie par la source ; les indicateurs portent sur le périmètre complet, indépendamment de cette page.</p><div className="table-scroll"><table><thead><tr>{['Numéro de série', 'Produit', 'Détenteur / vendeur', 'État CRM', 'État historique', 'Disponibilité'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.assets.rows.map(asset => <tr key={asset.serialNumber}><td><button className="link-button" onClick={() => setOpened(asset)}>{asset.serialNumber}</button></td><td>{text(asset.productName)}<small className="cell-note">{text(asset.productReference)}</small></td><td>{text(asset.holderName)}<small className="cell-note">{asset.crmStatus==='DEPLOYED'?'Vendeur':text(asset.holderCategory)}</small></td><td>{text(asset.crmStatus)}<small className="cell-note">{text(asset.crmFlag)}</small></td><td>{text(asset.historicalStatus)}</td><td>{{ available: 'Confirmée', unavailable: 'Indisponible', unconfirmed: 'En stock' }[asset.availability]}</td></tr>)}</tbody></table></div>{!data.assets.rows.length && <p>Aucun équipement dans cette page.</p>}<div className="pagination-controls"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(n => n - 1)}>Précédent</button><button className="secondary-button" disabled={!data.assets.hasMore} onClick={() => setPage(n => n + 1)}>Suivant</button></div></section>}
      </>}
      {opened && ['assets','quality'].includes(view) && <section className="panel" aria-label="Fiche équipement"><button onClick={() => setOpened(null)}>Fermer la fiche</button><h2>{opened.serialNumber}</h2><p>{text(opened.productName)} · {text(opened.availabilityReason)}</p><p>Propriétaire client : {text(opened.ownerClientNumber)} · {opened.crmStatus==='DEPLOYED'?'Vendeur':'Détenteur'} : {text(opened.holderName)}</p><h3>Périodes connues</h3><p>Ces périodes ne constituent pas un journal exhaustif ni une preuve documentaire.</p>{opened.periods == null ? <p>Historique non fourni.</p> : !opened.periods.length ? <p>Aucune période connue dans la couverture fournie.</p> : <ol>{opened.periods.map((period, i) => <li key={i}>{date(period.startAt)} → {period.endAt ? date(period.endAt) : 'Période en cours'} · {text(period.holderName)} · {text(period.assetStatus)}</li>)}</ol>}</section>}
    </>}
  </div></main></div></div>;
}
function chartProducts(rows) {
  return rows.map(row => ({id:row.key,name:row.label,active:Number(row.quantity)}));
}

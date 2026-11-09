import { elapsedDays } from '../domain/commercial.js';
import { saleFacts, salesRanking, saleTrend } from '../domain/commercial-planning.js';
import { territorySummary } from '../domain/director-views.js';
import { Metrics, Period, Bars } from '../components/CommercialSummary.jsx';
import { TrendChart } from '../components/ApexCharts.jsx';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useStockFilters from '../navigation/useStockFilters.js';
import { selectKits, summarize, isAvailable, PRODUCTS } from '../domain/stock.js';
import NationalStock from './NationalStock.jsx';
import CommercialPerformance from './CommercialPerformance.jsx';
import CommercialNeeds from './CommercialNeeds.jsx';
import CommercialService from './CommercialService.jsx';

function Availability({ selected, filters }) {
  const products=filters.product?[filters.product]:PRODUCTS;
  return <div className="dc-availability"><p className="commercial-caption">Quantités disponibles par produit, séparées entre terrain et entrepôt central. Défectueux : kits en stock dont l’état est « Défectueux », tous lieux confondus dans le périmètre filtré.</p><div className="commercial-card-grid">{products.map(product=>{
    const kits=selected.filter(k=>k.product===product), totals=summarize(kits);
    return <article className="panel dc-availability-card" key={product}><h2>{product}</h2><dl><div><dt>Disponible sur le terrain</dt><dd>{kits.filter(k=>k.holderId!=='central'&&isAvailable(k)).length}</dd></div><div><dt>Disponible à l’entrepôt central</dt><dd>{kits.filter(k=>k.holderId==='central'&&isAvailable(k)).length}</dd></div><div><dt>Défectueux</dt><dd>{totals.defective}</dd></div></dl></article>;
  })}</div></div>;
}
function Overview({ selected, filters }) {
  const [days,setDays] = useState(90);
  const facts = useMemo(()=>saleFacts(filters,days),[filters,days]);
  const totals = summarize(selected), dormant = selected.filter(k=>isAvailable(k)&&elapsedDays(k.updatedAt)>30);
  return <><div className="commercial-toolbar"><Period days={days} onChange={setDays} /></div>
    <Metrics items={[['Stock de l’entreprise',totals.active,'Entrepôt central et terrain'],['Disponible au total',totals.available],['Kits vendus',facts.length,`Sur ${days} jours`],['Disponibles dormants',dormant.length,'Sans mouvement depuis plus de 30 jours']]} />
    <TrendChart data={saleTrend(facts,days)} showValues={false} title="Évolution du nombre de kits vendus" subtitle="Même fenêtre que les KPI ; les mois de début et de fin peuvent être partiels." series={[{key:'sales',label:'Kits vendus'}]} />
    <div className="overview-distribution"><Bars rows={territorySummary(selected,'region').map(r=>({id:r.id,name:r.name,value:r.active,note:`${r.available} disponibles`}))} title="Où sont les kits ?" subtitle="Entrepôt central séparé des stocks terrain." /><Bars rows={salesRanking(facts,'product')} title="Ventes par catégorie de produit" subtitle="Nombre de kits vendus pour chaque type de produit." /></div>
    <p className="commercial-caption">Les ventes sont rattachées au vendeur et au lieu enregistrés à la date de vente. Un retour ultérieur ne retire pas cette vente du classement. Une vente enregistrée correspond à un kit ; aucun montant financier n’est utilisé. Les stocks restent mesurés au dernier détenteur connu.</p>
  </>;
}
export default function CommercialDashboard({ menu = '' }) {
  const [filters] = useStockFilters(), { search } = useLocation();
  const selected = useMemo(()=>selectKits('dc',filters),[filters]);
  return <Content key={menu+'-'+search} menu={menu} selected={selected} filters={filters} />;
}
function Content({ menu, selected, filters }) {
  const [tab,setTab] = useState('');
  return <div className={`commercial-content ${!menu ? 'overview dc-overview' : ''}`}>
    {menu==='disponibilite' && <div className="level-tabs commercial-toolbar" aria-label="Rubriques du menu">{[['','Disponibilité'],['geographie','Localisation du stock']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>}
    {!menu && <Overview selected={selected} filters={filters} />}
    {menu==='disponibilite' && (tab ? <NationalStock selected={selected} centralAtZoneOnly /> : <Availability selected={selected} filters={filters} />)}
    {menu==='reseau' && <CommercialPerformance filters={filters} />}
    {menu==='couverture' && <CommercialNeeds selected={selected} filters={filters} />}
    {menu==='risques' && <CommercialService selected={selected} />}
  </div>;
}
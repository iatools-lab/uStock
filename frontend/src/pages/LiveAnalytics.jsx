import ExcelTable from '../components/ExcelTable.jsx';
import KpiScope from '../components/KpiScope.jsx';
import { useState } from 'react';
import { TrendChart, BarChart } from '../components/ApexCharts.jsx';
import { quantity } from '../data/real-stock.js';
import { forecastNeeds, monthlySeries, needsMatrix, stateEvolution } from '../domain/live-analysis.js';
import '../styles/live-analysis.css';
import { StockRisks, Redistribution, SalesConcentration, StockAging } from './StrategicInsights.jsx';

function Tabs({items,value,onChange,label}){return <div className="decision-tabs" role="tablist" aria-label={label}>{items.map(([key,title])=><button key={key} id={`${label}-${key}`} role="tab" aria-selected={value===key} aria-controls={`${label}-panel`} onClick={()=>onChange(key)}>{title}</button>)}</div>;}
function Bars(props){return <BarChart {...props}/>;}
function Evolution({analysis,dimension,status,names,title}){const chart=monthlySeries(analysis,dimension,status,names);return chart.series.length?<TrendChart {...chart} title={title} subtitle={status==='INSTOCK'?`Stock cumulé en fin de ${analysis.window.granularity==='day'?'journée':'mois'}.`:'Premières ventes toujours validées Upya et premiers défauts.'}/>:<section className="panel"><h2>{title}</h2><p>Aucun événement observé sur la période.</p></section>;}
const exportMetadata=analysis=>[['Début',analysis.window.start],['Fin',analysis.window.end],['Pas de temps',analysis.window.granularity==='day'?'Jour':'Mois'],...Object.entries(analysis.filters||{})];
function PeriodTable({analysis}){
  const rows=analysis.months.map(period=>{const totals={INSTOCK:0,DEPLOYED:0,DEFECTIVE:0};for(const r of analysis.rows)if(r.month===period)totals[r.status]+=r.quantity;return [period,totals.INSTOCK,totals.DEPLOYED,totals.DEFECTIVE];});
  const totals=['Total / stock final',rows.at(-1)?.[1]||0,rows.reduce((n,r)=>n+r[2],0),rows.reduce((n,r)=>n+r[3],0)];
  return <ExcelTable title={analysis.window.granularity==='day'?'Récapitulatif journalier':'Récapitulatif mensuel'} headers={['Période','En stock en fin de période','Vendus','Nouveaux défauts']} rows={rows} totals={totals} metadata={exportMetadata(analysis)}/>;
}

export function LiveAnalytics({data,filters={}}){
  const [tab,setTab]=useState('place');
  const analysis=data.analysis,names=new Map((data.options.ams||[]).map(r=>[r.value,r.label]));
  if(!analysis)return null;
  const zoneNeeds=forecastNeeds(analysis,'zone',30,0,names),amNeeds=forecastNeeds(analysis,'amId',30,0,names),products=forecastNeeds(analysis,'product',30,0,names);
  const defective=analysis.rows.filter(r=>r.status==='DEFECTIVE').reduce((n,r)=>n+r.quantity,0);
  const stockCurve=stateEvolution(analysis,'INSTOCK');
  const stockProductRows=products.rows.map(r=>({key:r.id,label:r.label,stock:r.stock,target:r.target}));
  const alerts=amNeeds.rows.filter(r=>r.need>0).sort((a,b)=>b.need-a.need);
  return <div className="live-analysis" data-live-view="analytics"><KpiScope filters={filters} options={data.options}/><div className="decision-kpis"><article><span>Kits vendus</span><strong>{quantity(zoneNeeds.totals.sold)}</strong></article><article><span>Besoin pour 30 jours</span><strong>{quantity(zoneNeeds.totals.need)}</strong><small>Au rythme des ventes observées</small></article><article><span>Nouveaux défauts</span><strong>{quantity(defective)}</strong></article></div>
    <Tabs label="Tendances" value={tab} onChange={setTab} items={ [['place','Lieu'],['kit','Kit'],['state','État']] }/><div id="Tendances-panel" role="tabpanel" aria-labelledby={`Tendances-${tab}`}>
    {tab==='place'&&<><StockRisks analysis={analysis}/><div className="analysis-grid"><Evolution analysis={analysis} dimension="zone" status="DEPLOYED" names={names} title="Quelles zones gagnent ou perdent des ventes ?"/><Bars title="Quelles régions portent les ventes ?" rows={monthlySeries(analysis,'region','DEPLOYED',names).ranking}/></div><ExcelTable title="Quels area managers renforcer en priorité ?" headers={['Area manager','Vendus','En stock','Besoin pour 30 jours']} rows={alerts.map(r=>[r.label,r.sold,r.stock,r.need])} metadata={exportMetadata(analysis)}/>{!alerts.length&&<p className="decision-note">Aucun besoin calculé sur les 30 prochains jours.</p>}</>}
    {tab==='kit'&&<><div className="analysis-grid"><Evolution analysis={analysis} dimension="product" status="DEPLOYED" names={names} title="Quels produits progressent dans les ventes ?"/><BarChart title="Quels produits faut-il réapprovisionner ?" rows={stockProductRows} seriesSpec={[{key:'stock',label:'En stock'},{key:'target',label:'Besoin de stock pour 30 jours'}]} unit="kits"/></div><SalesConcentration analysis={analysis}/></>}
    {tab==='state'&&<><div className="analysis-grid"><TrendChart title="Le stock disponible augmente-t-il ou diminue-t-il ?" {...stockCurve} subtitle="Stock cumulé en fin de période."/><Bars title="Quels produits concentrent les nouveaux défauts ?" rows={monthlySeries(analysis,'product','DEFECTIVE',names).ranking}/></div><StockAging analysis={analysis}/></>}
    <details className="decision-help decision-actions"><summary>Voir les chiffres de la période</summary><PeriodTable analysis={analysis}/></details>
  </div></div>;
}

export function LiveForecast({data,filters={}}){
  const [tab,setTab]=useState('zone');
  const horizon=90,buffer=14;
  const analysis=data.analysis,names=new Map((data.options.ams||[]).map(r=>[r.value,r.label]));
  if(!analysis)return null;
  const forecast=forecastNeeds(analysis,tab,horizon,buffer,names),t=forecast.totals,matrix=needsMatrix(forecast);
  const metadata=[...exportMetadata(analysis),['Horizon (jours)',horizon],['Sécurité (jours)',buffer]];
  const projection=[0,1,2,3].map(i=>({month:i?`J+${Math.round(horizon*i/3)}`:'Départ',demand:Math.ceil(t.daily*horizon*i/3),remaining:Math.max(0,Math.floor(t.stock-t.daily*horizon*i/3))}));
  return <div className="live-analysis" data-live-view="forecast"><KpiScope filters={filters} options={data.options}/><div className="commercial-metrics"><article><span>Vendus sur la période observée</span><strong>{quantity(t.sold)}</strong></article><article><span>En stock</span><strong>{quantity(t.stock)}</strong></article><article><span>Stock cible</span><strong>{quantity(t.target)}</strong></article><article><span>Besoin estimé</span><strong>{quantity(t.need)}</strong></article></div>
    <Tabs label="Besoins" value={tab} onChange={setTab} items={ [['zone','Par zone'],['amId','Par area manager'],['product','Par kit']] }/><div id="Besoins-panel" role="tabpanel" aria-labelledby={`Besoins-${tab}`}>
    <div className="analysis-grid"><Bars title="Besoins de réapprovisionnement" rows={forecast.rows} value="need"/><TrendChart title="Projection au rythme des ventes observées" data={projection} series={[{key:'demand',label:'Demande cumulée estimée'},{key:'remaining',label:'Stock restant estimé'}]} subtitle="Projection sans nouvelle réception ni transfert."/></div>
    {tab==='zone'&&<Redistribution analysis={analysis} part="charts"/>}
    <ExcelTable title="Récapitulatif des besoins" headers={['Périmètre','Vendus observés','En stock','Stock cible','Besoin estimé']} rows={forecast.rows.map(r=>[r.label,r.sold,r.stock,r.target,r.need])} totals={['Total',t.sold,t.stock,t.target,t.need]} metadata={metadata}/>
    {tab!=='product'&&<ExcelTable title={`Besoins par ${tab==='zone'?'zone':'area manager'} et type de produit`} headers={[tab==='zone'?'Zone':'Area manager',...matrix.products,'Total']} rows={matrix.rows} totals={matrix.totals} metadata={metadata}/>}
    {tab==='zone'&&<Redistribution analysis={analysis} part="tables"/>}
    <details className="decision-help"><summary>Comment est calculé le besoin ?</summary><p>Stock cible = ventes observées ÷ {analysis.window.days} jours × (horizon + sécurité), arrondi au kit supérieur. Besoin = stock cible moins stock disponible, avec un minimum de zéro, calculé séparément pour chaque produit et chaque lieu.</p><p>Estimation à rythme constant sur les historiques connus. Les réceptions futures et les délais fournisseurs ne sont pas fournis. Les lieux non renseignés restent visibles dans les totaux. Les rattachements suivent le référentiel géographique actuel et le détenteur connu au moment de l’événement.</p></details>
    </div></div>;
}

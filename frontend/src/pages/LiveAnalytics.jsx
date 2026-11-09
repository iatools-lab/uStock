import ExcelTable from '../components/ExcelTable.jsx';
import { useState } from 'react';
import { TrendChart, BarChart } from '../components/ApexCharts.jsx';
import { quantity } from '../data/real-stock.js';
import { forecastNeeds, monthlySeries, STATE_LABELS, needsMatrix } from '../domain/live-analysis.js';
import '../styles/live-analysis.css';

function Tabs({items,value,onChange,label}){return <div className="level-tabs analysis-tabs" role="tablist" aria-label={label}>{items.map(([key,title])=><button key={key} id={`${label}-${key}`} role="tab" aria-selected={value===key} aria-controls={`${label}-panel`} onClick={()=>onChange(key)}>{title}</button>)}</div>;}
function Bars(props){return <BarChart {...props}/>;}
function Evolution({analysis,dimension,status,names,title}){const chart=monthlySeries(analysis,dimension,status,names);return chart.series.length?<TrendChart {...chart} title={title} subtitle={status==='INSTOCK'?`Stock cumulé en fin de ${analysis.window.granularity==='day'?'journée':'mois'}.`:'Premières ventes toujours validées Upya et premiers défauts.'}/>:<section className="panel"><h2>{title}</h2><p>Aucun événement observé sur la période.</p></section>;}
const exportMetadata=analysis=>[['Début',analysis.window.start],['Fin',analysis.window.end],['Pas de temps',analysis.window.granularity==='day'?'Jour':'Mois'],...Object.entries(analysis.filters||{})];
function TimeControls({analysis,value,onChange}){return <div className="analysis-controls"><label>Pas de temps<select aria-label="Pas de temps" value={value} onChange={e=>onChange(e.target.value)}><option value="auto">Automatique</option><option value="day" disabled={analysis.window.days>366}>Jour</option><option value="month">Mois</option></select></label></div>;}
function PeriodTable({analysis}){
  const rows=analysis.months.map(period=>{const totals={INSTOCK:0,DEPLOYED:0,DEFECTIVE:0};for(const r of analysis.rows)if(r.month===period)totals[r.status]+=r.quantity;return [period,totals.INSTOCK,totals.DEPLOYED,totals.DEFECTIVE];});
  const totals=['Total / stock final',rows.at(-1)?.[1]||0,rows.reduce((n,r)=>n+r[2],0),rows.reduce((n,r)=>n+r[3],0)];
  return <ExcelTable title={analysis.window.granularity==='day'?'Récapitulatif journalier':'Récapitulatif mensuel'} headers={['Période','En stock en fin de période','Vendus','Nouveaux défauts']} rows={rows} totals={totals} metadata={exportMetadata(analysis)}/>;
}

export function LiveAnalytics({data,granularity='auto',onGranularity}){
  const [tab,setTab]=useState('place');const analysis=data.analysis,names=new Map((data.options.ams||[]).map(r=>[r.value,r.label]));
  if(!analysis)return null;
  return <div className="live-analysis" data-live-view="analytics"><TimeControls analysis={analysis} value={granularity} onChange={onGranularity}/><Tabs label="Tendances" value={tab} onChange={setTab} items={ [['place','Lieu'],['kit','Kit'],['state','État']] }/><div id="Tendances-panel" role="tabpanel" aria-labelledby={`Tendances-${tab}`}>
    <p className="commercial-caption">Du {analysis.window.start} au {analysis.window.end} · premières ventes validées Upya et premiers défauts · stock en fin de période.</p>
    {tab==='place'&&<div className="analysis-grid">{[['region','région'],['zone','zone'],['amId','area manager']].map(([dimension,label])=><Evolution key={dimension} analysis={analysis} dimension={dimension} status="DEPLOYED" names={names} title={`Évolution des ventes par ${label}`}/>)}<Bars title="Ventes par région" rows={monthlySeries(analysis,'region','DEPLOYED',names).ranking}/></div>}
    {tab==='kit'&&<div className="analysis-grid"><Evolution analysis={analysis} dimension="product" status="DEPLOYED" names={names} title="Évolution des ventes par produit"/><Evolution analysis={analysis} dimension="product" status="DEFECTIVE" names={names} title="Évolution des défauts par produit"/><Evolution analysis={analysis} dimension="product" status="INSTOCK" names={names} title="Stock en fin de période par produit"/><Bars title="Produits les plus vendus" rows={monthlySeries(analysis,'product','DEPLOYED',names).ranking}/></div>}
    {tab==='state'&&<div className="analysis-grid">{Object.entries(STATE_LABELS).map(([status,label])=><Evolution key={status} analysis={analysis} dimension="product" status={status} names={names} title={status==='INSTOCK'?'Évolution du stock disponible':status==='DEPLOYED'?'Évolution des ventes':'Évolution des nouveaux kits défectueux'}/>)}<Bars title="Défauts par région" rows={monthlySeries(analysis,'region','DEFECTIVE',names).ranking}/></div>}
    <PeriodTable analysis={analysis}/>
  </div></div>;
}

export function LiveForecast({data,granularity='auto',onGranularity}){
  const [tab,setTab]=useState('zone'),[horizon,setHorizon]=useState(90),[buffer,setBuffer]=useState(14);
  const analysis=data.analysis,names=new Map((data.options.ams||[]).map(r=>[r.value,r.label]));
  if(!analysis)return null;
  const forecast=forecastNeeds(analysis,tab,horizon,buffer,names),t=forecast.totals,matrix=needsMatrix(forecast);
  const metadata=[...exportMetadata(analysis),['Horizon (jours)',horizon],['Sécurité (jours)',buffer]];
  const projection=[0,1,2,3].map(i=>({month:i?`J+${Math.round(horizon*i/3)}`:'Départ',demand:Math.ceil(t.daily*horizon*i/3),remaining:Math.max(0,Math.floor(t.stock-t.daily*horizon*i/3))}));
  return <div className="live-analysis" data-live-view="forecast"><div className="analysis-controls"><label>Horizon<select aria-label="Horizon de prévision" value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[30,60,90,180].map(n=><option key={n} value={n}>{n} jours</option>)}</select></label><label>Marge de sécurité<select aria-label="Marge de sécurité" value={buffer} onChange={e=>setBuffer(Number(e.target.value))}>{[0,7,14,30].map(n=><option key={n} value={n}>{n} jours</option>)}</select></label></div>
    <p className="commercial-caption">Rythme observé du {analysis.window.start} au {analysis.window.end} · stock au {analysis.window.end}.</p>
    <div className="commercial-metrics"><article><span>Vendus sur la période observée</span><strong>{quantity(t.sold)}</strong></article><article><span>En stock</span><strong>{quantity(t.stock)}</strong></article><article><span>Stock cible</span><strong>{quantity(t.target)}</strong></article><article><span>Besoin estimé</span><strong>{quantity(t.need)}</strong></article></div>
    <TimeControls analysis={analysis} value={granularity} onChange={onGranularity}/><Tabs label="Besoins" value={tab} onChange={setTab} items={ [['zone','Par zone'],['amId','Par area manager'],['product','Par kit']] }/><div id="Besoins-panel" role="tabpanel" aria-labelledby={`Besoins-${tab}`}>
    <div className="analysis-grid"><Bars title="Besoins de réapprovisionnement" rows={forecast.rows} value="need"/><TrendChart title="Projection au rythme des ventes observées" data={projection} series={[{key:'demand',label:'Demande cumulée estimée'},{key:'remaining',label:'Stock restant estimé'}]} subtitle="Projection sans nouvelle réception ni transfert."/><Bars title="Stock disponible" rows={[...forecast.rows].sort((a,b)=>b.stock-a.stock)} value="stock"/><Evolution analysis={analysis} dimension={tab} status="DEPLOYED" names={names} title="Ventes servant de base à la prévision"/></div>
    <ExcelTable title="Récapitulatif des besoins" headers={['Périmètre','Vendus observés','En stock','Stock cible','Besoin estimé']} rows={forecast.rows.map(r=>[r.label,r.sold,r.stock,r.target,r.need])} totals={['Total',t.sold,t.stock,t.target,t.need]} metadata={metadata}/>
    {tab!=='product'&&<ExcelTable title={`Besoins par ${tab==='zone'?'zone':'area manager'} et type de produit`} headers={[tab==='zone'?'Zone':'Area manager',...matrix.products,'Total']} rows={matrix.rows} totals={matrix.totals} metadata={metadata}/>}
    <details className="panel"><summary>Calcul de la prévision</summary><p>Stock cible = ventes observées ÷ {analysis.window.days} jours × (horizon + sécurité), arrondi au kit supérieur. Besoin = stock cible moins stock disponible, avec un minimum de zéro, calculé séparément pour chaque produit et chaque lieu.</p><p>Estimation à rythme constant sur les historiques connus. Les réceptions futures et les délais fournisseurs ne sont pas fournis. Les lieux non renseignés restent visibles dans les totaux. Les rattachements suivent le référentiel géographique actuel et le détenteur connu au moment de l’événement.</p></details>
    </div></div>;
}

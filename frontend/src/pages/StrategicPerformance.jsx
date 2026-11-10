import { useState } from 'react';
import { BarChart, CoverageChart } from '../components/ApexCharts.jsx';
import ExcelTable from '../components/ExcelTable.jsx';
import { performanceRows } from '../domain/performance.js';
import { quantity } from '../data/real-stock.js';
import '../styles/live-analysis.css';

export default function StrategicPerformance({data,comparison,onComparison}){
 const [dimension,setDimension]=useState('zone');
 const a=data.analysis;
 if(!a?.previous)return <p role="status">Chargement de la comparaison…</p>;
 const names=new Map((data.options.ams||[]).map(r=>[r.value,r.label]));
 const rows=performanceRows(a,dimension,names),current=rows.reduce((n,r)=>n+r.current,0),previous=rows.reduce((n,r)=>n+r.previous,0),delta=current-previous;
 const movement=[...rows].sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
 const percent=previous?`${(delta/previous*100).toFixed(1)} %`:'Non calculable';
 const ref=a.previous.window,metadata=[['Début',a.window.start],['Fin',a.window.end],['Référence début',ref.start],['Référence fin',ref.end],['Règle','Premières ventes validées Upya, mêmes exclusions et filtres'],...Object.entries(a.filters||{})];
 return <div className="live-analysis" data-live-view="performance"><div className="decision-kpis">{[['Ventes de la période',quantity(current)],['Ventes de référence',quantity(previous)],['Écart en kits',`${delta>0?'+':delta<0?'−':''}${quantity(Math.abs(delta))}`],['Progression / baisse',percent]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
 <div className="performance-comparison"><label>Comparer avec<select aria-label="Période de référence" value={comparison||'previous'} onChange={e=>onComparison(e.target.value)}><option value="previous">La période précédente</option><option value="year">La même période l’année précédente</option></select></label><p>Du <strong>{a.window.start}</strong> au <strong>{a.window.end}</strong>, comparé au <strong>{ref.start}</strong> jusqu’au <strong>{ref.end}</strong>.</p></div>
 <div className="decision-tabs" role="tablist" aria-label="Comparaison stratégique">{[['zone','Zones'],['amId','Area managers'],['product','Produits']].map(([id,label])=><button key={id} id={`performance-${id}`} role="tab" aria-selected={dimension===id} aria-controls="performance-panel" onClick={()=>setDimension(id)}>{label}</button>)}</div>
 <div id="performance-panel" role="tabpanel" aria-labelledby={`performance-${dimension}`}>
 <BarChart title="Qui vend plus ou moins qu’avant ?" rows={rows} seriesSpec={[{key:'current',label:'Période choisie'},{key:'previous',label:'Période de référence'}]} unit="kits vendus" explanation="Pour chaque nom, les deux barres montrent les ventes pendant les deux périodes. Si la barre de la période choisie est plus longue, les ventes ont augmenté. Si elle est plus courte, elles ont baissé. Seules les premières ventes de kits validées dans Upya sont comptées."/>
 <BarChart title="Qui explique la hausse ou la baisse des ventes ?" rows={movement} value="delta" signed unit="kits d’écart" explanation="Une barre verte montre des ventes gagnées par rapport à la période de référence. Une barre rouge montre des ventes perdues. Une grande barre pèse davantage dans le changement du total. Exemple : passer de 1 000 à 1 200 ventes apporte 200 ventes, même si la hausse en pourcentage paraît petite. Les écarts de tous les noms s’additionnent pour retrouver l’écart total."/>
 <CoverageChart rows={rows}/>
 <ExcelTable title="Comparaison détaillée des performances" headers={['Périmètre','Ventes choisies','Ventes de référence','Écart en kits','Progression (%)','En stock','Couverture (jours)']} rows={rows.map(r=>[r.label,r.current,r.previous,r.delta,r.growth==null?'Non calculable':Number(r.growth.toFixed(1)),r.stock,r.coverage==null?'Non calculable':Number(r.coverage.toFixed(1))])} totals={['Total',current,previous,delta,previous?Number((delta/previous*100).toFixed(1)):'Non calculable',rows.reduce((n,r)=>n+r.stock,0),'—']} metadata={metadata}/>
 <p className="decision-note">{a.window.days} jours comparés à {ref.days} jours. Les mois complets gardent leurs dates de calendrier. Une période en cours est comparée à une durée équivalente, dans la limite de la période précédente. Sans vente de référence, le pourcentage reste non calculable. Une absence de ventes observées ne prouve pas que l’historique est complet. Les rattachements utilisent le référentiel actuel.</p>
 </div></div>;
}

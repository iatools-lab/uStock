import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { ExcelButton } from './ExcelTable.jsx';
import fr from 'apexcharts/dist/locales/fr.json';
import ChartFrame, { chartColor } from './ChartFrame.jsx';

const ReactChart=lazy(()=>import('react-apexcharts'));
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const format=value=>number(value).toLocaleString('fr-FR',{maximumFractionDigits:0});
function Plot({type,options,series,height,title}){
  const [mounted,setMounted]=useState(false),id=useId();
  useEffect(()=>setMounted(true),[]);
  const common={chart:{id:`apex-${id.replace(/:/g,'')}`,fontFamily:'inherit',foreColor:'#58708f',background:'transparent',locales:[fr],defaultLocale:'fr',animations:{enabled:false},parentHeightOffset:0,toolbar:{show:true,tools:{download:true,selection:false,zoom:type==='line',zoomin:type==='line',zoomout:type==='line',pan:type==='line',reset:type==='line'}},zoom:{enabled:type==='line',type:'x',autoScaleYaxis:true}},theme:{mode:'light'},grid:{borderColor:'#e6edf5',padding:{left:12,right:18}},noData:{text:'Aucune donnée pour cette sélection'},...options};
  return <div className="apex-chart" data-chart-type={type} role="img" aria-label={title} style={{minHeight:height}}>{mounted?<Suspense fallback={<p role="status">Chargement du graphique…</p>}><ReactChart type={type} options={common} series={series} height={height} width="100%"/></Suspense>:<p role="status">Chargement du graphique…</p>}</div>;
}
export function ProductChart(props){const title=props.title||'Stock actif par produit';return <ChartFrame title={title}>{expanded=><ProductPlot {...props} title={title} expanded={expanded}/>}</ChartFrame>;}
function ProductPlot({rows,title,unit='kits actifs',expanded}){
  const series=rows.map(r=>number(r.active)),total=series.reduce((n,v)=>n+v,0);
  const options={labels:rows.map(r=>r.name),colors:rows.map((_,i)=>chartColor(i)),legend:{show:true,position:'bottom',horizontalAlign:'left',fontSize:'12px',onItemClick:{toggleDataSeries:true}},dataLabels:{enabled:expanded&&rows.length<=15},stroke:{width:2},plotOptions:{pie:{expandOnClick:true,donut:{size:'70%',labels:{show:true,name:{show:true},value:{show:true,formatter:format},total:{show:true,label:unit,formatter:()=>format(total)}}}}},tooltip:{y:{formatter:value=>`${format(value)} ${unit}`}}};
  return <section className="panel"><div className="panel__head"><div><p className="eyebrow">Mix produit</p><h2>{title}</h2></div></div>{total?<Plot type="donut" options={options} series={series} height={expanded?540:380} title={title}/>:<p className="table-empty">Aucun équipement pour cette sélection.</p>}{expanded&&<Values title={title} headers={['Produit',unit]} rows={rows.map(r=>[r.name,number(r.active)])}/>}</section>;
}
export function BarChart(props){return <ChartFrame title={props.title}>{expanded=><BarPlot {...props} expanded={expanded}/>}</ChartFrame>;}
export function StockBars({rows,title}){return <BarChart rows={rows.map(r=>({...r,label:r.name}))} title={title} seriesSpec={[{key:'active',label:'Stock suivi'},{key:'available',label:'Disponible'}]}/>;}
function BarPlot({rows,title,value='quantity',unit='kits',expanded,seriesSpec}){
  const visible=expanded?rows:rows.slice(0,12),spec=seriesSpec||[{key:value,label:unit}];
  const series=spec.map(s=>({name:s.label,data:visible.map(r=>number(r[s.key]))}));
  const options={colors:spec.length===1?visible.map((_,i)=>chartColor(i)):spec.map((_,i)=>chartColor(i)),plotOptions:{bar:{horizontal:true,distributed:spec.length===1,borderRadius:4,barHeight:'65%'}},legend:{show:spec.length>1},dataLabels:{enabled:true,formatter:format},xaxis:{categories:visible.map(r=>r.label),labels:{formatter:format}},yaxis:{labels:{maxWidth:expanded?350:180}},tooltip:{y:{formatter:v=>`${format(v)} ${unit}`}}};
  return <section className="panel"><h2>{title}</h2>{visible.length?<Plot type="bar" options={options} series={series} height={Math.max(300,visible.length*(spec.length>1?48:32)+90)} title={title}/>:<p>Aucune donnée pour cette sélection.</p>}{!expanded&&rows.length>12&&<small>12 premiers · agrandir pour afficher tous les éléments.</small>}{expanded&&<Values title={title} headers={['Périmètre',...spec.map(s=>s.label)]} rows={rows.map(r=>[r.label,...spec.map(s=>number(r[s.key]))])}/>}</section>;
}
export function TrendChart(props){return <ChartFrame title={props.title}>{expanded=><TrendPlot {...props} expanded={expanded}/>}</ChartFrame>;}
function TrendPlot({data,title,series,subtitle,showValues=true,expanded}){
  const [hidden,setHidden]=useState(new Set()),[search,setSearch]=useState('');
  const visible=series.filter(s=>!hidden.has(s.key)),legend=series.filter(s=>s.label.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const options={colors:visible.map(s=>chartColor(series.indexOf(s))),stroke:{curve:'straight',width:2},markers:{size:expanded?3:2,hover:{sizeOffset:3}},xaxis:{categories:data.map(r=>r.month),tickPlacement:'on',labels:{rotate:-35,hideOverlappingLabels:true}},yaxis:{min:0,forceNiceScale:true,labels:{formatter:format}},legend:{show:!expanded,position:'bottom',horizontalAlign:'left',fontSize:'12px',onItemClick:{toggleDataSeries:true}},tooltip:{shared:true,intersect:false,y:{formatter:format}},dataLabels:{enabled:false}};
  return <section className="panel temporal-panel"><div className="panel__head"><div><p className="eyebrow">Historique calculé</p><h2>{title}</h2><p className="panel__subtitle">{subtitle}</p></div></div>
    {expanded&&<><div className="chart-series-controls"><input aria-label="Rechercher une série" placeholder="Rechercher une région, un kit, un AM…" value={search} onChange={e=>setSearch(e.target.value)}/><button className="secondary-button" onClick={()=>setHidden(new Set())}>Tout afficher</button><button className="secondary-button" onClick={()=>setHidden(new Set(series.map(s=>s.key)))}>Tout masquer</button><span>{visible.length} / {series.length} séries affichées</span></div><div className="chart-legend">{legend.map(s=><button key={s.key} aria-pressed={!hidden.has(s.key)} onClick={()=>setHidden(old=>{const next=new Set(old);if(next.has(s.key))next.delete(s.key);else next.add(s.key);return next;})}><i style={{background:chartColor(series.indexOf(s))}}/>{s.label}</button>)}</div></>}
    {visible.length?<Plot type="line" options={options} series={visible.map(s=>({name:s.label,data:data.map(r=>number(r[s.key]))}))} height={expanded?500:340} title={title}/>:<p>Aucune série affichée. Cliquez sur « Tout afficher » pour retrouver les courbes.</p>}
    {(showValues||expanded)&&<Values title={title} expanded={expanded} headers={['Période',...series.map(s=>s.label)]} rows={data.map(r=>[r.month,...series.map(s=>number(r[s.key]))])}/>}
  </section>;
}
function Values({title='Valeurs du graphique',headers,rows,expanded=true}){return <details className="scope-help" open={expanded||undefined}><summary>Afficher les valeurs du graphique</summary><ExcelButton title={title} headers={headers} rows={rows}/><div className="table-scroll"><table><thead><tr>{headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{typeof v==='number'?format(v):v}</td>)}</tr>)}</tbody></table></div></details>;}

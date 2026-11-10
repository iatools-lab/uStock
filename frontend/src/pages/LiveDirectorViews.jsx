import ExcelTable from '../components/ExcelTable.jsx';
import { BarChart } from '../components/ApexCharts.jsx';
import { useState } from 'react';
import ProductMixDialog from '../components/ProductMixDialog.jsx';
import { ChartInfo } from '../components/ChartFrame.jsx';
import { MapPin, ChevronRight, ArrowLeft, Plus, Minus, LocateFixed, X } from 'lucide-react';
import { quantity } from '../data/real-stock.js';
import { LIVE_LEVELS } from '../domain/live-routing.js';
import boundaries from '../data/cameroon-regions.json';
import { geometryPath, geometryPoints, fitMap } from '../domain/stock-map.js';

const NATIONAL_LEVELS=[['zone','Zone'],['amId','Area manager'],['holderId','Détenteur']];
const canonical = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const regionNames = {'FARNORTH':'EXTREME-NORD','NORTH':'NORD','NORTHWEST':'NORD-OUEST','SOUTHWEST':'SUD-OUEST','SOUTH':'SUD','EAST':'EST','WEST':'OUEST'};
const features = boundaries.features.map(f=>({...f,name:regionNames[canonical(f.properties.shapeName)]||f.properties.shapeName.toUpperCase()}));
const nationalView=fitMap(features.flatMap(f=>geometryPoints(f.geometry)));
export function territoryGroups(rows) {
  const groups=new Map();
  for(const row of rows||[]){
    if(!groups.has(row.key))groups.set(row.key,{key:row.key,label:row.label,quantity:0,defective:0,instock:0,deployed:0,products:[]});
    const group=groups.get(row.key);for(const key of ['quantity','defective','instock','deployed'])group[key]+=Number(row[key]||0);group.products.push(row);
  }
  return [...groups.values()].sort((a,b)=>b.quantity-a.quantity);
}
function Mix({group,onClose,onExplore}){
  const products=group.products.map(p=>({id:p.productReference||'unknown',name:p.productName||p.productReference||'Produit non renseigné',active:Number(p.quantity),instock:Number(p.instock||0),deployed:Number(p.deployed||0),defective:Number(p.defective||0)}));
  return <ProductMixDialog name={group.label} products={products} total={group.quantity} onClose={onClose} onExplore={onExplore}/>;
}
export function LiveNationalStock({data,level,onLevel,filters,onFilter}){
  const [search,setSearch]=useState(''),[focus,setFocus]=useState(null),[page,setPage]=useState(1);
  const rows=territoryGroups(data.territories?.rows),label=NATIONAL_LEVELS.find(([key])=>key===level)?.[1]||'Zone';
  const selected=focus?rows.find(row=>row.key===focus):null;
  const visible=rows.filter(row=>row.label.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
  const drill=row=>{
    setFocus(null);setSearch('');setPage(1);
    if(row.key==='__central__'){onFilter({holderKind:'central'});onLevel('holderId');return;}
    const nextLevel={zone:'amId',amId:'holderId'};
    if(row.key!=='__unknown__'&&level!=='holderId'){onFilter({[level]:row.key});onLevel(nextLevel[level]||'holderId');}
  };
  return <div className="national-stock" data-live-view="stock">
    <div className="national-summary"><div><p className="eyebrow">Parc analysé</p><strong>{quantity(data.metrics.total.value)} <span>équipements</span></strong></div><div><span>En stock</span><strong>{quantity(data.metrics.instock.value)}</strong></div><div><span>Déployés / vendus</span><strong>{quantity(data.metrics.deployed.value)}</strong></div><div><span>Défectueux</span><strong>{quantity(data.metrics.defective.value)}</strong></div></div>
    <nav className="stock-breadcrumbs" aria-label="Chemin du stock"><button onClick={()=>{onFilter(Object.fromEntries([...LIVE_LEVELS.map(([key])=>[key,'']),['holderKind','']]));onLevel('zone');setFocus(null);}}>Stock national</button>{LIVE_LEVELS.filter(([key])=>filters[key]).map(([key,title])=><span key={key}><ChevronRight size={13}/><button onClick={()=>{onFilter({[key]:''});onLevel(key);setFocus(null);setSearch('');setPage(1);}}>{title} : {filters[key]}</button></span>)}{filters.holderKind==='central'&&<span>Entrepôts</span>}</nav>
    <section className="panel distribution-panel"><div className="distribution-heading"><div><h2>Répartition par {label.toLocaleLowerCase('fr')}</h2><p className="panel__subtitle"></p></div></div><div className="distribution-controls"><div className="level-tabs" aria-label="Niveau de détail">{NATIONAL_LEVELS.map(([key,title])=><button key={key} aria-pressed={level===key} onClick={()=>{onLevel(key);setFocus(null);setSearch('');setPage(1);}}>{title}</button>)}</div><input aria-label="Rechercher un lieu" placeholder="Rechercher un lieu…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div>
      <div className="territory-grid">{visible.slice((page-1)*18,page*18).map(row=><article key={row.key} className={`territory-card ${row.key==='__unknown__'?'territory-card--unassigned':''}`}><button className="territory-mix-button" onClick={()=>setFocus(row.key)}><div className="territory-card-heading"><span className="territory-icon"><MapPin size={20}/></span><span>{row.label}</span></div><strong>{quantity(row.quantity)} <small>équipements</small></strong><div className="territory-progress"><i style={{width:`${Number(data.metrics.total.value)?row.quantity/Number(data.metrics.total.value)*100:0}%`}}/></div><div className="territory-card-footer territory-statuses"><span><strong>{quantity(row.instock)}</strong> En stock</span><span><strong>{quantity(row.deployed)}</strong> Déployés / vendus</span><span><strong>{quantity(row.defective)}</strong> Défectueux</span></div><span className="territory-mix-hint">Voir le mix produit</span></button>{row.key!=='__unknown__'&&level!=='holderId'&&<button className="secondary-button territory-explore" onClick={()=>drill(row)}>Explorer <ChevronRight size={15}/></button>}</article>)}</div>{!visible.length&&<p className="table-empty">Aucun équipement pour cette sélection.</p>}<div className="pagination-controls"><button className="secondary-button" disabled={page===1} onClick={()=>setPage(n=>n-1)}>Précédent</button><span>{visible.length} lieux · page {page} / {Math.max(1,Math.ceil(visible.length/18))}</span><button className="secondary-button" disabled={page*18>=visible.length} onClick={()=>setPage(n=>n+1)}>Suivant</button></div>
      {Number(data.territories?.unassigned?.quantity)>0&&<p className="commercial-caption">{quantity(data.territories.unassigned.quantity)} kits sans rattachement à ce niveau, inclus dans le total.</p>}
    </section>{selected&&<Mix group={selected} onClose={()=>setFocus(null)} onExplore={selected.key!=='__unknown__'&&level!=='holderId'?()=>drill(selected):null}/>}</div>;
}
export function LiveStockMap({data,filters,onFilter}){
  const [zoom,setZoom]=useState(1),[closedMix,setClosedMix]=useState(null);
  const rows=data.mapRegions||[],maximum=Math.max(1,...rows.filter(r=>r.key!=='__unknown__').map(r=>Number(r.quantity)));
  const focus=features.find(f=>canonical(f.name)===canonical(filters.region||''));
  const auto=focus?fitMap(geometryPoints(focus.geometry)):nationalView;
  const view=[auto[0]+auto[2]*(1-zoom)/2,auto[1]+auto[3]*(1-zoom)/2,auto[2]*zoom,auto[3]*zoom];
  const rowFor=f=>rows.find(row=>canonical(row.key)===canonical(f.name));
  const select=region=>{onFilter({region});setZoom(1);setClosedMix(null);};
  const mix=filters.region?territoryGroups(data.mapRegionProducts||data.territories?.rows).find(r=>canonical(r.key)===canonical(filters.region)):null;
  return <div className="stock-map-page commercial-content" data-live-view="map"><div className="commercial-metrics"><article><span>Parc dans la sélection</span><strong>{quantity(data.metrics.active.value)}</strong><small>Équipements retenus</small></article><article><span>Région non renseignée</span><strong>{quantity(data.mapping?.unmappedRegion)}</strong><small>Conservés dans le total</small></article><article><span>Défectueux</span><strong>{quantity(data.metrics.defective.value)}</strong></article></div><section className="panel map-panel"><div className="commercial-heading"><div><h2>Le stock sur la carte du Cameroun</h2><ChartInfo align="left" title="Le stock sur la carte du Cameroun" explanation="Chaque forme représente une région. Plus sa couleur est foncée, plus elle contient de kits de la sélection. Le nombre indique le total, pas une position GPS. Touchez une région ou un nombre pour voir ses produits. Les kits sans région restent comptés séparément."/><p className="commercial-caption">Quantités agrégées par région ; les couleurs représentent les volumes réels.</p></div><button className="secondary-button" onClick={()=>select('')}><LocateFixed size={16}/> Vue nationale</button></div><div className="map-layout"><div><div className="cameroon-map"><svg viewBox={view.join(' ')} role="group" aria-label="Stock par région">{features.map(f=>{const row=rowFor(f);return <path key={f.name} d={geometryPath(f.geometry)} fill="#2457a7" fillOpacity={row?.quantity?0.2+0.65*Number(row.quantity)/maximum:0.06} stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" tabIndex={0} role="button" aria-label={`${f.name} : ${quantity(row?.quantity||0)} équipements`} onClick={()=>select(f.name)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(f.name);}}}><title>{f.name} · {quantity(row?.quantity||0)} équipements</title></path>;})}</svg>{features.map(f=>{const row=rowFor(f);if(!row||Number(row.quantity)===0)return null;const [x,y,w,h]=fitMap(geometryPoints(f.geometry)),left=(x+w/2-view[0])/view[2]*100,top=(y+h/2-view[1])/view[3]*100;if(left<0||left>100||top<0||top>100)return null;return <button className="map-marker" key={f.name} style={{left:left+'%',top:top+'%'}} onClick={()=>select(f.name)} aria-label={`${f.name}, ${quantity(row.quantity)} équipements`}><strong>{quantity(row.quantity)}</strong><span>{f.name}</span></button>;})}<div className="map-controls"><button className="icon-button" aria-label="Zoom avant" onClick={()=>setZoom(v=>Math.max(.2,v*.7))}><Plus size={17}/></button><button className="icon-button" aria-label="Zoom arrière" onClick={()=>setZoom(v=>Math.min(2,v/0.7))}><Minus size={17}/></button><button className="icon-button" aria-label="Recentrer" onClick={()=>setZoom(1)}><LocateFixed size={17}/></button></div></div><p className="commercial-caption">Les compteurs représentent des régions, pas des positions GPS de boutiques. Les zones sont celles du fichier Excel, sans les anciennes zones fictives.</p><p className="map-attribution">Fond embarqué : geoBoundaries / Wikimedia · CC BY 3.0.</p></div><aside className="map-places"><h3>Régions et quantités</h3>{rows.map(row=><article className="map-place" key={row.key}><button className="map-place-name" onClick={()=>select(row.key)}>{row.label}</button><button className="map-count" onClick={()=>select(row.key)}>{quantity(row.quantity)}</button></article>)}<p className="notice">{quantity(data.mapping?.unmappedRegion)} équipements sans région certaine. Ils ne sont pas positionnés arbitrairement sur la carte.</p></aside></div></section>{mix&&closedMix!==filters.region&&<Mix group={mix} onClose={()=>setClosedMix(filters.region)}/>}</div>;
}
export function LivePerformance({data,days}){
  const periodDays=data.performance?.days||days||90;
  const rows=(data.performance?.rows||[]).map(r=>({...r,stock:Math.max(0,Number(r.active)-Number(r.defective)),sales:Number(r.deployments),defects:Number(r.defective)})).sort((a,b)=>b.sales-a.sales);
  const sales=rows.reduce((n,r)=>n+r.sales,0),stock=rows.reduce((n,r)=>n+r.stock,0),defects=rows.reduce((n,r)=>n+r.defects,0);
  const table=rows.map(r=>[r.label,r.sales,r.stock,r.defects]);
  return <div className="director-menu-content" data-live-view="performance"><div className="decision-kpis"><article><span>Kits vendus</span><strong>{quantity(sales)}</strong><small>Sur {periodDays} jours</small></article><article><span>Kits disponibles</span><strong>{quantity(stock)}</strong></article><article><span>Kits défectueux</span><strong>{quantity(defects)}</strong></article></div>
  <div className="zone-performance-grid">{rows.map(r=>{const coverage=r.sales?r.stock/(r.sales/periodDays):null,warning=coverage!=null&&coverage<30;return <article className="zone-performance-card" key={r.key}><header><h2>{r.label}</h2><span className={`zone-signal ${warning?'zone-signal--warning':coverage==null?'zone-signal--neutral':''}`}>{coverage==null?'Pas de vente':warning?'Stock à renforcer':'Stock disponible'}</span></header><div className="zone-sales">{quantity(r.sales)}<small>kits vendus</small></div><dl><div><dt>En stock</dt><dd>{quantity(r.stock)}</dd></div><div><dt>Défectueux</dt><dd>{quantity(r.defects)}</dd></div></dl></article>;})}</div>
  <p className="decision-note">Stock à renforcer : moins de 30 jours de ventes disponibles, au rythme de la période.</p>
  <BarChart title="Quelles zones vendent le plus ?" rows={rows.map(r=>({key:r.key,label:r.label,quantity:r.sales}))} unit="kits vendus"/>
  <div className="decision-actions"><ExcelTable title="Résultats par zone" headers={['Zone','Vendus','En stock','Défectueux']} rows={table} totals={['Total',sales,stock,defects]}/></div>
  </div>;
}

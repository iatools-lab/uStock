import { useMemo, useState } from 'react';
import { selectKits, locationById } from '../domain/stock.js';
import { demandByPlace, demandFilters, NEED_LEVELS } from '../domain/commercial-planning.js';
import { Metrics, Period, formatNumber } from '../components/CommercialSummary.jsx';
import PlaceTrail from '../components/PlaceTrail.jsx';
export default function CommercialNeeds({ filters }) {
  const [days,setDays]=useState(90),[horizon,setHorizon]=useState(30),[trail,setTrail]=useState([]),[query,setQuery]=useState(''),[onlyNeed,setOnlyNeed]=useState(false),[page,setPage]=useState(0);
  const scope=useMemo(()=>demandFilters(filters),[filters]), selected=useMemo(()=>selectKits('dc',scope),[scope]);
  const [field,label]=NEED_LEVELS[trail.length];
  const all=useMemo(()=>demandByPlace(selected,scope,field,days,horizon),[selected,scope,field,days,horizon]);
  // Restreindre AVANT l'agrégation lorsqu'un AM est partagé entre plusieurs départements.
  const scopedRows=useMemo(()=>{
    const shopIds=new Set(all.flatMap(r=>r.shopIds).filter(id=>trail.every(t=>locationById[id]?.[t.field]===t.id)));
    const scopedFilters={...scope,...Object.fromEntries(trail.map(t=>[t.field,t.id]))};
    return demandByPlace(selected.filter(k=>shopIds.has(k.shopId)),scopedFilters,field,days,horizon);
  },[all,trail,scope,selected,field,days,horizon]);
  const pairs=scopedRows.flatMap(r=>r.rows), visible=scopedRows.filter(r=>(!onlyNeed||r.need>0)&&r.name.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')));
  const pages=Math.max(1,Math.ceil(visible.length/9)), current=Math.min(page,pages-1);
  const back=i=>{setTrail(trail.slice(0,i+1));setPage(0);setQuery('');};
  return <div className="dc-needs">
    <PlaceTrail trail={trail} onBack={back}/>
    <div className="commercial-toolbar"><Period days={days} onChange={setDays}/><label className="commercial-control">Couverture souhaitée<select aria-label="Couverture souhaitée" value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>{[15,30,45,60].map(d=><option key={d} value={d}>{d} jours</option>)}</select></label></div>
    <Metrics items={[["Besoin remonté",scopedRows.reduce((n,r)=>n+r.need,0),'Somme des besoins des boutiques'],[label+'s à renforcer',scopedRows.filter(r=>r.need>0).length],['Produits concernés',new Set(pairs.filter(r=>r.need>0).map(r=>r.product)).size],['Sans historique de vente',pairs.reduce((n,r)=>n+r.unknown,0),'Couples boutique / produit non estimables']]} />
    <p className="notice">Chaque besoin est calculé à la boutique, agents rattachés inclus : max(0, plafond(ventes ÷ {days} × {horizon}) − disponible). Il remonte à l’identique vers son AM, département, région et zone. L’excédent d’une autre boutique ne diminue pas ce besoin. Aucun besoin n’est calculé par agent.</p>
    <div className="commercial-toolbar"><h2>Besoins par {label.toLocaleLowerCase('fr')}</h2><input aria-label="Rechercher un lieu à réapprovisionner" value={query} placeholder="Rechercher un lieu…" onChange={e=>{setQuery(e.target.value);setPage(0);}}/><label className="commercial-caption"><input type="checkbox" checked={onlyNeed} onChange={e=>{setOnlyNeed(e.target.checked);setPage(0);}}/> Lieux avec besoin uniquement</label></div>
    <div className="commercial-card-grid">{visible.slice(current*9,current*9+9).map(place=><article className="panel dc-need-card" key={place.id}>
      {trail.length<NEED_LEVELS.length-1 ? <button className="dc-place-open" onClick={()=>{setTrail([...trail,{field,id:place.id,name:place.name}]);setPage(0);setQuery('');}}><h2>{place.name}</h2><span>Voir les {NEED_LEVELS[trail.length+1][1].toLocaleLowerCase('fr')}s →</span></button> : <h2>{place.name}</h2>}
      <strong className="dc-place-total">{formatNumber(place.need)} kits à apporter</strong><small>{place.shopIds.length} boutique(s)</small>
      <div className="dc-product-needs">{place.rows.map(r=><div key={r.product}><div className="dc-product-line"><strong>{r.product}</strong><span>{r.need===null?'Non estimable':r.need? '+'+r.need+' kits':'Besoin couvert'}</span></div><p>{r.sold} vendus · {r.available} disponibles{r.unknown>0?' · '+r.unknown+' boutique(s) sans ventes observées':''}</p></div>)}</div>
    </article>)}</div>
    {!visible.length&&<p className="table-empty">Aucun lieu ne correspond à cette sélection.</p>}
    <div className="pagination-controls"><span>Page {current+1} / {pages}</span><button className="secondary-button" disabled={!current} onClick={()=>setPage(current-1)}>Précédent</button><button className="secondary-button" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Suivant</button></div>
    <p className="commercial-caption">Sans vente observée dans une boutique, le besoin de son produit reste non estimable. Le total parent est la somme des besoins connus, pas une nouvelle estimation. Les niveaux ne s’additionnent pas entre eux. L’entrepôt central est une source de stock, exclue de ce calcul.</p>
  </div>;
}
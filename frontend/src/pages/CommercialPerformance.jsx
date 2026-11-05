import { useMemo, useState } from 'react';
import { locations, matches, locationLabel } from '../domain/stock.js';
import { saleFacts, salesRanking, COMMERCIAL_LEVELS } from '../domain/commercial-planning.js';
import { Metrics, Period } from '../components/CommercialSummary.jsx';
export default function CommercialPerformance({ filters }) {
  const [field,setField]=useState('zone'),[days,setDays]=useState(90),[focus,setFocus]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0);
  const facts=useMemo(()=>saleFacts(filters,days),[filters,days]);
  const actors=useMemo(()=>{
    const ranking=salesRanking(facts,field), eligible=locations.filter(l=>l.type!=='central'&&matches({...l,product:filters.product},filters));
    const ids=[...new Set([...eligible.map(l=>l[field]),...ranking.map(r=>r.id)].filter(Boolean))];
    return ids.map(id=>ranking.find(r=>r.id===id)||{id,name:locationLabel(id),value:0,rank:null}).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'fr'));
  },[filters,facts,field]);
  const scoped=focus?facts.filter(f=>f[field]===focus):facts, products=salesRanking(scoped,'product');
  const visible=actors.filter(a=>a.name.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))), pages=Math.max(1,Math.ceil(visible.length/9)), current=Math.min(page,pages-1);
  function reset(){setFocus('');setQuery('');setPage(0);}
  return <div className="dc-performance">
    <div className="level-tabs commercial-toolbar" aria-label="Acteurs de performance">{COMMERCIAL_LEVELS.map(([id,label])=><button key={id} aria-pressed={field===id} onClick={()=>{setField(id);reset();}}>{label==='AM'?'Area Managers':label+'s'}</button>)}</div>
    <div className="commercial-toolbar"><Period days={days} onChange={v=>{setDays(v);setFocus('');}}/>{focus&&<button className="secondary-button" onClick={()=>setFocus('')}>← Tous les acteurs</button>}</div>
    <Metrics items={[["Kits vendus",scoped.length,'Ventes enregistrées sur '+days+' jours'],['Agents ayant vendu',new Set(scoped.map(f=>f.agentId).filter(Boolean)).size],['Catégories vendues',products.length],['Ventes moyennes / jour',scoped.length/days]]}/>
    {focus ? <section className="panel"><h2>{locationLabel(focus)} · ventes par produit</h2><div className="commercial-card-grid">{products.map(p=><article className="dc-product-performance" key={p.id}><h3>{p.name}</h3><strong>{p.value} kits vendus</strong></article>)}</div>{!products.length&&<p className="table-empty">Aucune vente sur cette période.</p>}</section> : <>
      <div className="commercial-toolbar"><h2>Classement par nombre de kits vendus</h2><input aria-label="Rechercher un acteur de performance" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Rechercher un acteur…"/></div>
      <div className="commercial-card-grid">{visible.slice(current*9,current*9+9).map(actor=><button className="panel dc-performance-card" key={actor.id} onClick={()=>setFocus(actor.id)}><span className="commercial-caption">{actor.rank?'Rang '+actor.rank:'Sans vente'}</span><h2>{actor.name}</h2><strong className="dc-place-total">{actor.value} kits vendus</strong><span>Voir les ventes par produit →</span></button>)}</div>
      {!visible.length&&<p className="table-empty">Aucun acteur dans ce périmètre.</p>}
      <div className="pagination-controls"><span>Page {current+1} / {pages}</span><button className="secondary-button" disabled={!current} onClick={()=>setPage(current-1)}>Précédent</button><button className="secondary-button" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Suivant</button></div>
    </>}
    <p className="commercial-caption">Classement sur la même période, avec ex æquo. Les ventes restent attribuées au vendeur et au lieu enregistrés lors de la vente, même après un retour. Les catégories sont les types de produits du référentiel. Aucun montant financier.</p>
  </div>;
}
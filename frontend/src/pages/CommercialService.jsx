import { useMemo, useState } from 'react';
import { serviceCases, stockDistribution } from '../domain/director-views.js';
import { COMMERCIAL_LEVELS } from '../domain/commercial-planning.js';
import { Metrics } from '../components/CommercialSummary.jsx';
import PlaceTrail from '../components/PlaceTrail.jsx';
export default function CommercialService({ selected }) {
  const [trail,setTrail]=useState([]),[query,setQuery]=useState(''),[page,setPage]=useState(0);
  const cases=useMemo(()=>serviceCases(selected),[selected]), [field,label]=COMMERCIAL_LEVELS[trail.length];
  const {scoped,rows}=useMemo(()=>stockDistribution(cases,field,trail.map(t=>({field:t.field,value:t.id}))),[cases,field,trail]);
  const visible=rows.filter(r=>r.name.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))), pages=Math.max(1,Math.ceil(visible.length/12)),current=Math.min(page,pages-1);
  return <div className="dc-service">
    <PlaceTrail trail={trail} onBack={i=>{setTrail(trail.slice(0,i+1));setQuery('');setPage(0);}}/>
    <Metrics items={[["Kits concernés",scoped.length,'Total distinct du périmètre affiché'],['Retours SAV ouverts',scoped.filter(k=>k.returned).length],['Endommagés',scoped.filter(k=>k.damaged).length],['En réparation',scoped.filter(k=>k.inRepair).length]]}/>
    <div className="commercial-toolbar"><h2>SAV par {label.toLocaleLowerCase('fr')}</h2><input aria-label="Rechercher un lieu SAV" value={query} placeholder="Rechercher un lieu…" onChange={e=>{setQuery(e.target.value);setPage(0);}}/></div>
    <div className="commercial-card-grid">{visible.slice(current*12,current*12+12).map(r=><article className="panel dc-service-card" key={r.id}>
      {r.id&&!r.central&&trail.length<COMMERCIAL_LEVELS.length-1 ? <button className="dc-place-open" onClick={()=>{setTrail([...trail,{field,id:r.id,name:r.name}]);setQuery('');setPage(0);}}><h2>{r.name}</h2><span>Voir les {COMMERCIAL_LEVELS[trail.length+1][1].toLocaleLowerCase('fr')}s →</span></button> : <h2>{r.name}</h2>}
      <strong className="dc-place-total">{r.active} kits concernés</strong><dl><div><dt>Retours SAV</dt><dd>{r.kits.filter(k=>k.returned).length}</dd></div><div><dt>Endommagés</dt><dd>{r.kits.filter(k=>k.damaged).length}</dd></div><div><dt>Réparations</dt><dd>{r.kits.filter(k=>k.inRepair).length}</dd></div></dl>
    </article>)}</div>
    {!visible.length&&<p className="table-empty">Aucun kit concerné dans cette sélection.</p>}
    <div className="pagination-controls"><span>Page {current+1} / {pages}</span><button className="secondary-button" disabled={!current} onClick={()=>setPage(current-1)}>Précédent</button><button className="secondary-button" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Suivant</button></div>
    <p className="commercial-caption">Un kit peut appartenir à plusieurs catégories. Le total reste dédupliqué. Les cartes des enfants détaillent le périmètre choisi, sans afficher les numéros de série.</p>
  </div>;
}

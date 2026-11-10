import { Filter, RefreshCw, X } from 'lucide-react';

export function FilterToolbar({filters,open,onToggle,onRefresh}){
  const count=Object.entries(filters).filter(([key,value])=>value&&!['date','granularity'].includes(key)).length;
  const period=filters.startDate?`${filters.startDate} → ${filters.endDate||filters.date||'Aujourd’hui'}`:'Toutes les périodes';
  return <div className="workspace-toolbar"><button className="filter-trigger" aria-expanded={open} aria-controls="live-filters" onClick={onToggle}><Filter size={16}/><span>Filtres</span>{count>0&&<b className="filter-count">{count}</b>}</button><span className="workspace-period">{period}</span><button className="secondary-button workspace-refresh" aria-label="Actualiser les données" title="Actualiser" onClick={onRefresh}><RefreshCw size={16}/></button></div>;
}

export default function WorkspaceFilters({open,onClose,filters,data,view,onChange,onReset,onPeriod,today}){
  const choices=(field,label,option,empty='Tous')=><label key={field}>{label}<select aria-label={label} value={filters[field]||''} onChange={e=>onChange({[field]:e.target.value})}><option value="">{empty}</option>{(data?.options?.[option]||[]).map(r=><option key={r.value} value={r.value}>{r.label||r.value}</option>)}</select></label>;
  return <section id="live-filters" hidden={!open} className="panel workspace-filters" aria-label="Filtres du stock"><div className="workspace-filter-heading"><strong>Affiner la sélection</strong><div><button className="link-button" onClick={onReset}>Réinitialiser</button><button className="secondary-button" aria-label="Fermer les filtres" onClick={onClose}><X size={16}/></button></div></div>
    <div className="workspace-filter-grid"><label>Période<select aria-label="Période" value="" onChange={e=>onPeriod(e.target.value)}><option value="" disabled>Choisir</option>{[['all','Toutes les périodes'],['month','Ce mois'],['quarter','Ce trimestre'],['semester','Ce semestre'],['year','Cette année']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Du<input aria-label="Début de période" type="date" max={filters.endDate||filters.date||today} value={filters.startDate||''} onChange={e=>onChange({startDate:e.target.value})}/></label>
    <label>Au<input aria-label="Fin de période" type="date" min={filters.startDate||undefined} max={today} value={filters.endDate||filters.date||today} onChange={e=>onChange({date:e.target.value,endDate:e.target.value})}/></label>
    {choices('product','Produit','products')}{choices('zone','Zone','zones')}{choices('amId','Area manager','ams')}
    {!['forecast','performance','commercial','teams','opportunities','sales','logistics','redistribution','treatment','incoming'].includes(view)&&<label>État<select aria-label="État" value={filters.status||''} onChange={e=>onChange({status:e.target.value})}><option value="">Tous</option>{(data?.statuses||[]).map(s=><option key={s.key} value={s.key}>{{INSTOCK:'En stock',DEPLOYED:'Vendu',DEFECTIVE:'Défectueux'}[s.key]||s.label}</option>)}</select></label>}
    {['analytics','sales','commercial'].includes(view)&&<label>Lecture des courbes<select aria-label="Pas de temps" value={filters.granularity||'auto'} onChange={e=>onChange({granularity:e.target.value})}><option value="auto">Automatique</option><option value="day" disabled={data?.analysis?.window.days>366}>Jour</option><option value="month">Mois</option></select></label>}
    <form className="workspace-search" onSubmit={e=>{e.preventDefault();onChange({search:new FormData(e.currentTarget).get('search')});}}><label>Rechercher<input key={filters.search} name="search" defaultValue={filters.search} maxLength={200} placeholder="Kit, produit ou personne"/></label><button className="secondary-button" type="submit">OK</button></form></div>
    <details className="workspace-advanced"><summary>Autres lieux</summary><div className="workspace-filter-grid">{choices('region','Région','regions')}{choices('department','Département','departments')}{choices('arrondissement','Arrondissement','arrondissements')}{choices('shopId','Boutique','shops')}</div></details>
  </section>;
}

import { Filter, RotateCcw } from 'lucide-react';
import { FILTERS, EMPTY_FILTERS, changeFilter, filterOptions } from '../domain/stock.js';

export default function StockFilters({ role, filters, onChange, count }) {
  const options = filterOptions(role, filters);
  return <section className="panel filter-panel" aria-labelledby="filters-title">
    <div className="panel__head"><div><p className="eyebrow"><Filter size={13} /> Périmètre d’analyse</p><h2 id="filters-title">Filtres</h2></div>
      <button className="secondary-button" onClick={() => onChange({ ...EMPTY_FILTERS })}><RotateCcw size={14} /> Réinitialiser</button></div>
    <div className="filter-grid">{FILTERS.map(([key, label]) => <label key={key} htmlFor={`filter-${key}`}><span>{label}</span>
      <select id={`filter-${key}`} value={filters[key]} onChange={e => onChange(changeFilter(filters, key, e.target.value))}>
        <option value="">{role === 'am' && key === 'amId' ? 'Mon périmètre uniquement' : 'Tous'}</option>
        {options[key].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>)}</div>
    <p className="filter-summary" role="status">{count.toLocaleString('fr-FR')} kits suivis · Périmètre sélectionné.</p>
    <details className="scope-help"><summary>Comment lire les périmètres ?</summary><p>Le stock central est situé à Yaoundé, sans rattachement à un AM ou une boutique. Le sélectionner par AM ou boutique l’exclut. La localisation correspond au dernier détenteur enregistré. Une boutique inclut ses agents. Un kit vendu conserve le rattachement de la vente. Les zones et rattachements sont des exemples à valider avec upOwa.</p></details>
  </section>;
}

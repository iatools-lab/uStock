import { useEffect, useRef, useState } from 'react';
import { Filter, X } from 'lucide-react';
import StockFilters from './StockFilters.jsx';
import { selectKits } from '../domain/stock.js';

export default function HeaderFilters({ role, filters, onChange }) {
  const [open, setOpen] = useState(false), root = useRef(null), button = useRef(null);
  const count = Object.values(filters).filter(Boolean).length;
  useEffect(() => {
    if (!open) return;
    const click = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const key = event => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key);
    root.current?.querySelector('select')?.focus();
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className="header-filters" ref={root}>
    <button ref={button} className={`filter-trigger ${count ? 'filter-trigger--active' : ''}`} aria-expanded={open} aria-controls="header-filter-panel" onClick={() => setOpen(!open)}><Filter size={17} /> Filtres {count > 0 && <span className="filter-count">{count}</span>}</button>
    {open && <div id="header-filter-panel" className="filter-popover" role="region" aria-label="Filtres du périmètre"><button className="filter-close icon-button" aria-label="Fermer les filtres" onClick={() => { setOpen(false); button.current?.focus(); }}><X size={17} /></button><StockFilters role={role} filters={filters} onChange={onChange} count={selectKits(role, filters).length} /><div className="filter-popover-footer"><span>Les filtres s’appliquent immédiatement.</span><button className="secondary-button" onClick={() => { setOpen(false); button.current?.focus(); }}>Afficher les résultats</button></div></div>}
  </div>;
}

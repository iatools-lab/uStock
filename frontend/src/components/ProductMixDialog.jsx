import { useEffect, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { ProductChart } from './ApexCharts.jsx';
import '../styles/live-analysis.css';

export default function ProductMixDialog({ name, products, total, onClose, onExplore, exploreLabel }) {
  const ref = useRef(null);
  const rows = products;
  const count = total;
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement, overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="history-dialog product-mix-dialog" aria-labelledby="product-mix-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="history-content">
      <div className="history-heading"><div><p className="eyebrow">Mix produit</p><h2 id="product-mix-title">{name}</h2><p>{Number(count).toLocaleString('fr-FR')} équipements · En stock, déployés / vendus et défectueux</p></div><button className="icon-button" aria-label="Fermer le mix produit" onClick={onClose} autoFocus><X size={20} /></button></div>
      <ProductChart rows={rows} title="Parc analysé par produit" unit="équipements" />
      {products&&products.every(p=>Number.isFinite(p.instock))&&<section className="product-state-table" aria-label="Mix produit par état"><div className="mix-state-summary">{[['instock','En stock'],['deployed','Vendus'],['defective','Défectueux']].map(([key,label])=><span key={key}>{label}<strong>{products.reduce((n,p)=>n+p[key],0).toLocaleString('fr-FR')}</strong></span>)}</div><div className="table-scroll"><table><thead><tr><th>Produit</th><th>En stock</th><th>Vendus</th><th>Défectueux</th><th>Total</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.name}</td>{['instock','deployed','defective','active'].map(key=><td key={key}>{p[key].toLocaleString('fr-FR')}</td>)}</tr>)}</tbody></table></div></section>}
      {onExplore && <button className="secondary-button mix-explore" onClick={onExplore}>{exploreLabel || 'Explorer les lieux rattachés'}<ChevronRight size={16} /></button>}
    </div>
  </dialog>;
}

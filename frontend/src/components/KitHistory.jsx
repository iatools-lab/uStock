import { useEffect, useRef } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { CONDITION_LABELS, EVENT_LABELS, LIFE_LABELS, locationLabel, isAvailable } from '../domain/stock.js';
export const formatDate = at => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(new Date(at));

export default function KitHistory({ kit, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    dialog.showModal();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = scroll; previous?.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="history-dialog" aria-labelledby="kit-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialogRef.current) onClose(); }}>
    <div className="history-content"><div className="history-heading"><div><p className="eyebrow">Traçabilité individuelle</p><h2 id="kit-title">{kit.id}</h2><p>{kit.product}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer la fiche du kit" autoFocus><X size={20} /></button></div>
      <div className="status-row"><span className="status-tag">{LIFE_LABELS[kit.lifecycle]}</span><span className={`status-tag ${kit.condition !== 'good' ? 'status-tag--warning' : ''}`}>{CONDITION_LABELS[kit.condition]}</span>{isAvailable(kit) && <span className="status-tag status-tag--good">Disponible</span>}{kit.reserved && <span className="status-tag">Réservé</span>}</div>
      <dl className="kit-facts"><div><dt>{kit.lifecycle === 'sold' ? 'Dernier agent commercial' : 'Responsable du stock'}</dt><dd>{kit.holder}</dd></div><div><dt>Localisation / rattachement</dt><dd>{kit.lifecycle === 'sold' ? 'Client final · ' : ''}{kit.region} · {kit.department}</dd></div><div><dt>Zone</dt><dd>{kit.zone}</dd></div><div><dt>AM / boutique</dt><dd>{locationLabel(kit.amId)} / {locationLabel(kit.shopId)}</dd></div></dl>
      {kit.customerRef && <p className="notice">Client : {kit.customerRef} · Référence fictive, aucune donnée personnelle.</p>}
      <h3>Parcours et justificatifs</h3><p className="muted">Horaires du Cameroun · événements de démonstration, du plus ancien au plus récent.</p>
      <ol className="timeline">{kit.history.map(event => <li key={event.id}><div className="timeline-dot" /><div><strong>{EVENT_LABELS[event.type]}</strong><time dateTime={event.at}>{formatDate(event.at)}</time>
        {(event.from || event.to) && <p className="movement-route">{event.from ? locationLabel(event.from) : 'Fournisseur'} <ArrowRight size={12} /> {locationLabel(event.to)}</p>}
        <p>{event.actor}</p><p className="muted">Réf. {event.reference}</p>{event.reason && <p>{event.reason}</p>}{event.approver && <p>Approbation : {event.approver}</p>}{event.deliveryRef && <p>Livraison : {event.deliveryRef} · Client : {event.customerRef}</p>}
      </div></li>)}</ol>
    </div>
  </dialog>;
}

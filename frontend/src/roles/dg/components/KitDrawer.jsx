import { MapPin, PackageCheck, UserRound, X } from 'lucide-react';

export default function KitDrawer({ kit, onClose, notFound }) {
  if (!kit && !notFound) return null;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="kit-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="kit-drawer__header">
          <div>
            <span className="eyebrow">Résultat de recherche</span>
            <h2>{kit ? kit.id : 'Kit introuvable'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {kit ? (
          <>
            <div className="kit-status"><PackageCheck size={18} /><span>{kit.status}</span></div>
            <dl className="kit-details">
              <div><dt>Produit</dt><dd>{kit.product}</dd></div>
              <div><dt>Région</dt><dd>{kit.region}</dd></div>
              <div><dt>Area Manager</dt><dd>{kit.areaManager}</dd></div>
              <div><dt>Boutique</dt><dd>{kit.shop}</dd></div>
            </dl>
            <div className="kit-info-card"><UserRound size={18} /><div><span>Détenteur actuel</span><strong>{kit.holder}</strong></div></div>
            <div className="kit-info-card"><MapPin size={18} /><div><span>Dernière mise à jour UPYA</span><strong>{kit.updatedAt}</strong></div></div>
          </>
        ) : (
          <div className="empty-state">
            <PackageCheck size={28} />
            <strong>Aucun résultat</strong>
            <p>Vérifiez l’identifiant saisi. Les données affichées dans cette maquette sont fictives.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

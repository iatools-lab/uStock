import { BarChart3, Boxes, CircleHelp, MapPinned, PackageSearch, Settings, UsersRound } from 'lucide-react';
import Logo from './Logo';

const iconMap = {
  overview: BarChart3,
  stock: Boxes,
  explorer: PackageSearch,
  holders: UsersRound,
  network: MapPinned,
  settings: Settings,
  help: CircleHelp
};

export default function Sidebar({ roleLabel, menus }) {
  const overviewItem = menus[0];
  const Icon = iconMap[overviewItem?.icon] || BarChart3;

  return (
    <aside className="sidebar">
      <div className="sidebar__brand"><Logo /></div>
      <div className="sidebar__eyebrow">Pilotage</div>
      <nav className="sidebar__nav">
        {overviewItem && (
          <button
            type="button"
            key={overviewItem.label}
            className="nav-item nav-item--active"
            onClick={(event) => event.preventDefault()}
            title={overviewItem.label}
          >
            <Icon size={18} />
            <span>{overviewItem.label}</span>
          </button>
        )}
      </nav>
      <div className="sidebar__bottom">
        <div className="profile-card">
          <div className="avatar">UP</div>
          <div>
            <strong>{roleLabel}</strong>
            <span>upOwa Cameroun</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

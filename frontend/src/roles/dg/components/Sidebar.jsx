import { BarChart3 } from 'lucide-react';
import Logo from './Logo';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand"><Logo /></div>
      <nav className="sidebar__nav" aria-label="Navigation principale">
        <span className="sidebar__eyebrow">Pilotage</span>
        <div className="nav-item nav-item--active" aria-current="page">
          <BarChart3 size={19} strokeWidth={1.9} />
          <span>Vue d’ensemble</span>
        </div>
      </nav>
      <div className="sidebar__bottom">
        <div className="profile-card">
          <div className="avatar">DG</div>
          <div>
            <strong>Directeur Général</strong>
            <span>Vue nationale</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

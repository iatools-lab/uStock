import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, MapPinned, TrendingUp, Activity, PackagePlus, Boxes } from 'lucide-react';
import { MENUS, ROLE_ROUTES } from './menus.js';

const icons = {
  carte: MapPinned,
  previsions: PackagePlus, analytique: Activity,
  '': BarChart3, 'stock-national': Boxes, performance: TrendingUp
};
export default function RoleNavigation({ role }) {
  const { search } = useLocation();
  return <nav className="sidebar__nav role-menu" aria-label="Navigation du profil">{MENUS[role].map(item => {
    const Icon = icons[item.path];
    return <NavLink key={item.path} end to={{ pathname: `${ROLE_ROUTES[role]}${item.path ? `/${item.path}` : ''}`, search }} title={item.label} aria-label={item.label} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span></NavLink>;
  })}</nav>;
}

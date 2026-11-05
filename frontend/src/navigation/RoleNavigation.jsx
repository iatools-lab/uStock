import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Boxes, MapPinned, Search, TrendingUp, ShieldCheck, FileText, Store, UsersRound, PackageCheck, ShoppingCart, ClipboardCheck, Wrench, RefreshCw, History, Bell, CalendarClock, Database, Settings, KeyRound, Activity, ArrowLeftRight, PackagePlus } from 'lucide-react';
import { MENUS, ROLE_ROUTES } from './menus.js';

const icons = {
  carte: MapPinned,
  '': BarChart3, 'stock-national': MapPinned, risques: ShieldCheck, tracabilite: Search, performance: TrendingUp, arbitrages: ClipboardCheck, rapports: FileText,
  disponibilite: Boxes, reseau: UsersRound, couverture: PackagePlus, ventes: ShoppingCart, 'stock-dormant': CalendarClock, alertes: Bell,
  distribution: ArrowLeftRight, stock: Boxes, approvisionnements: ShoppingCart, receptions: PackageCheck, transferts: ArrowLeftRight, detention: MapPinned, inventaires: ClipboardCheck,
  sav: Wrench, reapprovisionnement: PackagePlus, journal: History, boutiques: Store, agents: UsersRound, demandes: PackagePlus, defauts: Wrench,
  integrations: Activity, synchronisations: RefreshCw, qualite: ShieldCheck, referentiels: Database, habilitations: KeyRound, parametres: Settings
};
export default function RoleNavigation({ role }) {
  const { search } = useLocation();
  return <nav className="sidebar__nav role-menu" aria-label="Navigation du profil">{MENUS[role].map(item => {
    const Icon = icons[item.path] || FileText;
    return <NavLink key={item.path} end to={{ pathname: `${ROLE_ROUTES[role]}${item.path ? `/${item.path}` : ''}`, search }} title={item.label} aria-label={item.label} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span></NavLink>;
  })}</nav>;
}
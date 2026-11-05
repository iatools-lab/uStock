import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import KitDrawer from '../components/KitDrawer';
import { getDirecteurDashboard } from '../services/directeur.service';

export default function DirecteurLayout() {
  const [data, setData] = useState(null);
  const [selectedKit, setSelectedKit] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getDirecteurDashboard().then(setData);
  }, []);

  const actions = useMemo(() => ({
    findKit(raw) {
      if (!data) return;
      const normalized = raw.trim().toUpperCase();
      if (!normalized) return;
      const kit = data.kits.find((item) => item.id.toUpperCase() === normalized || item.id.endsWith(normalized));
      setSelectedKit(kit || null);
      setNotFound(!kit);
    },
    openKit(kit) {
      setSelectedKit(kit);
      setNotFound(false);
    }
  }), [data]);

  if (!data) {
    return <div className="loading-screen"><div className="loader" /><span>Chargement de la vue Directeur Général…</span></div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Outlet context={{ data, actions }} />
      </main>
      <KitDrawer
        kit={selectedKit}
        notFound={notFound}
        onClose={() => { setSelectedKit(null); setNotFound(false); }}
      />
    </div>
  );
}

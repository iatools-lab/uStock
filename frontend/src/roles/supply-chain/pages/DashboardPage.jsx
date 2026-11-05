import { BriefcaseBusiness, CheckCircle2, PackageOpen, Store, Warehouse, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import Header from '../components/Header';
import KpiCard from '../components/KpiCard';
import TemporalLineChart from '../components/TemporalLineChart';
import BarList from '../components/BarList';
import DonutCard from '../components/DonutCard';
import DataTable from '../components/DataTable';
import { dashboardData as data } from '../data/dashboard.mock';

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const searchText = searchTerm.trim().toLowerCase();

  const filteredRegions = useMemo(() => {
    if (!searchText) return data.regionsDetail;
    return data.regionsDetail.filter((item) => [item.name, item.am, item.boutiques, item.agents].join(' ').toLowerCase().includes(searchText));
  }, [searchText]);

  const filteredHolders = useMemo(() => {
    if (!searchText) return data.holders;
    return data.holders.filter((item) => [item.name, item.type, item.region].join(' ').toLowerCase().includes(searchText));
  }, [searchText]);

  const kpis = [
    { label: 'Stock actif', value: data.kpis.stockActif, helper: 'Tous les kits non vendus', icon: PackageOpen, variant: 'primary' },
    { label: 'Magasin central', value: data.kpis.central, helper: 'Kits encore au stock central', icon: Warehouse },
    { label: 'Chez les AM', value: data.kpis.areaManagers, helper: 'Stock détenu par les Area Managers', icon: BriefcaseBusiness },
    { label: 'En boutiques', value: data.kpis.boutiques, helper: 'Stock positionné en boutiques', icon: Store },
    { label: 'Chez les agents', value: data.kpis.agents, helper: 'Stock actuellement pris en charge', icon: UsersRound },
    { label: 'Kits vendus', value: data.kpis.vendus, helper: 'Sortis du stock actif', icon: CheckCircle2, variant: 'accent' }
  ];

  const regionColumns = [
    { key: 'name', label: 'Région' }, { key: 'am', label: 'Chez AM', numeric: true },
    { key: 'boutiques', label: 'Boutiques', numeric: true }, { key: 'agents', label: 'Agents', numeric: true },
    { key: 'total', label: 'Total actif', numeric: true }
  ];
  const holderColumns = [
    { key: 'name', label: 'Détenteur' }, { key: 'type', label: 'Type' }, { key: 'region', label: 'Région' }, { key: 'kits', label: 'Kits détenus', numeric: true }
  ];

  return (
    <>
      <Header title="Pilotage Supply Chain" subtitle="Localisation, disponibilité et circulation physique du stock dans le réseau." role="Supply Chain" lastSync={data.meta.lastSync} onSearch={setSearchTerm} searchPlaceholder="Rechercher une région, boutique ou personne..." />
      <section className="kpi-grid">{kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</section>
      <div className="content-grid content-grid--trends">
        <TemporalLineChart title="Réceptions vs distribution réseau" subtitle="Volumes mensuels reçus au magasin central et redistribués vers le réseau." data={data.flowsTrend} series={[{ key: 'receipts', label: 'Réceptions', color: '#001A70' }, { key: 'distributed', label: 'Distribués', color: '#FE5716' }]} />
        <TemporalLineChart title="Stock du magasin central" subtitle="Évolution du stock disponible au magasin central en fin de mois." data={data.centralTrend} series={[{ key: 'active', label: 'Stock central', color: '#0b58bd' }]} />
      </div>
      <div className="content-grid content-grid--split">
        <BarList title="Stock actif par région" subtitle="Dispersion géographique des kits actuellement dans le réseau." items={data.regions} />
        <DonutCard title="Mix du stock actif" subtitle="Répartition actuelle par gamme de produits." items={data.products} />
      </div>
      <DataTable title="Stock physique par région" subtitle="Répartition entre Area Managers, boutiques et agents." columns={regionColumns} rows={filteredRegions} badge="Lecture logistique" emptyMessage="Aucune région ne correspond à cette recherche." />
      <DataTable title="Principaux détenteurs" subtitle="Points de possession concentrant les plus gros volumes de kits." columns={holderColumns} rows={filteredHolders} badge="Stock localisé" emptyMessage="Aucun détenteur ne correspond à cette recherche." />
      <footer className="dashboard-footer"><span>Source : UPYA · données fictives de démonstration</span><span>Période : {data.meta.period}</span></footer>
    </>
  );
}

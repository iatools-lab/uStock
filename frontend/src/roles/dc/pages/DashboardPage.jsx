import { BriefcaseBusiness, CheckCircle2, PackageOpen, Store, UsersRound, UserRoundCheck } from 'lucide-react';
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

  const filteredAreaManagers = useMemo(() => {
    if (!searchText) return data.areaManagers;
    return data.areaManagers.filter((item) => [item.name, item.region].join(' ').toLowerCase().includes(searchText));
  }, [searchText]);

  const filteredHolders = useMemo(() => {
    if (!searchText) return data.holders;
    return data.holders.filter((item) => [item.name, item.type, item.region].join(' ').toLowerCase().includes(searchText));
  }, [searchText]);

  const kpis = [
    { label: 'Stock actif national', value: data.kpis.stockActif, helper: 'Kits disponibles dans le réseau', icon: PackageOpen, variant: 'primary' },
    { label: 'Chez les AM', value: data.kpis.areaManagers, helper: 'Stock détenu par les Area Managers', icon: BriefcaseBusiness },
    { label: 'En boutiques', value: data.kpis.boutiques, helper: 'Stock en points de vente', icon: Store },
    { label: 'Chez les agents', value: data.kpis.agents, helper: 'Kits pris en charge par les agents', icon: UsersRound },
    { label: 'Kits vendus', value: data.kpis.vendus, helper: 'Kits livrés aux clients finaux', icon: CheckCircle2, variant: 'accent' },
    { label: 'Détenteurs actifs', value: data.kpis.detenteurs, helper: 'AM, boutiques et agents avec stock', icon: UserRoundCheck }
  ];

  const amColumns = [
    { key: 'name', label: 'Area Manager' }, { key: 'region', label: 'Région' },
    { key: 'stock', label: 'Stock actif', numeric: true }, { key: 'boutiques', label: 'Boutiques', numeric: true },
    { key: 'agents', label: 'Agents', numeric: true }, { key: 'vendus', label: 'Vendus', numeric: true }
  ];
  const holderColumns = [
    { key: 'name', label: 'Détenteur' }, { key: 'type', label: 'Type' }, { key: 'region', label: 'Région' }, { key: 'kits', label: 'Kits détenus', numeric: true }
  ];

  return (
    <>
      <Header title="Pilotage commercial national" subtitle="Vue consolidée du stock commercial, des ventes et de la détention du parc." role="Directeur Commercial" lastSync={data.meta.lastSync} onSearch={setSearchTerm} searchPlaceholder="Rechercher un AM, une région ou un détenteur..." />
      <section className="kpi-grid">{kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</section>
      <div className="content-grid content-grid--trends">
        <TemporalLineChart title="Ventes vs prises en charge agents" subtitle="Évolution mensuelle des kits vendus et des kits confiés aux agents." data={data.salesTrend} series={[{ key: 'assignments', label: 'Prises en charge', color: '#001A70' }, { key: 'sales', label: 'Ventes', color: '#FE5716' }]} />
        <TemporalLineChart title="Évolution du stock actif" subtitle="Stock commercial non vendu observé en fin de mois." data={data.stockTrend} series={[{ key: 'active', label: 'Stock actif', color: '#0b58bd' }]} />
      </div>
      <div className="content-grid content-grid--split">
        <BarList title="Stock actif par région" subtitle="Répartition géographique du stock commercial actuel." items={data.regions} />
        <DonutCard title="Stock par produit" subtitle="Composition du stock commercial actif." items={data.products} />
      </div>
      <DataTable title="Lecture par Area Manager" subtitle="Vision consolidée des principaux périmètres commerciaux." columns={amColumns} rows={filteredAreaManagers} badge="Vue nationale" emptyMessage="Aucun AM ne correspond à cette recherche." />
      <DataTable title="Principaux détenteurs du stock" subtitle="Détenteurs ayant actuellement les volumes les plus importants." columns={holderColumns} rows={filteredHolders} badge={`${data.kpis.detenteurs} détenteurs actifs`} emptyMessage="Aucun détenteur ne correspond à cette recherche." />
      <footer className="dashboard-footer"><span>Source : UPYA · données fictives de démonstration</span><span>Période : {data.meta.period}</span></footer>
    </>
  );
}

import { Boxes, CheckCircle2, PackageOpen, Store, UserRound, UsersRound } from 'lucide-react';
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

  const filteredBoutiques = useMemo(() => {
    if (!searchText) return data.boutiques;
    return data.boutiques.filter((item) => [item.name, item.region, item.boutique].join(' ').toLowerCase().includes(searchText));
  }, [searchText]);

  const filteredAgents = useMemo(() => {
    if (!searchText) return data.agents;
    return data.agents.filter((item) => [item.name, item.boutique, item.produit].join(' ').toLowerCase().includes(searchText));
  }, [searchText]);

  const kpis = [
    { label: 'Parc de mon périmètre', value: data.kpis.parc, helper: 'Kits suivis sur mon périmètre', icon: Boxes },
    { label: 'Stock actif', value: data.kpis.stockActif, helper: 'Kits encore disponibles', icon: PackageOpen, variant: 'primary' },
    { label: 'Stock chez moi', value: data.kpis.chezMoi, helper: 'Kits détenus directement par l’AM', icon: UserRound },
    { label: 'En boutiques', value: data.kpis.boutiques, helper: 'Stock présent dans mes boutiques', icon: Store },
    { label: 'Chez les agents', value: data.kpis.agents, helper: 'Kits détenus par mes agents', icon: UsersRound },
    { label: 'Kits vendus', value: data.kpis.vendus, helper: 'Ventes enregistrées sur le périmètre', icon: CheckCircle2, variant: 'accent' }
  ];

  const boutiqueColumns = [
    { key: 'name', label: 'Boutique' }, { key: 'boutique', label: 'Stock boutique', numeric: true },
    { key: 'agents', label: 'Chez agents', numeric: true }, { key: 'total', label: 'Total périmètre', numeric: true },
    { key: 'vendus', label: 'Vendus', numeric: true }
  ];
  const agentColumns = [
    { key: 'name', label: 'Agent' }, { key: 'boutique', label: 'Boutique' },
    { key: 'kits', label: 'Kits détenus', numeric: true }, { key: 'produit', label: 'Produits principaux' }
  ];

  return (
    <>
      <Header title="Mon périmètre de stock" subtitle={`Suivi du stock, des boutiques et des agents — ${data.meta.perimeter}.`} role="Area Manager" lastSync={data.meta.lastSync} onSearch={setSearchTerm} searchPlaceholder="Rechercher une boutique, un agent ou un produit..." />
      <section className="kpi-grid">{kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</section>
      <div className="content-grid content-grid--trends">
        <TemporalLineChart title="Transferts vers le réseau vs ventes" subtitle="Évolution mensuelle des kits distribués vers boutiques/agents et des ventes finales." data={data.activityTrend} series={[{ key: 'transfers', label: 'Transferts', color: '#001A70' }, { key: 'sales', label: 'Ventes', color: '#FE5716' }]} />
        <TemporalLineChart title="Évolution de mon stock actif" subtitle="Stock non vendu observé sur mon périmètre en fin de mois." data={data.stockTrend} series={[{ key: 'active', label: 'Stock actif', color: '#0b58bd' }]} />
      </div>
      <div className="content-grid content-grid--split">
        <BarList title="Stock par boutique" subtitle="Stock boutique + stock détenu par les agents qui lui sont rattachés." items={data.boutiquesBars} />
        <DonutCard title="Stock par produit" subtitle="Composition du stock actif de mon périmètre." items={data.products} />
      </div>
      <DataTable title="Mes boutiques" subtitle="Répartition du stock au sein de mon réseau de boutiques." columns={boutiqueColumns} rows={filteredBoutiques} badge="4 boutiques" emptyMessage="Aucune boutique ne correspond à cette recherche." />
      <DataTable title="Mes principaux agents détenteurs" subtitle="Agents qui détiennent actuellement le plus de kits dans mon périmètre." columns={agentColumns} rows={filteredAgents} badge="Périmètre limité" emptyMessage="Aucun agent ne correspond à cette recherche." />
      <footer className="dashboard-footer"><span>Source : UPYA · données fictives de démonstration</span><span>Périmètre : {data.meta.perimeter}</span></footer>
    </>
  );
}

import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  PackageOpen,
  Store,
  UsersRound,
  Warehouse
} from 'lucide-react';
import Header from '../components/Header';
import KpiCard from '../components/KpiCard';
import ProductDonut from '../components/ProductDonut';
import RegionBars from '../components/RegionBars';
import RegionTable from '../components/RegionTable';
import TopHolders from '../components/TopHolders';
import TemporalLineChart from '../components/TemporalLineChart';

export default function DirecteurPage() {
  const { data, actions } = useOutletContext();

  const kpiConfig = useMemo(() => [
    { label: 'Parc total suivi', value: data.kpis.parcTotal, helper: 'Tous les kits connus par UPYA', icon: Boxes },
    { label: 'Stock actif', value: data.kpis.stockActif, helper: 'Kits non vendus', icon: PackageOpen, variant: 'primary' },
    { label: 'Magasin central', value: data.kpis.magasinCentral, helper: 'Yaoundé', icon: Warehouse },
    { label: 'Area Managers', value: data.kpis.areaManagers, helper: 'Stock détenu par les AM', icon: BriefcaseBusiness },
    { label: 'Boutiques', value: data.kpis.boutiques, helper: 'Stock en points de vente', icon: Store },
    { label: 'Agents', value: data.kpis.agents, helper: 'Stock pris en charge', icon: UsersRound },
    { label: 'Kits vendus', value: data.kpis.vendus, helper: 'Chez le client final', icon: CheckCircle2, variant: 'accent' }
  ], [data]);

  return (
    <>
      <Header meta={data.meta} onSearch={actions.findKit} />

      <section className="kpi-grid">
        {kpiConfig.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </section>

      <div className="content-grid content-grid--trends">
        <TemporalLineChart
          data={data.timeSeries.flows}
          title="Entrées de kits vs ventes"
          subtitle="Lecture mensuelle des flux depuis janvier 2026."
          series={[
            { key: 'entries', label: 'Entrées de kits', color: '#001A70' },
            { key: 'sales', label: 'Kits vendus', color: '#FE5716' }
          ]}
        />
        <TemporalLineChart
          data={data.timeSeries.stock}
          title="Évolution du stock actif"
          subtitle="Stock non vendu observé en fin de période."
          series={[{ key: 'active', label: 'Stock actif', color: '#0b58bd' }]}
        />
      </div>

      <div className="content-grid content-grid--hero">
        <RegionBars regions={data.regions} />
        <ProductDonut products={data.products} />
      </div>

      <div className="content-grid content-grid--lower">
        <RegionTable regions={data.regions} />
        <TopHolders holders={data.topHolders} />
      </div>

      <footer className="dashboard-footer">
        <span>Source : UPYA · données fictives pour la maquette</span>
        <span>Dernière synchronisation : {data.meta.lastSync}</span>
      </footer>
    </>
  );
}

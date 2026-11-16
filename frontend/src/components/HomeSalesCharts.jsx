import { BarChart, TrendChart } from './ApexCharts.jsx';
import { monthlySeries, stateEvolution } from '../domain/live-analysis.js';
import '../styles/live-analysis.css';

export default function HomeSalesCharts({ analysis }) {
  if (!analysis) return null;
  const products = monthlySeries(analysis, 'product', 'DEPLOYED');
  const total = stateEvolution(analysis, 'DEPLOYED');
  const subtitle = `${analysis.window.start} — ${analysis.window.end} · Ventes par ${analysis.window.granularity === 'day' ? 'jour' : 'mois'}`;
  return <section aria-label="Analyse des ventes" className="live-analysis">
    <TrendChart title="Évolution des ventes" {...total} subtitle={subtitle} showValues={false}
      explanation="Chaque point indique combien de kits ont été vendus pendant le jour ou le mois affiché. Quand la ligne monte, les ventes augmentent. Quand elle descend, les ventes baissent. Les jours ou mois sans vente sont affichés à zéro." />
    <div className="analysis-grid">
      <BarChart title="Ventes par type de kit" rows={products.ranking} unit="kits vendus"
        explanation="Chaque barre représente un type de kit. Plus elle est longue, plus ce kit a été vendu pendant la période affichée sur les courbes. Agrandissez le graphique pour voir tous les produits." />
      <TrendChart title="Évolution des ventes par kit" data={products.data} series={products.series} subtitle={subtitle} showValues={false}
        explanation="Chaque couleur représente un type de kit. La ligne montre ses ventes par jour ou par mois. Une ligne qui monte indique davantage de ventes. Touchez un point pour lire les chiffres et cliquez sur un nom dans la légende pour masquer ou afficher sa ligne." />
    </div>
  </section>;
}

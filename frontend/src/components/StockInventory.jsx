import KpiDownload from './KpiDownload.jsx';
import { quantity } from '../data/real-stock.js';
import { ChartInfo } from './ChartFrame.jsx';

export default function StockInventory({data,filters={}}){
 if(!data.stockBreakdown?.length)return null;
 return <section className="panel" aria-label="État des kits complets en stock">
  <div className="panel__head"><h2>Kits complets déclarés en stock</h2><ChartInfo title="État des kits complets en stock" explanation="Seules les références de kits avec une nomenclature de composants sont retenues. Les accessoires sont exclus. Le statut est INSTOCK. Le détenteur, le produit, le flag et l’historique servent à séparer les kits disponibles des retours et des réparations. Un cas sans historique ou avec un flag non expliqué reste à contrôler. Tout kit lié à un contrat Signed est exclu du disponible, même sans paiement. PAV seul ne prouve pas qu’un kit est neuf. La nomenclature ne garantit pas que toutes les pièces sont physiquement présentes."/></div>
  <div className="commercial-metrics">{data.stockBreakdown.map(row=><article key={row.key}><span>{row.label}<KpiDownload data={data} filters={filters} stockCondition={row.key} metric="instock" count={row.quantity} title={row.label}/></span><strong>{quantity(row.quantity)}</strong></article>)}</div>
 </section>;
}

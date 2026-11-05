import { ChevronRight } from 'lucide-react';

export default function RegionTable({ regions }) {
  return (
    <section className="panel panel--table">
      <div className="panel__heading">
        <div>
          <span className="eyebrow">Drill-down</span>
          <h2>Détail régional</h2>
        </div>
        <button className="text-button" type="button">Voir tout</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Région</th>
              <th>Stock actif</th>
              <th>Chez AM</th>
              <th>Boutiques</th>
              <th>Agents</th>
              <th>Vendus</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region.name}>
                <td><strong>{region.name}</strong></td>
                <td>{region.active.toLocaleString('fr-FR')}</td>
                <td>{region.am.toLocaleString('fr-FR')}</td>
                <td>{region.boutiques.toLocaleString('fr-FR')}</td>
                <td>{region.agents.toLocaleString('fr-FR')}</td>
                <td><span className="sold-pill">{region.sold.toLocaleString('fr-FR')}</span></td>
                <td><button className="row-action" type="button" aria-label={`Voir ${region.name}`}><ChevronRight size={17} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

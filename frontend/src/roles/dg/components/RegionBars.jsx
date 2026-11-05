export default function RegionBars({ regions }) {
  const max = Math.max(...regions.map((r) => r.active));

  return (
    <section className="panel panel--regions">
      <div className="panel__heading">
        <div>
          <span className="eyebrow">Répartition géographique</span>
          <h2>Stock actif par région</h2>
        </div>
        <span className="panel__note">8 régions couvertes</span>
      </div>
      <div className="region-bars">
        {regions.map((region) => (
          <div className="region-row" key={region.name}>
            <div className="region-row__label">
              <strong>{region.name}</strong>
              <span>{region.active.toLocaleString('fr-FR')} kits</span>
            </div>
            <div className="progress-track">
              <div className="progress-value" style={{ width: `${(region.active / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

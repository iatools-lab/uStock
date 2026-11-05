export default function BarList({ title, subtitle, items, valueLabel = 'kits' }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <p className="eyebrow">Répartition</p>
          <h2>{title}</h2>
          <p className="panel__subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="bar-list">
        {items.map((item) => (
          <div className="bar-row" key={item.label} title={`${item.label} : ${item.value.toLocaleString('fr-FR')} ${valueLabel}`}>
            <div className="bar-row__meta"><strong>{item.label}</strong><span>{item.value.toLocaleString('fr-FR')} {valueLabel}</span></div>
            <div className="bar-track"><i style={{ width: `${Math.max(6, (item.value / max) * 100)}%` }} title={`${item.label} : ${item.value.toLocaleString('fr-FR')} ${valueLabel}`} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

const palette = ['#001A70', '#0A47A9', '#2979D9', '#63A7EE', '#FE5716', '#FF8A4C', '#D7E4F6'];

export default function ProductDonut({ products }) {
  const total = products.reduce((sum, p) => sum + p.active, 0);
  let cursor = 0;
  const stops = products.map((product, index) => {
    const start = (cursor / total) * 100;
    cursor += product.active;
    const end = (cursor / total) * 100;
    return `${palette[index % palette.length]} ${start}% ${end}%`;
  }).join(', ');

  return (
    <section className="panel">
      <div className="panel__heading">
        <div>
          <span className="eyebrow">Mix produit</span>
          <h2>Stock actif par produit</h2>
        </div>
      </div>
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="donut__hole">
            <strong>{total.toLocaleString('fr-FR')}</strong>
            <span>kits actifs</span>
          </div>
        </div>
        <div className="legend-list">
          {products.slice(0, 6).map((product, index) => (
            <div className="legend-item" key={product.name}>
              <span className="legend-dot" style={{ background: palette[index] }} />
              <span className="legend-name">{product.name}</span>
              <strong>{product.active.toLocaleString('fr-FR')}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

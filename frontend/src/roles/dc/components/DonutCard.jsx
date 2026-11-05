export default function DonutCard({ title, subtitle, items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = items.map((item, index) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    const colors = ['#001A70', '#0b58bd', '#FE5716', '#5b7fd2', '#87a2df', '#ff9a67', '#92b7ec'];
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  }).join(', ');

  return (
    <section className="panel">
      <div className="panel__head">
        <div><p className="eyebrow">Mix produit</p><h2>{title}</h2><p className="panel__subtitle">{subtitle}</p></div>
      </div>
      <div className="donut-layout">
        <div className="donut" style={{ background: `conic-gradient(${stops})` }} title={`Total : ${total.toLocaleString('fr-FR')} kits`}><div><strong>{total.toLocaleString('fr-FR')}</strong><span>kits</span></div></div>
        <div className="donut-legend">
          {items.map((item, index) => <div key={item.label} title={`${item.label} : ${item.value.toLocaleString('fr-FR')} kits`}><i className={`legend-color legend-color--${index}`} /><span>{item.label}</span><strong>{item.value.toLocaleString('fr-FR')}</strong></div>)}
        </div>
      </div>
    </section>
  );
}

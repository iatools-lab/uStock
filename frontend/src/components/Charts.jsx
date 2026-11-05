const palette = ['#001A70', '#0b58bd', '#FE5716', '#5b7fd2', '#87a2df', '#ff9a67'];
export function ProductChart({ rows, title = "Stock actif par produit", unit = "kits actifs" }) {
  const total = rows.reduce((n, r) => n + r.active, 0);
  let cursor = 0;
  const stops = rows.map((r, index) => { const start = cursor; cursor += total ? r.active / total * 100 : 0; return `${palette[index % palette.length]} ${start}% ${cursor}%`; });
  return <section className="panel"><div className="panel__head"><div><p className="eyebrow">Mix produit</p><h2>{title}</h2><p className="panel__subtitle">Tous états techniques.</p></div></div>
    {total ? <div className="donut-layout"><div className="donut" role="img" aria-label={`${total} kits actifs par produit, détail dans la légende`} style={{ background: `conic-gradient(${stops.join(',')})` }}><div><strong>{total.toLocaleString('fr-FR')}</strong><span>{unit}</span></div></div>
      <div className="donut-legend">{rows.map((r, i) => <div key={r.id}><i style={{ background: palette[i % palette.length] }} className="legend-color" /><span>{r.name}</span><strong>{r.active}</strong></div>)}</div></div> : <p className="table-empty">Aucun stock actif dans ce périmètre.</p>}
  </section>;
}
export function StockBars({ rows, title }) {
  const max = Math.max(...rows.map(r => r.active), 1);
  return <section className="panel"><div className="panel__head"><div><p className="eyebrow">Répartition</p><h2>{title}</h2><p className="panel__subtitle">Stock actif, dont immédiatement disponible.</p></div></div>
    <div className="bar-list">{rows.length ? rows.map(r => <div key={r.id} className="stock-bar"><div className="bar-row__meta"><strong>{r.name}</strong><span>{r.active} actifs · {r.available} disponibles</span></div><div className="bar-track"><i style={{ width: `${r.active / max * 100}%` }} /></div></div>) : <p className="table-empty">Aucun kit dans ce périmètre.</p>}</div>
  </section>;
}
export function TrendChart({ data, title, series, subtitle, showValues = true }) {
  const width = 720, height = 250, padX = 50, padY = 30;
  const max = Math.max(1, ...data.flatMap(row => series.map(s => row[s.key])));
  const x = i => padX + i / Math.max(data.length - 1, 1) * (width - 2 * padX);
  const y = value => height - padY - value / max * (height - 2 * padY);
  return <section className="panel temporal-panel"><div className="panel__head"><div><p className="eyebrow">Historique calculé</p><h2>{title}</h2><p className="panel__subtitle">{subtitle}</p></div></div>
    <div className="chart-legend">{series.map((s, i) => <span key={s.key}><i style={{ background: palette[i] }} />{s.label}</span>)}</div>
    <div className="svg-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} className="temporal-chart" role="img" aria-label={title}>
      {[0, .25, .5, .75, 1].map(t => <g key={t}><line x1={padX} x2={width - padX} y1={y(t * max)} y2={y(t * max)} className="chart-gridline" /><text x={padX - 8} y={y(t * max) + 4} textAnchor="end" className="chart-axis-label">{Math.round(t * max)}</text></g>)}
      {data.map((row, i) => <text key={row.month} x={x(i)} y={height - 6} textAnchor="middle" className="chart-axis-label">{row.month}</text>)}
      {series.map((s, j) => <g key={s.key}><polyline points={data.map((row, i) => `${x(i)},${y(row[s.key])}`).join(' ')} fill="none" stroke={palette[j]} strokeWidth="3" />{data.map((row, i) => <circle key={i} cx={x(i)} cy={y(row[s.key])} r="4" fill="white" stroke={palette[j]} strokeWidth="2" tabIndex={0} aria-label={`${row.month}, ${s.label} : ${row[s.key]}`}><title>{`${row.month} · ${s.label} : ${row[s.key]}`}</title></circle>)}</g>)}
    </svg></div>
    {showValues && <details className="scope-help"><summary>Afficher les valeurs du graphique</summary><div className="table-scroll"><table><thead><tr><th>Mois</th>{series.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead><tbody>{data.map(row => <tr key={row.month}><td>{row.month}</td>{series.map(s => <td key={s.key}>{row[s.key]}</td>)}</tr>)}</tbody></table></div></details>}
  </section>;
}

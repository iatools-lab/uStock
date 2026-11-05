const WIDTH = 720;
const HEIGHT = 250;
const PAD_X = 46;
const PAD_Y = 30;

export default function TemporalLineChart({ title, subtitle, data, series }) {
  const allValues = data.flatMap((row) => series.map((serie) => Number(row[serie.key]) || 0));
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = Math.max(max - min, 1);
  const xStep = data.length > 1 ? (WIDTH - PAD_X * 2) / (data.length - 1) : 0;
  const y = (value) => HEIGHT - PAD_Y - ((value - min) / range) * (HEIGHT - PAD_Y * 2);
  const x = (index) => PAD_X + index * xStep;
  const points = (key) => data.map((row, index) => `${x(index)},${y(row[key])}`).join(' ');
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4).reverse();

  return (
    <section className="panel temporal-panel">
      <div className="panel__head">
        <div>
          <p className="eyebrow">Évolution temporelle</p>
          <h2>{title}</h2>
          <p className="panel__subtitle">{subtitle}</p>
        </div>
        <div className="chart-legend">
          {series.map((serie) => <span key={serie.key}><i style={{ background: serie.color }} />{serie.label}</span>)}
        </div>
      </div>
      <div className="svg-chart-wrap">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="temporal-chart" role="img" aria-label={title}>
          {ticks.map((tick, index) => {
            const py = PAD_Y + (index * (HEIGHT - PAD_Y * 2)) / 4;
            return <g key={index}><line x1={PAD_X} y1={py} x2={WIDTH - PAD_X} y2={py} className="chart-gridline" /><text x={4} y={py + 4} className="chart-axis-label">{Math.round(tick).toLocaleString('fr-FR')}</text></g>;
          })}
          {data.map((row, index) => <text key={row.month} x={x(index)} y={HEIGHT - 7} textAnchor="middle" className="chart-axis-label">{row.month}</text>)}
          {series.map((serie) => (
            <g key={serie.key}>
              <polyline fill="none" stroke={serie.color} strokeWidth="3" points={points(serie.key)} strokeLinecap="round" strokeLinejoin="round" />
              {data.map((row, index) => (
                <circle
                  key={`${serie.key}-${row.month}`}
                  cx={x(index)}
                  cy={y(row[serie.key])}
                  r="3.5"
                  fill="#fff"
                  stroke={serie.color}
                  strokeWidth="2.5"
                  className="chart-point"
                  tabIndex={0}
                  aria-label={`${serie.label} : ${row.month} = ${Number(row[serie.key]).toLocaleString('fr-FR')}`}
                  title={`${serie.label} · ${row.month} : ${Number(row[serie.key]).toLocaleString('fr-FR')}`}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

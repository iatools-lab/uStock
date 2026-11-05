import { useMemo } from 'react';

const WIDTH = 760;
const HEIGHT = 270;
const PAD = { left: 48, right: 18, top: 18, bottom: 38 };

function buildPoints(data, key, maxValue) {
  const chartW = WIDTH - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;
  return data.map((row, index) => {
    const x = PAD.left + (index / Math.max(data.length - 1, 1)) * chartW;
    const y = PAD.top + chartH - (row[key] / maxValue) * chartH;
    return `${x},${y}`;
  }).join(' ');
}

export default function TemporalLineChart({ data, series, title, subtitle }) {
  const maxValue = useMemo(() => {
    const values = data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
    return Math.max(...values, 1) * 1.12;
  }, [data, series]);

  const ticks = [0, .25, .5, .75, 1].map((ratio) => ({
    ratio,
    value: Math.round(maxValue * (1 - ratio))
  }));

  return (
    <section className="panel temporal-panel">
      <div className="panel__heading">
        <div>
          <span className="eyebrow">Évolution temporelle</span>
          <h2>{title}</h2>
          {subtitle && <p className="panel__subtitle">{subtitle}</p>}
        </div>
        <div className="chart-legend">
          {series.map((item) => (
            <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
          ))}
        </div>
      </div>
      <div className="svg-chart-wrap">
        <svg className="temporal-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
          {ticks.map((tick) => {
            const y = PAD.top + tick.ratio * (HEIGHT - PAD.top - PAD.bottom);
            return (
              <g key={tick.ratio}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="chart-gridline" />
                <text x={PAD.left - 9} y={y + 4} textAnchor="end" className="chart-axis-label">{tick.value.toLocaleString('fr-FR')}</text>
              </g>
            );
          })}
          {data.map((row, index) => {
            const x = PAD.left + (index / Math.max(data.length - 1, 1)) * (WIDTH - PAD.left - PAD.right);
            return <text key={row.label} x={x} y={HEIGHT - 11} textAnchor="middle" className="chart-axis-label">{row.label}</text>;
          })}
          {series.map((item) => (
            <g key={item.key}>
              <polyline
                points={buildPoints(data, item.key, maxValue)}
                fill="none"
                stroke={item.color}
                strokeWidth="3.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {data.map((row, index) => {
                const x = PAD.left + (index / Math.max(data.length - 1, 1)) * (WIDTH - PAD.left - PAD.right);
                const y = PAD.top + (HEIGHT - PAD.top - PAD.bottom) - ((Number(row[item.key]) || 0) / maxValue) * (HEIGHT - PAD.top - PAD.bottom);
                return (
                  <circle
                    key={`${item.key}-${row.label}`}
                    cx={x}
                    cy={y}
                    r="3.7"
                    fill="#fff"
                    stroke={item.color}
                    strokeWidth="2.3"
                    className="chart-point"
                    tabIndex={0}
                    aria-label={`${item.label} : ${row.label} = ${Number(row[item.key]).toLocaleString('fr-FR')}`}
                    title={`${item.label} · ${row.label} : ${Number(row[item.key]).toLocaleString('fr-FR')}`}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

import { ArrowUpRight } from 'lucide-react';

export default function KpiCard({ label, value, helper, variant = 'default', icon: Icon }) {
  return (
    <article className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-card__top">
        <span className="kpi-card__icon"><Icon size={19} /></span>
        <span className="kpi-card__trend"><ArrowUpRight size={14} /> temps réel</span>
      </div>
      <strong>{value.toLocaleString('fr-FR')}</strong>
      <span className="kpi-card__label">{label}</span>
      {helper && <small>{helper}</small>}
    </article>
  );
}

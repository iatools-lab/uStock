import { ArrowUpRight } from 'lucide-react';

export default function KpiCard({ label, value, helper, icon: Icon, variant = 'default', trend }) {
  return (
    <article className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-card__top">
        <span className="kpi-card__icon"><Icon size={17} /></span>
        {trend && <span className="kpi-card__trend"><ArrowUpRight size={11} />{trend}</span>}
      </div>
      <strong>{Number(value).toLocaleString('fr-FR')}</strong>
      <span className="kpi-card__label">{label}</span>
      <small>{helper}</small>
    </article>
  );
}

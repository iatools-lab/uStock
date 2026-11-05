import { ChevronRight } from 'lucide-react';
export default function PlaceTrail({ trail, onBack, title = 'Toutes les zones' }) {
  return <nav className="stock-breadcrumbs" aria-label="Parcours des lieux"><button onClick={()=>onBack(-1)}>{title}</button>{trail.map((step,i)=><span key={step.field}><ChevronRight size={14}/><button onClick={()=>onBack(i)}>{step.name}</button></span>)}</nav>;
}

import { stockScope } from '../domain/stock-scope.js';
import '../styles/kpi-scope.css';
export default function KpiScope({filters,options}){
 const scope=stockScope(filters,options);
 return <div className="kpi-scope" aria-label="Périmètre des indicateurs"><strong>{scope.title}</strong>{scope.detail&&<span>{scope.detail}</span>}</div>;
}

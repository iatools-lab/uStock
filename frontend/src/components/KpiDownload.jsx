import { ExcelButton } from './ExcelTable.jsx';
import '../styles/sales-download.css';
export default function KpiDownload({data,filters={},metric='total',count,title,groupLevel,groupKey,window,rows,headers,metadata=[],adminScope,stockCondition}){
 async function getData(){
  if(rows)return {headers,rows,metadata:[['Indicateur',title],['Valeur affichée',count],...metadata]};
  const p=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
  p.set('role','dg');p.set('view','stock');p.set('exportDetails','true');p.set('revision',data.selection.revision);p.set('expectedCount',count);
  if(stockCondition){p.set('stockCondition',stockCondition);p.set('status','INSTOCK');}
  if(adminScope){p.set('adminExport','true');p.set('scope',adminScope);}
  if(metric==='instock')p.set('status','INSTOCK');if(metric==='defective')p.set('status','DEFECTIVE');
  if(window){p.delete('date');if(window.start)p.set('startDate',window.start);else p.delete('startDate');p.set('endDate',window.end);}
  if(groupLevel){p.set('groupLevel',groupLevel);p.set('groupKey',groupKey);}
  const response=await fetch('/api/sales-export?'+p,{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error);
  if(result.total!==Number(count))throw new Error('Les données ont changé. Actualisez les indicateurs.');
  const cols=[['serialNumber','Numéro de série'],['contractNumber','Contrat Upya'],['productReference','Référence produit'],['productName','Produit'],['status','État'],['flag','Marqueur CRM'],['agentNumber','Agent / détenteur'],['agentName','Nom'],['zone','Zone'],['region','Région'],['areaManagerNumber','Area manager'],...(adminScope?[['included','Inclus dans l’analyse']]:[])];
  return {headers:cols.map(c=>c[1]),rows:result.rows.map(r=>cols.map(c=>typeof r[c[0]]==='boolean'?(r[c[0]]?'Oui':'Non'):r[c[0]]??'')),metadata:[['Indicateur',title],['Nombre',result.total],['Début',result.period.start||'Toutes périodes'],['Fin',result.period.end],['Révision',result.revision],...Object.entries(filters).filter(([,v])=>v)]};
 }
 return <ExcelButton title={title} iconOnly getData={getData}/>;
}

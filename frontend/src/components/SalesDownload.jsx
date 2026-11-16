import { ExcelButton } from './ExcelTable.jsx';
import '../styles/sales-download.css';
const columns=[['serialNumber','N° de série du kit'],['contractNumber','N° de contrat Upya'],['productReference','Référence du kit'],['productName','Produit'],['contractProductReference','Référence dans le contrat'],['contractProductName','Produit dans le contrat'],['signingDate','Signature — heure du Cameroun'],['signingDateUTC','Signature — UTC'],['agentNumber','N° agent'],['agentName','Agent'],['zone','Zone'],['region','Région'],['areaManagerNumber','N° area manager'],['areaManagerName','Area manager'],['assetNumber','Identifiant équipement Upya'],['paygNumber','N° PAYG']];
export default function SalesDownload({data,filters={},window,expectedCount,title='Identifiants des ventes',groupLevel,groupKey,product}){
 async function getData(){
  const interval=window||data.salesWindow||{start:data.period?.start,end:data.asOfDate,allowUndated:!data.period?.start&&!filters.date&&!filters.endDate};
  const params=new URLSearchParams(Object.entries(filters).filter(([,value])=>value));
  params.delete('date');params.delete('startDate');params.delete('endDate');
  if(interval.start)params.set('startDate',interval.start);
  params.set('endDate',interval.end);params.set('allowUndated',String(Boolean(interval.allowUndated)));
  if(data.selection?.revision!=null)params.set('revision',String(data.selection.revision));
  params.set('expectedCount',String(expectedCount));
  if(groupLevel){params.set('groupLevel',groupLevel);params.set('groupKey',groupKey);}
  if(product!==undefined)params.set('product',product||'__unknown__');
  const response=await fetch('/api/sales-export?'+params,{cache:'no-store'});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Export indisponible. Réessayez.');
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Export indisponible. Réessayez.');
  if(result.total!==Number(expectedCount)||result.rows.length!==result.total)throw new Error('Le nombre de ventes a changé. Actualisez les indicateurs puis relancez le téléchargement.');
  return {headers:columns.map(([,label])=>label),rows:result.rows.map(row=>columns.map(([key])=>row[key]??'')),metadata:[['Source','raw_upowa_schema.crm_contracts'],['Début',result.period.start||'Toutes les dates connues'],['Fin',result.period.end],['Ventes exportées',result.total],['Révision des exclusions',result.revision],['Export généré le',result.generatedAt],['Signature sans date incluse',result.allowUndated?'Oui':'Non'],['Kit sans numéro de série','Numéro de contrat conservé ; aucun numéro de série inventé'],...Object.entries(filters).filter(([,value])=>value)]};
 }
 return <ExcelButton title={title} iconOnly getData={getData}/>;
}

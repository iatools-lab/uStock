import { queryContractDetails } from './contract-sales.mjs';
import { loadStockContext, matchesGroup, selectedPeriod, territoryPlace, GROUPS } from './stock-query.mjs';

export async function querySalesExport(c,params,selection){
 for(const [,value] of params)if(value.length>200)throw new Error('INVALID_FILTER');
 const today=(await c.query(`SELECT (now() AT TIME ZONE 'Africa/Douala')::date::text AS today`)).rows[0].today;
 const period=selectedPeriod(params,today);
 const allowUndated=params.get('allowUndated')==='true'&&!period.start&&period.end===today;
 const level=params.get('groupLevel'),key=params.get('groupKey');
 if(level&&!GROUPS[level])throw new Error('INVALID_GROUP');
 const {decorate,byId}=await loadStockContext(c,period.end);
 const source=await queryContractDetails(c,{selection,params,start:period.start,end:period.end,allowUndated});
 const rows=source.map(decorate).filter(r=>matchesGroup(r,params)).filter(r=>!level||((territoryPlace(r,level,byId)?.key||'__unknown__')===key));
 if(rows.length>1048575)throw new Error('EXPORT_TOO_LARGE');
 return {revision:selection.revision,period,allowUndated,total:rows.length,generatedAt:new Date().toISOString(),rows:rows.map(r=>({serialNumber:r.serial_number||'',contractNumber:r.contract_number,assetNumber:r.asset_number||'',paygNumber:r.payg_number||'',productReference:r.productReference||'',productName:r.product_name||'',contractProductReference:r.contract_product_reference||'',contractProductName:r.contract_product_name||'',signingDate:r.signing_date_local||'',signingDateUTC:r.sold_at?new Date(r.sold_at).toISOString():'',agentNumber:r.holderId||'',agentName:r.holderName||'',zone:r.zone||'',region:r.region||'',areaManagerNumber:r.amId||'',areaManagerName:byId.get(r.amId)?.agent_name||''}))};
}

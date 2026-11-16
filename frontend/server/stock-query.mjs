import { loadTerritories, loadAgentAssignments, mapAgents, locateAgent, enrichAgentNetwork } from './territories.mjs';
import { inclusionSQL } from './analysis-selection.mjs';
import { eligibleSQL, physicalStockSQL } from './status-scope.mjs';
import { queryAnalysis } from './analytics.mjs';
import { comparisonPeriod } from './performance-period.mjs';
import { contractSalesCTE, queryContractSales, queryContractDetails } from './contract-sales.mjs';
import { stockConditionSQL, STOCK_CONDITION_LABELS } from './kit-stock-scope.mjs';

export const GROUPS = {zone:'zone',region:'region',department:'department',arrondissement:'arrondissement',amId:'amId',shopId:'shopId',holderId:'holderId'};
const ACTIVE = new Set(['INSTOCK']);
const metric=(value,reason)=>({value:value==null?null:String(value),status:value==null?'unavailable':'known',reason});
export function selectedDate(value,today){
  const date=value||today;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)throw new Error('INVALID_DATE');
  return date;
}
export function selectedPeriod(params,today){
  const end=selectedDate(params.get('endDate')||params.get('date'),today);
  const start=params.get('startDate')?selectedDate(params.get('startDate'),today):null;
  if(start&&start>end)throw new Error('INVALID_PERIOD');
  return {start,end};
}
export function matchesGroup(row,params){
  for(const key of ['product','status','region','zone','department','arrondissement','amId','shopId','holderId','holderKind']){
    const value=params.get(key);if(!value)continue;
    const actual=key==='product'?row.productReference:row[key];
    if(value==='__unknown__'){if(actual!=null&&actual!=='')return false;}
    else if(value==='__central__'){if(row.holderKind!=='central')return false;}
    else if(actual!==value)return false;
  }
  return true;
}
const increment=(map,key,label,n,extra={})=>{
  key=key||'__unknown__';if(!map.has(key))map.set(key,{key,label:label||'Non renseigné',quantity:0,...extra});
  map.get(key).quantity+=n;return map.get(key);
};
const asRows=map=>[...map.values()].sort((a,b)=>b.quantity-a.quantity).map(row=>({...row,quantity:String(row.quantity)}));
export function territoryPlace(row,level,byId){
  if(level!=='holderId'&&row.holderKind==='central')return {key:'__central__',label:'Entrepôts'};
  if(!row[level])return null;
  const label=level==='holderId'?row.holderName:level==='amId'?byId.get(row.amId)?.agent_name:level==='shopId'?byId.get(row.shopId)?.agent_name:row[level];
  return label?{key:row[level],label}:null;
}
export async function loadStockContext(c,asOfDate){
  const territories=await loadTerritories();
  const assignments=await loadAgentAssignments();
  // Les données CRM sont relues ; seules leurs correspondances géographiques inchangées sont mémorisées.
  const agents=mapAgents((await c.query(`SELECT agent_number,agent_name,role,is_active,team,entity_name,location_region,location_district,location_arrondissement,location_commune,location_village,location_zone FROM bi_schema.dim_agents`)).rows,territories,assignments);
  const daily=(await c.query(`SELECT DISTINCT ON(holder_id) holder_id,holder_name,holder_role FROM bi_schema.fct_asset_stock_daily WHERE holder_category='AGENT' AND holder_id IS NOT NULL ORDER BY holder_id,snapshot_date DESC`)).rows;
  const agentIndex=new Map(agents.map(agent=>[agent.agent_number,agent]));
  for(const row of daily){
    let agent=agentIndex.get(row.holder_id);
    if(!agent){agent={agent_number:row.holder_id,agent_name:row.holder_name,role:row.holder_role,...locateAgent({agent_name:row.holder_name,role:row.holder_role},territories)};agents.push(agent);agentIndex.set(agent.agent_number,agent);}
    else if(!agent.region||!agent.zone){const old=locateAgent({...agent,agent_name:row.holder_name,role:row.holder_role},territories);for(const field of ['region','department','arrondissement','zone'])if(!agent[field]&&old[field]){agent[field]=old[field];agent.method='daily_holder';}}
  }
  const network=(await c.query(`WITH ordered AS (
    SELECT holder_id,holder_category,start_at,
      lag(holder_id) OVER(PARTITION BY serial_number ORDER BY start_at,period_no) AS source_id,
      lag(holder_role) OVER(PARTITION BY serial_number ORDER BY start_at,period_no) AS source_role,
      lag(holder_category) OVER(PARTITION BY serial_number ORDER BY start_at,period_no) AS source_category
    FROM bi_schema.fct_asset_holding_periods WHERE start_at < (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')
  ) SELECT DISTINCT holder_id,source_id,source_role FROM ordered WHERE holder_category='AGENT' AND source_category='AGENT' AND source_role IN ('POINT RELAIS','AREA MANAGER') AND holder_id<>source_id`,[asOfDate])).rows;
  enrichAgentNetwork(agents,network);
  const byId=new Map(agents.map(a=>[a.agent_number,a]));
  const decorate=row=>{
    const agent=byId.get(row.holder_id);
    const route=byId.get(row.routing_shop_id);
    const useRoute=agent?.holderKind!=='central'&&route?.holderKind==='shop'&&(!agent?.zone||!route.zone||agent.zone===route.zone)&&(!agent?.region||!route.region||agent.region===route.region);
    return {...row,productReference:row.product_reference,holderId:row.holder_id,holderName:row.holder_name||agent?.agent_name,holderKind:agent?.holderKind||'unknown',region:agent?.region||(useRoute?route.region:null),department:agent?.department||(useRoute?route.department:null),arrondissement:agent?.arrondissement||(useRoute?route.arrondissement:null),zone:agent?.zone||(useRoute?route.zone:null),amId:agent?.amId||(useRoute?route.amId:null),shopId:row.status==='DEPLOYED'&&useRoute?route.agent_number:agent?.shopId||(useRoute?route.agent_number:null),method:useRoute&&!agent?.region?'distribution_shop':agent?.method,conflict:agent?.conflict};
  };
  return {territories,agents,byId,decorate};
}
export async function queryStock(c,params,selection={rules:[],revision:0},{contextProvider}={}){
  const page=Number(params.get('page')||1),days=Number(params.get('days')||90),role=params.get('role')||'dg',view=params.get('view')||'overview';
  const level=view==='performance'?'zone':params.get('level')||'zone';
  const operational=['commercial','teams','opportunities','sales','logistics','redistribution','treatment'].includes(view);
  if(view==='forecast'||view==='performance'||operational){params=new URLSearchParams(params);params.delete('status');}
  if(!Number.isSafeInteger(page)||page<1||page>100000||![30,60,90,180,365].includes(days)||!GROUPS[level]||!['dg','dc','supply','am','it'].includes(role))throw new Error('INVALID_REQUEST');
  for(const [,value] of params)if(value.length>200)throw new Error('INVALID_FILTER');
  const identity=(await c.query(`SELECT current_database() AS "name",now() AS "at",(now() AT TIME ZONE 'Africa/Douala')::date::text AS today,(SELECT max(_loaded_at) FROM bi_schema.dim_asset) AS loaded`)).rows[0];
  const period=selectedPeriod(params,identity.today),asOfDate=period.end,historical=asOfDate!==identity.today;
  const allowUndatedSales=!period.start&&!params.get('date')&&!params.get('endDate');
  const denied={schemaVersion:1,source:'ukit',salesSource:'raw_upowa_schema.crm_contracts',salesWindow:{start:period.start,end:asOfDate,allowUndated:allowUndatedSales},queriedAt:identity.at,sourceLoadedAt:identity.loaded||identity.at,asOfDate,today:identity.today,scope:{label:'Affectation AM à compléter',authorized:false},coverage:{status:'partial',note:'Identité de l’utilisateur AM à fournir.'},metrics:Object.fromEntries(['active','available','availabilityUnconfirmed','defective','deployed','sales'].map(key=>[key,metric(null,'Périmètre AM non confirmé.')])),products:[],custody:[],assets:{rows:[],hasMore:false},options:{}};
  if(role==='am')return denied;
  const {territories,agents,byId,decorate}=await (contextProvider?contextProvider(c,asOfDate,identity):loadStockContext(c,asOfDate));
  if(params.get('section')==='analysis'){
    if(view!=='overview')throw new Error('INVALID_SECTION');
    const analysis=await queryAnalysis(c,{params,selection,asOfDate,view,decorate,matchesGroup,salesOnly:true});
    return {analysis,selection:{revision:selection.revision},asOfDate};
  }
  const values=[asOfDate],conditions=['$1::date IS NOT NULL',eligibleSQL('a'),inclusionSQL(selection,values)];
  const baseStatus=historical?"CASE WHEN h.asset_status='IN_STOCK' THEN 'INSTOCK' ELSE h.asset_status END":'a.crm_status';
  const status=baseStatus;
  // Le stock neuf et les ventes sont deux sources distinctes : un kit deja vendu ne redevient pas neuf.
  const stockCutoff=`(($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')`;
  conditions.push(physicalStockSQL('a',baseStatus,{holderName:historical?'h.holder_name':'a.crm_holder_name',cutoff:stockCutoff,signed:'signed_stock.serial_number IS NOT NULL'}));
  const priorSaleSQL=`a.serial_number IN (SELECT sold.serial_number FROM contract_first_sales sold WHERE sold.sold_at<${stockCutoff} OR (${allowUndatedSales?'true':'false'} AND sold.sold_at IS NULL))`;
  conditions.push(`NOT (${priorSaleSQL})`);
  if(period.start){
    values.push(period.start);
    const start=`($${values.length}::date::timestamp AT TIME ZONE 'Africa/Douala')`;
    const end=`(($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')`;
    conditions.push(`(${baseStatus}='INSTOCK' OR (${baseStatus}='DEFECTIVE' AND l.first_defective_at>=${start} AND l.first_defective_at<${end}))`);
  }
  if(historical&&!period.start)conditions.push(`${baseStatus} IN ('DEPLOYED','INSTOCK','DEFECTIVE')`);
  for(const [key,column] of [['product','a.product_reference'],['status',status]])if(params.get(key)){if(params.get(key)==='__unknown__')conditions.push(`${column} IS NULL`);else{values.push(params.get(key));conditions.push(`${column}=$${values.length}`);}}
  if(params.get('search')){values.push('%'+params.get('search')+'%');conditions.push(`(a.serial_number ILIKE $${values.length} OR a.product_name ILIKE $${values.length} OR ${historical?'h.holder_name':'a.crm_holder_name'} ILIKE $${values.length})`);}
  const holder=historical?`CASE WHEN h.holder_category='AGENT' THEN h.holder_id END`:`coalesce(a.crm_holder_agent_number,CASE WHEN l.current_holder_category='AGENT' AND replace(l.current_status,'IN_STOCK','INSTOCK')=a.crm_status THEN l.current_holder_id END)`;
  const holderName=historical?`CASE WHEN h.holder_category='AGENT' THEN h.holder_name END`:`coalesce(a.crm_holder_name,l.current_holder_name)`;
  const buildSource=where=>`SELECT a.serial_number,a.product_reference,a.product_name,a.crm_flag,a.crm_owner_client_number,a.in_crm,${status} status,${holder} holder_id,${holderName} holder_name,NULL::text routing_shop_id FROM bi_schema.dim_asset a LEFT JOIN stock_signed_assets signed_stock ON signed_stock.serial_number=a.serial_number LEFT JOIN bi_schema.fct_asset_lifecycle l ON l.serial_number=a.serial_number ${historical?`${period.start?'LEFT JOIN':'JOIN'} (SELECT DISTINCT ON (serial_number) serial_number,holder_id,holder_name,holder_category,asset_status FROM bi_schema.fct_asset_holding_periods WHERE start_at < (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') AND (end_at IS NULL OR end_at >= (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')) ORDER BY serial_number,start_at DESC,period_no DESC) h ON h.serial_number=a.serial_number`:''} WHERE ${where.join(' AND ')}`;
  const source=buildSource(conditions);
  const cutoff=`(($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')`;
  // Inventaire complet INSTOCK : les retours restent visibles sans gonfler le disponible.
  const inventoryConditions=conditions.filter((condition,index)=>index!==3&&index!==4);
  inventoryConditions.push(`${baseStatus} IN ('INSTOCK','IN_STOCK')`);
  const inventorySource=buildSource(inventoryConditions);
  const inventorySQL=inventorySource.replace('NULL::text routing_shop_id',`NULL::text routing_shop_id,${stockConditionSQL('a',{holderName,cutoff,sold:priorSaleSQL,signed:'signed_stock.serial_number IS NOT NULL'})} AS stock_condition`);
  if(params.get('exportDetails')==='true'&&params.has('stockCondition')){
    const condition=params.get('stockCondition');
    if(!Object.hasOwn(STOCK_CONDITION_LABELS,condition))throw new Error('INVALID_FILTER');
    const level=params.get('groupLevel'),key=params.get('groupKey');
    if(level&&!GROUPS[level])throw new Error('INVALID_GROUP');
    const records=(await c.query(`WITH ${contractSalesCTE()}, inventory AS (${inventorySQL}) SELECT * FROM inventory WHERE stock_condition=$${values.length+1}`, [...values,condition])).rows.map(decorate).filter(row=>matchesGroup(row,params)).filter(row=>!level||(territoryPlace(row,level,byId)?.key||'__unknown__')===key);
    return {revision:selection.revision,period,total:records.length,rows:records.map(r=>({serialNumber:r.serial_number||'',contractNumber:'',productReference:r.productReference||'',productName:r.product_name||'',status:r.status,flag:r.crm_flag||'',agentNumber:r.holderId||'',agentName:r.holderName||'',zone:r.zone||'',region:r.region||'',areaManagerNumber:r.amId||''}))};
  }
  if(params.get('exportDetails')==='true'){
    const physical=(await c.query(`WITH ${contractSalesCTE()}, selected AS (${source}) SELECT * FROM selected`,values)).rows.map(decorate).filter(row=>matchesGroup(row,params));
    const sold=(await queryContractDetails(c,{selection,params,start:period.start,end:asOfDate,allowUndated:allowUndatedSales})).map(decorate).filter(row=>matchesGroup(row,params));
    const level=params.get('groupLevel'),key=params.get('groupKey');if(level&&!GROUPS[level])throw new Error('INVALID_GROUP');
    const rows=[...physical,...sold].filter(row=>!level||(territoryPlace(row,level,byId)?.key||'__unknown__')===key);
    return {revision:selection.revision,period,total:rows.length,rows:rows.map(r=>({serialNumber:r.serial_number||'',contractNumber:r.contract_number||'',productReference:r.productReference||'',productName:r.product_name||'',status:r.status,flag:r.crm_flag||'',agentNumber:r.holderId||'',agentName:r.holderName||'',zone:r.zone||'',region:r.region||'',areaManagerNumber:r.amId||''}))};
  }
  const requestedStatus=params.get('status');
  let stockInventory=[];
  if(!requestedStatus||requestedStatus==='INSTOCK')stockInventory=(await c.query(`WITH ${contractSalesCTE()}, inventory AS (${inventorySQL}) SELECT holder_id,holder_name,product_reference,product_name,status,crm_flag,stock_condition,bool_or(in_crm) AS in_crm,NULL::text routing_shop_id,count(*)::int quantity FROM inventory GROUP BY 1,2,3,4,5,6,7`,values)).rows.map(decorate).filter(row=>matchesGroup(row,params));
  const stockBreakdown=Object.entries(STOCK_CONDITION_LABELS).map(([key,label])=>({key,label,quantity:stockInventory.filter(r=>r.stock_condition===key).reduce((n,r)=>n+r.quantity,0)}));

  const defectConditions=conditions.map((condition,index)=>index===3?`${baseStatus}='DEFECTIVE'`:condition);
  const grouped=(!requestedStatus||requestedStatus==='DEFECTIVE')?(await c.query(`WITH ${contractSalesCTE()}, selected AS (${buildSource(defectConditions)}) SELECT holder_id,routing_shop_id,max(holder_name) holder_name,product_reference,max(product_name) product_name,status,in_crm,count(*)::int quantity FROM selected GROUP BY holder_id,routing_shop_id,product_reference,status,in_crm`,values)).rows.filter(row=>row.status==='DEFECTIVE').map(decorate):[];
  grouped.push(...stockInventory.filter(row=>row.stock_condition==='available'));
  const sales=(!requestedStatus||requestedStatus==='DEPLOYED')?await queryContractSales(c,{selection,params,start:period.start,end:asOfDate,allowUndated:allowUndatedSales}):[];
  grouped.push(...sales.map(decorate));
  const scoped=grouped.filter(row=>matchesGroup(row,params));
  const products=new Map(),custody=new Map(),stockCustody=new Map(),places=new Map(),regions=new Map(),regionProducts=new Map(),zones=new Map(),statuses=new Map();
  const totals={total:0,active:0,unconfirmed:0,defective:0,deployed:0,unmappedRegion:0,unmappedZone:0,conflicts:0};
  const labels={central:'Entrepôts',am:'Area managers',shop:'Boutiques',agent:'Agents',sav:'SAV',unknown:'Non classé'};
  const unassigned={quantity:0,instock:0,deployed:0,defective:0};
  for(const row of scoped){
    const n=row.quantity;totals.total+=n;increment(statuses,row.status,row.status,n);
    if(row.status==='DEPLOYED')totals.deployed+=n;
    if(row.status==='INSTOCK')totals.unconfirmed+=n;
    if(row.status==='DEFECTIVE')totals.defective+=n;
    if(ACTIVE.has(row.status))totals.active+=n;
    if(!row.region)totals.unmappedRegion+=n;if(!row.zone)totals.unmappedZone+=n;if(row.conflict)totals.conflicts+=n;
    const product=increment(products,row.productReference,row.product_name,n,{instock:0,deployed:0,defective:0});
    if(row.status==='INSTOCK')product.instock+=n;else if(row.status==='DEPLOYED')product.deployed+=n;else product.defective+=n;
    increment(custody,row.status==='DEPLOYED'?'client':row.holderKind,row.status==='DEPLOYED'?'Clients / déployés':labels[row.holderKind],n);
    if(row.status==='INSTOCK')increment(stockCustody,row.holderKind,labels[row.holderKind],n);
    increment(zones,row.holderKind==='central'?'__central__':row.zone,row.holderKind==='central'?'Entrepôts':row.zone||'Zone non renseignée',n);
    const regionKey=row.region||'__unknown__';
    const regionLabel=row.region||'Région non renseignée';
    const region=increment(regions,regionKey,regionLabel,n,{defective:0,instock:0,deployed:0});
    if(row.status==='DEFECTIVE')region.defective+=n;else if(row.status==='INSTOCK')region.instock+=n;else region.deployed+=n;
    const rpKey=JSON.stringify([regionKey,row.productReference]);
    if(!regionProducts.has(rpKey))regionProducts.set(rpKey,{key:regionKey,label:regionLabel,productReference:row.productReference,productName:row.product_name,quantity:0,instock:0,deployed:0,defective:0});
    const rp=regionProducts.get(rpKey);rp.quantity+=n;rp[row.status==='DEPLOYED'?'deployed':row.status==='INSTOCK'?'instock':'defective']+=n;
    let place=territoryPlace(row,level,byId);
    if(!place){unassigned.quantity+=n;unassigned[row.status==='DEPLOYED'?'deployed':row.status==='INSTOCK'?'instock':'defective']+=n;place={key:'__unknown__',label:'Sans rattachement'};}
    const id=JSON.stringify([place.key,row.productReference]);
    if(!places.has(id))places.set(id,{...place,productReference:row.productReference,productName:row.product_name,quantity:0,defective:0,instock:0,deployed:0});
    const p=places.get(id);p.quantity+=n;if(row.status==='DEFECTIVE')p.defective+=n;else if(row.status==='INSTOCK')p.instock+=n;else p.deployed+=n;
  }
  const assets={rows:[],hasMore:false,total:String(totals.total)};
  if(['assets','quality'].includes(view)&&scoped.length){
    const pairs=[...new Map(scoped.map(row=>[JSON.stringify([row.holderId,row.routing_shop_id]),[row.holderId,row.routing_shop_id]])).values()];
    const rows=(await c.query(`WITH ${contractSalesCTE()}, selected AS (${source}) SELECT * FROM selected WHERE EXISTS(SELECT 1 FROM unnest($${values.length+1}::text[],$${values.length+2}::text[]) permitted(holder_id,shop_id) WHERE selected.holder_id IS NOT DISTINCT FROM permitted.holder_id AND selected.routing_shop_id IS NOT DISTINCT FROM permitted.shop_id) ORDER BY serial_number LIMIT 51 OFFSET $${values.length+3}`,[...values,pairs.map(p=>p[0]),pairs.map(p=>p[1]),(page-1)*50])).rows;
    assets.hasMore=rows.length>50;
    assets.rows=rows.slice(0,50).map(decorate).map(row=>({serialNumber:row.serial_number,productReference:row.productReference,productName:row.product_name,crmStatus:row.status,crmFlag:row.crm_flag,holderId:row.holderId,holderName:row.holderName,holderKind:row.holderKind,holderCategory:row.status==='DEPLOYED'?'CLIENT':byId.has(row.holderId)?'AGENT':'UNKNOWN',sellerId:row.status==='DEPLOYED'?row.holderId:null,sellerName:row.status==='DEPLOYED'?row.holderName:null,ownerClientNumber:row.crm_owner_client_number,region:row.region,department:row.department,arrondissement:row.arrondissement,zone:row.zone,mappingMethod:row.method,mappingConflict:row.conflict,availability:row.status==='INSTOCK'?'available':'unavailable'}));
    if(assets.rows.length){
      const periods=(await c.query(`SELECT serial_number,start_at AS "startAt",CASE WHEN $2::boolean AND end_at >= (($3::date+1)::timestamp AT TIME ZONE 'Africa/Douala') THEN NULL ELSE end_at END AS "endAt",holder_name AS "holderName",asset_status AS "assetStatus" FROM bi_schema.fct_asset_holding_periods WHERE serial_number=ANY($1::text[]) AND (NOT $2::boolean OR start_at < (($3::date+1)::timestamp AT TIME ZONE 'Africa/Douala')) ORDER BY serial_number,period_no`,[assets.rows.map(row=>row.serialNumber),historical,asOfDate])).rows;
      for(const row of assets.rows){row.periods=periods.filter(p=>p.serial_number===row.serialNumber);row.historicalStatus=row.periods.at(-1)?.assetStatus??null;row.availabilityReason=row.status==='INSTOCK'?'En stock.':row.status==='DEPLOYED'?'Déployé / vendu.':'Défectueux.';}
    }
  }
  let performance=null;
  if(view==='performance'){
    const performanceDays=period.start?Math.round((Date.parse(asOfDate)-Date.parse(period.start))/86400000)+1:days;
    const eventStart=period.start||new Date(Date.parse(asOfDate)-(performanceDays-1)*86400000).toISOString().slice(0,10);
    const events=(period.start?sales:await queryContractSales(c,{selection,params,start:eventStart,end:asOfDate})).map(decorate).filter(row=>matchesGroup(row,params));
    const results=new Map();
    const get=row=>{const place=territoryPlace(row,'zone',byId)||{key:'__unknown__',label:'Zone non renseignée'};if(!results.has(place.key))results.set(place.key,{...place,active:0,defective:0,deployments:0});return results.get(place.key);};
    for(const row of scoped)if(row.in_crm&&(ACTIVE.has(row.status)||row.status==='DEFECTIVE')){const target=get(row);target.active+=row.quantity;if(row.status==='DEFECTIVE')target.defective+=row.quantity;}
    for(const row of events)get(row).deployments+=row.quantity;
    performance={days:performanceDays,rows:[...results.values()].sort((a,b)=>b.deployments-a.deployments),note:`Premiers contrats signés éligibles Upya sur ${performanceDays} jours jusqu’au ${asOfDate}, attribuées au vendeur. Chaque kit est compté une seule fois.`};
  }
  const optionValues=[];
  const options={products:(await c.query(`WITH ${contractSalesCTE()}, option_products AS (
    SELECT a.serial_number,a.product_reference,a.product_name FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} AND a.crm_status IN ('INSTOCK','DEFECTIVE')
    UNION ALL SELECT serial_number,product_reference,product_name FROM contract_sales)
    SELECT a.product_reference AS value,max(a.product_name) AS label FROM option_products a
    WHERE ${inclusionSQL(selection,optionValues)} AND a.product_reference IS NOT NULL GROUP BY 1 ORDER BY 2`,optionValues)).rows};
  const relevant=new Set(grouped.map(row=>row.holderId));
  for(const [name,field] of Object.entries({regions:'region',zones:'zone',departments:'department',arrondissements:'arrondissement'}))options[name]=[...new Set(grouped.map(row=>row[field]).filter(Boolean))].sort().map(value=>({value,label:value}));
  options.ams=agents.filter(a=>a.holderKind==='am').map(a=>({value:a.agent_number,label:a.agent_name}));options.shops=agents.filter(a=>a.holderKind==='shop'&&relevant.has(a.agent_number)).map(a=>({value:a.agent_number,label:a.agent_name}));
  const sourceDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(identity.loaded||identity.at);
  const includeActors=['commercial','teams','sales'].includes(view);
  const analysis=(params.get('section')!=='summary')&&(['overview','analytics','forecast','performance'].includes(view)||operational)?await queryAnalysis(c,{params,selection,asOfDate,view:operational||view==='performance'?'forecast':view,decorate,matchesGroup,includeActors,salesOnly:view==='overview'}):null;
  if(analysis&&view==='performance'){
    const reference=comparisonPeriod(analysis.window,params.get('comparison')||'previous',identity.today);
    const previousParams=new URLSearchParams(params);previousParams.set('startDate',reference.start);previousParams.set('granularity','month');
    const previous=await queryAnalysis(c,{params:previousParams,selection,asOfDate:reference.end,view:'forecast',decorate,matchesGroup,salesOnly:true});
    analysis.previous={window:previous.window,mode:reference.mode,rows:previous.rows.filter(r=>r.status==='DEPLOYED')};
  }
  if(analysis&&['commercial','teams','sales'].includes(view)){
    const shift=(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
    const previousParams=new URLSearchParams(params),end=shift(analysis.window.start,-1);
    previousParams.set('startDate',shift(end,1-analysis.window.days));previousParams.set('endDate',end);previousParams.set('granularity','month');
    const previous=await queryAnalysis(c,{params:previousParams,selection,asOfDate:end,view:'forecast',decorate,matchesGroup,salesOnly:true,includeActors});
    analysis.previous={window:previous.window,rows:previous.rows.filter(r=>r.status==='DEPLOYED')};
  }
  return {schemaVersion:1,source:'ukit',salesSource:'raw_upowa_schema.crm_contracts',salesWindow:{start:period.start,end:asOfDate,allowUndated:allowUndatedSales},queriedAt:identity.at,sourceLoadedAt:identity.loaded||identity.at,asOfDate,period,today:identity.today,cohort:'analysis',selection:{revision:selection.revision,rules:selection.rules.length},statuses:asRows(statuses),cohortCount:String(totals.total),historical,stale:sourceDate<asOfDate,scope:{label:'Équipements retenus · périmètre filtré',authorized:true},coverage:{status:'partial',note:historical?'Situation de fin de journée reconstituée uniquement pour les équipements ayant un historique connu. La sélection des équipements et les rattachements géographiques sont ceux du référentiel actuel.':'Stock disponible : références de kits complets INSTOCK, hors retours, réparations, reconditionnés et cas à contrôler. Ventes : premiers contrats signés éligibles Upya. La date de chargement indique la fraîcheur réelle des données.'},metrics:{total:metric(totals.total,'DEPLOYED, INSTOCK et DEFECTIVE.'),active:metric(totals.active,'Références de kits complets INSTOCK classées disponibles.'),instock:metric(totals.unconfirmed,'Références de kits complets INSTOCK disponibles, hors ventes antérieures.'),available:metric(totals.unconfirmed,'Références de kits complets INSTOCK classées disponibles.'),availabilityUnconfirmed:metric(0,''),defective:metric(totals.defective,period.start?'Premier défaut dans la période, statut DEFECTIVE en fin de période.':'État DEFECTIVE.'),deployed:metric(totals.deployed,period.start?'Premier contrat signé éligible dans la période, date signingDate.':'Premiers contrats signés éligibles à la date sélectionnée.'),sales:metric(period.start?totals.deployed:null,period.start?'Premiers contrats signés éligibles Upya sur la période.':'Sélectionner une période pour mesurer les ventes.')},products:asRows(products),custody:asRows(custody),stockCustody:asRows(stockCustody),territories:{level,rows:[...places.values()],unassigned},mapRegions:asRows(regions),mapRegionProducts:[...regionProducts.values()],mapZones:asRows(zones),performance,analysis,stockBreakdown,mapping:{rows:territories.length,unmappedRegion:String(totals.unmappedRegion),unmappedZone:String(totals.unmappedZone),conflicts:String(totals.conflicts)},assets,options};
}

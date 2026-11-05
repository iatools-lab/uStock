import { loadTerritories, mapAgents, locateAgent } from './territories.mjs';
import { inclusionSQL } from './analysis-selection.mjs';
import { eligibleSQL } from './status-scope.mjs';

export const GROUPS = {zone:'zone',region:'region',department:'department',arrondissement:'arrondissement',amId:'amId',shopId:'shopId',holderId:'holderId'};
const ACTIVE = new Set(['INSTOCK','DEFECTIVE']);
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
export async function queryStock(c,params,selection={rules:[],revision:0}){
  const page=Number(params.get('page')||1),days=Number(params.get('days')||90),role=params.get('role')||'dg',level=params.get('level')||'zone',view=params.get('view')||'overview';
  if(!Number.isSafeInteger(page)||page<1||page>100000||![30,60,90,180,365].includes(days)||!GROUPS[level]||!['dg','dc','supply','am','it'].includes(role))throw new Error('INVALID_REQUEST');
  for(const [,value] of params)if(value.length>200)throw new Error('INVALID_FILTER');
  const identity=(await c.query(`SELECT current_database() AS "name",now() AS "at",(now() AT TIME ZONE 'Africa/Douala')::date::text AS today,(SELECT max(_loaded_at) FROM bi_schema.dim_asset) AS loaded`)).rows[0];
  const period=selectedPeriod(params,identity.today),asOfDate=period.end,historical=asOfDate!==identity.today;
  const denied={schemaVersion:1,source:'ukit',queriedAt:identity.at,sourceLoadedAt:identity.loaded||identity.at,asOfDate,today:identity.today,scope:{label:'Affectation AM à compléter',authorized:false},coverage:{status:'partial',note:'Identité de l’utilisateur AM à fournir.'},metrics:Object.fromEntries(['active','available','availabilityUnconfirmed','defective','deployed','sales'].map(key=>[key,metric(null,'Périmètre AM non confirmé.')])),products:[],custody:[],assets:{rows:[],hasMore:false},options:{}};
  if(role==='am')return denied;
  const territories=await loadTerritories();
  // Les données CRM sont relues ; seules leurs correspondances géographiques inchangées sont mémorisées.
  const agents=mapAgents((await c.query(`SELECT agent_number,agent_name,role,is_active,team,entity_name,location_region,location_district,location_arrondissement,location_commune,location_village,location_zone FROM bi_schema.dim_agents`)).rows,territories);
  const daily=(await c.query(`SELECT DISTINCT ON(holder_id) holder_id,holder_name,holder_role FROM bi_schema.fct_asset_stock_daily WHERE holder_category='AGENT' AND holder_id IS NOT NULL ORDER BY holder_id,snapshot_date DESC`)).rows;
  const agentIndex=new Map(agents.map(agent=>[agent.agent_number,agent]));
  for(const row of daily){
    let agent=agentIndex.get(row.holder_id);
    if(!agent){agent={agent_number:row.holder_id,agent_name:row.holder_name,role:row.holder_role,...locateAgent({agent_name:row.holder_name,role:row.holder_role},territories)};agents.push(agent);agentIndex.set(agent.agent_number,agent);}
    else if(!agent.region||!agent.zone){const old=locateAgent({...agent,agent_name:row.holder_name,role:row.holder_role},territories);for(const field of ['region','department','arrondissement','zone'])if(!agent[field]&&old[field]){agent[field]=old[field];agent.method='daily_holder';}}
  }
  const byId=new Map(agents.map(a=>[a.agent_number,a]));
  const decorate=row=>{
    const agent=byId.get(row.holder_id);
    const route=byId.get(row.routing_shop_id);
    const useRoute=agent?.holderKind!=='central'&&route?.holderKind==='shop'&&(!agent?.zone||!route.zone||agent.zone===route.zone)&&(!agent?.region||!route.region||agent.region===route.region);
    return {...row,productReference:row.product_reference,holderId:row.holder_id,holderName:row.holder_name||agent?.agent_name,holderKind:agent?.holderKind||'unknown',region:agent?.region||(useRoute?route.region:null),department:agent?.department||(useRoute?route.department:null),arrondissement:agent?.arrondissement||(useRoute?route.arrondissement:null),zone:agent?.zone||(useRoute?route.zone:null),amId:agent?.amId||(useRoute?route.amId:null),shopId:row.status==='DEPLOYED'&&useRoute?route.agent_number:agent?.shopId||(useRoute?route.agent_number:null),method:useRoute&&!agent?.region?'distribution_shop':agent?.method,conflict:agent?.conflict};
  };
  const values=[asOfDate],conditions=['$1::date IS NOT NULL',eligibleSQL('a'),inclusionSQL(selection,values)];
  const status=historical?"CASE WHEN h.asset_status='IN_STOCK' THEN 'INSTOCK' ELSE h.asset_status END":'a.crm_status';
  if(historical)conditions.push(`${status} IN ('DEPLOYED','INSTOCK','DEFECTIVE')`);
  if(period.start){
    values.push(period.start);
    const start=`($${values.length}::date::timestamp AT TIME ZONE 'Africa/Douala')`;
    const end=`(($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')`;
    conditions.push(`(${status}='INSTOCK' OR (${status}='DEPLOYED' AND l.first_deployed_at>=${start} AND l.first_deployed_at<${end}) OR (${status}='DEFECTIVE' AND l.first_defective_at>=${start} AND l.first_defective_at<${end}))`);
  }
  for(const [key,column] of [['product','a.product_reference'],['status',status]])if(params.get(key)){if(params.get(key)==='__unknown__')conditions.push(`${column} IS NULL`);else{values.push(params.get(key));conditions.push(`${column}=$${values.length}`);}}
  if(params.get('search')){values.push('%'+params.get('search')+'%');conditions.push(`(a.serial_number ILIKE $${values.length} OR a.product_name ILIKE $${values.length} OR ${historical?'h.holder_name':'a.crm_holder_name'} ILIKE $${values.length})`);}
  const saleCutoff=period.start?`CASE WHEN life.first_deployed_at>=($${values.indexOf(period.start)+1}::date::timestamp AT TIME ZONE 'Africa/Douala') AND life.first_deployed_at<(($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') THEN life.first_deployed_at ELSE (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') END`:historical?`coalesce(sale.deployed_at,(($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala'))`:`CASE WHEN asset.crm_status='DEPLOYED' THEN coalesce(life.last_deployed_at,asset.deploy_date AT TIME ZONE 'Africa/Douala') ELSE (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') END`;
  const saleJoin=historical?`LEFT JOIN (SELECT serial_number,max(start_at) AS deployed_at FROM bi_schema.fct_asset_holding_periods WHERE asset_status='DEPLOYED' AND holder_category='CLIENT' AND start_at < (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') GROUP BY serial_number) sale USING(serial_number)`:'';
  const attributionJoins=`JOIN bi_schema.dim_asset asset USING(serial_number) LEFT JOIN bi_schema.fct_asset_lifecycle life USING(serial_number) ${saleJoin}`;
  const prior=`LEFT JOIN (SELECT DISTINCT ON(p.serial_number) p.serial_number,p.holder_id,p.holder_name FROM bi_schema.fct_asset_holding_periods p ${attributionJoins} WHERE p.holder_category='AGENT' AND p.holder_id IS NOT NULL AND p.start_at<=(${saleCutoff}) ORDER BY p.serial_number,p.start_at DESC,p.period_no DESC) prior ON prior.serial_number=a.serial_number`;
  const distribution=`LEFT JOIN (SELECT DISTINCT ON(p.serial_number) p.serial_number,p.holder_id FROM bi_schema.fct_asset_holding_periods p ${attributionJoins} WHERE p.holder_category='AGENT' AND p.holder_role='POINT RELAIS' AND p.start_at<=(${saleCutoff}) ORDER BY p.serial_number,p.start_at DESC,p.period_no DESC) distribution ON distribution.serial_number=a.serial_number`;
  const holder=historical?`CASE WHEN ${status}='DEPLOYED' THEN prior.holder_id WHEN h.holder_category='AGENT' THEN h.holder_id END`:`CASE WHEN a.crm_status='DEPLOYED' THEN coalesce(prior.holder_id,a.crm_holder_agent_number,CASE WHEN l.nb_deployments=1 THEN l.last_agent_before_first_deployment END) ELSE coalesce(a.crm_holder_agent_number,CASE WHEN l.current_holder_category='AGENT' AND replace(l.current_status,'IN_STOCK','INSTOCK')=a.crm_status THEN l.current_holder_id END) END`;
  const holderName=historical?`CASE WHEN ${status}='DEPLOYED' THEN prior.holder_name WHEN h.holder_category='AGENT' THEN h.holder_name END`:`CASE WHEN a.crm_status='DEPLOYED' THEN CASE WHEN prior.holder_id IS NOT NULL THEN prior.holder_name WHEN a.crm_holder_agent_number IS NULL AND l.nb_deployments=1 THEN l.last_agent_name_before_first_deployment END ELSE coalesce(a.crm_holder_name,l.current_holder_name) END`;
  const source=`SELECT a.serial_number,a.product_reference,a.product_name,a.crm_flag,a.crm_owner_client_number,a.in_crm,${status} status,${holder} holder_id,${holderName} holder_name,CASE WHEN prior.holder_id=(${holder}) THEN distribution.holder_id ELSE NULL END routing_shop_id FROM bi_schema.dim_asset a LEFT JOIN bi_schema.fct_asset_lifecycle l ON l.serial_number=a.serial_number ${prior} ${distribution} ${historical?`JOIN (SELECT DISTINCT ON (serial_number) serial_number,holder_id,holder_name,holder_category,asset_status FROM bi_schema.fct_asset_holding_periods WHERE start_at < (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') AND (end_at IS NULL OR end_at >= (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')) ORDER BY serial_number,start_at DESC,period_no DESC) h ON h.serial_number=a.serial_number`:''} WHERE ${conditions.join(' AND ')}`;

  const grouped=(await c.query(`WITH selected AS (${source}) SELECT holder_id,routing_shop_id,max(holder_name) holder_name,product_reference,max(product_name) product_name,status,in_crm,count(*)::int quantity FROM selected GROUP BY holder_id,routing_shop_id,product_reference,status,in_crm`,values)).rows.map(decorate);
  const scoped=grouped.filter(row=>matchesGroup(row,params));
  const products=new Map(),custody=new Map(),places=new Map(),regions=new Map(),statuses=new Map();
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
    const regionKey=row.region||'__unknown__';
    const regionLabel=row.region||'Région non renseignée';
    const region=increment(regions,regionKey,regionLabel,n,{defective:0,instock:0,deployed:0});
    if(row.status==='DEFECTIVE')region.defective+=n;else if(row.status==='INSTOCK')region.instock+=n;else region.deployed+=n;
    const place=territoryPlace(row,level,byId);
    if(!place){unassigned.quantity+=n;unassigned[row.status==='DEPLOYED'?'deployed':row.status==='INSTOCK'?'instock':'defective']+=n;continue;}
    const id=JSON.stringify([place.key,row.productReference]);
    if(!places.has(id))places.set(id,{...place,productReference:row.productReference,productName:row.product_name,quantity:0,defective:0,instock:0,deployed:0});
    const p=places.get(id);p.quantity+=n;if(row.status==='DEFECTIVE')p.defective+=n;else if(row.status==='INSTOCK')p.instock+=n;else p.deployed+=n;
  }
  const assets={rows:[],hasMore:false,total:String(totals.total)};
  if(['assets','quality'].includes(view)&&scoped.length){
    const pairs=[...new Map(scoped.map(row=>[JSON.stringify([row.holderId,row.routing_shop_id]),[row.holderId,row.routing_shop_id]])).values()];
    const rows=(await c.query(`WITH selected AS (${source}) SELECT * FROM selected WHERE EXISTS(SELECT 1 FROM unnest($${values.length+1}::text[],$${values.length+2}::text[]) permitted(holder_id,shop_id) WHERE selected.holder_id IS NOT DISTINCT FROM permitted.holder_id AND selected.routing_shop_id IS NOT DISTINCT FROM permitted.shop_id) ORDER BY serial_number LIMIT 51 OFFSET $${values.length+3}`,[...values,pairs.map(p=>p[0]),pairs.map(p=>p[1]),(page-1)*50])).rows;
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
    const events=(await c.query(`WITH selected AS (${source}),ordered AS (SELECT h.*,lag(h.holder_id) OVER(PARTITION BY h.serial_number ORDER BY h.period_no) previous_holder FROM bi_schema.fct_asset_holding_periods h JOIN selected s ON s.serial_number=h.serial_number) SELECT h.previous_holder holder_id,max(h.holder_name) holder_name,s.product_reference,max(s.product_name) product_name,s.status,count(*)::int quantity FROM ordered h JOIN selected s ON s.serial_number=h.serial_number WHERE h.start_event_type='DEPLOYED' AND h.holder_category='CLIENT' AND h.start_at >= (($1::date+1-$${values.length+1}::int)::timestamp AT TIME ZONE 'Africa/Douala') AND h.start_at < (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala') AND h.start_at<=now() ${period.start?"AND s.status='DEPLOYED' AND h.start_at=(SELECT min(first_sale.start_at) FROM bi_schema.fct_asset_holding_periods first_sale WHERE first_sale.serial_number=h.serial_number AND first_sale.asset_status='DEPLOYED' AND first_sale.holder_category='CLIENT')":''} GROUP BY h.previous_holder,s.product_reference,s.status`,[...values,performanceDays])).rows.map(row=>decorate({...row,holder_name:byId.get(row.holder_id)?.agent_name})).filter(row=>matchesGroup(row,params));
    const results=new Map();
    const get=row=>{const key=row[level]||'__unknown__';if(!results.has(key))results.set(key,{key,label:level==='holderId'?row.holderName||'Non renseigné':level==='amId'?byId.get(row.amId)?.agent_name||'Non renseigné':level==='shopId'?byId.get(row.shopId)?.agent_name||'Non renseigné':row[level]||'Non renseigné',active:0,defective:0,deployments:0});return results.get(key);};
    for(const row of scoped)if(row.in_crm&&ACTIVE.has(row.status)){const target=get(row);target.active+=row.quantity;if(row.status==='DEFECTIVE')target.defective+=row.quantity;}
    for(const row of events)get(row).deployments+=row.quantity;
    performance={days:performanceDays,rows:[...results.values()].sort((a,b)=>b.deployments-a.deployments),note:`Déploiements des équipements retenus sur ${performanceDays} jours jusqu’au ${asOfDate}, attribués au détenteur précédent. La géographie et la sélection sont celles du référentiel actuel.`};
  }
  const optionValues=[];
  const options={products:(await c.query(`SELECT a.product_reference AS value,max(a.product_name) AS label FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} AND ${inclusionSQL(selection,optionValues)} AND a.product_reference IS NOT NULL GROUP BY 1 ORDER BY 2`,optionValues)).rows};
  const relevant=new Set(grouped.map(row=>row.holderId));
  for(const [name,field] of Object.entries({regions:'region',zones:'zone',departments:'department',arrondissements:'arrondissement'}))options[name]=[...new Set(grouped.map(row=>row[field]).filter(Boolean))].sort().map(value=>({value,label:value}));
  options.ams=agents.filter(a=>a.holderKind==='am').map(a=>({value:a.agent_number,label:a.agent_name}));options.shops=agents.filter(a=>a.holderKind==='shop'&&relevant.has(a.agent_number)).map(a=>({value:a.agent_number,label:a.agent_name}));
  const sourceDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(identity.loaded||identity.at);
  return {schemaVersion:1,source:'ukit',queriedAt:identity.at,sourceLoadedAt:identity.loaded||identity.at,asOfDate,period,today:identity.today,cohort:'analysis',selection:{revision:selection.revision,rules:selection.rules.length},statuses:asRows(statuses),cohortCount:String(totals.total),historical,stale:sourceDate<asOfDate,scope:{label:'Équipements retenus · périmètre filtré',authorized:true},coverage:{status:'partial',note:historical?'Situation de fin de journée reconstituée uniquement pour les équipements ayant un historique connu. La sélection des équipements et les rattachements géographiques sont ceux du référentiel actuel.':'Dernier état CRM connu des équipements retenus, avec ou sans marqueur. La date de chargement indique la fraîcheur réelle des données.'},metrics:{total:metric(totals.total,'DEPLOYED, INSTOCK et DEFECTIVE.'),active:metric(totals.active,'INSTOCK + DEFECTIVE présents dans le CRM.'),instock:metric(totals.unconfirmed,'État INSTOCK.'),available:metric(totals.unconfirmed,'État INSTOCK.'),availabilityUnconfirmed:metric(0,''),defective:metric(totals.defective,period.start?'Premier défaut dans la période, statut DEFECTIVE en fin de période.':'État DEFECTIVE.'),deployed:metric(totals.deployed,period.start?'Première vente dans la période, statut DEPLOYED en fin de période.':'Équipements déployés à la date sélectionnée.'),sales:metric(null,'Définition des ventes à confirmer.')},products:asRows(products),custody:asRows(custody),territories:{level,rows:[...places.values()],unassigned},mapRegions:asRows(regions),performance,mapping:{rows:territories.length,unmappedRegion:String(totals.unmappedRegion),unmappedZone:String(totals.unmappedZone),conflicts:String(totals.conflicts)},assets,options};
}

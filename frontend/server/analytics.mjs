import { eligibleSQL } from './status-scope.mjs';
import { inclusionSQL } from './analysis-selection.mjs';
import { validatedFirstSaleSQL } from './sales-scope.mjs';

const day=86400000;
const dateMinus=(date,n)=>new Date(Date.parse(date)-n*day).toISOString().slice(0,10);
export function analysisWindow(params,end,view){
  const start=params.get('startDate')||(view==='forecast'?dateMinus(end,89):`${Number(end.slice(0,4))-1}-${end.slice(5,7)}-01`);
  const days=Math.round((Date.parse(end)-Date.parse(start))/day)+1;
  const requested=params.get('granularity')||'auto';
  if(!['auto','day','month'].includes(requested))throw new Error('INVALID_GRANULARITY');
  const granularity=requested==='auto'?(days<=62?'day':'month'):requested;
  if(granularity==='day'&&days>366)throw new Error('INVALID_DAILY_PERIOD');
  return {start,end,days,granularity};
}

export function buildAnalysis(rows,window){
  const months=[];
  const daily=window.granularity==='day';
  for(let d=new Date(daily?window.start:window.start.slice(0,7)+'-01');d.toISOString().slice(0,10)<=window.end;daily?d.setUTCDate(d.getUTCDate()+1):d.setUTCMonth(d.getUTCMonth()+1))months.push(d.toISOString().slice(0,daily?10:7));
  const buckets=new Map();
  const metrics=['quantity','ageUnder30','age30to59','age60to89','age90plus','ageUnknown'];
  for(const row of rows){const key=JSON.stringify([row.month,row.product,row.status,row.region,row.zone,row.amId,row.holderId]);if(!buckets.has(key))buckets.set(key,{...row,...Object.fromEntries(metrics.map(k=>[k,0]))});for(const metric of metrics)buckets.get(key)[metric]+=Number(row[metric]||0);}
  return {window,months,rows:[...buckets.values()]};
}

export async function queryAnalysis(c,{params,selection,asOfDate,view,decorate,matchesGroup,salesOnly=false,includeActors=false}){
  const window=analysisWindow(params,asOfDate,view);
  const step=window.granularity==='day'?'day':'month',format=step==='day'?'YYYY-MM-DD':'YYYY-MM';
  const values=[window.start,window.end];
  const where=[eligibleSQL('a'),inclusionSQL(selection,values)];
  if(params.get('product')){if(params.get('product')==='__unknown__')where.push('a.product_reference IS NULL');else{values.push(params.get('product'));where.push(`a.product_reference=$${values.length}`);}}
  if(params.get('search')){values.push('%'+params.get('search')+'%');where.push(`(a.serial_number ILIKE $${values.length} OR a.product_name ILIKE $${values.length} OR a.crm_holder_name ILIKE $${values.length})`);}
  const sql=`WITH eligible AS (
    SELECT a.serial_number,a.product_reference,a.product_name,a.crm_status FROM bi_schema.dim_asset a WHERE ${where.join(' AND ')}
  ), events AS (
    SELECT a.*,e.status,e.event_at FROM eligible a JOIN bi_schema.fct_asset_lifecycle l USING(serial_number)
    CROSS JOIN LATERAL (VALUES ('DEPLOYED',l.first_deployed_at),('DEFECTIVE',l.first_defective_at)) e(status,event_at)
    WHERE e.event_at>=($1::date::timestamp AT TIME ZONE 'Africa/Douala') AND e.event_at<(($2::date+1)::timestamp AT TIME ZONE 'Africa/Douala')
      AND (e.status<>'DEPLOYED' OR ${validatedFirstSaleSQL('a','l')})
  ), event_places AS (
    SELECT e.*,actor.holder_id,actor.holder_name,shop.holder_id AS routing_shop_id FROM events e
    LEFT JOIN LATERAL (SELECT h.holder_id,h.holder_name FROM bi_schema.fct_asset_holding_periods h
      WHERE h.serial_number=e.serial_number AND h.holder_category='AGENT' AND h.holder_id IS NOT NULL AND h.start_at<=e.event_at
      ORDER BY h.start_at DESC,h.period_no DESC LIMIT 1) actor ON true
    LEFT JOIN LATERAL (SELECT h.holder_id FROM bi_schema.fct_asset_holding_periods h
      WHERE h.serial_number=e.serial_number AND h.holder_category='AGENT' AND h.holder_role='POINT RELAIS' AND h.start_at<=e.event_at
      ORDER BY h.start_at DESC,h.period_no DESC LIMIT 1) shop ON true
  ), months AS (
    SELECT m,least((m+interval '1 ${step}') AT TIME ZONE 'Africa/Douala',($2::date+1)::timestamp AT TIME ZONE 'Africa/Douala') AS cutoff
    FROM generate_series(date_trunc('${step}',$1::date::timestamp),date_trunc('${step}',$2::date::timestamp),interval '1 ${step}') m
    ${salesOnly?'WHERE false':view==='forecast'?`WHERE m=date_trunc('${step}',$2::date::timestamp)`:''}
  ), snapshots AS (
    SELECT DISTINCT ON (m.m,a.serial_number) to_char(m.m,'${format}') AS month,a.*,h.asset_status,
      CASE WHEN h.holder_category='AGENT' THEN h.holder_id END AS holder_id,
      CASE WHEN h.holder_category='AGENT' THEN h.holder_name END AS holder_name,
      greatest(0,((m.cutoff AT TIME ZONE 'Africa/Douala')::date-1)-(h.start_at AT TIME ZONE 'Africa/Douala')::date) AS age_days
    FROM months m JOIN bi_schema.fct_asset_holding_periods h ON h.start_at<m.cutoff AND (h.end_at IS NULL OR h.end_at>=m.cutoff)
    JOIN eligible a ON a.serial_number=h.serial_number ORDER BY m.m,a.serial_number,h.start_at DESC,h.period_no DESC
  ), combined AS (
    SELECT to_char(event_at AT TIME ZONE 'Africa/Douala','${format}') AS month,product_reference,product_name,status,holder_id,holder_name,routing_shop_id,NULL::int AS age_days FROM event_places
    UNION ALL
    SELECT month,product_reference,product_name,'INSTOCK' AS status,holder_id,holder_name,NULL::text AS routing_shop_id,age_days FROM snapshots WHERE asset_status IN ('INSTOCK','IN_STOCK')
  ) SELECT month,product_reference,max(product_name) AS product_name,status,holder_id,max(holder_name) AS holder_name,routing_shop_id,count(*)::int AS quantity,
    count(*) FILTER(WHERE status='INSTOCK' AND age_days<30)::int AS "ageUnder30",
    count(*) FILTER(WHERE status='INSTOCK' AND age_days>=30 AND age_days<60)::int AS "age30to59",
    count(*) FILTER(WHERE status='INSTOCK' AND age_days>=60 AND age_days<90)::int AS "age60to89",
    count(*) FILTER(WHERE status='INSTOCK' AND age_days>=90)::int AS "age90plus",
    count(*) FILTER(WHERE status='INSTOCK' AND age_days IS NULL)::int AS "ageUnknown"
    FROM combined GROUP BY month,product_reference,status,holder_id,routing_shop_id`;
  const rows=(await c.query(sql,values)).rows.map(decorate).filter(row=>matchesGroup(row,params)).map(row=>({month:row.month,product:row.productReference||'__unknown__',productName:row.product_name||row.productReference||'Produit non renseigné',status:row.status,quantity:row.quantity,region:row.region||null,zone:row.zone||null,amId:row.amId||null,...(includeActors?{holderId:row.holder_id||null,holderName:row.holder_name||null}:{}),...Object.fromEntries(['ageUnder30','age30to59','age60to89','age90plus','ageUnknown'].map(k=>[k,Number(row[k]||0)]))}));
  return {...buildAnalysis(rows,window),filters:Object.fromEntries([...params].filter(([key])=>['product','region','zone','amId','shopId','holderId','status','search'].includes(key)))};
}

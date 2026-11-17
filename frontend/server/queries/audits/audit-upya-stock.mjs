import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { configuration } from '../../local-database.mjs';
import { contractSalesCTE } from '../contract-sales.mjs';
import { inclusionSQL } from '../selection-rules.mjs';

const input=process.argv[2];
if(!input)throw new Error('Indiquer le fichier texte du releve Upya.');
const content=readFileSync(input,'utf8');
const rows=[...content.matchAll(/^(.+?)\s+\(([^\r\n]*)\)\s*(\d+)\s+units in stock\s*$/gm)].map(m=>({name:m[1].trim(),role:m[2].trim(),quantity:Number(m[3])}));
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const key=(name,role)=>JSON.stringify([normalize(name),normalize(role)]);
const expected=new Map();
for(const row of rows){const id=key(row.name,row.role);if(!expected.has(id))expected.set(id,{...row,quantity:0,lines:0});const entry=expected.get(id);entry.quantity+=row.quantity;entry.lines++;}
const db=new DatabaseSync(fileURLToPath(new URL('../../analysis-selection.sqlite',import.meta.url)),{readOnly:true});
const selection={rules:db.prepare('SELECT kind,key,included FROM analysis_rule').all().map(r=>({...r,included:Boolean(r.included)}))};db.close();
const c=new pg.Client(configuration());
try{
 await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const values=[];const included=inclusionSQL(selection,values,'a');
 const sql=`WITH ${contractSalesCTE()}, kit_products AS (
 SELECT DISTINCT "productReference" AS product_reference FROM raw_upowa_schema.crm_products
 WHERE jsonb_typeof(NULLIF(boq,'')::jsonb)='array' AND jsonb_array_length(NULLIF(boq,'')::jsonb)>0
 ), candidates AS (
 SELECT r."serialNumber" AS serial_number,r."heldBy.agentNumber" AS holder_id,
 r."product.productReference" AS product_reference,r."product.name" AS product_name,r.flag,
 a.serial_number IS NOT NULL AS in_bi,
 a.crm_status IS NOT DISTINCT FROM r.status AS same_status,
 a.crm_flag IS NOT DISTINCT FROM r.flag AS same_flag,
 a.crm_holder_agent_number IS NOT DISTINCT FROM r."heldBy.agentNumber" AS same_holder,
 k.product_reference IS NOT NULL AS kit_reference,
 EXISTS(SELECT 1 FROM bi_schema.fct_asset_holding_periods h WHERE h.serial_number=r."serialNumber") AS history,
 COALESCE(${included},false) AS included,
 EXISTS(SELECT 1 FROM contract_first_sales s WHERE s.serial_number=r."serialNumber" AND (s.sold_at IS NULL OR s.sold_at<((now() AT TIME ZONE 'Africa/Douala')::date+1)::timestamp AT TIME ZONE 'Africa/Douala')) AS sold
 FROM raw_upowa_schema.crm_assets r
 LEFT JOIN bi_schema.dim_asset a ON a.serial_number=r."serialNumber"
 LEFT JOIN kit_products k ON k.product_reference=r."product.productReference"
 WHERE r.status='INSTOCK'
 ) SELECT holder_id,flag,kit_reference,history,included,sold,in_bi,same_status,same_flag,same_holder,count(*)::int AS quantity FROM candidates GROUP BY 1,2,3,4,5,6,7,8,9,10`;
 const counts=(await c.query(sql,values)).rows;
 const agents=(await c.query(`SELECT d.agent_number,d.agent_name,d.role,d.is_active,r.assets AS source_counter FROM bi_schema.dim_agents d LEFT JOIN raw_upowa_schema.crm_agents r ON r."agentNumber"=d.agent_number`)).rows;
 const byId=new Map(agents.map(a=>[a.agent_number,a]));
 const actual=new Map();
 for(const row of counts){const a=byId.get(row.holder_id),id=key(a?.agent_name||`ID:${row.holder_id}`,a?.role||'Sans role');if(!actual.has(id))actual.set(id,{name:a?.agent_name||row.holder_id,role:a?.role,ids:new Set(),total:0,kit:0,pav:0,retained:0});const e=actual.get(id);e.ids.add(row.holder_id);e.total+=row.quantity;if(row.kit_reference)e.kit+=row.quantity;if(row.flag==='PAV')e.pav+=row.quantity;if(row.flag==='PAV'&&row.history&&row.in_bi&&row.included&&!row.sold)e.retained+=row.quantity;}
 const comparisons=[...expected].map(([id,e])=>{
 let a=actual.get(id),method='name_role';
 if(!a&&e.role==='Warehouse'){const options=[...actual.values()].filter(a=>normalize(a.name)===normalize(e.name));if(options.length===1){a=options[0];method='unique_warehouse_name';}}
 const agentRows=a?[...a.ids].map(id=>byId.get(id)).filter(Boolean):agents.filter(a=>normalize(a.agent_name)===normalize(e.name)&&normalize(a.role)===normalize(e.role));
 const counter=agentRows.length&&agentRows.every(r=>/^\d+$/.test(r.source_counter||''))?agentRows.reduce((s,r)=>s+Number(r.source_counter),0):null;
 return {...e,ids:a?[...a.ids]:agentRows.map(r=>r.agent_number),method,raw:a?.total??null,counter,kit:a?.kit??null,pav:a?.pav??null,retained:a?.retained??null,delta:a?a.total-e.quantity:null};});
 const sum=(rs,fn=()=>true)=>rs.reduce((s,r)=>s+(fn(r)?r.quantity:0),0);
 const global={raw:sum(counts),pav:sum(counts,r=>r.flag==='PAV'),nullFlag:sum(counts,r=>r.flag===null),kitReferences:sum(counts,r=>r.kit_reference),noKitNomenclature:sum(counts,r=>!r.kit_reference),missingBi:sum(counts,r=>!r.in_bi),statusMismatch:sum(counts,r=>!r.same_status),flagMismatch:sum(counts,r=>!r.same_flag),holderMismatch:sum(counts,r=>!r.same_holder),pavNoHistory:sum(counts,r=>r.flag==='PAV'&&r.in_bi&&!r.history),pavExcluded:sum(counts,r=>r.flag==='PAV'&&r.in_bi&&r.history&&!r.included),pavSold:sum(counts,r=>r.flag==='PAV'&&r.in_bi&&r.history&&r.included&&r.sold),retained:sum(counts,r=>r.flag==='PAV'&&r.in_bi&&r.history&&r.included&&!r.sold)};
 console.log('summary',JSON.stringify({lines:rows.length,groups:expected.size,releveTotal:sum(rows),matched:comparisons.filter(r=>r.raw!==null).length,exact:comparisons.filter(r=>r.delta===0).length,matchedReleve:comparisons.filter(r=>r.raw!==null).reduce((s,r)=>s+r.quantity,0),matchedRaw:comparisons.reduce((s,r)=>s+(r.raw||0),0),global}));
 console.log('differences',JSON.stringify(comparisons.filter(r=>r.delta!==0)));
 console.log('largest_exact',JSON.stringify(comparisons.filter(r=>r.delta===0).sort((a,b)=>b.quantity-a.quantity).slice(0,10)));
 console.log('counter_summary',JSON.stringify({counterMatched:comparisons.filter(r=>r.counter!==null).length,counterExact:comparisons.filter(r=>r.counter===r.quantity).length,counterTotalMatched:comparisons.reduce((s,r)=>s+(r.counter||0),0),counterVsRaw:comparisons.filter(r=>r.counter!==null&&r.raw!==null&&r.counter!==r.raw).map(r=>({name:r.name,upya:r.quantity,counter:r.counter,raw:r.raw}))}));
 console.log('warehouses',JSON.stringify(comparisons.filter(r=>r.role==='Warehouse')));
 const matchedIds=new Set(comparisons.flatMap(r=>r.ids));
 console.log('absent_from_releve',JSON.stringify([...actual.values()].filter(a=>![...a.ids].some(id=>matchedIds.has(id))).map(a=>({...a,ids:[...a.ids]})).sort((a,b)=>b.total-a.total).slice(0,10)));
 console.log('releve_roles',JSON.stringify({warehouseUnits:sum(rows,r=>r.role==='Warehouse'),otherUnits:sum(rows,r=>r.role!=='Warehouse'),warehouseLines:rows.filter(r=>r.role==='Warehouse').length}));
 const flags=new Map(),roles=new Map();for(const r of counts){flags.set(r.flag,(flags.get(r.flag)||0)+r.quantity);const role=byId.get(r.holder_id)?.role||'Sans role';roles.set(role,(roles.get(role)||0)+r.quantity);}
 console.log('flags',JSON.stringify([...flags].sort((a,b)=>b[1]-a[1])));
 console.log('roles',JSON.stringify([...roles].sort((a,b)=>b[1]-a[1])));
 console.log('freshness',JSON.stringify((await c.query('SELECT now() AS queried_at,max(_loaded_at) AS bi_loaded_at FROM bi_schema.dim_asset')).rows));
 await c.query('COMMIT');
}finally{await c.end();}

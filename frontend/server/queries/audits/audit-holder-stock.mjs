import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { configuration } from '../../local-database.mjs';
import { contractSalesCTE } from '../contract-sales.mjs';
import { inclusionSQL } from '../selection-rules.mjs';

const expected = [
 ['FOUMBOT',166],['ATEBA Eveline',49],['Kenmogne',1],['MELONG',9],
 ['Hainwe',7],['BOHONO',7],['Fokouop',12],['ANABA Emmanuel',7],
 ['Mouliom',15],['Bertos',12],['LOMIE',1],['TSEING',1],['Mboua',81],
 ['Biwole',54],['Zili',6],['Batouri',9],['KAMDEM Francky',62],
 ['Kiadjeu',37],['Boumssi',1],['ABONG',11],['MANDJOU',23],['Djeugoue',7],['GAROUA-BOULAI',2],
];
const db = new DatabaseSync(fileURLToPath(new URL('../../analysis-selection.sqlite',import.meta.url)),{readOnly:true});
const selection={rules:db.prepare('SELECT kind,key,included FROM analysis_rule').all().map(r=>({...r,included:Boolean(r.included)}))};
db.close();
const c=new pg.Client(configuration());
try {
 await c.connect();
 await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 console.log('freshness',JSON.stringify((await c.query('SELECT now() AS queried_at,max(_loaded_at) AS bi_loaded_at FROM bi_schema.dim_asset')).rows));
 const agents=(await c.query('SELECT agent_number,agent_name,is_active,role FROM bi_schema.dim_agents')).rows;
 const ids=['670','123','133','678','968','956','971','966','973','972','178','192','241','355','945','965','1243','1245','834','1215','1198','944','1199'];
 console.log('agents',JSON.stringify(ids.map((id,i)=>({id,...expected[i]&&{upya:expected[i][1]},name:agents.find(a=>a.agent_number===id)?.agent_name}))));
 const values=[ids];
 const included=inclusionSQL(selection,values,'a');
 const sql=`WITH ${contractSalesCTE()}, candidates AS (
 SELECT r."serialNumber" AS serial_number,r."heldBy.agentNumber" AS holder_id,r.flag,
 r."product.productReference" AS product_reference,r."product.name" AS product_name,
 a.serial_number IS NOT NULL AS in_bi,
 EXISTS(SELECT 1 FROM bi_schema.fct_asset_holding_periods h WHERE h.serial_number=r."serialNumber") AS history,
 COALESCE(${included},false) AS included,
 EXISTS(SELECT 1 FROM contract_first_sales s WHERE s.serial_number=r."serialNumber" AND (s.sold_at IS NULL OR s.sold_at<((now() AT TIME ZONE 'Africa/Douala')::date+1)::timestamp AT TIME ZONE 'Africa/Douala')) AS sold
 FROM raw_upowa_schema.crm_assets r LEFT JOIN bi_schema.dim_asset a ON a.serial_number=r."serialNumber"
 WHERE r.status='INSTOCK' AND r."heldBy.agentNumber"=ANY($1::text[])
 ) SELECT holder_id,count(*) AS raw_instock,
 count(*) FILTER(WHERE flag='PAV') AS pav,
 count(*) FILTER(WHERE flag IS NULL) AS null_flag,
 count(*) FILTER(WHERE flag IS NOT NULL AND flag<>'PAV') AS other_flag,
 count(*) FILTER(WHERE flag='PAV' AND NOT in_bi) AS pav_missing_bi,
 count(*) FILTER(WHERE flag='PAV' AND in_bi AND NOT history) AS pav_no_history,
 count(*) FILTER(WHERE flag='PAV' AND in_bi AND history AND NOT included) AS pav_excluded,
 count(*) FILTER(WHERE flag='PAV' AND in_bi AND history AND included AND sold) AS pav_sold,
 count(*) FILTER(WHERE flag='PAV' AND in_bi AND history AND included AND NOT sold) AS dashboard
 FROM candidates GROUP BY holder_id`;
 console.log('counts',JSON.stringify((await c.query(sql,values)).rows));
 console.log('flag_details',JSON.stringify((await c.query(`SELECT r.flag,count(*) AS n FROM raw_upowa_schema.crm_assets r WHERE r.status='INSTOCK' AND r."heldBy.agentNumber"=ANY($1::text[]) GROUP BY 1 ORDER BY 2 DESC`,[ids])).rows));
 console.log('raw_bi',JSON.stringify((await c.query(`SELECT count(*) FILTER(WHERE a.serial_number IS NULL) missing_bi,count(*) FILTER(WHERE a.crm_status IS DISTINCT FROM r.status) status_mismatch,count(*) FILTER(WHERE a.crm_flag IS DISTINCT FROM r.flag) flag_mismatch,count(*) FILTER(WHERE a.crm_holder_agent_number IS DISTINCT FROM r."heldBy.agentNumber") holder_mismatch FROM raw_upowa_schema.crm_assets r LEFT JOIN bi_schema.dim_asset a ON a.serial_number=r."serialNumber" WHERE r.status='INSTOCK' AND r."heldBy.agentNumber"=ANY($1::text[])`,[ids])).rows));
 console.log('products',JSON.stringify((await c.query(`SELECT r."heldBy.agentNumber" AS holder,r."product.name" AS product,r.flag,count(*) AS n FROM raw_upowa_schema.crm_assets r WHERE r.status='INSTOCK' AND r."heldBy.agentNumber"=ANY($1::text[]) GROUP BY 1,2,3 ORDER BY 1,4 DESC`,[['670','678','1198','241']])).rows));
 console.log('selection',JSON.stringify({localRules:selection.rules.length,excludedProducts:selection.rules.filter(r=>r.kind==='product'&&!r.included).length}));
 console.log('catalogue',JSON.stringify((await c.query(`SELECT r."heldBy.agentNumber" AS holder,count(*) total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM raw_upowa_schema.crm_products p WHERE p."productReference"=r."product.productReference" AND jsonb_typeof(NULLIF(p.boq,'')::jsonb)='array' AND jsonb_array_length(NULLIF(p.boq,'')::jsonb)>0)) AS references_avec_nomenclature FROM raw_upowa_schema.crm_assets r WHERE r.status='INSTOCK' AND r."heldBy.agentNumber"=ANY($1::text[]) GROUP BY 1 ORDER BY 1`,[ids])).rows));
 await c.query('COMMIT');
}finally{await c.end();}

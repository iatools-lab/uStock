import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { eligibleSQL } from './status-scope.mjs';

export function openSelectionStore(filename = process.env.UKIT_SELECTION_FILE || fileURLToPath(new URL('./analysis-selection.sqlite', import.meta.url))) {
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS analysis_rule(kind TEXT NOT NULL CHECK(kind IN ('asset','product')), key TEXT NOT NULL, included INTEGER NOT NULL CHECK(included IN (0,1)), reason TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY(kind,key));
    CREATE TABLE IF NOT EXISTS analysis_revision(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL);
    INSERT OR IGNORE INTO analysis_revision VALUES(1,0);`);
  return {
    read(){return {revision:db.prepare('SELECT version FROM analysis_revision WHERE id=1').get().version,rules:db.prepare('SELECT kind,key,included,reason,updated_at AS updatedAt FROM analysis_rule ORDER BY updated_at DESC,kind,key').all().map(r=>({...r,included:Boolean(r.included)}))};},
    save({kind,keys,included,reason=''}){
      if(!['asset','product'].includes(kind)||!Array.isArray(keys)||keys.length<1||keys.length>5000||keys.some(key=>typeof key!=='string'||!key.trim()||key.length>200)||![true,false,null].includes(included)||typeof reason!=='string'||reason.length>500)throw new Error('INVALID_SELECTION');
      const unique=[...new Set(keys)],now=new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try{
        for(const key of unique){
          if(included===null)db.prepare('DELETE FROM analysis_rule WHERE kind=? AND key=?').run(kind,key);
          else db.prepare('INSERT INTO analysis_rule VALUES(?,?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET included=excluded.included,reason=excluded.reason,updated_at=excluded.updated_at').run(kind,key,included?1:0,reason,now);
        }
        db.exec('UPDATE analysis_revision SET version=version+1 WHERE id=1; COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return this.read();
    },
    close(){db.close();},
  };
}
export function inclusionSQL(selection,values,alias='a'){
  const arrays=[selection.rules.filter(r=>r.kind==='asset'&&r.included).map(r=>r.key),selection.rules.filter(r=>r.kind==='asset'&&!r.included).map(r=>r.key),selection.rules.filter(r=>r.kind==='product'&&!r.included).map(r=>r.key)];
  const slots=arrays.map(array=>{values.push(array);return `$${values.length}::text[]`;});
  return `(${alias}.serial_number=ANY(${slots[0]}) OR (NOT (${alias}.serial_number=ANY(${slots[1]})) AND NOT (coalesce(${alias}.product_reference,'')=ANY(${slots[2]}))))`;
}
export async function querySelection(c,params,selection){
  const page=Number(params.get('page')||1);
  if(!Number.isSafeInteger(page)||page<1||page>100000)throw new Error('INVALID_PAGE');
  const values=[],included=inclusionSQL(selection,values),where=[eligibleSQL('a')];
  for(const [key,column] of [['product','a.product_reference'],['status','a.crm_status'],['flag','a.crm_flag']]){
    const value=params.get(key);if(value){if(value.length>200)throw new Error('INVALID_FILTER');if(value==='__unknown__')where.push(`${column} IS NULL`);else{values.push(value);where.push(`${column}=$${values.length}`);}}
  }
  const term=params.get('search');if(term){if(term.length>200)throw new Error('INVALID_FILTER');values.push('%'+term+'%');where.push(`(a.serial_number ILIKE $${values.length} OR a.product_name ILIKE $${values.length} OR a.crm_holder_name ILIKE $${values.length})`);}
  const scope=params.get('scope')||'all';if(!['all','included','excluded'].includes(scope))throw new Error('INVALID_SCOPE');
  const globalValues=[];const globalPredicate=inclusionSQL(selection,globalValues);
  const counts=(await c.query(`SELECT count(*)::int total,count(*) FILTER(WHERE ${globalPredicate})::int included,count(*) FILTER(WHERE NOT ${globalPredicate})::int excluded FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')}`,globalValues)).rows[0];
  const scopeWhere=[...where,...(scope==='all'?[]:[scope==='included'?included:`NOT ${included}`])];
  const scoped=scopeWhere.length?' WHERE '+scopeWhere.join(' AND '):'';
  const total=(await c.query(`SELECT count(*)::int total,count(*) FILTER(WHERE ${included})::int retained FROM bi_schema.dim_asset a${scoped}`,values)).rows[0].total;
  const rows=(await c.query(`SELECT a.serial_number AS "serialNumber",a.product_reference AS "productReference",a.product_name AS "productName",a.crm_status AS "crmStatus",a.crm_flag AS "crmFlag",a.crm_holder_name AS "holderName",${included} AS included FROM bi_schema.dim_asset a${scoped} ORDER BY a.serial_number LIMIT 50 OFFSET $${values.length+1}`,[...values,(page-1)*50])).rows;
  const options=(await c.query(`SELECT product_reference AS value,max(product_name) AS label,count(*)::int quantity FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} AND product_reference IS NOT NULL GROUP BY 1 ORDER BY 2`)).rows;
  const statuses=(await c.query(`SELECT DISTINCT crm_status AS value FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} ORDER BY 1`)).rows;
  const flags=(await c.query(`SELECT DISTINCT crm_flag AS value FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} ORDER BY 1 NULLS LAST`)).rows;
  return {counts,rows,total,page,hasMore:page*50<total,options:{products:options,statuses,flags},selection};
}

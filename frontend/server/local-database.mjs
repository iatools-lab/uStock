import pg from 'pg';
import { queryStock, loadStockContext } from './stock-query.mjs';
import { openSelectionStore, querySelection } from './analysis-selection.mjs';
import { readFileSync, statSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { connection, parseConfig, settings } from '../../backend/scripts/bi/config.mjs';
import { createSnapshotCache, snapshotKey } from './snapshot-cache.mjs';
import { reportDatabaseFailure } from './database-diagnostics.mjs';
import { analysisCohortCTE } from './analysis-cohort.mjs';
import { querySalesExport } from './sales-export.mjs';
import { createReadQueryCache } from './read-query-cache.mjs';

export function configuration(overrides={}) {
  let existing = {}, local = {};
  // Les accès distants restent côté serveur ; TARGET_DB_* concerne seulement l'import local.
  try { existing = parseConfig(readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8')); } catch(error) { if(error.code!=='ENOENT')throw error; }
  try { local = parseEnv(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')); } catch {}
  const e = { ...existing, ...local, ...process.env, ...overrides };
  const url = e.UKIT_DATABASE_URL || e.SOURCE_DATABASE_URL;
  if(url){
    let parsed;try{parsed=new URL(url);}catch{throw new Error('URL PostgreSQL distante invalide');}
    if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('URL PostgreSQL distante invalide');
    Object.assign(e,{SOURCE_DB_HOST:parsed.hostname,SOURCE_DB_PORT:parsed.port||'5432',SOURCE_DB_DATABASE:decodeURIComponent(parsed.pathname.slice(1)),SOURCE_DB_USER:decodeURIComponent(parsed.username),SOURCE_DB_PASSWORD:decodeURIComponent(parsed.password),SOURCE_DB_SSLMODE:parsed.searchParams.get('sslmode')||e.SOURCE_DB_SSLMODE||'require'});
  }
  return {...connection(e,'source'),max:4,keepAlive:true,application_name:'ukit-dashboard',options:'-c default_transaction_read_only=on -c statement_timeout=30000 -c jit=off'};
}
export function createLocalDatabase({selectionStore}={}) {
  const selection=selectionStore||openSelectionStore();
  const pool = new pg.Pool(configuration()); pool.on('error',error=>reportDatabaseFailure('pool',error));
  pool.on('connect',client=>client.on('error',()=>{}));
  const ttl=Number(settings().UKIT_CACHE_TTL_SECONDS??60);
  if(!Number.isFinite(ttl)||ttl<0||ttl>3600)throw new Error('INVALID_CACHE_TTL');
  const cache=createSnapshotCache({ttl:ttl*1000});
  // Le referentiel ne contient pas de selection utilisateur ; il reste en memoire.
  const contexts=createSnapshotCache({ttl:Math.min(ttl,60)*1000,maxEntries:4,clone:false});
  const queries=createReadQueryCache({ttl:Math.min(ttl,60)*1000,maxEntries:100,maxBytes:32*1024*1024});
  let context;
  const contextProvider=(c,date,identity)=>contexts.get(JSON.stringify([context,date,identity.loaded]),()=>loadStockContext(c,date));
  async function snapshot(params) {
    params=new URLSearchParams(params);
    // Ces ecrans utilisent exactement les memes agregats, sans courbes temporelles.
    if(params.get('view')==='map'||(params.get('view')==='overview'&&params.get('section')==='summary')){
      params.set('view','stock');params.delete('section');
    }
    const rules=selection.read();
    const file=statSync(new URL('./Agents_Terrain_Uniformises.xlsx',import.meta.url));
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const reference=`${file.mtimeMs}:${file.size}`,current=JSON.stringify([rules.revision,reference,date]);
    if(context!==current){cache.clear();contexts.clear();queries.clear();context=current;}
    const key=snapshotKey(params,{revision:rules.revision,reference,date});
    return cache.get(key,()=>readSnapshot(new URLSearchParams(params),rules));
  }
  async function readSnapshot(params,rules) {
    const c=await pool.connect();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const data=await queryStock(queries.reader(c,context),params,rules,{contextProvider});
      await c.query('COMMIT');
      return data;
    } catch(error) { await c.query('ROLLBACK').catch(()=>{}); throw error; }
    finally { c.release(); }
  }
  async function administration(params){
    const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await querySelection(c,params,selection.read());await c.query('COMMIT');return data;}catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }
  async function saveSelection(body){
    if(!body||!['asset','product'].includes(body.kind)||!Array.isArray(body.keys)||body.keys.length<1||body.keys.length>5000||body.keys.some(key=>typeof key!=='string'||!key.trim()||key.length>200)||![true,false,null].includes(body.included)||typeof(body.reason??'')!=='string'||(body.reason?.length||0)>500)throw new Error('INVALID_SELECTION');
    if(body.included!==null){const column=body.kind==='asset'?'selection_key':"coalesce(nullif(product_reference,''),'__unknown__')";const result=await pool.query(`WITH ${analysisCohortCTE()} SELECT count(DISTINCT ${column})::int n FROM analysis_entities WHERE ${column}=ANY($1::text[])`,[[...new Set(body.keys)]]);if(result.rows[0].n!==new Set(body.keys).size)throw new Error('INVALID_UNKNOWN_EQUIPMENT');}
    const result=selection.save(body);cache.clear();queries.clear();return result;
  }
  async function exportSales(params){
    const rules=selection.read();
    if(params.has('revision')&&Number(params.get('revision'))!==rules.revision)throw new Error('EXPORT_STALE_SELECTION');
    const c=await pool.connect();try{
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const data=params.get('exportDetails')==='true'?(params.get('adminExport')==='true'?await querySelection(c,params,rules):await queryStock(c,params,rules,{contextProvider})):await querySalesExport(c,params,rules);
      if(data.total>1048575)throw new Error('EXPORT_TOO_LARGE');
      if(params.has('expectedCount')&&(!Number.isSafeInteger(Number(params.get('expectedCount')))||Number(params.get('expectedCount'))<0))throw new Error('INVALID_COUNT');
      if(selection.read().revision!==rules.revision||(params.has('expectedCount')&&Number(params.get('expectedCount'))!==data.total))throw new Error('EXPORT_STALE_SELECTION');
      await c.query('COMMIT');return data;
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
  }
  let closing;
  return {snapshot,administration,saveSelection,exportSales,health:async()=>{await pool.query('SELECT 1');},close:()=>closing||= (async()=>{cache.clear();contexts.clear();queries.clear();await pool.end();selection.close();})()};
}
export function registerDatabaseRoutes(server,database){
    server.middlewares.use('/api/sales-export',async(req,res)=>{
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.method!=='GET'){res.statusCode=405;res.end('{"error":"Méthode non autorisée."}');return;}
      try{res.end(JSON.stringify(await database.exportSales(new URL(req.url,'http://localhost').searchParams)));}
      catch(error){res.statusCode=error.message==='EXPORT_STALE_SELECTION'?409:error.message==='EXPORT_TOO_LARGE'?422:error.message.startsWith('INVALID_')?400:503;if(res.statusCode===503)reportDatabaseFailure('sales_export',error);res.end(JSON.stringify({error:res.statusCode===409?'La sélection ou les ventes ont changé. Actualisez les indicateurs puis relancez le téléchargement.':res.statusCode===422?'Cette sélection dépasse la capacité d’une feuille Excel. Choisissez une période plus courte.':res.statusCode===400?'Période ou filtre invalide.':'Téléchargement indisponible. Réessayez.'}));}
    });
    server.middlewares.use('/api/analysis-selection',async(req,res)=>{
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      try{
        if(req.method==='GET'){res.end(JSON.stringify(await database.administration(new URL(req.url,'http://localhost').searchParams)));return;}
        if(req.method!=='POST'){res.statusCode=405;res.end('{"error":"Méthode non autorisée"}');return;}
        const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host){res.statusCode=403;res.end('{"error":"Origine non autorisée"}');return;}
        if(!req.headers['content-type']?.includes('application/json'))throw new Error('INVALID_CONTENT_TYPE');
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw new Error('INVALID_SIZE');}
        let body;try{body=JSON.parse(raw);}catch{throw new Error('INVALID_BODY');}
        res.end(JSON.stringify(await database.saveSelection(body)));
      }catch(error){res.statusCode=error.message.startsWith('INVALID_')?400:503;res.end(JSON.stringify({error:res.statusCode===400?'Sélection ou filtre invalide.':'Enregistrement ou lecture indisponible.'}));}
    });
    server.middlewares.use('/api/local-stock',async(req,res)=>{
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.method!=='GET'){res.statusCode=405;res.end('{"error":"Méthode non autorisée"}');return;}
      try{res.end(JSON.stringify(await database.snapshot(new URL(req.url,'http://localhost').searchParams)));}
      catch(error){res.statusCode=error.message.startsWith('INVALID_')?400:503;const failure=res.statusCode===503?reportDatabaseFailure('snapshot',error):null;res.end(JSON.stringify({error:res.statusCode===400?'Filtre ou page invalide.':'Connexion à PostgreSQL distant indisponible.',...(failure?{code:failure.code}:{})}));}
    });
}
export function localDatabasePlugin(){
  let database;
  function configure(server){database||=createLocalDatabase();registerDatabaseRoutes(server,database);server.httpServer?.once('close',()=>database.close());}
  return {name:'ukit-local-database',configureServer:configure,configurePreviewServer:configure,closeBundle:()=>database?.close()};
}

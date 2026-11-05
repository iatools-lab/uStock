import pg from 'pg';
import { queryStock } from './stock-query.mjs';
import { openSelectionStore, querySelection } from './analysis-selection.mjs';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { connection, parseConfig } from '../../backend/scripts/bi/config.mjs';

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
  return {...connection(e,'source'),max:4,keepAlive:true,application_name:'ukit-dashboard',options:'-c default_transaction_read_only=on -c statement_timeout=30000'};
}
export function createLocalDatabase({selectionStore}={}) {
  const selection=selectionStore||openSelectionStore();
  const pool = new pg.Pool(configuration()); pool.on('error',()=>{});
  pool.on('connect',client=>client.on('error',()=>{}));
  async function snapshot(params) {
    const c=await pool.connect();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const data=await queryStock(c,params,selection.read());
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
    if(body.included!==null){const column=body.kind==='asset'?'serial_number':'product_reference';const result=await pool.query(`SELECT count(DISTINCT ${column})::int n FROM bi_schema.dim_asset WHERE ${column}=ANY($1::text[])`,[[...new Set(body.keys)]]);if(result.rows[0].n!==new Set(body.keys).size)throw new Error('INVALID_UNKNOWN_EQUIPMENT');}
    return selection.save(body);
  }
  let closing;
  return {snapshot,administration,saveSelection,close:()=>closing||= (async()=>{await pool.end();if(!selectionStore)selection.close();})()};
}
export function localDatabasePlugin(){
  let database;
  function configure(server){
    database||=createLocalDatabase();
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
      catch(error){res.statusCode=error.message.startsWith('INVALID_')?400:503;res.end(JSON.stringify({error:res.statusCode===400?'Filtre ou page invalide.':'Connexion à PostgreSQL distant indisponible.'}));}
    });
    server.httpServer?.once('close',()=>database.close());
  }
  return {name:'ukit-local-database',configureServer:configure,configurePreviewServer:configure,closeBundle:()=>database?.close()};
}

import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

export function parseConfig(text) {
  const standard=parseEnv(text);
  // Compatibilité avec le fichier initial « server: ... » ; séparation au premier deux-points.
  for(const line of text.split(/\r?\n/)) {
    const match=line.match(/^\s*(server|database|port|user|password)\s*:\s*(.*)$/);
    if(match && standard[match[1]]===undefined) standard[match[1]]=match[2].trim();
  }
  return standard;
}
export function settings(overrides={}) {
  const file=fileURLToPath(new URL('../../.env',import.meta.url));
  let local={};try{local=parseConfig(readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return {...local,...process.env,...overrides};
}
export function connection(env,side) {
  if(side==='target' && (env.TARGET_DATABASE_URL || env.DATABASE_URL)) {
    let url;try{url=new URL(env.TARGET_DATABASE_URL || env.DATABASE_URL);}catch{throw new Error('URL PostgreSQL de destination invalide');}
    if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('URL PostgreSQL de destination invalide');
    return connection({...env,TARGET_DATABASE_URL:'',DATABASE_URL:'',
      TARGET_DB_HOST:url.hostname,TARGET_DB_PORT:url.port||'5432',
      TARGET_DB_DATABASE:decodeURIComponent(url.pathname.slice(1)),TARGET_DB_USER:decodeURIComponent(url.username),
      TARGET_DB_PASSWORD:decodeURIComponent(url.password),
      TARGET_DB_SSLMODE:url.searchParams.get('sslmode')||env.TARGET_DB_SSLMODE||'disable'},side);
  }
  const prefix=side==='source'?'SOURCE_DB_':'TARGET_DB_';
  const legacy=side==='source'?{HOST:'server',PORT:'port',DATABASE:'database',USER:'user',PASSWORD:'password'}:{};
  const get=key=>env[prefix+key]??env[legacy[key]];
  for(const key of ['HOST','DATABASE','USER','PASSWORD']) if(!get(key)) throw new Error(prefix+key+' manquant');
  const port=Number(get('PORT')||5432);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error(prefix+'PORT invalide');
  const sslmode=env[prefix+'SSLMODE']||(side==='source'?'require':'disable');
  if(!['disable','require','verify-full'].includes(sslmode)) throw new Error(prefix+'SSLMODE invalide');
  return {host:get('HOST'),port,database:get('DATABASE'),user:get('USER'),password:get('PASSWORD'),
    connectionTimeoutMillis:10000,application_name:'ukit-bi-'+side,
    ssl: sslmode==='disable' ? false : {rejectUnauthorized:sslmode==='verify-full',...(env[prefix+'SSL_CA_FILE']?{ca:readFileSync(env[prefix+'SSL_CA_FILE'],'utf8')}:{})},
    ...(side==='source'?{options:'-c default_transaction_read_only=on -c statement_timeout=120000'}:{})};
}
export function assertSeparate(source,target) {
  // Interdit la destination UPYA même à travers un alias réseau.
  if(source.database.toLowerCase()===target.database.toLowerCase()) throw new Error('La destination doit être une base distincte de la source UPYA.');
}
export const TABLES=[
  {name:'dim_asset',keys:['serial_number']},
  {name:'dim_agents',keys:['agent_number']},
  {name:'fct_asset_holding_periods',keys:['serial_number','period_no']},
  {name:'fct_asset_lifecycle',keys:['serial_number']},
  {name:'fct_asset_stock_daily',keys:['snapshot_date','holder_category','holder_id','asset_status']},
];
export function rowKey(row,keys) {
  if(keys.some(k=>row[k]===undefined))throw new Error('Colonne de clé absente');
  return JSON.stringify(keys.map(k=>row[k]??null));
}
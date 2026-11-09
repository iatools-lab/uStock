import pg from 'pg';
import { access } from 'node:fs/promises';
import { configuration } from './local-database.mjs';
import { databaseFailure } from './database-diagnostics.mjs';
let client;
try{
  const config=configuration();
  console.log('Configuration PostgreSQL chargée ; test de connexion en lecture seule.');
  client=new pg.Client(config);client.on('error',()=>{});await client.connect();
  const result=await client.query(`SELECT current_database() AS database,current_setting('transaction_read_only') AS readonly`);
  console.log(JSON.stringify(result.rows[0]));
  for(const table of ['dim_asset','dim_agents','fct_asset_holding_periods','fct_asset_lifecycle','fct_asset_stock_daily'])await client.query(`SELECT 1 FROM bi_schema.${table} LIMIT 1`);
  await access(new URL('./Agents_Terrain_Uniformises.xlsx',import.meta.url));
  console.log('Connexion, droits de lecture BI et présence du référentiel : OK.');
}catch(error){console.error(JSON.stringify(databaseFailure(error)));process.exitCode=1;}
finally{await client?.end().catch(()=>{});}

import assert from 'node:assert/strict';
import pg from 'pg';
import { run } from './import.mjs';
// Serveur temporaire réservé aux tests, jamais les bases du .env.
const port = Number(process.env.BI_TEST_PORT);
if (!port)
  throw new Error(
    'BI_TEST_PORT requis : instance PostgreSQL temporaire uniquement',
  );
const common = {
  host: '127.0.0.1',
  port,
  user: 'postgres',
  password: 'test',
  ssl: false,
};
const admin = new pg.Client({ ...common, database: 'postgres' });
await admin.connect();
const sourceDb = 'ukit_bi_test_source_' + Date.now(),
  targetDb = 'ukit_bi_test_target_' + Date.now();
for (const db of [sourceDb, targetDb])
  await admin.query('CREATE DATABASE ' + db);
const source = new pg.Client({ ...common, database: sourceDb }),
  target = new pg.Client({ ...common, database: targetDb });
await source.connect();
await target.connect();
Object.assign(process.env, {
  SOURCE_DB_HOST: '127.0.0.1',
  SOURCE_DB_PORT: String(port),
  SOURCE_DB_DATABASE: sourceDb,
  SOURCE_DB_USER: 'postgres',
  SOURCE_DB_PASSWORD: 'test',
  SOURCE_DB_SSLMODE: 'disable',
  TARGET_DATABASE_URL:
    'postgresql://postgres:test@127.0.0.1:' +
    port +
    '/' +
    targetDb +
    '?sslmode=disable',
});
try {
  await source.query(`
 CREATE SCHEMA bi_schema;
 CREATE TABLE bi_schema.dim_asset AS SELECT 'K1'::text serial_number,true in_crm,'P1'::text product_reference,'Produit'::text product_name,'INSTOCK'::text crm_status,NULL::text crm_flag,'A1'::text crm_holder_agent_number,now() _loaded_at;
 INSERT INTO bi_schema.dim_asset SELECT 'K2',true,'P1','Produit','DEFECTIVE',NULL,'A1',now();
 INSERT INTO bi_schema.dim_asset SELECT 'K3',false,NULL,NULL,NULL,NULL,NULL,now();
 CREATE TABLE bi_schema.dim_agents AS SELECT 'A1'::text agent_number,'POINT RELAIS'::text role,'Centre'::text location_region,'Source non validée'::text location_zone,NULL::text location_district,now() _loaded_at;
 CREATE TABLE bi_schema.fct_asset_lifecycle AS SELECT 'K1'::text serial_number,'IN_STOCK'::text current_status,'A2'::text current_holder_id,now() _loaded_at;
 CREATE TABLE bi_schema.fct_asset_holding_periods AS SELECT 'K1'::text serial_number,1::bigint period_no,now() _loaded_at;
 CREATE TABLE bi_schema.fct_asset_stock_daily AS SELECT current_date snapshot_date,'AGENT'::text holder_category,'A1'::text holder_id,'BA'::text holder_role,'IN_STOCK'::text asset_status,1::bigint nb_kits,now()::timestamp data_as_of,now() _loaded_at;
 ALTER TABLE bi_schema.fct_asset_holding_periods ADD COLUMN holder_category text,ADD COLUMN holder_id text,ADD COLUMN holder_role text,ADD COLUMN asset_status text,ADD COLUMN start_at timestamptz,ADD COLUMN end_at timestamptz,ADD COLUMN is_current boolean,ADD COLUMN duration_days numeric;
 ALTER TABLE bi_schema.fct_asset_lifecycle ADD COLUMN first_instock_at timestamptz,ADD COLUMN first_deployed_at timestamptz,ADD COLUMN last_deployed_at timestamptz,ADD COLUMN nb_deployments integer,ADD COLUMN nb_returns integer,ADD COLUMN last_returned_at timestamptz,ADD COLUMN current_since timestamptz;
 `);
  await source.query("INSERT INTO bi_schema.fct_asset_lifecycle(serial_number,current_status,current_holder_id,_loaded_at) VALUES('K3','IN_STOCK','A1',now())");
  await run('sync');
  let rows = (
    await target.query(
      'SELECT * FROM ukit_mart.asset_current ORDER BY serial_number',
    )
  ).rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].holder_mismatch, true);
  assert.equal(rows[0].holder_kind,'shop');
  const mapping=(await target.query("SELECT r,ukit_ref.kind_from_role(r) AS kind FROM unnest(ARRAY['AREA MANAGER','POINT RELAIS','BA+','BA','MBA','FACO','Administrator',' autre ']) r")).rows;
  assert.deepEqual(mapping.map(r=>r.kind),['am','shop','agent','agent','agent','agent','central','unknown']);
  const daily=(await target.query("SELECT holder_kind,stock_state FROM ukit_mart.stock_daily_classified")).rows[0];
  assert.deepEqual(daily,{holder_kind:'agent',stock_state:'in_stock'});

  assert.equal(rows[0].region, null);
  assert.equal(rows[0].source_region, 'Centre');
  assert.equal(rows[0].availability, 'unconfirmed');
  assert.equal(rows[1].lifecycle_present, false);
  assert.equal(
    (
      await target.query(
        'SELECT sum(equipment_count)::int n FROM ukit_mart.stock_summary',
      )
    ).rows[0].n,
    2,
  );
  await target.query(
    "INSERT INTO ukit_ref.product VALUES('P1','Produit','Famille','kit','approved',now()); INSERT INTO ukit_ref.holder(holder_id,holder_kind,region,validated_at) VALUES('A1','shop','Centre',now())",
  );
  await run('sync');
  rows = (
    await target.query(
      "SELECT * FROM ukit_mart.asset_current WHERE serial_number='K1'",
    )
  ).rows;
  assert.equal(rows[0].availability, 'available');
  assert.equal(rows[0].region, 'Centre');
  assert.equal(
    (await target.query("SELECT to_regclass('ukit_etl.bi_record') AS name"))
      .rows[0].name,
    null,
  );
  assert.equal(
    (await target.query('SELECT count(*)::int n FROM ukit_mart.holding_period'))
      .rows[0].n,
    1,
  );
  const previous = rows[0].run_id;
  await source.query('UPDATE bi_schema.fct_asset_stock_daily SET nb_kits=-1');
  await assert.rejects(() => run('sync'), /Réconciliation/);
  assert.equal(
    (
      await target.query(
        "SELECT run_id FROM ukit_mart.asset_current WHERE serial_number='K1'",
      )
    ).rows[0].run_id,
    previous,
  );
  assert.equal(
    (
      await target.query(
        'SELECT status FROM ukit_etl.import_run ORDER BY id DESC LIMIT 1',
      )
    ).rows[0].status,
    'failed',
  );
  await import('reflect-metadata');
  const { DashboardService } = await import('../../dist/dashboard.service.js');
  process.env.SOURCE_DB_HOST = 'source-inaccessible.invalid';
  const api = new DashboardService();
  try {
    const data = await api.overview({});
    assert.equal(data.source, 'postgres_local');
    assert.equal(data.data.stock, '2');
    assert.equal(data.data.field_available, '1');
    assert.equal(
      (await api.stock({ groupBy: 'family' })).data[0].quantity,
      '2',
    );
    await assert.rejects(() => api.stock({ groupBy: 'invalid; DROP TABLE x' }));
  } finally {
    await api.onModuleDestroy();
  }
  console.log('API locale validée avec source distante inaccessible.');
  console.log(
    'Intégration validée : import, jointures, totaux, référentiels, réimport et rollback.',
  );
} finally {
  await Promise.all([source.end(), target.end()]);
  for (const db of [sourceDb, targetDb])
    await admin.query('DROP DATABASE ' + db);
  await admin.end();
}
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import {
  settings,
  connection,
  assertSeparate,
  TABLES,
  rowKey,
} from './config.mjs';
const columns = {
  dim_asset: [
    'serial_number',
    'in_crm',
    'product_reference',
    'product_name',
    'crm_status',
    'crm_flag',
    'crm_holder_agent_number',
    '_loaded_at',
  ],
  dim_agents: [
    'agent_number',
    'role',
    'location_region',
    'location_zone',
    'location_district',
    '_loaded_at',
  ],
  fct_asset_holding_periods: [
    'serial_number',
    'period_no',
    'holder_category',
    'holder_id',
    'holder_role',
    'asset_status',
    'start_at',
    'end_at',
    'is_current',
    'duration_days',
    '_loaded_at',
  ],
  fct_asset_lifecycle: [
    'serial_number',
    'first_instock_at',
    'first_deployed_at',
    'last_deployed_at',
    'nb_deployments',
    'nb_returns',
    'last_returned_at',
    'current_status',
    'current_holder_id',
    'current_since',
    '_loaded_at',
  ],
  fct_asset_stock_daily: [
    'snapshot_date',
    'holder_category',
    'holder_id',
    'holder_role',
    'asset_status',
    'nb_kits',
    'data_as_of',
    '_loaded_at',
  ],
};
const sql = (name) => readFile(new URL(name, import.meta.url), 'utf8');
export async function run(mode = 'check') {
  if (!['check', 'migrate', 'sync'].includes(mode))
    throw new Error('Mode attendu : check, migrate ou sync');
  const env = settings(),
    sourceConfig = connection(env, 'source'),
    targetConfig = connection(env, 'target');
  assertSeparate(sourceConfig, targetConfig);
  const source = new pg.Client({
      ...sourceConfig,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }),
    target = new pg.Client(targetConfig);
  let disconnected;
  source.on('error', (e) => {
    disconnected = e;
  });
  target.on('error', (e) => {
    disconnected = e;
  });
  let runId,
    locked = false,
    sourceConnected = false,
    targetConnected = false;
  try {
    await source.connect();
    sourceConnected = true;
    await target.connect();
    targetConnected = true;
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const schemas = await source.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='bi_schema'",
    );
    for (const t of TABLES)
      for (const key of columns[t.name]) {
        if (
          !schemas.rows.some(
            (r) => r.table_name === t.name && r.column_name === key,
          )
        )
          throw new Error('Structure BI incompatible : ' + t.name + '.' + key);
      }
    // Identifie aussi une éventuelle source exposée sous un alias.
    const sourceId = await source.query(
      'SELECT current_database() AS db, inet_server_addr()::text AS addr, inet_server_port() AS port',
    );
    const targetId = await target.query(
      'SELECT current_database() AS db, inet_server_addr()::text AS addr, inet_server_port() AS port',
    );
    if (JSON.stringify(sourceId.rows) === JSON.stringify(targetId.rows))
      throw new Error('Source et destination identiques');
    if (mode === 'check') {
      console.log(
        'Connexions source BI et destination valides. Source en lecture seule.',
      );
      return;
    }
    const lock = await target.query(
      "SELECT pg_try_advisory_lock(hashtext('ukit-bi-import')) AS acquired",
    );
    if (!lock.rows[0].acquired) throw new Error('Un import est déjà en cours');
    locked = true;
    await target.query('BEGIN');
    await target.query(await sql('migrate.sql'));
    await target.query('COMMIT');
    if (mode === 'migrate') {
      console.log('Schémas locaux créés. Aucune donnée source modifiée.');
      return;
    }
    await target.query(
      "UPDATE ukit_etl.import_run SET status='failed',finished_at=now(),error_code='INTERRUPTED' WHERE status='running'",
    );
    runId = (
      await target.query(
        "INSERT INTO ukit_etl.import_run(status) VALUES('running') RETURNING id",
      )
    ).rows[0].id;
    await target.query('BEGIN');
    await target.query(`CREATE TEMP TABLE bi_record (
 source_table text NOT NULL,record_key text NOT NULL,payload jsonb NOT NULL,run_id bigint NOT NULL,
 PRIMARY KEY(source_table,record_key)) ON COMMIT DROP`);
    const counts = {};
    for (const t of TABLES) {
      await source.query(
        'DECLARE bi_cursor NO SCROLL CURSOR FOR SELECT jsonb_build_array(' +
          columns[t.name].join(',') +
          ') AS values FROM bi_schema.' +
          t.name,
      );
      let count = 0;
      while (true) {
        if (disconnected) throw disconnected;
        const batch = await source.query('FETCH FORWARD 5000 FROM bi_cursor');
        if (!batch.rowCount) break;
        const data = batch.rows.map(({ values }) => {
          const payload=Object.fromEntries(columns[t.name].map((name,i)=>[name,values[i]]));
          return {key:rowKey(payload,t.keys),payload};
        });
        await target.query(
          `INSERT INTO pg_temp.bi_record(source_table,record_key,payload,run_id)
          SELECT $1,x.key::jsonb::text,x.payload,$2 FROM jsonb_to_recordset($3::jsonb) AS x(key text,payload jsonb)`,
          [t.name, runId, JSON.stringify(data)],
        );
        count += batch.rowCount;
        if (count % 50000 === 0)
          console.log(t.name + ': ' + count + ' lignes extraites');
      }
      await source.query('CLOSE bi_cursor');
      const expected = Number(
        (await source.query('SELECT count(*) AS n FROM bi_schema.' + t.name))
          .rows[0].n,
      );
      if (count !== expected || count === 0)
        throw new Error('Volume incomplet ou vide : ' + t.name);
      counts[t.name] = count;
      console.log(t.name + ': ' + count + ' lignes copiées');
    }
    if (disconnected) throw disconnected;
    await target.query('ANALYZE pg_temp.bi_record');
    await target.query(await sql('refresh.sql'));
    const control = await target.query(`SELECT
      (SELECT count(*) FROM ukit_mart.asset_current) AS assets,
      (SELECT coalesce(sum(equipment_count),0) FROM ukit_mart.stock_summary) AS grouped,
      (SELECT count(*) FROM ukit_mart.asset_current WHERE in_crm AND crm_status IN ('INSTOCK','DEFECTIVE')) AS stock,
      (SELECT count(*) FROM ukit_mart.stock_daily WHERE equipment_count<0) AS negative`);
    const c = control.rows[0];
    if (
      Number(c.assets) !== counts.dim_asset ||
      c.grouped !== c.stock ||
      Number(c.negative) !== 0
    )
      throw new Error('Réconciliation des agrégats refusée');
    await target.query(
      "UPDATE ukit_etl.import_run SET status='succeeded',finished_at=now(),counts=$2 WHERE id=$1",
      [runId, JSON.stringify(counts)],
    );
    await source.query('COMMIT');
    await target.query('COMMIT');
    console.log(
      'Import publié. Totaux réconciliés ; référentiels métier conservés.',
    );
  } catch (error) {
    if (targetConnected) await target.query('ROLLBACK').catch(() => {});
    if (runId)
      await target
        .query(
          "UPDATE ukit_etl.import_run SET status='failed',finished_at=now(),error_code=$2 WHERE id=$1",
          [
            runId,
            /^[0-9A-Z]{5}$/.test(error.code || '')
              ? error.code
              : 'IMPORT_FAILED',
          ],
        )
        .catch(() => {});
    // Ne jamais afficher détail SQL, connexion ou payload (données personnelles).
    if (error.code)
      throw new Error(
        'Échec PostgreSQL ' + [error.schema,error.table,error.column].filter(Boolean).join('.') + ' (' +
          error.code +
          '). Vérifier accès, structure et droits ; aucun détail sensible affiché.',
      );
    throw error;
  } finally {
    if (sourceConnected) await source.query('ROLLBACK').catch(() => {});
    if (locked)
      await target
        .query("SELECT pg_advisory_unlock(hashtext('ukit-bi-import'))")
        .catch(() => {});
    await Promise.allSettled([source.end(), target.end()]);
  }
}
if (
  process.argv[1] &&
  new URL(import.meta.url).pathname.replace(/^\//, '').toLowerCase() ===
    process.argv[1].replaceAll('\\', '/').toLowerCase()
) {
  run(process.argv[2] || 'check').catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
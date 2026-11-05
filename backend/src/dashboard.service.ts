import {
  Injectable,
  OnModuleDestroy,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const fields = [
  'zone',
  'region',
  'department',
  'am_id',
  'shop_id',
  'product_reference',
  'family',
  'asset_kind',
  'holder_kind',
  'crm_status',
  'availability',
] as const;
@Injectable()
export class DashboardService implements OnModuleDestroy {
  private pool?: Pool;
  private localPool(): Pool {
    if (this.pool) return this.pool;
    let file: Record<string, string | undefined> = {};
    try {
      file = parseEnv(readFileSync(resolve(process.cwd(), '.env'), 'utf8'));
    } catch {}
    const e = { ...file, ...process.env };
    // Uniquement la destination. Aucun import du client ETL ni des paramètres SOURCE_DB_*.
    const url = e.TARGET_DATABASE_URL || e.DATABASE_URL;
    if (!url && !e.TARGET_DB_HOST)
      throw new ServiceUnavailableException('Base locale non configurée');
    this.pool = new Pool(
      url
        ? {
            connectionString: url,
            max: 5,
            connectionTimeoutMillis: 5000,
            statement_timeout: 15000,
            options: '-c default_transaction_read_only=on',
          }
        : {
            host: e.TARGET_DB_HOST,
            port: Number(e.TARGET_DB_PORT || 5432),
            database: e.TARGET_DB_DATABASE,
            user: e.TARGET_DB_USER,
            password: e.TARGET_DB_PASSWORD,
            max: 5,
            connectionTimeoutMillis: 5000,
            statement_timeout: 15000,
            options: '-c default_transaction_read_only=on',
            ssl:
              e.TARGET_DB_SSLMODE && e.TARGET_DB_SSLMODE !== 'disable'
                ? {
                    rejectUnauthorized: e.TARGET_DB_SSLMODE === 'verify-full',
                    ...(e.TARGET_DB_SSL_CA_FILE
                      ? { ca: readFileSync(e.TARGET_DB_SSL_CA_FILE, 'utf8') }
                      : {}),
                  }
                : false,
          },
    );
    this.pool.on('error', () => {});
    return this.pool;
  }
  async onModuleDestroy() {
    await this.pool?.end();
  }
  private filter(query: Record<string, string>) {
    const values: string[] = [];
    const clauses: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (
        !fields.includes(key as (typeof fields)[number]) ||
        typeof value !== 'string' ||
        value.length > 200
      )
        throw new BadRequestException('Filtre invalide : ' + key);
      if (value) {
        values.push(value);
        clauses.push(key + ' = $' + values.length);
      }
    }
    return {
      where: clauses.length ? ' WHERE ' + clauses.join(' AND ') : '',
      values,
    };
  }
  private async snapshot<T>(fn: (c: PoolClient) => Promise<T>) {
    let c: PoolClient | undefined;
    try {
      c = await this.localPool().connect();
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const latest = (
        await c.query(
          "SELECT id,finished_at,counts FROM ukit_etl.import_run WHERE status='succeeded' ORDER BY id DESC LIMIT 1",
        )
      ).rows[0];
      if (!latest)
        throw new ServiceUnavailableException(
          'Aucune synchronisation locale réussie',
        );
      const data = await fn(c);
      await c.query('COMMIT');
      return {
        source: 'postgres_local',
        unit: 'equipment',
        lastImport: latest,
        data,
      };
    } catch (e) {
      await c?.query('ROLLBACK').catch(() => {});
      if (
        e instanceof BadRequestException ||
        e instanceof ServiceUnavailableException
      )
        throw e;
      throw new ServiceUnavailableException(
        'Données locales indisponibles. Aucun recours au serveur distant.',
      );
    } finally {
      c?.release();
    }
  }
  async overview(query: Record<string, string>) {
    const f = this.filter(query);
    return this.snapshot(
      async (c) =>
        (
          await c.query(
            `SELECT
      coalesce(sum(equipment_count),0)::bigint AS stock,
      coalesce(sum(equipment_count) FILTER(WHERE availability='available' AND holder_kind='central'),0)::bigint AS central_available,
      coalesce(sum(equipment_count) FILTER(WHERE availability='available' AND holder_kind IN ('am','shop','agent')),0)::bigint AS field_available,
      coalesce(sum(equipment_count) FILTER(WHERE crm_status='DEFECTIVE'),0)::bigint AS defective,
      coalesce(sum(equipment_count) FILTER(WHERE availability='unconfirmed'),0)::bigint AS availability_unconfirmed,
      coalesce(sum(equipment_count) FILTER(WHERE region IS NULL),0)::bigint AS region_unmapped
      FROM ukit_mart.stock_summary${f.where}`,
            f.values,
          )
        ).rows[0],
    );
  }
  async stock(query: Record<string, string>) {
    const { groupBy = 'product_reference', ...filters } = query;
    if (!fields.includes(groupBy as (typeof fields)[number]))
      throw new BadRequestException('Regroupement invalide');
    const f = this.filter(filters);
    return this.snapshot(
      async (c) =>
        (
          await c.query(
            `SELECT ${groupBy} AS value,sum(equipment_count)::bigint AS quantity FROM ukit_mart.stock_summary${f.where} GROUP BY ${groupBy} ORDER BY quantity DESC,value NULLS LAST`,
            f.values,
          )
        ).rows,
    );
  }
  async quality() {
    return this.snapshot(
      async (c) =>
        (
          await c.query(
            'SELECT check_name,affected_count FROM ukit_mart.quality_summary ORDER BY check_name',
          )
        ).rows,
    );
  }

  private dgFilters(query: Record<string, string>) {
    const names: Record<string, string> = {
      zone: 'zone',
      region: 'region',
      department: 'department',
      amId: 'am_id',
      shopId: 'shop_id',
      agentId: 'holder_id',
      product: 'product_reference',
    };
    const values: string[] = [],
      clauses = ['in_crm = true'];
    for (const [key, value] of Object.entries(query)) {
      if (!names[key] || typeof value !== 'string' || value.length > 200)
        throw new BadRequestException('Filtre DG invalide : ' + key);
      if (value) {
        values.push(value);
        clauses.push(names[key] + ' = $' + values.length);
      }
    }
    return { where: ' WHERE ' + clauses.join(' AND '), values };
  }
  async directorOverview(query: Record<string, string>) {
    const f = this.dgFilters(query);
    return this.snapshot(async (c) => {
      const totals = (
        await c.query(
          `SELECT
        count(*)::bigint AS equipment_total,
        count(*) FILTER(WHERE crm_status IN ('INSTOCK','DEFECTIVE'))::bigint AS active,
        count(*) FILTER(WHERE availability='available')::bigint AS available_confirmed,
        count(*) FILTER(WHERE availability='unconfirmed')::bigint AS availability_unconfirmed,
        count(*) FILTER(WHERE crm_status='DEFECTIVE')::bigint AS defective,
        count(*) FILTER(WHERE crm_status='DEPLOYED')::bigint AS deployed,
        count(*) FILTER(WHERE asset_kind='unknown')::bigint AS kind_unclassified,
        count(*) FILTER(WHERE NOT lifecycle_present)::bigint AS without_lifecycle,
        min(source_loaded_at) AS source_loaded_min,max(source_loaded_at) AS source_loaded_max
        FROM ukit_mart.asset_current${f.where}`,
          f.values,
        )
      ).rows[0];
      const stock = f.where + " AND crm_status IN ('INSTOCK','DEFECTIVE')";
      const custody = (
        await c.query(
          `SELECT holder_kind AS key,count(*)::bigint AS quantity FROM ukit_mart.asset_current${stock} GROUP BY holder_kind ORDER BY quantity DESC`,
          f.values,
        )
      ).rows;
      const regions = (
        await c.query(
          `SELECT CASE WHEN holder_kind='central' THEN '__central__' ELSE region END AS key,count(*)::bigint AS quantity FROM ukit_mart.asset_current${stock} GROUP BY 1 ORDER BY quantity DESC`,
          f.values,
        )
      ).rows;
      const products = (
        await c.query(
          `SELECT product_reference AS key,max(product_name) AS name,family,count(*)::bigint AS quantity FROM ukit_mart.asset_current${stock} GROUP BY product_reference,family ORDER BY quantity DESC`,
          f.values,
        )
      ).rows;
      return {
        totals,
        custody,
        regions,
        products,
        filters: query,
        availabilityComplete: totals.availability_unconfirmed === '0',
        sales: null,
        salesReason:
          'La règle de vente et la couverture historique doivent être validées.',
        historicalStock: null,
        historyReason:
          'Le stock journalier BI a une couverture partielle et ne permet pas tous les filtres produit et territoire.',
        labels: { unknown: 'Non renseigné', central: 'Entrepôt central' },
      };
    });
  }
  async directorStock(query: Record<string, string>) {
    const { level = 'zone', ...filters } = query;
    const levels: Record<string, string> = {
      zone: 'zone',
      region: 'region',
      department: 'department',
      amId: 'am_id',
      shopId: 'shop_id',
      agentId: 'holder_id',
    };
    if (!levels[level]) throw new BadRequestException('Niveau DG invalide');
    const f = this.dgFilters(filters),
      field = levels[level];
    return this.snapshot(async (c) => {
      const rows = (
        await c.query(
          `SELECT CASE WHEN holder_kind='central' THEN '__central__' ELSE ${field} END AS place,
        product_reference,max(product_name) AS product_name,family,count(*)::bigint AS active,
        count(*) FILTER(WHERE availability='available')::bigint AS available_confirmed,
        count(*) FILTER(WHERE availability='unconfirmed')::bigint AS availability_unconfirmed,
        count(*) FILTER(WHERE crm_status='DEFECTIVE')::bigint AS defective
        FROM ukit_mart.asset_current${f.where} AND crm_status IN ('INSTOCK','DEFECTIVE')
        GROUP BY 1,product_reference,family ORDER BY place NULLS LAST,product_reference`,
          f.values,
        )
      ).rows;
      return { level, filters, rows };
    });
  }
  async directorFilters(query: Record<string, string>) {
    const { field = 'region', search = '', ...filters } = query;
    const names: Record<string, string> = {
      zone: 'zone',
      region: 'region',
      department: 'department',
      amId: 'am_id',
      shopId: 'shop_id',
      agentId: 'holder_id',
      product: 'product_reference',
    };
    if (!names[field] || typeof search !== 'string' || search.length > 100)
      throw new BadRequestException('Recherche de filtre invalide');
    const scope = { ...filters };
    delete scope[field];
    const f = this.dgFilters(scope),
      column = names[field],
      label =
        field === 'product'
          ? 'coalesce(product_name,product_reference)'
          : column;
    f.values.push('%' + search + '%');
    return this.snapshot(async (c) => {
      const rows = (
        await c.query(
          `SELECT ${column} AS value,max(${label}) AS label FROM ukit_mart.asset_current${f.where}
        AND ${column} IS NOT NULL AND ${label} ILIKE $${f.values.length}
        GROUP BY ${column} ORDER BY label,value LIMIT 201`,
          f.values,
        )
      ).rows;
      return { field, options: rows.slice(0, 200), hasMore: rows.length > 200 };
    });
  }

  async directorDaily(query:Record<string,string>){
    const {date,...other}=query;
    if(Object.keys(other).length || (date && (typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)))throw new BadRequestException('Date de stock invalide');
    return this.snapshot(async c=>{
      const snapshotDate=date||(await c.query('SELECT max(snapshot_date)::text AS date FROM ukit_mart.stock_daily')).rows[0].date;
      const rows=(await c.query(`SELECT holder_kind,holder_role,stock_state,sum(equipment_count)::bigint AS quantity
       FROM ukit_mart.stock_daily_classified WHERE snapshot_date=$1::date
       GROUP BY holder_kind,holder_role,stock_state ORDER BY holder_kind,stock_state`,[snapshotDate])).rows;
      return {snapshotDate,sourceTable:'stock_daily',historyStart:'2025-01-01',rows,
        note:'Photographie historique BI à cette date. DEPLOYED désigne les vendus/déployés à date, pas le nombre de nouvelles ventes de la journée.'};
    });
  }
}

CREATE SCHEMA IF NOT EXISTS ukit_etl;
CREATE SCHEMA IF NOT EXISTS ukit_ref;
CREATE SCHEMA IF NOT EXISTS ukit_mart;

CREATE TABLE IF NOT EXISTS ukit_etl.import_run (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 counts jsonb,
 error_code text
);
-- Référentiels locaux validés par le métier, jamais écrasés par l'import.
CREATE TABLE IF NOT EXISTS ukit_ref.product (
 product_reference text PRIMARY KEY,
 product_name text NOT NULL,
 family text,
 asset_kind text NOT NULL DEFAULT 'unknown' CHECK(asset_kind IN ('kit','accessory','part','other','unknown')),
 availability_rule text NOT NULL DEFAULT 'unconfirmed' CHECK(availability_rule IN ('unconfirmed','approved')),
 validated_at timestamptz
);
CREATE TABLE IF NOT EXISTS ukit_ref.holder (
 holder_id text PRIMARY KEY,
 holder_kind text NOT NULL DEFAULT 'unknown' CHECK(holder_kind IN ('central','am','shop','agent','sav','other','unknown')),
 zone text, region text, department text, am_id text, shop_id text,
 latitude numeric CHECK(latitude BETWEEN -90 AND 90),
 longitude numeric CHECK(longitude BETWEEN -180 AND 180),
 validated_at timestamptz
);
CREATE TABLE IF NOT EXISTS ukit_mart.asset_current (
 serial_number text PRIMARY KEY,
 product_reference text, product_name text, family text,
 asset_kind text NOT NULL,
 in_crm boolean NOT NULL,
 crm_status text,
 crm_flag text,
 holder_id text, holder_kind text NOT NULL,
 zone text, region text, department text, am_id text, shop_id text,
 source_region text, source_zone text, source_district text,
 availability text NOT NULL CHECK(availability IN ('available','unavailable','unconfirmed')),
 lifecycle_present boolean NOT NULL,
 lifecycle_status text,
 holder_mismatch boolean NOT NULL,
 status_mismatch boolean NOT NULL,
 source_loaded_at timestamptz,
 run_id bigint NOT NULL REFERENCES ukit_etl.import_run(id)
);
CREATE INDEX IF NOT EXISTS asset_current_scope_idx ON ukit_mart.asset_current(region,shop_id,crm_status);
CREATE INDEX IF NOT EXISTS asset_current_product_idx ON ukit_mart.asset_current(product_reference);
CREATE TABLE IF NOT EXISTS ukit_mart.stock_summary (
 product_reference text, product_name text, family text, asset_kind text,
 holder_kind text, zone text, region text, department text, am_id text, shop_id text,
 crm_status text, availability text, equipment_count bigint NOT NULL,
 run_id bigint NOT NULL REFERENCES ukit_etl.import_run(id)
);
CREATE TABLE IF NOT EXISTS ukit_mart.quality_summary (
 check_name text PRIMARY KEY,
 affected_count bigint NOT NULL,
 run_id bigint NOT NULL REFERENCES ukit_etl.import_run(id)
);
CREATE TABLE IF NOT EXISTS ukit_mart.stock_daily (
 snapshot_date date NOT NULL, holder_category text NOT NULL, holder_id text,
 holder_role text, asset_status text NOT NULL, equipment_count bigint NOT NULL,
 data_as_of timestamp, source_loaded_at timestamptz,
 run_id bigint NOT NULL REFERENCES ukit_etl.import_run(id)
);
CREATE INDEX IF NOT EXISTS stock_daily_date_idx ON ukit_mart.stock_daily(snapshot_date);

CREATE TABLE IF NOT EXISTS ukit_mart.holding_period (
 serial_number text NOT NULL, period_no bigint NOT NULL,
 holder_category text,holder_id text,holder_role text,asset_status text,
 start_at timestamptz,end_at timestamptz,is_current boolean,duration_days numeric,
 run_id bigint NOT NULL REFERENCES ukit_etl.import_run(id),
 PRIMARY KEY(serial_number,period_no)
);
CREATE TABLE IF NOT EXISTS ukit_mart.lifecycle (
 serial_number text PRIMARY KEY,first_instock_at timestamptz,first_deployed_at timestamptz,
 last_deployed_at timestamptz,nb_deployments integer,nb_returns integer,
 last_returned_at timestamptz,current_status text,current_holder_id text,current_since timestamptz,
 run_id bigint NOT NULL REFERENCES ukit_etl.import_run(id)
);
-- Correspondances métier confirmées par upOwa le 7 octobre 2026.
CREATE OR REPLACE FUNCTION ukit_ref.kind_from_role(role text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE upper(btrim(role))
 WHEN 'AREA MANAGER' THEN 'am'
 WHEN 'POINT RELAIS' THEN 'shop'
 WHEN 'BA+' THEN 'agent' WHEN 'BA' THEN 'agent'
 WHEN 'MBA' THEN 'agent' WHEN 'FACO' THEN 'agent'
 WHEN 'ADMINISTRATOR' THEN 'central'
 ELSE 'unknown' END
$$;
CREATE OR REPLACE VIEW ukit_mart.stock_daily_classified AS
SELECT s.*,CASE WHEN holder_category='CLIENT' THEN 'client' ELSE ukit_ref.kind_from_role(holder_role) END AS holder_kind,
 CASE asset_status
 WHEN 'DEPLOYED' THEN 'sold'
 WHEN 'DEFECTIVE' THEN 'defective'
 WHEN 'IN_STOCK' THEN 'in_stock'
 WHEN 'INSTOCK' THEN 'in_stock'
 WHEN 'RESERVED' THEN 'reserved'
 ELSE 'unknown' END AS stock_state
FROM ukit_mart.stock_daily s;
DELETE FROM ukit_mart.asset_current;
DELETE FROM ukit_mart.stock_summary;
DELETE FROM ukit_mart.quality_summary;
DELETE FROM ukit_mart.stock_daily;
DELETE FROM ukit_mart.holding_period;
DELETE FROM ukit_mart.lifecycle;
INSERT INTO ukit_mart.asset_current
SELECT
 d.payload->>'serial_number',d.payload->>'product_reference',d.payload->>'product_name',
 p.family,coalesce(p.asset_kind,'unknown'),(d.payload->>'in_crm')::boolean,
 d.payload->>'crm_status',d.payload->>'crm_flag',d.payload->>'crm_holder_agent_number',
 coalesce(nullif(ukit_ref.kind_from_role(a.payload->>'role'),'unknown'),h.holder_kind,'unknown'),h.zone,h.region,h.department,h.am_id,h.shop_id,
 a.payload->>'location_region',a.payload->>'location_zone',a.payload->>'location_district',
 CASE WHEN d.payload->>'crm_status' IS DISTINCT FROM 'INSTOCK' THEN 'unavailable'
 WHEN p.availability_rule='approved' AND p.validated_at IS NOT NULL
 AND coalesce(nullif(ukit_ref.kind_from_role(a.payload->>'role'),'unknown'),h.holder_kind,'unknown') IN ('central','am','shop','agent')
 AND nullif(btrim(d.payload->>'crm_flag'),'') IS NULL THEN 'available'
 ELSE 'unconfirmed' END,
 l.record_key IS NOT NULL,l.payload->>'current_status',
 l.record_key IS NOT NULL AND coalesce(d.payload->>'crm_status' IN ('INSTOCK','DEFECTIVE'),false)
 AND (d.payload->>'crm_holder_agent_number') IS DISTINCT FROM (l.payload->>'current_holder_id'),
 l.record_key IS NOT NULL AND (CASE WHEN d.payload->>'crm_status'='INSTOCK' THEN 'IN_STOCK' ELSE d.payload->>'crm_status' END) IS DISTINCT FROM (l.payload->>'current_status'),
 (d.payload->>'_loaded_at')::timestamptz,d.run_id
FROM pg_temp.bi_record d
LEFT JOIN pg_temp.bi_record a ON a.source_table='dim_agents' AND a.record_key=jsonb_build_array(d.payload->>'crm_holder_agent_number')::text
LEFT JOIN pg_temp.bi_record l ON l.source_table='fct_asset_lifecycle' AND l.record_key=jsonb_build_array(d.payload->>'serial_number')::text
LEFT JOIN ukit_ref.product p ON p.product_reference=d.payload->>'product_reference'
LEFT JOIN ukit_ref.holder h ON h.holder_id=d.payload->>'crm_holder_agent_number' AND h.validated_at IS NOT NULL
WHERE d.source_table='dim_asset';

INSERT INTO ukit_mart.stock_summary
SELECT product_reference,product_name,family,asset_kind,holder_kind,zone,region,department,am_id,shop_id,
 crm_status,availability,count(*),min(run_id)
FROM ukit_mart.asset_current
WHERE in_crm AND crm_status IN ('INSTOCK','DEFECTIVE')
GROUP BY product_reference,product_name,family,asset_kind,holder_kind,zone,region,department,am_id,shop_id,crm_status,availability;

INSERT INTO ukit_mart.stock_daily
SELECT (payload->>'snapshot_date')::date,payload->>'holder_category',payload->>'holder_id',
 payload->>'holder_role',payload->>'asset_status',(payload->>'nb_kits')::bigint,
 (payload->>'data_as_of')::timestamp,(payload->>'_loaded_at')::timestamptz,run_id
FROM pg_temp.bi_record WHERE source_table='fct_asset_stock_daily';

INSERT INTO ukit_mart.quality_summary
SELECT 'crm_assets_without_lifecycle',count(*) FILTER(WHERE in_crm AND NOT lifecycle_present),min(run_id) FROM ukit_mart.asset_current
UNION ALL SELECT 'bi_assets_absent_crm',count(*) FILTER(WHERE NOT in_crm),min(run_id) FROM ukit_mart.asset_current
UNION ALL SELECT 'stock_without_region',count(*) FILTER(WHERE in_crm AND crm_status IN ('INSTOCK','DEFECTIVE') AND region IS NULL),min(run_id) FROM ukit_mart.asset_current
UNION ALL SELECT 'product_family_unmapped',count(*) FILTER(WHERE in_crm AND family IS NULL),min(run_id) FROM ukit_mart.asset_current
UNION ALL SELECT 'availability_unconfirmed',count(*) FILTER(WHERE in_crm AND availability='unconfirmed'),min(run_id) FROM ukit_mart.asset_current
UNION ALL SELECT 'holder_mismatch',count(*) FILTER(WHERE in_crm AND holder_mismatch),min(run_id) FROM ukit_mart.asset_current
UNION ALL SELECT 'status_mismatch',count(*) FILTER(WHERE in_crm AND status_mismatch),min(run_id) FROM ukit_mart.asset_current;
INSERT INTO ukit_mart.holding_period
SELECT payload->>'serial_number',(payload->>'period_no')::bigint,
payload->>'holder_category',payload->>'holder_id',payload->>'holder_role',payload->>'asset_status',
(payload->>'start_at')::timestamptz,(payload->>'end_at')::timestamptz,
(payload->>'is_current')::boolean,(payload->>'duration_days')::numeric,run_id
FROM pg_temp.bi_record WHERE source_table='fct_asset_holding_periods';
INSERT INTO ukit_mart.lifecycle
SELECT payload->>'serial_number',(payload->>'first_instock_at')::timestamptz,
(payload->>'first_deployed_at')::timestamptz,(payload->>'last_deployed_at')::timestamptz,
(payload->>'nb_deployments')::integer,(payload->>'nb_returns')::integer,
(payload->>'last_returned_at')::timestamptz,payload->>'current_status',
payload->>'current_holder_id',(payload->>'current_since')::timestamptz,run_id
FROM pg_temp.bi_record WHERE source_table='fct_asset_lifecycle';
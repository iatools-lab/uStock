WITH candidats AS (
    SELECT a."serialNumber" AS serial_number,
           a."product.productReference" AS product_reference,
           a."product.name" AS product_name,
           a.status, a.flag,
           NULLIF(a."dateAdded", '')::timestamptz AS date_ajout_upya,
           a."heldBy.agentNumber" AS agent_number
    FROM raw_upowa_schema.crm_assets a
    WHERE a.status = 'INSTOCK' AND a.flag = 'PAV'
      AND EXISTS (
          SELECT 1 FROM raw_upowa_schema.crm_products p
          WHERE p."productReference" = a."product.productReference"
            AND jsonb_typeof(NULLIF(p.boq, '')::jsonb) = 'array'
            AND jsonb_array_length(NULLIF(p.boq, '')::jsonb) > 0
      )
), entree_unique AS (
    SELECT e."asset.serialNumber" AS serial_number,
           MIN(NULLIF(e."createdAt", '')::timestamptz) AS date_entree_connue
    FROM raw_upowa_schema.crm_asset_events e
    JOIN candidats c ON c.serial_number = e."asset.serialNumber"
    GROUP BY e."asset.serialNumber"
    HAVING COUNT(*) = 1 AND MIN(e.type) = 'INSTOCK'
), retenus AS (
    SELECT c.*, e.date_entree_connue
    FROM candidats c JOIN entree_unique e USING (serial_number)
    WHERE NOT EXISTS (
        SELECT 1 FROM bi_schema.fct_asset_holding_periods h
        WHERE h.serial_number = c.serial_number
        GROUP BY h.serial_number
        HAVING COUNT(*) > 1
            OR BOOL_OR(h.asset_status IS NULL
                OR UPPER(TRIM(h.asset_status)) NOT IN ('INSTOCK', 'IN_STOCK'))
    )
      AND NOT EXISTS (
        SELECT 1 FROM bi_schema.fct_asset_lifecycle l
        WHERE l.serial_number = c.serial_number
          AND (l.first_deployed_at IS NOT NULL OR l.first_defective_at IS NOT NULL
            OR l.first_returned_at IS NOT NULL OR l.first_restored_at IS NOT NULL
            OR COALESCE(l.nb_deployments, 0) > 0 OR COALESCE(l.nb_defective, 0) > 0
            OR COALESCE(l.nb_returns, 0) > 0 OR COALESCE(l.nb_restorations, 0) > 0)
      )
)
SELECT * FROM retenus ORDER BY product_name, serial_number;

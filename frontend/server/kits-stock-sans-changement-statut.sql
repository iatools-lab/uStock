WITH candidats AS (
    SELECT
        r."serialNumber" AS serial_number,
        r."product.productReference" AS product_reference,
        r."product.name" AS product_name,
        r.status AS statut_actuel,
        r.flag AS flag_actuel,
        NULLIF(r."dateAdded", '')::timestamptz AS date_ajout_upya,
        r."heldBy.agentNumber" AS agent_number,
        r."contract.contractNumber" AS contract_number
    FROM raw_upowa_schema.crm_assets r
    WHERE r.status = 'INSTOCK'
      AND (r.flag = 'PAV' OR r.flag IS NULL)
), periodes AS (
    SELECT
        h.serial_number,
        COUNT(*) AS nombre_periodes,
        MIN(h.start_at) AS premier_historique,
        MAX(h.start_at) AS derniere_periode,
        BOOL_OR(
            h.asset_status IS NULL
            OR UPPER(TRIM(h.asset_status)) NOT IN ('INSTOCK', 'IN_STOCK')
        ) AS autre_statut_observe
    FROM bi_schema.fct_asset_holding_periods h
    JOIN candidats c ON c.serial_number = h.serial_number
    GROUP BY h.serial_number
), evenements AS (
    SELECT
        e."asset.serialNumber" AS serial_number,
        MIN(NULLIF(e."createdAt", '')::timestamptz) AS premier_evenement,
        BOOL_OR(UPPER(TRIM(e.type)) IN (
            'DEPLOYED', 'DEFECTIVE', 'RESERVED', 'WRITEOFF'
        )) AS evenement_autre_statut
    FROM raw_upowa_schema.crm_asset_events e
    JOIN candidats c ON c.serial_number = e."asset.serialNumber"
    GROUP BY e."asset.serialNumber"
), controles AS (
    SELECT
        c.*,
        p.nombre_periodes,
        p.premier_historique,
        p.derniere_periode,
        e.premier_evenement,
        p.serial_number IS NOT NULL AS historique_present,
        COALESCE(p.autre_statut_observe, FALSE) AS autre_statut_observe,
        COALESCE(e.evenement_autre_statut, FALSE) AS evenement_autre_statut,
        (
            l.first_deployed_at IS NOT NULL
            OR COALESCE(l.nb_deployments, 0) > 0
            OR l.first_defective_at IS NOT NULL
            OR COALESCE(l.nb_defective, 0) > 0
            OR l.first_returned_at IS NOT NULL
            OR COALESCE(l.nb_returns, 0) > 0
            OR l.first_restored_at IS NOT NULL
            OR COALESCE(l.nb_restorations, 0) > 0
        ) AS antecedent_cycle_de_vie
    FROM candidats c
    LEFT JOIN periodes p USING (serial_number)
    LEFT JOIN evenements e USING (serial_number)
    LEFT JOIN bi_schema.fct_asset_lifecycle l USING (serial_number)
), retenus AS (
    SELECT *
    FROM controles
    WHERE historique_present
      AND NOT autre_statut_observe
      AND NOT evenement_autre_statut
      AND NOT antecedent_cycle_de_vie
)
SELECT *
FROM retenus
ORDER BY product_name, serial_number;

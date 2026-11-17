-- Cas a verifier : ce profil ne prouve pas, a lui seul, une ancienne vente.
WITH evenements AS (
    SELECT "asset.serialNumber" AS serial_number,
           MIN(NULLIF("createdAt", '')::timestamptz) AS premier_evenement,
           COUNT(*) AS nombre_evenements,
           BOOL_OR(type = 'INSTOCK') AS entree_stock,
           BOOL_OR(type = 'FLAGGED') AS flag_ajoute,
           BOOL_OR(type = 'UNFLAGGED') AS flag_retire,
           BOOL_AND(type IN ('INSTOCK', 'EXCEPTION', 'FLAGGED', 'UNFLAGGED')) AS profil_reinitialisation
    FROM raw_upowa_schema.crm_asset_events
    GROUP BY "asset.serialNumber"
)
SELECT a."serialNumber" AS serial_number,
       a."product.name" AS produit,
       a.status, a.flag,
       a."dateAdded" AS date_ajout_upya,
       e.premier_evenement, e.nombre_evenements,
       a."heldBy.agentNumber" AS agent_number,
       CONCAT_WS(' ', a."heldBy.profile.firstName", a."heldBy.profile.lastName") AS detenteur
FROM raw_upowa_schema.crm_assets a
JOIN evenements e ON e.serial_number = a."serialNumber"
WHERE a.status = 'INSTOCK'
  AND a."serialNumber" NOT LIKE '15%'
  AND EXISTS (
      SELECT 1 FROM raw_upowa_schema.crm_products p
      WHERE p."productReference" = a."product.productReference"
        AND CASE WHEN jsonb_typeof(NULLIF(p.boq, '')::jsonb) = 'array'
                 THEN jsonb_array_length(NULLIF(p.boq, '')::jsonb) > 0 ELSE FALSE END
  )
  AND (e.premier_evenement AT TIME ZONE 'Africa/Douala')::date
      > (NULLIF(a."dateAdded", '')::timestamptz AT TIME ZONE 'Africa/Douala')::date
  AND e.profil_reinitialisation AND e.entree_stock AND e.flag_ajoute AND e.flag_retire
ORDER BY produit, serial_number;

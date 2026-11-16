// La nomenclature identifie une reference de kit, pas sa completude physique.
// Regle metier Upya : les identifiants commencant par 15 sont des accessoires,
// meme quand leur reference est erroneement celle du kit SunShine complet.
export const completeKitSQL=(alias='a')=>`(${alias}.serial_number IS NOT NULL AND ${alias}.serial_number NOT LIKE '15%' AND EXISTS (
 SELECT 1 FROM raw_upowa_schema.crm_products kit_product
 WHERE kit_product."productReference"=${alias}.product_reference
 AND CASE WHEN jsonb_typeof(NULLIF(kit_product.boq,'')::jsonb)='array'
 THEN jsonb_array_length(NULLIF(kit_product.boq,'')::jsonb)>0 ELSE false END
))`;

export const signedKitSQL=(alias='a')=>`${alias}.serial_number IN (SELECT serial_number FROM stock_signed_assets)`;

export function stockConditionSQL(alias='a',{holderName=`${alias}.crm_holder_name`,cutoff='now()',sold='false',signed='false'}={}){
 const label=`lower(translate(concat_ws(' ',${holderName},${alias}.product_name,${alias}.crm_flag),'ÉÈÊéèêÀàÔôÛû','EEEeeeAaOoUu'))`;
 const before=field=>`life.${field}<${cutoff}`;
 return `CASE
 WHEN ${label} ~ '(repar|repair|defect|rebut|qualit|r&d)' THEN 'repair'
 WHEN ${label} ~ '(recondition|renew|refurb)' OR upper(coalesce(${alias}.crm_flag,''))='URENEW' THEN 'refurbished'
 WHEN ${label} ~ '(retour|terrain|entrepot rt)' OR upper(coalesce(${alias}.crm_flag,''))='RD' OR (${sold}) OR (${signed})
 OR ${alias}.serial_number IN (
 SELECT event."asset.serialNumber" FROM raw_upowa_schema.crm_asset_events event
 WHERE event.type IN ('DEPLOYED','AFTER SALES','OFFLIELD CODE','UNFLAGGED')
 AND event."asset.serialNumber" IS NOT NULL
 )
 OR EXISTS(SELECT 1 FROM bi_schema.fct_asset_lifecycle life WHERE life.serial_number=${alias}.serial_number AND (${before('first_deployed_at')} OR ${before('first_returned_at')})) THEN 'returned'
 WHEN EXISTS(SELECT 1 FROM bi_schema.fct_asset_lifecycle life WHERE life.serial_number=${alias}.serial_number AND (${before('first_defective_at')} OR ${before('first_restored_at')})) THEN 'control'
 WHEN NOT EXISTS(SELECT 1 FROM bi_schema.fct_asset_holding_periods known WHERE known.serial_number=${alias}.serial_number AND known.start_at<${cutoff}) THEN 'control'
 WHEN ${alias}.crm_flag IS NOT NULL AND upper(${alias}.crm_flag)<>'PAV' THEN 'control'
 ELSE 'available' END`;
}

export const STOCK_CONDITION_LABELS={available:'Kits disponibles',returned:'Retours / déjà signés ou déployés',repair:'Réparation / défaut / contrôle qualité',refurbished:'Reconditionnés',control:'À contrôler'};

import { contractSalesCTE } from './contract-sales.mjs';
import { eligibleSQL } from './status-scope.mjs';

// Administration : references de kits physiques, y compris non disponibles, et ventes Upya.
export function analysisCohortCTE(){return `${contractSalesCTE()}, analysis_entities AS (
 SELECT a.serial_number AS selection_key,a.serial_number,a.contract_number,a.product_reference,a.product_name,
 a.crm_status,a.crm_flag,a.crm_holder_name AS holder_name,'Stock'::text AS source
 FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} AND a.crm_status IN ('INSTOCK','DEFECTIVE')
 AND a.serial_number NOT IN (SELECT serial_number FROM contract_first_sales WHERE sold_at IS NULL OR sold_at<(((now() AT TIME ZONE 'Africa/Douala')::date+1)::timestamp AT TIME ZONE 'Africa/Douala'))
 UNION ALL
 SELECT coalesce(nullif(s.serial_number,''),'contract:'||s.contract_number),nullif(s.serial_number,''),s.contract_number,s.product_reference,s.product_name,
 'DEPLOYED',NULL::text,s.holder_name,'Vente Upya'
 FROM contract_sales s WHERE s.sold_at IS NULL OR s.sold_at<(((now() AT TIME ZONE 'Africa/Douala')::date+1)::timestamp AT TIME ZONE 'Africa/Douala')
)`;}

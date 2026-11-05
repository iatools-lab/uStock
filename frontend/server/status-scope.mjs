export const CRM_STATUSES = ['DEPLOYED','INSTOCK','DEFECTIVE'];
export const eligibleSQL = alias => `(${alias}.crm_status IN ('DEPLOYED','INSTOCK','DEFECTIVE') AND EXISTS (SELECT 1 FROM bi_schema.fct_asset_holding_periods history WHERE history.serial_number=${alias}.serial_number))`;

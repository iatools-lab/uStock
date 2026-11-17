import {
  completeKitSQL,
  stockConditionSQL,
  signedKitSQL,
} from "./kit-stock-scope.mjs";
export const CRM_STATUSES = ["DEPLOYED", "INSTOCK", "DEFECTIVE"];
export const eligibleSQL = (alias) =>
  `(${alias}.crm_status IN ('DEPLOYED','INSTOCK','DEFECTIVE') AND ${completeKitSQL(alias)})`;
// A une date historique, l'etat est celui de la derniere periode connue a cette date.
export const newStockSQL = (
  alias = "a",
  status = `${alias}.crm_status`,
  options = {},
) =>
  `(${completeKitSQL(alias)} AND ${status} IN ('INSTOCK','IN_STOCK') AND (${stockConditionSQL(alias, { ...options, signed: options.signed ?? signedKitSQL(alias) })})='available')`;
export const physicalStockSQL = (
  alias = "a",
  status = `${alias}.crm_status`,
  options = {},
) => `(${newStockSQL(alias, status, options)} OR ${status}='DEFECTIVE')`;

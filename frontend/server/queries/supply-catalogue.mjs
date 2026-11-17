import { eligibleSQL } from "./status-scope.mjs";
import { inclusionSQL } from "./selection-rules.mjs";
import { contractSalesCTE } from "./contract-sales.mjs";
import { newStockSQL } from "./status-scope.mjs";

export async function querySupplyKits(
  client,
  selection,
  warehouseIds,
  productIds,
) {
  const values = [warehouseIds, productIds],
    included = inclusionSQL(selection, values);
  return (
    await client.query(
      `WITH ${contractSalesCTE()}
 SELECT a.serial_number AS "serialNumber",a.product_reference AS "productId",a.crm_holder_agent_number AS "warehouseId"
 FROM bi_schema.dim_asset a LEFT JOIN stock_signed_assets signed_stock ON signed_stock.serial_number=a.serial_number
 WHERE a.crm_holder_agent_number=ANY($1::text[]) AND a.product_reference=ANY($2::text[]) AND ${eligibleSQL("a")}
 AND ${newStockSQL("a", "a.crm_status", { signed: "signed_stock.serial_number IS NOT NULL" })} AND ${included}
 ORDER BY a.product_reference,a.serial_number`,
      values,
    )
  ).rows;
}
import { forecastNeeds } from "../../shared/forecast-needs.js";

export function supplyEstimates(analysis, areaManagers) {
  const names = new Map(areaManagers.map((a) => [a.id, a.name]));
  const horizonDays = 90,
    bufferDays = 14;
  const forecast = forecastNeeds(
    analysis,
    "amId",
    horizonDays,
    bufferDays,
    names,
  );
  return {
    estimates: forecast.detail
      .filter((row) => row.id !== "__unknown__")
      .map((row) => ({
        managerId: row.id,
        productId: row.product,
        stock: row.stock,
        estimatedNeed: row.need,
      })),
    estimation: {
      observationDays: analysis.window.days,
      horizonDays,
      bufferDays,
      start: analysis.window.start,
      end: analysis.window.end,
    },
  };
}

export async function querySupplyProducts(client, selection) {
  const values = [];
  const included = inclusionSQL(selection, values);
  return (
    await client.query(
      `SELECT a.product_reference AS id,max(a.product_name) AS name
    FROM bi_schema.dim_asset a WHERE ${eligibleSQL("a")} AND ${included}
    GROUP BY a.product_reference ORDER BY 2`,
      values,
    )
  ).rows;
}

export function supplyStock(snapshot) {
  const warehouses = snapshot.options.warehouses || [];
  const ids = new Set(warehouses.map((w) => w.value));
  return {
    warehouses: warehouses.map((w) => ({ id: w.value, name: w.label })),
    stock: snapshot.territories.rows
      .filter((r) => ids.has(r.key) && r.instock > 0)
      .map((r) => ({
        warehouseId: r.key,
        productId: r.productReference,
        quantity: r.instock,
      })),
    areaManagers: snapshot.options.ams.map((a) => ({
      id: a.value,
      name: a.label,
    })),
    observedAt: snapshot.queriedAt,
    sourceLoadedAt: snapshot.sourceLoadedAt,
  };
}

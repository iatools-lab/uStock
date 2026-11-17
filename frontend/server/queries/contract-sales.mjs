import { inclusionSQL } from "./selection-rules.mjs";

// Les trois criteres metier sont ceux de la requete Upya fournie.
export const contractPredicate = (
  c = "c",
) => `${c}."deal.dealNumber" NOT IN ('XNKTM','XCTSQ','XH7HS')
 AND ${c}."onboardingStatus" = 'Signed'
 AND (${c}."pricingSchedule.upfrontPayment" IS NULL
      OR ${c}."totalPaid"::numeric >= ${c}."pricingSchedule.upfrontPayment"::numeric)`;

// Aucune ecriture ni stockage local. Un lien ambigu n'est pas attribue arbitrairement.
export function contractSalesCTE() {
  return `contract_asset_keys AS (
 SELECT contract_number,min(serial_number) AS serial_number
 FROM bi_schema.dim_asset WHERE nullif(contract_number,'') IS NOT NULL
 GROUP BY contract_number HAVING count(DISTINCT serial_number)=1
), stock_signed_assets AS MATERIALIZED (
 SELECT DISTINCT coalesce(nullif(c."asset.serialNumber",''),k.serial_number) AS serial_number
 FROM raw_upowa_schema.crm_contracts c
 LEFT JOIN contract_asset_keys k ON k.contract_number=c."contractNumber"
 WHERE c."onboardingStatus"='Signed'
 AND coalesce(nullif(c."asset.serialNumber",''),k.serial_number) IS NOT NULL
), qualified_contracts AS (
 SELECT c."contractNumber" AS contract_number,
 c."asset.assetNumber" AS asset_number,coalesce(nullif(c."asset.paygNumber",''),nullif(c."paygNumber",'')) AS payg_number,
 coalesce(nullif(c."asset.serialNumber",''),k.serial_number,'') AS serial_number,
 c."product.productReference" AS contract_product_reference,c."product.name" AS contract_product_name,
 inventory.product_reference AS inventory_product_reference,inventory.product_name AS inventory_product_name,
 coalesce(nullif(c."agent.agentNumber",''),nullif(c."recordingAgent.agentNumber",'')) AS holder_id,
 CASE WHEN nullif(c."agent.agentNumber",'') IS NOT NULL
 THEN nullif(trim(concat_ws(' ',c."agent.profile.firstName",c."agent.profile.lastName")),'')
 ELSE nullif(trim(concat_ws(' ',c."recordingAgent.profile.firstName",c."recordingAgent.profile.lastName")),'') END AS holder_name,
 nullif(c."signingDate",'')::timestamptz AS sold_at
 FROM raw_upowa_schema.crm_contracts c
 LEFT JOIN contract_asset_keys k ON k.contract_number=c."contractNumber"
 LEFT JOIN bi_schema.dim_asset inventory ON inventory.serial_number=coalesce(nullif(c."asset.serialNumber",''),k.serial_number)
 WHERE ${contractPredicate()}
), contract_product_aliases AS (
 SELECT contract_product_reference,min(inventory_product_reference) AS product_reference,min(inventory_product_name) AS product_name
 FROM qualified_contracts WHERE nullif(contract_product_reference,'') IS NOT NULL AND nullif(inventory_product_reference,'') IS NOT NULL
 GROUP BY contract_product_reference HAVING count(DISTINCT inventory_product_reference)=1
), normalized_contract_sales AS (
 SELECT q.*,coalesce(nullif(q.inventory_product_reference,''),aliases.product_reference,nullif(q.contract_product_reference,'')) AS product_reference,
 coalesce(nullif(q.inventory_product_name,''),aliases.product_name,q.contract_product_name) AS product_name
 FROM qualified_contracts q LEFT JOIN contract_product_aliases aliases USING(contract_product_reference)
), contract_first_sales AS MATERIALIZED (
 SELECT serial_number,min(sold_at) AS sold_at FROM qualified_contracts
 WHERE serial_number<>'' GROUP BY serial_number
), ranked_contract_sales AS (
 SELECT q.*,row_number() OVER (
 PARTITION BY CASE WHEN serial_number<>'' THEN 'asset:'||serial_number ELSE 'contract:'||contract_number END
 ORDER BY sold_at NULLS LAST,contract_number) AS sale_rank
 FROM normalized_contract_sales q
), contract_sales AS (
 SELECT * FROM ranked_contract_sales WHERE sale_rank=1
)`;
}

function saleFilter({
  selection = { rules: [] },
  params = new URLSearchParams(),
  start = null,
  end,
  allowUndated = false,
}) {
  const values = [start, end, allowUndated],
    where = [
      inclusionSQL(
        selection,
        values,
        "a",
        "coalesce(nullif(a.serial_number,''),'contract:'||a.contract_number)",
      ),
    ];
  if (params.get("product")) {
    const product = params.get("product");
    if (product === "__unknown__") where.push("a.product_reference IS NULL");
    else {
      values.push(product);
      where.push(`a.product_reference=$${values.length}`);
    }
  }
  if (params.get("search")) {
    values.push("%" + params.get("search") + "%");
    where.push(
      `(a.serial_number ILIKE $${values.length} OR a.product_name ILIKE $${values.length} OR a.holder_name ILIKE $${values.length})`,
    );
  }
  const predicate = `(((a.sold_at < (($2::date+1)::timestamp AT TIME ZONE 'Africa/Douala'))
 AND ($1::date IS NULL OR a.sold_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Douala')))
 OR ($3::boolean AND a.sold_at IS NULL)) AND ${where.join(" AND ")}`;
  return { values, predicate };
}
export async function queryContractSales(c, options) {
  const { granularity = null } = options,
    { values, predicate } = saleFilter(options);
  const format = granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const bucket = granularity
    ? `to_char(a.sold_at AT TIME ZONE 'Africa/Douala','${format}')`
    : "NULL::text";
  return (
    await c.query(
      `WITH ${contractSalesCTE()}
 SELECT ${bucket} AS month,a.product_reference,max(a.product_name) AS product_name,
 'DEPLOYED'::text AS status,a.holder_id,max(a.holder_name) AS holder_name,
 NULL::text AS routing_shop_id,true AS in_crm,count(*)::int AS quantity
 FROM contract_sales a
 WHERE ${predicate}
 GROUP BY 1,a.product_reference,a.holder_id`,
      values,
    )
  ).rows;
}
export async function queryContractDetails(c, options) {
  const { values, predicate } = saleFilter(options);
  return (
    await c.query(
      `WITH ${contractSalesCTE()}
 SELECT a.contract_number,a.asset_number,a.payg_number,nullif(a.serial_number,'') AS serial_number,a.product_reference,a.product_name,
 a.contract_product_reference,a.contract_product_name,a.holder_id,a.holder_name,'DEPLOYED'::text AS status,
 a.sold_at,to_char(a.sold_at AT TIME ZONE 'Africa/Douala','YYYY-MM-DD HH24:MI:SS') AS signing_date_local
 FROM contract_sales a WHERE ${predicate} ORDER BY a.sold_at NULLS LAST,a.contract_number`,
      values,
    )
  ).rows;
}

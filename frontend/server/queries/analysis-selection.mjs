import { analysisCohortCTE } from "./analysis-cohort.mjs";
import { inclusionSQL } from "./selection-rules.mjs";
import { loadStockContext } from "./territory-context.mjs";
import { agentExportFields } from "./agent-export.mjs";

export async function countSelectionKeys(client, kind, keys) {
  if (!["asset", "product"].includes(kind))
    throw new Error("INVALID_SELECTION");
  const column =
    kind === "asset"
      ? "selection_key"
      : "coalesce(nullif(product_reference,''),'__unknown__')";
  const result = await client.query(
    `WITH ${analysisCohortCTE()} SELECT count(DISTINCT ${column})::int n FROM analysis_entities WHERE ${column}=ANY($1::text[])`,
    [[...new Set(keys)]],
  );
  return result.rows[0].n;
}

export async function querySelection(c, params, selection) {
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    throw new Error("INVALID_PAGE");
  const cohort = analysisCohortCTE(),
    values = [],
    included = inclusionSQL(selection, values, "a", "a.selection_key"),
    where = ["true"];
  for (const [key, column] of [
    ["product", "a.product_reference"],
    ["status", "a.crm_status"],
    ["flag", "a.crm_flag"],
  ]) {
    const value = params.get(key);
    if (value) {
      if (value.length > 200) throw new Error("INVALID_FILTER");
      if (value === "__unknown__") where.push(`${column} IS NULL`);
      else {
        values.push(value);
        where.push(`${column}=$${values.length}`);
      }
    }
  }
  const term = params.get("search");
  if (term) {
    if (term.length > 200) throw new Error("INVALID_FILTER");
    values.push("%" + term + "%");
    where.push(
      `(a.serial_number ILIKE $${values.length} OR a.contract_number ILIKE $${values.length} OR a.product_name ILIKE $${values.length} OR a.holder_name ILIKE $${values.length})`,
    );
  }
  const scope = params.get("scope") || "all";
  if (!["all", "included", "excluded"].includes(scope))
    throw new Error("INVALID_SCOPE");
  const globalValues = [];
  const globalPredicate = inclusionSQL(
    selection,
    globalValues,
    "a",
    "a.selection_key",
  );
  const counts = (
    await c.query(
      `WITH ${cohort} SELECT count(*)::int total,count(*) FILTER(WHERE ${globalPredicate})::int included,count(*) FILTER(WHERE NOT ${globalPredicate})::int excluded FROM analysis_entities a`,
      globalValues,
    )
  ).rows[0];
  const scopeWhere = [
    ...where,
    ...(scope === "all"
      ? []
      : [scope === "included" ? included : `NOT ${included}`]),
  ];
  const scoped = scopeWhere.length ? " WHERE " + scopeWhere.join(" AND ") : "";
  const total = (
    await c.query(
      `WITH ${cohort} SELECT count(*)::int total,count(*) FILTER(WHERE ${included})::int retained FROM analysis_entities a${scoped}`,
      values,
    )
  ).rows[0].total;
  if (params.get("exportDetails") === "true") {
    const rows = (
      await c.query(
        `WITH ${cohort} SELECT a.serial_number AS "serialNumber",a.contract_number AS "contractNumber",a.product_reference AS "productReference",a.product_name AS "productName",a.crm_status AS status,a.crm_flag AS flag,a.holder_id AS "agentNumber",a.holder_name AS "agentName",${included} AS included FROM analysis_entities a${scoped} ORDER BY a.selection_key`,
        values,
      )
    ).rows;
    const today = (
      await c.query(
        "SELECT (now() AT TIME ZONE 'Africa/Douala')::date::text AS today",
      )
    ).rows[0].today;
    const { byId } = await loadStockContext(c, today);
    return {
      revision: selection.revision,
      total,
      rows: rows.map((r) => ({
        ...r,
        ...agentExportFields(r.agentNumber, byId),
      })),
      period: { start: null, end: new Date().toISOString().slice(0, 10) },
    };
  }
  const rows = (
    await c.query(
      `WITH ${cohort} SELECT a.selection_key AS "selectionKey",a.serial_number AS "serialNumber",a.contract_number AS "contractNumber",a.source,a.product_reference AS "productReference",a.product_name AS "productName",a.crm_status AS "crmStatus",a.crm_flag AS "crmFlag",a.holder_name AS "holderName",${included} AS included FROM analysis_entities a${scoped} ORDER BY a.selection_key LIMIT 50 OFFSET $${values.length + 1}`,
      [...values, (page - 1) * 50],
    )
  ).rows;
  const options = (
    await c.query(
      `WITH ${cohort} SELECT coalesce(nullif(product_reference,''),'__unknown__') AS value,max(product_name) AS label,count(*)::int quantity FROM analysis_entities a GROUP BY 1 ORDER BY 2`,
    )
  ).rows;
  const statuses = (
    await c.query(
      `WITH ${cohort} SELECT DISTINCT crm_status AS value FROM analysis_entities a ORDER BY 1`,
    )
  ).rows;
  const flags = (
    await c.query(
      `WITH ${cohort} SELECT DISTINCT crm_flag AS value FROM analysis_entities a ORDER BY 1 NULLS LAST`,
    )
  ).rows;
  return {
    counts,
    rows,
    total,
    page,
    hasMore: page * 50 < total,
    options: { products: options, statuses, flags },
    selection,
  };
}

export const STATE_LABELS = {
  INSTOCK: "En stock",
  DEPLOYED: "Vendus",
  DEFECTIVE: "Défectueux",
};
export const PALETTE = [
  "#001a70",
  "#fe5716",
  "#168779",
  "#7297dc",
  "#b377bf",
  "#bd851e",
  "#8894a9",
];
const name = (row, dimension, names) =>
  dimension === "product"
    ? row.productName
    : dimension === "holderId"
      ? row.holderName || row.holderId || "Vendeur non renseigné"
      : dimension === "amId"
        ? names.get(row.amId) || "AM non renseigné"
        : row[dimension] || "Lieu non renseigné";

export function monthlySeries(analysis, dimension, status, names = new Map()) {
  const totals = new Map();
  for (const r of analysis.rows)
    if (r.status === status) {
      const key = r[dimension] || "__unknown__";
      const old = totals.get(key) || {
        key,
        label: name(r, dimension, names),
        quantity: 0,
      };
      old.quantity += r.quantity;
      totals.set(key, old);
    }
  const ordered = [...totals.values()].sort(
    (a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label),
  );
  const series = ordered.map((r, i) => ({
    key: `s${i}`,
    label: r.label,
    id: r.key,
  }));
  const byKey = new Map(series.map((s) => [s.id, s]));
  const data = analysis.months.map((month) => ({
    month,
    ...Object.fromEntries(series.map((s) => [s.key, 0])),
  }));
  const byMonth = new Map(data.map((r) => [r.month, r]));
  for (const r of analysis.rows)
    if (r.status === status) {
      const key = r[dimension] || "__unknown__";
      const s = byKey.get(key);
      if (s && byMonth.has(r.month)) byMonth.get(r.month)[s.key] += r.quantity;
    }
  return { data, series, ranking: ordered };
}

export { forecastNeeds } from "../../shared/forecast-needs.js";

export function productType(reference, label) {
  const value = `${reference} ${label}`.replace(/[_-]/g, " ").toUpperCase();
  for (const [pattern, type] of [
    [/\bJUA/, "Jua"],
    [/\bSUNSHINE\b/, "Sunshine"],
    [/\bFLASH\b/, "Flash"],
    [/\bLION\b/, "Lion"],
    [/\bLUCIOLE\b/, "Luciole"],
  ])
    if (pattern.test(value)) return type;
  return label || reference;
}
export function needsMatrix(forecast) {
  const products = [
    ...new Set(
      forecast.detail.map((r) => productType(r.product, r.productName)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const byPlace = new Map(
    forecast.rows.map((r) => [r.id, { label: r.label, values: new Map() }]),
  );
  for (const r of forecast.detail) {
    const place = byPlace.get(r.id),
      key = productType(r.product, r.productName);
    place.values.set(key, (place.values.get(key) || 0) + r.need);
  }
  const rows = [...byPlace.values()].map((r) => {
    const values = products.map((p) => r.values.get(p) || 0);
    return [r.label, ...values, values.reduce((n, v) => n + v, 0)];
  });
  return {
    products,
    rows,
    totals: [
      "Total",
      ...products.map((_, i) => rows.reduce((n, r) => n + r[i + 1], 0)),
      forecast.totals.need,
    ],
  };
}

export function stateEvolution(analysis, status) {
  const totals = new Map(analysis.months.map((month) => [month, 0]));
  for (const r of analysis.rows)
    if (r.status === status && totals.has(r.month))
      totals.set(r.month, totals.get(r.month) + r.quantity);
  return {
    data: [...totals].map(([month, value]) => ({ month, value })),
    series: [{ key: "value", label: STATE_LABELS[status] }],
  };
}

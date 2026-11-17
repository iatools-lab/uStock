const name = (row, dimension, names) =>
  dimension === "product"
    ? row.productName
    : dimension === "holderId"
      ? row.holderName || row.holderId || "Vendeur non renseigné"
      : dimension === "amId"
        ? names.get(row.amId) || "AM non renseigné"
        : row[dimension] || "Lieu non renseigné";

export function forecastNeeds(
  analysis,
  dimension,
  horizon,
  buffer,
  names = new Map(),
) {
  const cells = new Map(),
    last = analysis.months.at(-1);
  for (const r of analysis.rows) {
    if (
      r.status !== "DEPLOYED" &&
      !(r.status === "INSTOCK" && r.month === last)
    )
      continue;
    const id = r[dimension] || "__unknown__",
      key = JSON.stringify([
        r.zone || null,
        r.region || null,
        r.amId || null,
        r.product,
      ]);
    if (!cells.has(key))
      cells.set(key, {
        id,
        product: r.product,
        productName: r.productName,
        label: name(r, dimension, names),
        sold: 0,
        stock: 0,
      });
    cells.get(key)[r.status === "DEPLOYED" ? "sold" : "stock"] += r.quantity;
  }
  const calculated = [...cells.values()].map((r) => {
    const daily = r.sold / analysis.window.days,
      target = Math.ceil(daily * (horizon + buffer));
    return { ...r, daily, target, need: Math.max(0, target - r.stock) };
  });
  const details = new Map();
  for (const r of calculated) {
    const key = JSON.stringify([r.id, r.product]);
    if (!details.has(key))
      details.set(key, {
        ...r,
        sold: 0,
        stock: 0,
        daily: 0,
        target: 0,
        need: 0,
      });
    const cell = details.get(key);
    for (const k of ["sold", "stock", "daily", "target", "need"])
      cell[k] += r[k];
  }
  const detail = [...details.values()].map((r) => ({
    ...r,
    coverage: r.daily ? r.stock / r.daily : null,
  }));
  const groups = new Map();
  for (const r of detail) {
    if (!groups.has(r.id))
      groups.set(r.id, {
        id: r.id,
        label: r.label,
        sold: 0,
        stock: 0,
        target: 0,
        need: 0,
        daily: 0,
      });
    const g = groups.get(r.id);
    for (const k of ["sold", "stock", "target", "need", "daily"]) g[k] += r[k];
  }
  const rows = [...groups.values()].sort(
    (a, b) =>
      b.need - a.need || b.sold - a.sold || a.label.localeCompare(b.label),
  );
  return {
    rows,
    detail: detail.sort((a, b) => b.need - a.need),
    totals: rows.reduce(
      (t, r) => {
        for (const k of ["sold", "stock", "target", "need", "daily"])
          t[k] += r[k];
        return t;
      },
      { sold: 0, stock: 0, target: 0, need: 0, daily: 0 },
    ),
  };
}

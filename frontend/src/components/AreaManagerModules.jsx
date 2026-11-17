import { useEffect, useState } from "react";
import { BarChart, TrendChart } from "./ApexCharts.jsx";
import { stateEvolution, monthlySeries } from "../domain/live-analysis.js";
import { ExcelButton } from "./ExcelTable.jsx";

const qty = (n) => Number(n || 0).toLocaleString("fr-FR");
function Table({ headers, rows, exportable = true }) {
  const exported = headers
    .map((h, i) => (h === "Actions" ? -1 : i))
    .filter((i) => i >= 0);
  return (
    <section className="panel supply-request-table-panel">
      <div className="supply-module-heading">
        <h2>{exportable ? "Stock de mon réseau" : "Kits de mon réseau"}</h2>
        {exportable && (
          <ExcelButton
            title="Stock de mon réseau"
            headers={exported.map((i) => headers[i])}
            rows={rows.map((r) => exported.map((i) => r[i]))}
          />
        )}
      </div>
      <div className="supply-table-scroll">
        <table className="supply-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="supply-empty">
                  Aucune donnée pour votre réseau.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export default function AreaManagerModules({
  page,
  tab,
  data,
  search,
  loadKits,
  onPropose,
  onViewKits,
  productId,
  onClearProduct,
  saving,
}) {
  const [kits, setKits] = useState(null),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    if (page !== "" || tab !== "kits") return;
    const controller = new AbortController();
    setKits(null);
    setError("");
    setOffset(0);
    loadKits(controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setKits(r.kits);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [page, tab, data.manager.id, loadKits]);
  useEffect(() => setOffset(0), [search]);
  const match = (v) =>
    String(v || "")
      .toLocaleLowerCase("fr")
      .includes(search.toLocaleLowerCase("fr"));
  if (page === "activite") {
    if (!data.analysis) return <p>Aucun historique disponible.</p>;
    const stock = tab === "stock",
      status = stock ? "INSTOCK" : "DEPLOYED";
    const evolution = stateEvolution(data.analysis, status),
      products = monthlySeries(data.analysis, "product", status);
    return (
      <div className="live-analysis">
        <TrendChart
          title={
            stock ? "Évolution du stock de mon réseau" : "Ventes de mon réseau"
          }
          {...evolution}
          subtitle={`${data.analysis.window.start} — ${data.analysis.window.end}`}
          showValues={false}
          explanation={
            stock
              ? "Chaque point montre les kits disponibles dans votre réseau à la fin du mois. Les mois passés sont reconstitués à partir des historiques connus. Une réception locale ne modifie pas le stock Upya."
              : "Chaque point montre les kits nouvellement vendus par votre réseau pendant le mois. Plus la ligne monte, plus vous avez vendu."
          }
        />
        {!stock && (
          <BarChart
            title="Kits vendus par produit dans mon réseau"
            rows={products.ranking}
            unit="kits vendus"
            explanation="Chaque barre représente un type de kit vendu par votre réseau pendant les 90 derniers jours. Une barre plus longue indique plus de ventes."
          />
        )}
      </div>
    );
  }
  if (tab === "kits") {
    if (error)
      return (
        <p role="alert" className="supply-error">
          {error}
        </p>
      );
    if (!kits) return <p role="status">Chargement des kits de votre réseau…</p>;
    const rows = kits.filter(
      (k) =>
        (!productId || k.productReference === productId) &&
        match([k.serialNumber, k.productName, k.agentName].join(" ")),
    );
    return (
      <>
        {productId && (
          <button className="secondary-button" onClick={onClearProduct}>
            Voir tous les kits
          </button>
        )}
        <ExcelButton
          title="Liste complète des kits de mon réseau"
          headers={[
            "Identifiant / numéro de série",
            "Kit",
            "Détenteur",
            "Rôle de l’agent",
            "ID du DILE",
            "Nom du DILE",
          ]}
          rows={rows.map((k) => [
            k.serialNumber,
            k.productName,
            k.agentName || k.agentNumber || "",
            k.agentRole || "",
            k.dileNumber || "",
            k.dileName || "",
          ])}
        />
        <Table
          exportable={false}
          headers={["Identifiant / numéro de série", "Kit", "Détenteur"]}
          rows={rows
            .slice(offset, offset + 100)
            .map((k) => [
              k.serialNumber,
              k.productName,
              k.agentName || k.agentNumber || "Non renseigné",
            ])}
        />
        <div className="supply-actions">
          <button
            className="secondary-button"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 100))}
          >
            Précédent
          </button>
          <span>
            {rows.length ? offset + 1 : 0}–{Math.min(offset + 100, rows.length)}{" "}
            / {qty(rows.length)}
          </span>
          <button
            className="secondary-button"
            disabled={offset + 100 >= rows.length}
            onClick={() => setOffset(offset + 100)}
          >
            Suivant
          </button>
        </div>
      </>
    );
  }
  const holders = data.holders || [],
    byProduct = new Map();
  for (const r of holders) {
    if (!byProduct.has(r.productReference))
      byProduct.set(r.productReference, {
        name: r.productName,
        id: r.productReference,
        stock: 0,
      });
    byProduct.get(r.productReference).stock += Number(r.instock || 0);
  }
  if (tab === "holders")
    return (
      <Table
        headers={["Détenteur", "Kit", "Disponible"]}
        rows={holders
          .filter((r) => r.instock > 0 && match(r.label + " " + r.productName))
          .map((r) => [r.label, r.productName, qty(r.instock)])}
      />
    );
  const rows = [...byProduct.values()].filter(
    (r) => r.stock > 0 && match(r.name),
  );
  return (
    <>
      <BarChart
        title="Stock disponible dans mon réseau"
        rows={rows.map((r) => ({
          key: r.id,
          label: r.name,
          quantity: r.stock,
        }))}
        unit="kits disponibles"
        explanation="Chaque barre montre les kits neufs disponibles dans votre réseau pour un produit. Les accessoires, les retours et les kits déjà vendus sont exclus."
      />
      <Table
        headers={["Kit", "Disponible", "Besoin estimé", "Actions"]}
        rows={rows.map((r) => [
          r.name,
          qty(r.stock),
          qty(
            data.catalogue.estimates.find((e) => e.productId === r.id)
              ?.estimatedNeed,
          ),
          <div className="supply-inline-actions">
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => onViewKits(r.id)}
            >
              Voir les kits
            </button>
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() =>
                onPropose(
                  r.id,
                  Math.min(
                    100000,
                    Math.max(
                      1,
                      data.catalogue.estimates.find((e) => e.productId === r.id)
                        ?.estimatedNeed || 1,
                    ),
                  ),
                )
              }
            >
              Demander ce kit
            </button>
          </div>,
        ])}
      />
    </>
  );
}

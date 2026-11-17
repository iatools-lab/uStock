import { supplyTableColumns } from "./SupplyRequestsTables.jsx";

const qty = (n) => Number(n || 0).toLocaleString("fr-FR");
export default function AreaManagerNeeds({ data, search, saving, onPropose }) {
  const rows = data.catalogue.products
    .map((p) => ({
      ...p,
      ...(data.catalogue.estimates.find((e) => e.productId === p.id) || {
        stock: 0,
        estimatedNeed: 0,
      }),
    }))
    .filter((p) =>
      p.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")),
    )
    .sort(
      (a, b) =>
        b.estimatedNeed - a.estimatedNeed || a.name.localeCompare(b.name, "fr"),
    );
  return (
    <section className="panel supply-request-table-panel">
      <h2>Besoins estimés de mon réseau</h2>
      <p className="supply-estimation-note">
        Estimation sur les ventes des{" "}
        {data.catalogue.estimation?.observationDays || 90} derniers jours, pour
        90 jours de besoins et 14 jours de sécurité. Vous pouvez adapter la
        quantité proposée.
      </p>
      <div className="supply-table-scroll">
        <table className="supply-table">
          <thead>
            <tr>
              {supplyTableColumns.map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <small>{p.id}</small>
                </td>
                <td>{qty(p.stock)}</td>
                <td>{qty(p.estimatedNeed)}</td>
                <td>—</td>
                <td>—</td>
                <td>
                  {p.estimatedNeed > 0
                    ? "Besoin estimé"
                    : "Pas de besoin estimé"}
                </td>
                <td>
                  <button
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      onPropose(
                        p.id,
                        Math.min(100000, Math.max(1, p.estimatedNeed)),
                      )
                    }
                  >
                    Proposer
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="supply-empty">
                  Aucun produit pour cette recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

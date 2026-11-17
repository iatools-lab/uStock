import { Link } from "react-router-dom";
import { BarChart } from "./ApexCharts.jsx";
import { supplyStates } from "../domain/supply-navigation.js";

export default function SupplySummary({
  data,
  role,
  basePath,
  managerId,
  onOpen,
}) {
  const requests = data.requests || [],
    am = role === "am",
    supply = role === "supply";
  const link = (page, tab) =>
    `${basePath}${page ? "/" + page : ""}?${new URLSearchParams({ ...(am ? { managerId } : {}), ...(tab ? { tab } : {}) })}`;
  const actions = am
    ? [
        ["Déclarer un besoin", "besoins", "propose"],
        ["Confirmer une réception", "livraisons", "confirm"],
        ["Consulter mon stock", "", "products"],
      ]
    : supply
      ? [
          ["Traiter les demandes", "", "pending"],
          ["Préparer les kits", "preparation", "prepare"],
          ["Expédier les kits prêts", "preparation", "ready"],
        ]
      : [
          ["Vérifier les propositions", "", "verify"],
          ["Consulter le stock des AM", "stock", "managers"],
          ["Suivre les livraisons", "livraisons", "confirm"],
        ];
  const statuses = am
    ? ["PROPOSED", "SUBMITTED", "APPROVED", "PREPARED", "SHIPPED", "DISPUTED"]
    : supply
      ? ["SUBMITTED", "APPROVED", "PREPARED", "SHIPPED", "DISPUTED"]
      : [
          "PROPOSED",
          "SUBMITTED",
          "APPROVED",
          "PREPARED",
          "SHIPPED",
          "DISPUTED",
        ];
  const rows = statuses.map((status) => ({
    key: status,
    label: supplyStates[status],
    quantity: requests.filter((r) => r.status === status).length,
  }));
  const recent = [...requests]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 5);
  return (
    <div className="supply-summary">
      <BarChart
        title="Où en sont les demandes ?"
        rows={rows}
        unit="demandes"
        explanation="Chaque barre compte les demandes à une étape du circuit. Les demandes terminées ou annulées ne sont pas comptées ici. Les raccourcis vous permettent de passer à l’action."
      />
      <section className="panel supply-request-table-panel">
        <h2>Mes raccourcis</h2>
        <div className="supply-summary-shortcuts">
          {actions.map(([label, page, tab]) => (
            <Link key={label} className="secondary-button" to={link(page, tab)}>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <section className="panel supply-request-table-panel">
        <h2>Dernières demandes mises à jour</h2>
        <div className="supply-table-scroll">
          <table className="supply-table">
            <thead>
              <tr>
                <th>Référence</th>
                {!am && <th>Area manager</th>}
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.id.slice(0, 8).toUpperCase()}</td>
                  {!am && <td>{r.managerName}</td>}
                  <td>{supplyStates[r.status]}</td>
                  <td>
                    <button
                      className="secondary-button"
                      onClick={() => onOpen(r)}
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={am ? 3 : 4}>Aucune demande pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

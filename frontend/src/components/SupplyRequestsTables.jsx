import RequestActions from "./RequestActions.jsx";
import RequestExport from "./RequestExport.jsx";

export { supplyStates as requestStatusLabels } from "../domain/supply-navigation.js";
import { supplyStates as requestStatusLabels } from "../domain/supply-navigation.js";
export const supplyTableColumns = [
  "Kit",
  "En stock",
  "Besoin estimé",
  "Besoin proposé",
  "Besoin couvert",
  "Statut",
  "Actions",
];
export const managerEstimate = (data, managerId, productId) =>
  data.catalogue.estimates?.find(
    (row) => row.managerId === managerId && row.productId === productId,
  );
const quantity = (value) =>
  value == null ? "—" : Number(value).toLocaleString("fr-FR");

export default function SupplyRequestsTables({
  data,
  requests,
  role,
  onAction,
  saving,
  onOpen,
}) {
  const estimates = data.catalogue.estimation;
  return (
    <div className="supply-request-tables">
      {estimates && (
        <p className="supply-estimation-note">
          Estimation : ventes des {estimates.observationDays} derniers jours,
          pour {estimates.horizonDays} jours de besoins et{" "}
          {estimates.bufferDays} jours de sécurité. Le stock affiché est celui
          du réseau de l’Area manager.
        </p>
      )}
      {requests.length ? (
        requests.map((request) => (
          <section
            className="panel supply-request-table-panel"
            key={request.id}
          >
            <header className="supply-request-table-heading">
              <div>
                <h2>{request.managerName}</h2>
                <p>
                  {request.author} · besoin pour le{" "}
                  {request.neededOn.split("-").reverse().join("/")} ·{" "}
                  {request.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <RequestExport request={request} />
            </header>
            <div className="supply-table-scroll">
              <table className="supply-table">
                <thead>
                  <tr>
                    {supplyTableColumns.map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {request.lines.map((line) => {
                    const estimate = managerEstimate(
                      data,
                      request.managerId,
                      line.productId,
                    );
                    return (
                      <tr key={line.productId}>
                        <td>
                          <strong>{line.productName}</strong>
                          <small>{line.productId}</small>
                        </td>
                        <td>{quantity(estimate?.stock)}</td>
                        <td>{quantity(estimate?.estimatedNeed)}</td>
                        <td>
                          {quantity(line.requested)}
                          {request.transmittedAt && (
                            <small>
                              Proposition AM : {quantity(line.managerProposed)}{" "}
                              · vérifiée par {request.commercialActor}
                            </small>
                          )}
                        </td>
                        <td>
                          {["PROPOSED", "SUBMITTED"].includes(request.status)
                            ? "À définir"
                            : quantity(
                                [
                                  "APPROVED",
                                  "PREPARED",
                                  "SHIPPED",
                                  "RECEIVED",
                                  "DISPUTED",
                                  "RESOLVED",
                                ].includes(request.status)
                                  ? line.approved
                                  : 0,
                              )}
                        </td>
                        <td>
                          <span
                            className={`supply-status status-${request.status}`}
                          >
                            {requestStatusLabels[request.status]}
                          </span>
                        </td>
                        <td>
                          <RequestActions
                            request={request}
                            role={role}
                            saving={saving}
                            onAction={onAction}
                            onOpen={onOpen}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <section className="panel supply-request-table-panel">
          <div className="supply-table-scroll">
            <table className="supply-table">
              <thead>
                <tr>
                  {supplyTableColumns.map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="supply-empty">
                    Aucune demande pour cette sélection.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

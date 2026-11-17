import { ExcelButton } from "./ExcelTable.jsx";

const conditions = {
  PENDING: "À réceptionner",
  OK: "Bon état",
  DAMAGED: "Endommagé",
  MISSING: "Manquant",
};
export default function ShipmentDetails({ request }) {
  if (!request.shipment?.kits?.length) return null;
  const shipment = request.shipment,
    headers = ["Identifiant / numéro de série", "Kit", "État à réception"];
  const rows = shipment.kits.map((k) => [
    k.serialNumber,
    request.lines.find((l) => l.productId === k.productId)?.productName ||
      k.productId,
    conditions[k.condition] || "À réceptionner",
  ]);
  for (const serial of shipment.extraSerialNumbers || [])
    rows.push([serial, "Non prévu", "Supplémentaire"]);
  return (
    <section className="supply-shipment-details">
      <div className="supply-module-heading">
        <h3>Kits de la livraison</h3>
        <ExcelButton
          title={`Livraison ${request.id.slice(0, 8).toUpperCase()}`}
          headers={headers}
          rows={rows}
          metadata={[
            ["Area manager", request.managerName],
            ["Transporteur", shipment.carrier || ""],
            ["Référence d’expédition", shipment.tracking || ""],
          ]}
        />
      </div>
      {shipment.carrier && (
        <p>
          {shipment.carrier} · {shipment.tracking}
        </p>
      )}
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
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shipment.receivedBy && (
        <p>Réception confirmée par {shipment.receivedBy}.</p>
      )}
      {shipment.receiptNote && <p>{shipment.receiptNote}</p>}
      {shipment.resolutionNote && <p>Résolution : {shipment.resolutionNote}</p>}
    </section>
  );
}

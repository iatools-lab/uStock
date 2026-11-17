import { ExcelButton } from "./ExcelTable.jsx";
import { supplyStates } from "../domain/supply-navigation.js";

export default function RequestExport({ request }) {
  return (
    <ExcelButton
      iconOnly
      title={`Demande ${request.id.slice(0, 8).toUpperCase()}`}
      headers={[
        "Kit",
        "Référence produit",
        "Proposition AM",
        "Transmis par le commercial",
        "Validé",
        "Préparé",
        "Expédié",
        "Reçu",
        "Endommagé",
        "Statut",
      ]}
      rows={request.lines.map((l) => [
        l.productName,
        l.productId,
        l.managerProposed ?? l.requested,
        request.transmittedAt || request.origin === "LEGACY"
          ? l.requested
          : null,
        l.approved,
        l.prepared || 0,
        l.shipped || 0,
        l.received || 0,
        l.damaged || 0,
        supplyStates[request.status],
      ])}
      metadata={[
        ["Area manager", request.managerName],
        ["Auteur", request.author],
        ["Date souhaitée", request.neededOn],
        ["Commercial", request.commercialActor || ""],
        ["Entrepôt", request.warehouseName || ""],
        ["Transporteur", request.shipment?.carrier || ""],
        ["Expédition", request.shipment?.tracking || ""],
      ]}
    />
  );
}

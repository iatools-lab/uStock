import RequestActions from "./RequestActions.jsx";
import { useState } from "react";
import { supplyStates } from "../domain/supply-navigation.js";

const qty = (n) => Number(n || 0).toLocaleString("fr-FR");
const sum = (r, key) => r.lines.reduce((n, l) => n + (l[key] || 0), 0);
function Table({ headers, children, empty }) {
  return (
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
          {empty ? (
            <tr>
              <td colSpan={headers.length}>
                Aucune donnée pour cette sélection.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
function State({ value }) {
  return (
    <span className={`supply-status status-${value}`}>
      {supplyStates[value] || value}
    </span>
  );
}

export default function SupplyModules({
  page,
  tab,
  role,
  data,
  requests,
  onOperation,
  onOpen,
  onInboundAction,
  saving,
  search,
}) {
  const supply = role === "supply";
  const [place, setPlace] = useState("");
  const includes = (value) =>
    String(value || "")
      .toLocaleLowerCase("fr")
      .includes(search.toLocaleLowerCase("fr"));
  if (page === "stock") {
    if (!supply) {
      const rows = (data.catalogue.estimates || [])
        .map((e) => ({
          ...e,
          manager:
            data.catalogue.areaManagers.find((a) => a.id === e.managerId)
              ?.name || e.managerId,
          product:
            data.catalogue.products.find((p) => p.id === e.productId)?.name ||
            e.productId,
        }))
        .filter((r) => includes(`${r.manager} ${r.product}`));
      if (tab === "products") {
        const groups = new Map();
        for (const r of rows) {
          if (!groups.has(r.productId))
            groups.set(r.productId, { name: r.product, stock: 0, need: 0 });
          const g = groups.get(r.productId);
          g.stock += r.stock;
          g.need += r.estimatedNeed;
        }
        return (
          <section className="panel supply-request-table-panel">
            <h2>Stock du réseau par produit</h2>
            <Table
              headers={["Kit", "En stock", "Besoin estimé"]}
              empty={!groups.size}
            >
              {[...groups].map(([id, r]) => (
                <tr key={id}>
                  <td>{r.name}</td>
                  <td>{qty(r.stock)}</td>
                  <td>{qty(r.need)}</td>
                </tr>
              ))}
            </Table>
          </section>
        );
      }
      return (
        <section className="panel supply-request-table-panel">
          <h2>Stock des Area managers</h2>
          <Table
            headers={["Area manager", "Kit", "En stock", "Besoin estimé"]}
            empty={!rows.length}
          >
            {rows.map((r) => (
              <tr key={`${r.managerId}:${r.productId}`}>
                <td>{r.manager}</td>
                <td>{r.product}</td>
                <td>{qty(r.stock)}</td>
                <td>{qty(r.estimatedNeed)}</td>
              </tr>
            ))}
          </Table>
          <p className="supply-estimation-note">
            Le stock comprend les détenteurs rattachés au réseau de chaque Area
            manager.
          </p>
        </section>
      );
    }
    const pairs = new Map();
    for (const row of [...data.catalogue.stock, ...data.reservations])
      pairs.set(`${row.warehouseId}:${row.productId}`, {
        warehouseId: row.warehouseId,
        productId: row.productId,
      });
    const rows = [...pairs.values()]
      .map((row) => {
        const stock =
            data.catalogue.stock.find(
              (s) =>
                s.warehouseId === row.warehouseId &&
                s.productId === row.productId,
            )?.quantity || 0,
          reserved =
            data.reservations.find(
              (s) =>
                s.warehouseId === row.warehouseId &&
                s.productId === row.productId,
            )?.quantity || 0;
        return {
          ...row,
          stock,
          reserved,
          free: Math.max(0, stock - reserved),
          name:
            data.catalogue.products.find((p) => p.id === row.productId)?.name ||
            row.productId,
          warehouse:
            data.catalogue.warehouses.find((w) => w.id === row.warehouseId)
              ?.name || row.warehouseId,
        };
      })
      .filter(
        (r) =>
          (!place || r.warehouseId === place) &&
          includes(`${r.name} ${r.warehouse}`),
      );
    const displayed =
      tab === "reserved" ? rows.filter((r) => r.reserved > 0) : rows;
    if (tab === "products") {
      const groups = new Map();
      for (const r of displayed) {
        if (!groups.has(r.productId))
          groups.set(r.productId, {
            name: r.name,
            stock: 0,
            reserved: 0,
            free: 0,
          });
        const g = groups.get(r.productId);
        g.stock += r.stock;
        g.reserved += r.reserved;
        g.free += r.free;
      }
      return (
        <section className="panel supply-request-table-panel">
          <h2>Stock par produit</h2>
          <Table
            headers={["Kit", "Stock source", "Réservé", "Disponible"]}
            empty={!groups.size}
          >
            {[...groups].map(([id, r]) => (
              <tr key={id}>
                <td>{r.name}</td>
                <td>{qty(r.stock)}</td>
                <td>{qty(r.reserved)}</td>
                <td>{qty(r.free)}</td>
              </tr>
            ))}
          </Table>
        </section>
      );
    }
    return (
      <section className="panel supply-request-table-panel">
        <div className="supply-module-heading">
          <h2>
            {tab === "reserved"
              ? "Réservations en cours"
              : "Stock des entrepôts"}
          </h2>
          <select
            aria-label="Filtrer par entrepôt"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          >
            <option value="">Tous les entrepôts</option>
            {data.catalogue.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <Table
          headers={["Entrepôt", "Kit", "Stock source", "Réservé", "Disponible"]}
          empty={!displayed.length}
        >
          {displayed.map((r) => (
            <tr key={`${r.warehouseId}:${r.productId}`}>
              <td>{r.warehouse}</td>
              <td>{r.name}</td>
              <td>{qty(r.stock)}</td>
              <td>{qty(r.reserved)}</td>
              <td className={r.reserved > r.stock ? "supply-shortage" : ""}>
                {qty(r.free)}
              </td>
            </tr>
          ))}
        </Table>
        <p className="supply-estimation-note">
          Les kits expédiés restent déduits tant que leur retrait du stock
          source n’est pas constaté dans Upya.
        </p>
      </section>
    );
  }
  if (page === "plan") {
    if (tab === "inbound")
      return (
        <section className="panel supply-request-table-panel">
          <div className="supply-module-heading">
            <h2>Réceptions prévues</h2>
            <button
              className="supply-primary"
              onClick={() => onOperation("plan-inbound")}
              disabled={saving}
            >
              Prévoir une réception
            </button>
          </div>
          <Table
            headers={[
              "Entrepôt",
              "Kit",
              "Quantité",
              "Date prévue",
              "Référence",
              "État",
              "Actions",
            ]}
            empty={!(data.inbounds || []).length}
          >
            {(data.inbounds || [])
              .filter((r) =>
                includes(`${r.productName} ${r.warehouseName} ${r.reference}`),
              )
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.warehouseName}</td>
                  <td>{r.productName}</td>
                  <td>{qty(r.quantity)}</td>
                  <td>{r.expectedOn}</td>
                  <td>{r.reference}</td>
                  <td>
                    {
                      {
                        PLANNED: "Prévue",
                        ARRIVED: "Arrivée déclarée",
                        CANCELLED: "Annulée",
                      }[r.status]
                    }
                  </td>
                  <td>
                    {r.status === "PLANNED" && (
                      <div className="supply-inline-actions">
                        <button
                          className="secondary-button"
                          disabled={saving}
                          onClick={() => onInboundAction("arrive-inbound", r)}
                        >
                          Déclarer l’arrivée
                        </button>
                        <button
                          className="secondary-button"
                          disabled={saving}
                          onClick={() => onInboundAction("cancel-inbound", r)}
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </Table>
          <p className="supply-estimation-note">
            Une arrivée déclarée ne crée aucun kit en stock. Les kits doivent
            être enregistrés dans Upya pour devenir disponibles.
          </p>
        </section>
      );
    const gaps = new Map();
    for (const r of data.requests.filter((r) =>
      ["SUBMITTED", "APPROVED", "PREPARED"].includes(r.status),
    ))
      for (const l of r.lines) {
        const need = Math.max(0, l.requested - l.approved);
        if (!need) continue;
        if (!gaps.has(l.productId))
          gaps.set(l.productId, {
            name: l.productName,
            need: 0,
            managers: new Set(),
          });
        const g = gaps.get(l.productId);
        g.need += need;
        g.managers.add(r.managerName);
      }
    return (
      <section className="panel supply-request-table-panel">
        <h2>Besoins non couverts des demandes ouvertes</h2>
        <Table
          headers={["Kit", "Quantité non couverte", "Area managers concernés"]}
          empty={!gaps.size}
        >
          {[...gaps]
            .filter(([, r]) => includes(r.name))
            .map(([id, r]) => (
              <tr key={id}>
                <td>{r.name}</td>
                <td>{qty(r.need)}</td>
                <td>{[...r.managers].join(", ")}</td>
              </tr>
            ))}
        </Table>
      </section>
    );
  }
  return (
    <section className="panel supply-request-table-panel">
      <h2>
        {page === "preparation"
          ? "Préparation et expédition"
          : "Livraisons et réceptions"}
      </h2>
      <Table
        headers={[
          "Area manager",
          "Demandé",
          "Validé",
          "Préparé",
          "Expédié",
          "Reçu",
          "Statut",
          "Actions",
        ]}
        empty={!requests.length}
      >
        {requests.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.managerName}</strong>
              <small>
                {r.shipment?.carrier} {r.shipment?.tracking}
              </small>
            </td>
            <td>{qty(sum(r, "requested"))}</td>
            <td>{qty(sum(r, "approved"))}</td>
            <td>{qty(sum(r, "prepared"))}</td>
            <td>{qty(sum(r, "shipped"))}</td>
            <td>
              {r.shipment?.receivedAt ? qty(sum(r, "received")) : "—"}
              {r.shipment?.extraSerialNumbers?.length > 0 && (
                <small>
                  + {r.shipment.extraSerialNumbers.length} kit(s)
                  supplémentaire(s)
                </small>
              )}
            </td>
            <td>
              <State value={r.status} />
            </td>
            <td>
              <RequestActions
                request={r}
                role={role}
                saving={saving}
                onAction={onOperation}
                onOpen={onOpen}
              />
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

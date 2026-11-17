import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

export default function SupplyReviewForm({
  request,
  data,
  actor,
  onActor,
  warehouse,
  onWarehouse,
  approved,
  onApproved,
  note,
  onNote,
  saving,
  onSubmit,
}) {
  const [refusing, setRefusing] = useState(false);
  const lines = request.lines.map((line) => {
    const stock =
      data.catalogue.stock.find(
        (r) => r.warehouseId === warehouse && r.productId === line.productId,
      )?.quantity || 0;
    const reserved =
      data.reservations.find(
        (r) => r.warehouseId === warehouse && r.productId === line.productId,
      )?.quantity || 0;
    return { ...line, available: Math.max(0, stock - reserved) };
  });
  const hasQuantity = lines.some(
    (line) => Number(approved[line.productId]) > 0,
  );
  const base = { id: request.id, version: request.version, note };
  return (
    <form
      className="supply-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (refusing) {
          if (note.trim()) onSubmit({ ...base, action: "reject" });
          return;
        }
        onSubmit({
          ...base,
          note: "",
          action: "approve",
          warehouseId: warehouse,
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: Number(approved[line.productId] || 0),
          })),
        });
      }}
    >
      <div className="supply-form-grid">
        <label>
          Votre nom
          <input
            required
            maxLength={200}
            value={actor}
            onChange={(e) => onActor(e.target.value)}
            disabled={saving}
          />
        </label>
        <label>
          Entrepôt source
          <select
            required
            aria-label="Entrepôt source"
            value={warehouse}
            onChange={(e) => onWarehouse(e.target.value)}
            disabled={saving}
          >
            <option value="">Choisir un entrepôt</option>
            {data.catalogue.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="supply-review-quantities">
        {lines.map((line) => (
          <label key={line.productId}>
            <span>{line.productName}</span>
            <input
              required
              aria-label={`Quantité validée ${line.productName}`}
              type="number"
              min="0"
              max={Math.min(line.requested, line.available)}
              step="1"
              value={approved[line.productId] ?? 0}
              onChange={(e) =>
                onApproved({ ...approved, [line.productId]: e.target.value })
              }
              disabled={saving}
            />
            <small>
              Demandé : {line.requested} · Disponible : {line.available}
            </small>
          </label>
        ))}
      </div>
      {refusing && (
        <label className="supply-note">
          Motif du refus
          <textarea
            required
            maxLength={1000}
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Indiquez pourquoi la demande est refusée."
            disabled={saving}
          />
        </label>
      )}
      <div className="supply-detail-actions">
        {!refusing && (
          <button
            className="supply-primary"
            type="submit"
            disabled={saving || !actor.trim() || !warehouse || !hasQuantity}
          >
            <CheckCircle2 size={17} />
            {saving ? "Validation…" : "Valider les quantités"}
          </button>
        )}
        <button
          className="supply-reject"
          type="button"
          disabled={saving || !actor.trim() || (refusing && !note.trim())}
          onClick={() => {
            if (!refusing) {
              setRefusing(true);
              return;
            }
            onSubmit({ ...base, action: "reject" });
          }}
        >
          <XCircle size={17} />
          {refusing ? "Confirmer le refus" : "Refuser"}
        </button>
        {refusing && (
          <button
            type="button"
            className="secondary-button"
            disabled={saving}
            onClick={() => setRefusing(false)}
          >
            Retour
          </button>
        )}
      </div>
    </form>
  );
}

import { useState } from "react";

export default function CommercialVerificationForm({
  request,
  actor,
  onActor,
  saving,
  onSubmit,
}) {
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(request.lines.map((l) => [l.productId, l.requested])),
  );
  const [refusing, setRefusing] = useState(false),
    [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          action: refusing ? "reject-proposal" : "transmit",
          id: request.id,
          version: request.version,
          note,
          lines: request.lines.map((l) => ({
            productId: l.productId,
            quantity: Number(quantities[l.productId]),
          })),
        });
      }}
    >
      <p>
        <strong>{request.managerName}</strong> · besoin pour le{" "}
        {request.neededOn.split("-").reverse().join("/")}
      </p>
      {request.note && <p>{request.note}</p>}
      <label>
        Commercial
        <input
          required
          maxLength={200}
          value={actor}
          onChange={(e) => onActor(e.target.value)}
        />
      </label>
      {!refusing &&
        request.lines.map((l) => (
          <label className="supply-note" key={l.productId}>
            {l.productName}
            <small>
              Proposé par l’Area manager : {l.managerProposed ?? l.requested}
            </small>
            <input
              aria-label={`Quantité transmise ${l.productName}`}
              type="number"
              required
              min="1"
              max="100000"
              step="1"
              value={quantities[l.productId]}
              onChange={(e) =>
                setQuantities({ ...quantities, [l.productId]: e.target.value })
              }
            />
          </label>
        ))}
      {refusing && (
        <label className="supply-note">
          Motif du refus
          <textarea
            required
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      <div className="supply-detail-actions">
        <button
          className={refusing ? "supply-reject" : "supply-primary"}
          disabled={saving || !actor.trim() || (refusing && !note.trim())}
        >
          {refusing ? "Confirmer le refus" : "Transmettre à la supply chain"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={saving}
          onClick={() => setRefusing(!refusing)}
        >
          {refusing ? "Revenir aux quantités" : "Refuser la proposition"}
        </button>
      </div>
    </form>
  );
}

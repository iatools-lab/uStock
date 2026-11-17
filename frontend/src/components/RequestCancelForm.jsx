import { useState } from "react";

export default function RequestCancelForm({
  request,
  actor,
  onActor,
  saving,
  error,
  onSubmit,
}) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          action: "cancel",
          id: request.id,
          version: request.version,
          note,
        });
      }}
    >
      <p>
        <strong>{request.managerName}</strong> · demande{" "}
        {request.id.slice(0, 8).toUpperCase()}
      </p>
      {["APPROVED", "PREPARED"].includes(request.status) && (
        <p>Les kits réservés pour cette demande seront libérés.</p>
      )}
      {error && (
        <p role="alert" className="supply-error">
          {error}
        </p>
      )}
      <label>
        Votre nom
        <input
          required
          maxLength={200}
          value={actor}
          onChange={(e) => onActor(e.target.value)}
        />
      </label>
      <label className="supply-note">
        Motif d’annulation
        <textarea
          required
          maxLength={1000}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="supply-detail-actions">
        <button
          className="supply-reject"
          disabled={saving || !actor.trim() || !note.trim()}
        >
          Confirmer l’annulation
        </button>
      </div>
    </form>
  );
}

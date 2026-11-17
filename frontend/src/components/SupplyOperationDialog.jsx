import { useEffect, useState } from "react";
import RequestDialog from "./RequestDialog.jsx";

const titles = {
  prepare: "Préparer les kits",
  dispatch: "Enregistrer l’expédition",
  receive: "Confirmer la réception",
  resolve: "Résoudre un écart",
  "plan-inbound": "Prévoir une réception",
};
export default function SupplyOperationDialog({
  operation,
  role,
  data,
  actor,
  onActor,
  saving,
  onClose,
  onSubmit,
  loadKits,
}) {
  const { action, request } = operation;
  const [kitSearch, setKitSearch] = useState("");
  const [state, setState] = useState({}),
    [serials, setSerials] = useState([]),
    [conditions, setConditions] = useState(
      Object.fromEntries(
        (request?.shipment?.kits || []).map((k) => [k.serialNumber, "OK"]),
      ),
    ),
    [form, setForm] = useState({
      carrier: "",
      tracking: "",
      note: "",
      extra: "",
      warehouseId: "",
      productId: "",
      quantity: 1,
      expectedOn: "",
      reference: "",
      requestKey: crypto.randomUUID(),
    });
  useEffect(() => {
    if (action !== "prepare") return;
    const controller = new AbortController();
    setState({ loading: true });
    loadKits(request.id, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setState({ kits: r.kits });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState({ error: e.message });
      });
    return () => controller.abort();
  }, [action, request?.id]);
  const field = (name, value) =>
    setForm((previous) => ({ ...previous, [name]: value }));
  const kitSelectionOK =
    action !== "prepare" ||
    request.lines.every(
      (l) =>
        (state.kits || []).filter(
          (k) =>
            serials.includes(k.serialNumber) && k.productId === l.productId,
        ).length === l.approved,
    );
  function submit(e) {
    e.preventDefault();
    const body = {
      action,
      id: request?.id,
      version: request?.version,
      ...form,
    };
    if (action === "prepare") body.serialNumbers = serials;
    if (action === "receive") {
      body.kits = Object.entries(conditions).map(
        ([serialNumber, condition]) => ({ serialNumber, condition }),
      );
      body.extraSerialNumbers = form.extra
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (action === "plan-inbound") body.quantity = Number(form.quantity);
    onSubmit(body);
  }
  return (
    <RequestDialog title={titles[action]} busy={saving} onClose={onClose}>
      <form className="supply-operation-form" onSubmit={submit}>
        {request && (
          <p className="supply-detail-meta">
            {request.managerName} · {request.id.slice(0, 8).toUpperCase()}
          </p>
        )}
        {operation.error && (
          <p role="alert" className="supply-error">
            {operation.error}
          </p>
        )}
        <label>
          Votre nom
          <input
            required
            value={actor}
            maxLength={200}
            onChange={(e) => onActor(e.target.value)}
            disabled={saving}
          />
        </label>
        {action === "prepare" && (
          <>
            <label>
              Rechercher un identifiant
              <input
                value={kitSearch}
                onChange={(e) => setKitSearch(e.target.value)}
                placeholder="Scanner ou saisir un numéro de kit"
              />
            </label>
            {state.loading && (
              <p role="status">Lecture des kits disponibles…</p>
            )}
            {state.error && (
              <p role="alert" className="supply-error">
                {state.error}
              </p>
            )}
            {request.lines
              .filter((l) => l.approved > 0)
              .map((line) => (
                <fieldset key={line.productId} className="supply-kit-picker">
                  <legend>
                    {line.productName} ·{" "}
                    {
                      serials.filter((s) =>
                        (state.kits || []).some(
                          (k) =>
                            k.serialNumber === s &&
                            k.productId === line.productId,
                        ),
                      ).length
                    }
                    /{line.approved}
                  </legend>
                  <div>
                    {(state.kits || [])
                      .filter(
                        (k) =>
                          k.productId === line.productId &&
                          k.serialNumber
                            .toLowerCase()
                            .includes(kitSearch.trim().toLowerCase()),
                      )
                      .map((kit) => (
                        <label key={kit.serialNumber}>
                          <input
                            type="checkbox"
                            checked={serials.includes(kit.serialNumber)}
                            onChange={(e) =>
                              setSerials((old) =>
                                e.target.checked
                                  ? [...old, kit.serialNumber]
                                  : old.filter((s) => s !== kit.serialNumber),
                              )
                            }
                          />
                          <span>{kit.serialNumber}</span>
                        </label>
                      ))}
                  </div>
                </fieldset>
              ))}
          </>
        )}
        {action === "dispatch" && (
          <div className="supply-form-grid">
            <label>
              Transporteur
              <input
                required
                maxLength={200}
                value={form.carrier}
                onChange={(e) => field("carrier", e.target.value)}
              />
            </label>
            <label>
              Référence d’expédition
              <input
                required
                maxLength={200}
                value={form.tracking}
                onChange={(e) => field("tracking", e.target.value)}
              />
            </label>
          </div>
        )}
        {action === "receive" && (
          <>
            <div className="supply-table-scroll">
              <table className="supply-table">
                <thead>
                  <tr>
                    <th>Identifiant kit</th>
                    <th>État à la réception</th>
                  </tr>
                </thead>
                <tbody>
                  {request.shipment.kits.map((kit) => (
                    <tr key={kit.serialNumber}>
                      <td>{kit.serialNumber}</td>
                      <td>
                        <select
                          aria-label={`Réception ${kit.serialNumber}`}
                          value={conditions[kit.serialNumber]}
                          onChange={(e) =>
                            setConditions({
                              ...conditions,
                              [kit.serialNumber]: e.target.value,
                            })
                          }
                        >
                          <option value="OK">Reçu conforme</option>
                          <option value="DAMAGED">Reçu endommagé</option>
                          <option value="MISSING">Manquant</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label>
              Kits reçus en plus (identifiants)
              <textarea
                rows={2}
                value={form.extra}
                onChange={(e) => field("extra", e.target.value)}
                placeholder="Un identifiant par ligne"
              />
            </label>
          </>
        )}
        {action === "plan-inbound" && (
          <>
            <div className="supply-form-grid">
              <label>
                Entrepôt
                <select
                  required
                  value={form.warehouseId}
                  aria-label="Entrepôt"
                  onChange={(e) => field("warehouseId", e.target.value)}
                >
                  <option value="">Choisir</option>
                  {data.catalogue.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Produit
                <select
                  required
                  value={form.productId}
                  aria-label="Produit"
                  onChange={(e) => field("productId", e.target.value)}
                >
                  <option value="">Choisir</option>
                  {data.catalogue.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantité prévue
                <input
                  required
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => field("quantity", e.target.value)}
                />
              </label>
              <label>
                Date prévue
                <input
                  required
                  type="date"
                  value={form.expectedOn}
                  onChange={(e) => field("expectedOn", e.target.value)}
                />
              </label>
            </div>
            <label>
              Référence fournisseur
              <input
                required
                maxLength={200}
                value={form.reference}
                onChange={(e) => field("reference", e.target.value)}
              />
            </label>
          </>
        )}
        {["receive", "resolve"].includes(action) && (
          <label>
            Précisions{action === "resolve" ? " sur la résolution" : ""}
            <textarea
              required={action === "resolve"}
              rows={3}
              maxLength={1000}
              value={form.note}
              onChange={(e) => field("note", e.target.value)}
            />
          </label>
        )}
        {action === "resolve" && (
          <p className="supply-estimation-note">
            La résolution clôt le suivi ; les quantités et les écarts déclarés
            restent conservés.
          </p>
        )}
        <div className="supply-detail-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={saving}
            onClick={onClose}
          >
            Fermer
          </button>
          <button
            className="supply-primary"
            disabled={
              saving ||
              !actor.trim() ||
              !kitSelectionOK ||
              state.loading ||
              !!state.error
            }
          >
            {saving ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </form>
    </RequestDialog>
  );
}

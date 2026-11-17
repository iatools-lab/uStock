import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  PanelLeftOpen,
  PanelLeftClose,
  ClipboardList,
  Boxes,
  PackagePlus,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Truck,
} from "lucide-react";
import AreaManagerModules from "../components/AreaManagerModules.jsx";
import AreaManagerNeeds from "../components/AreaManagerNeeds.jsx";
import CommercialVerificationForm from "../components/CommercialVerificationForm.jsx";
import SupplySummary from "../components/SupplySummary.jsx";
import { supplyMetrics } from "../domain/supply-metrics.js";
import RequestActions from "../components/RequestActions.jsx";
import RequestExport from "../components/RequestExport.jsx";
import RequestCancelForm from "../components/RequestCancelForm.jsx";
import ShipmentDetails from "../components/ShipmentDetails.jsx";
import RequestDialog from "../components/RequestDialog.jsx";
import SupplyReviewForm from "../components/SupplyReviewForm.jsx";
import SupplyRequestsTables, {
  managerEstimate,
  supplyTableColumns,
} from "../components/SupplyRequestsTables.jsx";
import SupplyModules from "../components/SupplyModules.jsx";
import SupplyOperationDialog from "../components/SupplyOperationDialog.jsx";
import {
  supplyMenus,
  supplyStates,
  requestsForTab,
} from "../domain/supply-navigation.js";
import "../styles/supply-workspace.css";

const labels = supplyStates;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const when = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Douala",
  }).format(new Date(value));
const qty = (value) => Number(value || 0).toLocaleString("fr-FR");
async function api(role, body, signal, kitsFor, managerId, kits = false) {
  const response = await fetch(
    `/api/supply-requests?role=${role}${managerId ? "&managerId=" + encodeURIComponent(managerId) : ""}${kits ? "&kits=true" : ""}${kitsFor ? "&kitsFor=" + encodeURIComponent(kitsFor) : ""}`,
    {
      signal,
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Action indisponible.");
  return result;
}
function available(data, warehouseId, productId) {
  const stock =
    data.catalogue.stock.find(
      (r) => r.warehouseId === warehouseId && r.productId === productId,
    )?.quantity || 0;
  const reserved =
    data.reservations.find(
      (r) => r.warehouseId === warehouseId && r.productId === productId,
    )?.quantity || 0;
  return { stock, reserved, free: Math.max(0, stock - reserved) };
}
function defaultLines(request, data, warehouse) {
  return Object.fromEntries(
    request.lines.map((l) => [
      l.productId,
      Math.min(l.requested, available(data, warehouse, l.productId).free),
    ]),
  );
}

export default function SupplyWorkspace({ role }) {
  const navigate = useNavigate();
  const supply = role === "supply",
    am = role === "am";
  const { "*": menu = "" } = useParams();
  const [tabs, setTabs] = useSearchParams();
  const managerId = am ? tabs.get("managerId") || "" : "";
  const menus = supplyMenus[role],
    activeMenu = menus.find((m) => m.id === menu) || menus[0];
  const activeTab = activeMenu.tabs.some(([id]) => id === tabs.get("tab"))
    ? tabs.get("tab")
    : activeMenu.tabs[0]?.[0] || "";
  const basePath = am
    ? "/area-manager"
    : supply
      ? "/supply-chain"
      : "/commercial";
  const [operation, setOperation] = useState(null);
  useEffect(() => {
    setSelected(null);
    setOperation(null);
    setCreating(false);
    setSearch("");
    setMessage("");
    setError("");
  }, [menu, managerId]);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("upowa:sidebar:collapsed") === "true";
    } catch {
      return false;
    }
  });
  const toggleSidebar = () =>
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem("upowa:sidebar:collapsed", String(next));
      } catch {}
      return next;
    });
  const [state, setState] = useState({ loading: true }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(null),
    [creating, setCreating] = useState(false),
    [search, setSearch] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [actor, setActor] = useState(() => {
    try {
      return sessionStorage.getItem(`ustock:request-actor:${role}`) || "";
    } catch {
      return "";
    }
  });
  const [draft, setDraft] = useState(null),
    [warehouse, setWarehouse] = useState(""),
    [approved, setApproved] = useState({}),
    [reviewNote, setReviewNote] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => {
      const sameScope = !am || (previous.data?.manager?.id || "") === managerId;
      return {
        ...(sameScope ? previous : {}),
        loading: !sameScope || !previous.data,
        error: null,
      };
    });
    api(role, null, controller.signal, null, managerId)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: e.message,
          }));
      });
    return () => controller.abort();
  }, [role, revision, managerId, am]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && !saving) setRevision((r) => r + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [saving]);
  const data =
      am && (state.data?.manager?.id || "") !== managerId ? null : state.data,
    request = data?.requests?.find((r) => r.id === selected);
  function setName(value) {
    setActor(value);
    try {
      sessionStorage.setItem(`ustock:request-actor:${role}`, value);
    } catch {}
  }
  function openRequest(r) {
    setSelected(r.id);
    setCreating(false);
    setError("");
    setMessage("");
    setReviewNote("");
    const w = r.warehouseId || data.catalogue.warehouses[0]?.id || "";
    setWarehouse(w);
    setApproved(
      r.status === "SUBMITTED"
        ? defaultLines(r, data, w)
        : Object.fromEntries(r.lines.map((l) => [l.productId, l.approved])),
    );
  }
  function newRequest(productId = "", quantity = 1) {
    setSelected(null);
    setCreating(true);
    setError("");
    setMessage("");
    setDraft({
      requestKey: crypto.randomUUID(),
      managerId: am ? managerId : "",
      neededOn: today(),
      note: "",
      lines: [{ productId, quantity }],
    });
  }
  function requestAction(action, r) {
    setError("");
    setMessage("");
    if (action === "review") {
      openRequest(r);
      return;
    }
    setSelected(null);
    setCreating(false);
    if (action === "edit") {
      setDraft({
        id: r.id,
        version: r.version,
        managerId: r.managerId,
        neededOn: r.neededOn,
        note: r.note,
        lines: r.lines.map((l) => ({
          productId: l.productId,
          quantity: l.requested,
        })),
      });
      setCreating(true);
      return;
    }
    setOperation({ action, request: r });
  }
  async function submit(body) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api(
        role,
        { ...body, actor: actor.trim() },
        undefined,
        undefined,
        managerId,
      );
      setOperation(null);
      if (
        ["create", "update", "approve", "reject", "cancel"].includes(
          body.action,
        )
      )
        setSelected(result.id);
      else {
        setSelected(null);
        setOperation(null);
      }
      if (result.lines)
        setState((previous) =>
          previous.data
            ? {
                ...previous,
                data: {
                  ...previous.data,
                  requests: previous.data.requests.some(
                    (r) => r.id === result.id,
                  )
                    ? previous.data.requests.map((r) =>
                        r.id === result.id ? result : r,
                      )
                    : [result, ...previous.data.requests],
                },
              }
            : previous,
        );
      setCreating(false);
      if (am && body.action === "create") {
        if (activeMenu.id !== "besoins")
          navigate(
            `/area-manager/besoins?managerId=${encodeURIComponent(managerId)}&tab=current`,
          );
        else setTabs({ managerId, tab: "current" });
      }
      setMessage(
        {
          create: "Proposition envoyée au commercial.",
          update: "Proposition modifiée.",
          transmit: "Demande transmise à la supply chain.",
          "reject-proposal": "Proposition refusée.",
          approve:
            "Demande validée. Les quantités sont réservées dans l’application.",
          reject: "Demande refusée.",
          cancel: "Demande annulée.",
          prepare: "Les kits sont préparés.",
          dispatch: "Expédition enregistrée.",
          receive: "Réception enregistrée.",
          resolve: "Écart résolu.",
          "plan-inbound": "Réception planifiée.",
          "arrive-inbound":
            "Arrivée déclarée. Le stock reste celui enregistré dans Upya.",
          "cancel-inbound": "Réception prévue annulée.",
        }[body.action] || "Enregistrement effectué.",
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
      setOperation((previous) =>
        previous ? { ...previous, error: e.message } : previous,
      );
      setRevision((r) => r + 1);
    } finally {
      setSaving(false);
    }
  }
  const filtered = requestsForTab(
    data?.requests || [],
    role,
    activeMenu.id,
    activeTab,
  ).filter((r) =>
    `${r.managerName} ${r.author} ${r.id}`
      .toLocaleLowerCase("fr")
      .includes(search.toLocaleLowerCase("fr")),
  );
  const loadManagerKits = useCallback(
    (signal) => api("am", null, signal, null, managerId, true),
    [managerId],
  );
  const workspaceReady = data && !data.chooseManager;
  const kpis = supplyMetrics(data, role, activeMenu.id);
  return (
    <div
      className={`role-operations supply-workspace ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      <a className="skip-link" href="#supply-content">
        Aller au contenu
      </a>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Barre des menus">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={
              collapsed
                ? "Déplier la barre latérale"
                : "Réduire la barre latérale"
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
          <div className="sidebar__brand">
            <div className="brand" aria-label="upOwa">
              <span className="brand__up">up</span>
              <span className="brand__o">o</span>
              <span className="brand__wa">wa</span>
              <small className="brand__tagline">tracking des kits</small>
            </div>
          </div>
          <div className="sidebar__eyebrow">Approvisionnement</div>
          <nav
            className="sidebar__nav role-menu"
            aria-label="Menu des approvisionnements"
          >
            <Link className="nav-item" to="/directeur" title="Tableau de bord">
              <ArrowLeft size={19} />
              <span>Tableau de bord</span>
            </Link>
            {menus.map((item) => {
              const Icon =
                item.id === "dashboard"
                  ? LayoutDashboard
                  : item.id === "stock"
                    ? Boxes
                    : item.id === "plan"
                      ? PackagePlus
                      : item.id === "preparation" || item.id === "livraisons"
                        ? Truck
                        : ClipboardList;
              return (
                <NavLink
                  key={item.id}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "nav-item--active" : ""}`
                  }
                  to={`${basePath}${item.id ? "/" + item.id : ""}${am && managerId ? "?managerId=" + encodeURIComponent(managerId) : ""}`}
                  end
                  title={item.label}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar__bottom">
            <nav
              className="supply-role-switch"
              aria-label="Espaces approvisionnement"
            >
              <NavLink to="/area-manager/dashboard">Area manager</NavLink>
              <NavLink to="/commercial/dashboard">Commercial</NavLink>
              <NavLink to="/supply-chain/dashboard">Supply chain</NavLink>
            </nav>
            <div className="profile-card">
              <div className="avatar">{am ? "AM" : supply ? "SC" : "CO"}</div>
              <div>
                <strong>
                  {am ? "Area manager" : supply ? "Supply chain" : "Commercial"}
                </strong>
                <span>Approvisionnements</span>
              </div>
            </div>
          </div>
        </aside>
        <main id="supply-content" className="main-content" tabIndex={-1}>
          <header className="topbar supply-title">
            <div>
              <p className="page-kicker">
                {am
                  ? "Area manager"
                  : supply
                    ? "Supply chain"
                    : "Équipe commerciale"}
              </p>
              <h1>
                {am || activeMenu.id
                  ? activeMenu.label
                  : supply
                    ? "Demandes à approvisionner"
                    : "Besoins des Area managers"}
              </h1>
              <p className="page-subtitle">
                {am
                  ? data?.manager?.name ||
                    "Choisissez votre réseau pour commencer."
                  : supply
                    ? "Vérifiez le stock, ajustez les quantités, puis validez."
                    : "Vérifiez les propositions, puis transmettez les besoins."}
              </p>
            </div>
            <div className="supply-actions">
              <button
                className="secondary-button"
                onClick={() => setRevision((r) => r + 1)}
                disabled={saving}
              >
                <RefreshCw size={16} /> Actualiser
              </button>
              {am && activeMenu.id === "besoins" && workspaceReady && (
                <button
                  className="supply-primary"
                  onClick={() => newRequest()}
                  disabled={!data || saving}
                >
                  <Plus size={17} /> Nouvelle demande
                </button>
              )}
            </div>
          </header>

          {am && data && (
            <label className="supply-manager-selector">
              Mon Area manager
              <select
                aria-label="Mon Area manager"
                disabled={saving}
                value={managerId}
                onChange={(e) => {
                  setSelected(null);
                  setCreating(false);
                  setOperation(null);
                  setTabs(e.target.value ? { managerId: e.target.value } : {});
                }}
              >
                <option value="">Choisir mon réseau</option>
                {data.areaManagers?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {workspaceReady && (
            <div className="overview-kpis supply-kpis supply-kpis--four">
              {kpis.map(([label, value], index) => (
                <article
                  key={label}
                  className={`overview-metric ${index === 0 ? "overview-metric--primary" : ""}`}
                >
                  <div>
                    <span>{label}</span>
                    <Boxes size={19} />
                  </div>
                  <strong>{qty(value)}</strong>
                </article>
              ))}
            </div>
          )}
          {state.loading && (
            <p role="status">Chargement des demandes et du stock…</p>
          )}
          {state.error && (
            <p role="alert" className="supply-error">
              {state.error}
            </p>
          )}
          {error && !creating && (
            <p role="alert" className="supply-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="supply-success">
              {message}
            </p>
          )}
          {workspaceReady &&
            (activeMenu.id === "dashboard" ? (
              <SupplySummary
                data={data}
                role={role}
                basePath={basePath}
                managerId={managerId}
                onOpen={openRequest}
              />
            ) : (
              <>
                <div className="supply-search-toolbar">
                  <input
                    aria-label="Rechercher une demande"
                    placeholder="Area manager, commercial, référence…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div
                  className="decision-tabs supply-tabs"
                  role="tablist"
                  aria-label="Onglets du module"
                >
                  {activeMenu.tabs.map(([id, label]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={activeTab === id}
                      onClick={() =>
                        setTabs(am ? { tab: id, managerId } : { tab: id })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {am &&
                activeMenu.id === "besoins" &&
                activeTab === "propose" ? (
                  <AreaManagerNeeds
                    data={data}
                    search={search}
                    saving={saving}
                    onPropose={newRequest}
                  />
                ) : (!am && activeMenu.id === "") ||
                  (am && activeMenu.id === "besoins") ? (
                  <SupplyRequestsTables
                    data={data}
                    requests={filtered}
                    role={role}
                    onAction={requestAction}
                    saving={saving}
                    onOpen={openRequest}
                  />
                ) : am && activeMenu.id !== "livraisons" ? (
                  <AreaManagerModules
                    page={activeMenu.id}
                    tab={activeTab}
                    data={data}
                    search={search}
                    loadKits={loadManagerKits}
                    saving={saving}
                    onPropose={newRequest}
                    productId={tabs.get("productId")}
                    onViewKits={(productId) =>
                      setTabs({ managerId, tab: "kits", productId })
                    }
                    onClearProduct={() => setTabs({ managerId, tab: "kits" })}
                  />
                ) : (
                  <SupplyModules
                    key={activeMenu.id}
                    page={activeMenu.id}
                    tab={activeTab}
                    role={role}
                    data={data}
                    requests={filtered}
                    saving={saving}
                    search={search}
                    onOpen={openRequest}
                    onOperation={requestAction}
                    onInboundAction={(action, r) => {
                      if (!actor.trim()) {
                        setOperation({
                          action: "inbound-update",
                          inbound: r,
                          inboundAction: action,
                        });
                        return;
                      }
                      submit({ action, id: r.id, version: r.version });
                    }}
                  />
                )}
              </>
            ))}
        </main>
      </div>
      {operation &&
        !["inbound-update", "cancel"].includes(operation.action) && (
          <SupplyOperationDialog
            operation={operation}
            role={role}
            data={data}
            actor={actor}
            onActor={setName}
            saving={saving}
            onClose={() => setOperation(null)}
            onSubmit={submit}
            loadKits={(id, signal) => api(role, null, signal, id)}
          />
        )}
      {operation?.action === "cancel" && (
        <RequestDialog
          title="Annuler la demande"
          busy={saving}
          onClose={() => setOperation(null)}
        >
          <RequestCancelForm
            request={operation.request}
            actor={actor}
            onActor={setName}
            saving={saving}
            error={operation.error}
            onSubmit={submit}
          />
        </RequestDialog>
      )}
      {operation?.action === "inbound-update" && (
        <RequestDialog
          title="Confirmer la mise à jour"
          busy={saving}
          onClose={() => setOperation(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit({
                action: operation.inboundAction,
                id: operation.inbound.id,
                version: operation.inbound.version,
              });
            }}
          >
            <label>
              Votre nom
              <input
                required
                maxLength={200}
                value={actor}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="supply-detail-actions">
              <button
                className="supply-primary"
                disabled={saving || !actor.trim()}
              >
                Confirmer
              </button>
            </div>
          </form>
        </RequestDialog>
      )}
      {request && !creating && (
        <RequestDialog
          title="Traitement de la demande"
          busy={saving}
          onClose={() => setSelected(null)}
        >
          {error && (
            <p className="supply-error" role="alert">
              {error}
            </p>
          )}
          {role === "commercial" && request.status === "PROPOSED" ? (
            <CommercialVerificationForm
              key={request.id + ":" + request.version}
              request={request}
              actor={actor}
              onActor={setName}
              saving={saving}
              onSubmit={submit}
            />
          ) : supply && request.status === "SUBMITTED" ? (
            <SupplyReviewForm
              request={request}
              data={data}
              actor={actor}
              onActor={setName}
              warehouse={warehouse}
              onWarehouse={(value) => {
                setWarehouse(value);
                setApproved(defaultLines(request, data, value));
              }}
              approved={approved}
              onApproved={setApproved}
              note={reviewNote}
              onNote={setReviewNote}
              saving={saving}
              onSubmit={submit}
            />
          ) : (
            <>
              <label className="supply-dialog-author">
                Votre nom
                <input
                  value={actor}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                />
              </label>
              <section className="supply-detail">
                <>
                  <div className="supply-detail-title">
                    <div>
                      <p className="eyebrow">
                        Demande {request.id.slice(0, 8).toUpperCase()}
                      </p>
                      <h2>{request.managerName}</h2>
                    </div>
                    <span className={`supply-status status-${request.status}`}>
                      {labels[request.status]}
                    </span>
                  </div>
                  <div className="supply-detail-actions">
                    <RequestActions
                      request={request}
                      role={role}
                      saving={saving}
                      onAction={requestAction}
                      details={false}
                    />
                    <RequestExport request={request} />
                  </div>
                  <p className="supply-detail-meta">
                    Demandée par {request.author} · souhaitée le{" "}
                    {request.neededOn.split("-").reverse().join("/")}
                  </p>
                  {request.note && (
                    <p className="supply-request-note">{request.note}</p>
                  )}
                  {supply && request.status === "SUBMITTED" && (
                    <label className="supply-warehouse">
                      Entrepôt source
                      <select
                        aria-label="Entrepôt source"
                        value={warehouse}
                        onChange={(e) => {
                          setWarehouse(e.target.value);
                          setApproved(
                            defaultLines(request, data, e.target.value),
                          );
                        }}
                      >
                        <option value="">Choisir un entrepôt</option>
                        {data.catalogue.warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {request.warehouseName && (
                    <p>
                      Entrepôt retenu : <strong>{request.warehouseName}</strong>
                    </p>
                  )}
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
                          const stock = available(
                              data,
                              warehouse,
                              line.productId,
                            ),
                            estimate = managerEstimate(
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
                              <td>
                                {estimate == null ? "—" : qty(estimate.stock)}
                              </td>
                              <td>
                                {estimate == null
                                  ? "—"
                                  : qty(estimate.estimatedNeed)}
                              </td>
                              <td>
                                {qty(line.requested)}
                                {request.transmittedAt && (
                                  <small>
                                    Proposition AM : {qty(line.managerProposed)}{" "}
                                    · vérifiée par {request.commercialActor}
                                  </small>
                                )}
                              </td>
                              <td>
                                {supply && request.status === "SUBMITTED" ? (
                                  <>
                                    <input
                                      id={`covered-${line.productId}`}
                                      aria-label={`Quantité validée ${line.productName}`}
                                      type="number"
                                      min="0"
                                      max={Math.min(line.requested, stock.free)}
                                      step="1"
                                      value={approved[line.productId] ?? 0}
                                      onChange={(e) =>
                                        setApproved({
                                          ...approved,
                                          [line.productId]: e.target.value,
                                        })
                                      }
                                    />
                                    <small>
                                      Disponible dans l’entrepôt :{" "}
                                      {qty(stock.free)}
                                    </small>
                                  </>
                                ) : request.status === "SUBMITTED" ? (
                                  "À définir"
                                ) : (
                                  qty(
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
                                  )
                                )}
                              </td>
                              <td>
                                <span
                                  className={`supply-status status-${request.status}`}
                                >
                                  {labels[request.status]}
                                </span>
                              </td>
                              <td>
                                {supply && request.status === "SUBMITTED" ? (
                                  <button
                                    className="secondary-button"
                                    disabled={saving}
                                    onClick={() =>
                                      document
                                        .getElementById(
                                          `covered-${line.productId}`,
                                        )
                                        ?.focus()
                                    }
                                  >
                                    Ajuster
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {request.reviewNote && (
                    <p className="supply-request-note">
                      <strong>{request.reviewer} :</strong> {request.reviewNote}
                    </p>
                  )}
                  <ShipmentDetails request={request} />
                  <details className="supply-history">
                    <summary>Historique de la demande</summary>
                    {request.history.map((h, i) => (
                      <div key={i}>
                        <strong>
                          {labels[h.action]} · {h.actor}
                        </strong>
                        <small>{when(h.createdAt)}</small>
                        {h.note && <p>{h.note}</p>}
                      </div>
                    ))}
                  </details>
                </>
              </section>
            </>
          )}
        </RequestDialog>
      )}
      {creating && draft && (
        <RequestDialog
          title={
            draft.id ? "Modifier la proposition" : "Nouvelle demande de stock"
          }
          busy={saving}
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit({
                ...draft,
                action: draft.id ? "update" : "create",
                lines: draft.lines.map((l) => ({
                  ...l,
                  quantity: Number(l.quantity),
                })),
              });
            }}
          >
            {error && (
              <p className="supply-error" role="alert">
                {error}
              </p>
            )}
            <label className="supply-dialog-author">
              Votre nom
              <input
                required
                value={actor}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="Votre nom"
              />
            </label>
            <div className="supply-form-grid">
              <label>
                Area manager
                <select
                  required
                  value={draft.managerId}
                  disabled={am}
                  aria-label="Area manager"
                  onChange={(e) =>
                    setDraft({ ...draft, managerId: e.target.value })
                  }
                >
                  <option value="">Choisir un Area manager</option>
                  {data.catalogue.areaManagers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date souhaitée
                <input
                  type="date"
                  required
                  value={draft.neededOn}
                  onChange={(e) =>
                    setDraft({ ...draft, neededOn: e.target.value })
                  }
                />
              </label>
            </div>
            <h3>Kits nécessaires</h3>
            {draft.lines.map((line, i) => (
              <div className="supply-product-line" key={i}>
                <label>
                  Produit
                  <select
                    required
                    value={line.productId}
                    aria-label="Produit"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lines: draft.lines.map((l, j) =>
                          j === i ? { ...l, productId: e.target.value } : l,
                        ),
                      })
                    }
                  >
                    <option value="">Choisir un kit complet</option>
                    {data.catalogue.products
                      .filter(
                        (p) =>
                          p.id === line.productId ||
                          !draft.lines.some((l) => l.productId === p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Quantité
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lines: draft.lines.map((l, j) =>
                          j === i ? { ...l, quantity: e.target.value } : l,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="supply-icon-button"
                  aria-label={`Retirer le produit ${i + 1}`}
                  disabled={draft.lines.length === 1}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      lines: draft.lines.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary-button"
              disabled={draft.lines.length >= data.catalogue.products.length}
              onClick={() =>
                setDraft({
                  ...draft,
                  lines: [...draft.lines, { productId: "", quantity: 1 }],
                })
              }
            >
              <Plus size={15} /> Ajouter un produit
            </button>
            <label className="supply-note">
              Précisions
              <textarea
                maxLength={1000}
                rows={3}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="Priorité, opération prévue, point de livraison…"
              />
            </label>
            <div className="supply-detail-actions">
              <button
                className="supply-primary"
                disabled={saving || !actor.trim()}
              >
                <Send size={17} />
                {saving
                  ? "Enregistrement…"
                  : draft.id
                    ? "Enregistrer les modifications"
                    : "Envoyer au commercial"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCreating(false)}
                disabled={saving}
              >
                Fermer
              </button>
            </div>
          </form>
        </RequestDialog>
      )}
    </div>
  );
}

import WorkspaceFilters, {
  FilterToolbar,
} from "../components/WorkspaceFilters.jsx";
import "../styles/workspace-refinement.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { liveView } from "../domain/live-routing.js";
import { LiveNationalStock, LiveStockMap } from "./LiveDirectorViews.jsx";
import StrategicPerformance from "./StrategicPerformance.jsx";
import { LiveAnalytics, LiveForecast } from "./LiveAnalytics.jsx";
import RoleNavigation from "../navigation/RoleNavigation.jsx";
import {
  Boxes,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { MENUS, ROLE_ROUTES } from "../navigation/menus.js";
import { ProductChart, BarChart } from "../components/ApexCharts.jsx";
const ROLE_LABELS = { dg: "Pilotage du stock" };
import { loadSnapshot, quantity } from "../data/real-stock.js";
import "../styles/real-stock.css";
import KpiScope from "../components/KpiScope.jsx";
import SalesDownload from "../components/SalesDownload.jsx";
import KpiDownload from "../components/KpiDownload.jsx";
import HomeSalesCharts from "../components/HomeSalesCharts.jsx";
import { stockScope } from "../domain/stock-scope.js";
import "../styles/kpi-scope.css";

const text = (value) =>
  value == null || value === "" ? "Non renseigné" : String(value);
const date = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Douala",
      }).format(new Date(value))
    : "Non renseigné";
const todayInDouala = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const filterKeys = [
  "date",
  "startDate",
  "endDate",
  "granularity",
  "comparison",
  "product",
  "region",
  "zone",
  "department",
  "arrondissement",
  "amId",
  "shopId",
  "holderId",
  "holderKind",
  "status",
  "search",
];
export default function DataWorkspace() {
  const role = "dg";
  const { "*": menu = "" } = useParams();
  const [page, setPage] = useState(1),
    [retry, setRetry] = useState(0),
    [state, setState] = useState({ loading: true });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("upowa:sidebar:collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const snapshots = useRef(new Map());
  const [homeSales, setHomeSales] = useState({});
  const toggleSidebar = () => {
    const value = !collapsed;
    setCollapsed(value);
    try {
      localStorage.setItem("upowa:sidebar:collapsed", String(value));
    } catch {}
  };
  const menuLabel =
    MENUS[role].find((item) => item.path === menu)?.label || "Vue d’ensemble";
  const endpoint = "/api/local-stock";
  const view = liveView(role, menu);
  const [levels, setLevels] = useState({}),
    [days, setDays] = useState(90);
  const effectiveLevel =
    view === "map"
      ? "region"
      : view === "performance"
        ? "zone"
        : levels[view] || "zone";
  const setLevel = (value) =>
    setLevels((current) => ({ ...current, [view]: value }));
  const [params, setParams] = useSearchParams();
  const latestParams = useRef(params);
  useEffect(() => {
    latestParams.current = params;
  }, [params]);
  const filters = useMemo(
    () =>
      Object.fromEntries(filterKeys.map((key) => [key, params.get(key) || ""])),
    [params],
  );
  const setFilters = (update) => {
    const current = Object.fromEntries(
      filterKeys.map((key) => [key, latestParams.current.get(key) || ""]),
    );
    const next = typeof update === "function" ? update(current) : update;
    const query = new URLSearchParams(latestParams.current);
    for (const key of filterKeys) {
      if (next[key]) query.set(key, next[key]);
      else query.delete(key);
    }
    latestParams.current = query;
    setParams(query);
  };
  const updateFilters = (patch) => {
    setPage(1);
    const datesChanged = ["date", "startDate", "endDate"].some(
      (key) => key in patch,
    );
    setFilters((current) => ({
      ...current,
      ...patch,
      ...(datesChanged ? { granularity: "auto" } : {}),
    }));
  };
  useEffect(() => {
    setPage(1);
  }, [menu, view]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const key = JSON.stringify([view, effectiveLevel, days, filters]);
    const cached = snapshots.current.get(key);
    setState(
      cached && Date.now() - cached.at < 60000
        ? { data: cached.data, refreshing: true }
        : { loading: true },
    );
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const data = await loadSnapshot(endpoint, {
          role,
          page: 1,
          filters: filters,
          view,
          level: effectiveLevel,
          days,
          section: view === "overview" ? "summary" : undefined,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          snapshots.current.set(key, { data, at: Date.now() });
          while (snapshots.current.size > 12)
            snapshots.current.delete(snapshots.current.keys().next().value);
          setState({ data });
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) =>
            previous.data
              ? { ...previous, refreshing: false, refreshError: error.message }
              : { error: error.message },
          );
      } finally {
        pending = false;
      }
    }
    const initial = setTimeout(refresh, filters.search ? 300 : 0);
    const timer = setInterval(refresh, 60000);
    const onFocus = () => {
      if (!document.hidden) refresh();
    };
    const onSelection = (event) => {
      if (event.key === "ustock:analysis-revision") {
        snapshots.current.clear();
        setRetry((n) => n + 1);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("storage", onSelection);
    return () => {
      controller.abort();
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("storage", onSelection);
    };
  }, [role, page, retry, filters, view, effectiveLevel, days]);
  useEffect(() => {
    if (view !== "overview" || !state.data?.scope.authorized) return;
    const controller = new AbortController();
    const revision = state.data.selection.revision;
    const key = JSON.stringify([filters, revision]);
    setHomeSales((previous) =>
      previous.key === key
        ? { ...previous, loading: true, error: null }
        : { key, loading: true },
    );
    loadSnapshot(endpoint, {
      role,
      page: 1,
      filters,
      view,
      level: effectiveLevel,
      days,
      section: "analysis",
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.selection.revision !== revision) {
          setRetry((n) => n + 1);
          return;
        }
        setHomeSales({ key, data: result.analysis });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setHomeSales({ key, error: error.message });
      });
    return () => controller.abort();
  }, [
    view,
    filters,
    effectiveLevel,
    days,
    state.data?.scope.authorized,
    state.data?.selection.revision,
    state.data?.queriedAt,
    retry,
  ]);
  const choosePeriod = (kind) => {
    const end = todayInDouala(),
      year = Number(end.slice(0, 4)),
      month = Number(end.slice(5, 7));
    const first =
      kind === "month"
        ? month
        : kind === "quarter"
          ? Math.floor((month - 1) / 3) * 3 + 1
          : kind === "semester"
            ? Math.floor((month - 1) / 6) * 6 + 1
            : 1;
    updateFilters({
      date: "",
      startDate:
        kind === "all" ? "" : `${year}-${String(first).padStart(2, "0")}-01`,
      endDate: kind === "all" ? "" : end,
    });
  };
  const data = state.data;
  const scopeFilters = ["forecast", "performance"].includes(view)
    ? { ...filters, status: "" }
    : filters;
  const scope = stockScope(scopeFilters, data?.options);
  const filterData = useRef(null);
  if (data) filterData.current = data;
  if (!view) return <Navigate to={ROLE_ROUTES[role]} replace />;
  return (
    <div
      className={`role-operations role-${role} ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      <a className="skip-link" href="#dashboard">
        Aller au contenu
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={
              collapsed
                ? "Déplier la barre latérale"
                : "Réduire la barre latérale"
            }
            title={
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
          <div className="sidebar__eyebrow">Pilotage</div>
          <RoleNavigation role={role} />
          <div className="sidebar__bottom">
            <div className="profile-card">
              <div className="avatar">ST</div>
              <div>
                <strong>{ROLE_LABELS[role]}</strong>
                <span>{scope.title}</span>
              </div>
            </div>
          </div>
        </aside>
        <main id="dashboard" className="main-content" tabIndex={-1}>
          <header className="topbar">
            <div>
              <p className="page-kicker">{ROLE_LABELS[role]}</p>
              <h1>{menuLabel}</h1>
            </div>
            <Link className="secondary-button" to="/commercial">
              Demandes de stock
            </Link>
            <FilterToolbar
              filters={filters}
              open={filtersOpen}
              onToggle={() => setFiltersOpen((v) => !v)}
              onRefresh={() => setRetry((n) => n + 1)}
            />
          </header>
          <div
            className={`${view === "overview" ? "overview" : "commercial-content"} live-stock`}
            data-live-view={view}
          >
            <p className="sr-only">
              Lecture directe de PostgreSQL distant · actualisation toutes les
              60 secondes.
            </p>
            <WorkspaceFilters
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              filters={filters}
              data={data || filterData.current}
              view={view}
              onChange={updateFilters}
              onReset={() => {
                setPage(1);
                setFilters({});
              }}
              onPeriod={choosePeriod}
              today={
                data?.today || filterData.current?.today || todayInDouala()
              }
            />
            {state.refreshError && (
              <p role="status">
                Actualisation indisponible. Les dernières données chargées
                restent affichées.
              </p>
            )}
            {state.loading && <p role="status">Chargement des données…</p>}
            {state.error && (
              <section className="panel" role="alert">
                <h2>Données réelles indisponibles</h2>
                <p>{state.error}</p>
                <p>
                  La connexion à la base distante est indisponible. Réessayez
                  dans quelques instants.
                </p>
                <button onClick={() => setRetry((n) => n + 1)}>
                  Réessayer
                </button>
              </section>
            )}
            {data && !data.scope.authorized && (
              <section className="panel" role="alert">
                <h2>Périmètre non accessible</h2>
                <p>
                  Votre affectation doit être confirmée par la source de
                  données.
                </p>
              </section>
            )}
            {data?.scope.authorized && (
              <>
                <>
                  {view === "overview" && (
                    <>
                      <KpiScope filters={filters} options={data.options} />
                      <section
                        className="overview-kpis"
                        aria-label="Indicateurs réels"
                      >
                        {[
                          ["total", scope.title, Boxes],
                          ["instock", "Kits disponibles", PackageCheck],
                          [
                            "deployed",
                            data.period?.start
                              ? "Vendus sur la période"
                              : "Équipements déployés / vendus",
                            CheckCircle2,
                          ],
                          [
                            "defective",
                            data.period?.start
                              ? "Défauts sur la période"
                              : "Stock défectueux",
                            AlertTriangle,
                          ],
                        ].map(([key, label, Icon], index) => (
                          <article
                            key={key}
                            className={`overview-metric ${index === 0 ? "overview-metric--primary" : ""}`}
                          >
                            <div>
                              <span>
                                {label}
                                {key === "deployed" && (
                                  <SalesDownload
                                    data={data}
                                    filters={filters}
                                    expectedCount={data.metrics.deployed.value}
                                  />
                                )}
                                {key !== "deployed" && (
                                  <KpiDownload
                                    data={data}
                                    filters={filters}
                                    metric={key}
                                    count={data.metrics[key].value}
                                    title={label}
                                  />
                                )}
                              </span>
                              <Icon size={19} />
                            </div>
                            <strong>
                              {data.metrics[key].value == null
                                ? "—"
                                : quantity(data.metrics[key].value)}
                            </strong>
                          </article>
                        ))}
                      </section>
                      {homeSales.loading && !homeSales.data && (
                        <p role="status">Chargement des courbes de ventes…</p>
                      )}
                      {homeSales.error && (
                        <p role="alert">
                          Courbes de ventes indisponibles.{" "}
                          <button onClick={() => setRetry((n) => n + 1)}>
                            Réessayer
                          </button>
                        </p>
                      )}
                      <HomeSalesCharts
                        analysis={
                          homeSales.key ===
                          JSON.stringify([filters, data.selection.revision])
                            ? homeSales.data
                            : null
                        }
                      />

                      <div className="overview-distribution">
                        <BarChart
                          title="Kits défectueux par produit"
                          rows={data.products
                            .map((row) => ({
                              key: row.key,
                              label: row.label,
                              quantity: Number(row.defective || 0),
                            }))
                            .filter((row) => row.quantity > 0)
                            .sort((a, b) => b.quantity - a.quantity)}
                          unit="kits défectueux"
                          explanation="Chaque barre montre le nombre de kits défectueux d’un produit pour les filtres choisis. Plus elle est longue, plus ce produit compte de kits défectueux. Les accessoires sont exclus."
                        />
                        <BarChart
                          title="Stock par produit"
                          rows={data.products
                            .map((row) => ({
                              key: row.key,
                              label: row.label,
                              quantity: Number(row.instock || 0),
                            }))
                            .filter((row) => row.quantity > 0)
                            .sort((a, b) => b.quantity - a.quantity)}
                          unit="kits disponibles"
                          explanation="Chaque barre montre le nombre de kits disponibles pour un produit, selon les filtres choisis. Plus elle est longue, plus ce produit est disponible en stock. Les accessoires et les kits exclus du stock neuf ne sont pas comptés. Agrandissez pour voir tous les produits."
                        />
                      </div>
                      <ProductChart
                        rows={chartProducts(data.products)}
                        title="Parc analysé par produit"
                        unit="équipements"
                      />
                    </>
                  )}
                  {view === "stock" && (
                    <LiveNationalStock
                      data={data}
                      level={effectiveLevel}
                      onLevel={setLevel}
                      filters={filters}
                      onFilter={updateFilters}
                    />
                  )}
                  {view === "map" && (
                    <LiveStockMap
                      data={data}
                      filters={filters}
                      onFilter={updateFilters}
                    />
                  )}
                  {view === "performance" && (
                    <StrategicPerformance
                      data={data}
                      filters={scopeFilters}
                      comparison={filters.comparison}
                      onComparison={(comparison) =>
                        updateFilters({ comparison })
                      }
                    />
                  )}
                  {view === "forecast" && (
                    <LiveForecast data={data} filters={scopeFilters} />
                  )}
                  {view === "analytics" && (
                    <LiveAnalytics data={data} filters={filters} />
                  )}
                </>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
function chartProducts(rows) {
  return rows.map((row) => ({
    id: row.key,
    name: row.label,
    active: Number(row.quantity),
  }));
}

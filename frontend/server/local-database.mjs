import pg from "pg";
import { queryStock } from "./queries/stock-query.mjs";
import { loadStockContext } from "./queries/territory-context.mjs";
import { openSelectionStore } from "./analysis-selection.mjs";
import {
  querySelection,
  countSelectionKeys,
} from "./queries/analysis-selection.mjs";
import { readFileSync, statSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  connection,
  parseConfig,
  settings,
} from "../../backend/scripts/bi/config.mjs";
import { createSnapshotCache, snapshotKey } from "./snapshot-cache.mjs";
import { reportDatabaseFailure } from "./database-diagnostics.mjs";
import { querySalesExport } from "./queries/sales-export.mjs";
import { createReadQueryCache } from "./read-query-cache.mjs";
import { openSupplyStore, SupplyError } from "./supply-store.mjs";
import { registerSupplyRoutes } from "./supply-routes.mjs";
import { assertSupplyAction } from "./supply-access.mjs";
import {
  querySupplyProducts,
  supplyStock,
  supplyEstimates,
  querySupplyKits,
} from "./queries/supply-catalogue.mjs";

export function configuration(overrides = {}) {
  let existing = {},
    local = {};
  // Les accès distants restent côté serveur ; TARGET_DB_* concerne seulement l'import local.
  try {
    existing = parseConfig(
      readFileSync(new URL("../../backend/.env", import.meta.url), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    local = parseEnv(
      readFileSync(new URL("../.env.local", import.meta.url), "utf8"),
    );
  } catch {}
  const e = { ...existing, ...local, ...process.env, ...overrides };
  const url = e.UKIT_DATABASE_URL || e.SOURCE_DATABASE_URL;
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("URL PostgreSQL distante invalide");
    }
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error("URL PostgreSQL distante invalide");
    Object.assign(e, {
      SOURCE_DB_HOST: parsed.hostname,
      SOURCE_DB_PORT: parsed.port || "5432",
      SOURCE_DB_DATABASE: decodeURIComponent(parsed.pathname.slice(1)),
      SOURCE_DB_USER: decodeURIComponent(parsed.username),
      SOURCE_DB_PASSWORD: decodeURIComponent(parsed.password),
      SOURCE_DB_SSLMODE:
        parsed.searchParams.get("sslmode") || e.SOURCE_DB_SSLMODE || "require",
    });
  }
  return {
    ...connection(e, "source"),
    max: 4,
    keepAlive: true,
    application_name: "ukit-dashboard",
    options:
      "-c default_transaction_read_only=on -c statement_timeout=30000 -c jit=off",
  };
}
export function createLocalDatabase({ selectionStore, supplyStore } = {}) {
  const selection = selectionStore || openSelectionStore();
  const pool = new pg.Pool(configuration());
  pool.on("error", (error) => reportDatabaseFailure("pool", error));
  pool.on("connect", (client) => client.on("error", () => {}));
  const ttl = Number(settings().UKIT_CACHE_TTL_SECONDS ?? 60);
  if (!Number.isFinite(ttl) || ttl < 0 || ttl > 3600)
    throw new Error("INVALID_CACHE_TTL");
  const cache = createSnapshotCache({ ttl: ttl * 1000 });
  // Le referentiel ne contient pas de selection utilisateur ; il reste en memoire.
  const contexts = createSnapshotCache({
    ttl: Math.min(ttl, 60) * 1000,
    maxEntries: 4,
    clone: false,
  });
  const queries = createReadQueryCache({
    ttl: Math.min(ttl, 60) * 1000,
    maxEntries: 100,
    maxBytes: 32 * 1024 * 1024,
  });
  let context;
  const contextProvider = (c, date, identity) =>
    contexts.get(JSON.stringify([context, date, identity.loaded]), () =>
      loadStockContext(c, date),
    );
  async function snapshot(params) {
    params = new URLSearchParams(params);
    // Ces ecrans utilisent exactement les memes agregats, sans courbes temporelles.
    if (
      params.get("view") === "map" ||
      (params.get("view") === "overview" && params.get("section") === "summary")
    ) {
      params.set("view", "stock");
      params.delete("section");
    }
    const rules = selection.read();
    const file = statSync(
      new URL("./Agents_Terrain_Uniformises.xlsx", import.meta.url),
    );
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const reference = `${file.mtimeMs}:${file.size}`,
      current = JSON.stringify([rules.revision, reference, date]);
    if (context !== current) {
      cache.clear();
      contexts.clear();
      queries.clear();
      context = current;
    }
    const key = snapshotKey(params, {
      revision: rules.revision,
      reference,
      date,
    });
    return cache.get(key, () =>
      readSnapshot(new URLSearchParams(params), rules),
    );
  }
  async function readSnapshot(params, rules, { fresh = false } = {}) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const data = await queryStock(
        fresh ? c : queries.reader(c, context),
        params,
        rules,
        {
          contextProvider,
        },
      );
      await c.query("COMMIT");
      return data;
    } catch (error) {
      await c.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
  async function administration(params) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const data = await querySelection(c, params, selection.read());
      await c.query("COMMIT");
      return data;
    } catch (error) {
      await c.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
  async function saveSelection(body) {
    if (
      !body ||
      !["asset", "product"].includes(body.kind) ||
      !Array.isArray(body.keys) ||
      body.keys.length < 1 ||
      body.keys.length > 5000 ||
      body.keys.some(
        (key) => typeof key !== "string" || !key.trim() || key.length > 200,
      ) ||
      ![true, false, null].includes(body.included) ||
      typeof (body.reason ?? "") !== "string" ||
      (body.reason?.length || 0) > 500
    )
      throw new Error("INVALID_SELECTION");
    if (body.included !== null) {
      const count = await countSelectionKeys(pool, body.kind, body.keys);
      if (count !== new Set(body.keys).size)
        throw new Error("INVALID_UNKNOWN_EQUIPMENT");
    }
    const result = selection.save(body);
    cache.clear();
    queries.clear();
    return result;
  }
  async function exportSales(params) {
    const rules = selection.read();
    if (
      params.has("revision") &&
      Number(params.get("revision")) !== rules.revision
    )
      throw new Error("EXPORT_STALE_SELECTION");
    const c = await pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const data =
        params.get("exportDetails") === "true"
          ? params.get("adminExport") === "true"
            ? await querySelection(c, params, rules)
            : await queryStock(c, params, rules, { contextProvider })
          : await querySalesExport(c, params, rules);
      if (data.total > 1048575) throw new Error("EXPORT_TOO_LARGE");
      if (
        params.has("expectedCount") &&
        (!Number.isSafeInteger(Number(params.get("expectedCount"))) ||
          Number(params.get("expectedCount")) < 0)
      )
        throw new Error("INVALID_COUNT");
      if (
        selection.read().revision !== rules.revision ||
        (params.has("expectedCount") &&
          Number(params.get("expectedCount")) !== data.total)
      )
        throw new Error("EXPORT_STALE_SELECTION");
      await c.query("COMMIT");
      return data;
    } catch (error) {
      await c.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
  let requests = supplyStore;
  const requestStore = () => (requests ||= openSupplyStore());
  async function supplyCatalogue(fresh = false) {
    const params = new URLSearchParams({
      role: "dg",
      view: "stock",
      status: "INSTOCK",
      level: "holderId",
      holderKind: "central",
    });
    const rules = selection.read();
    const stock = fresh
      ? await readSnapshot(params, rules, { fresh: true })
      : await snapshot(params);
    const catalogue = {
      ...supplyStock(stock),
      products: await querySupplyProducts(pool, rules),
      selectionRevision: rules.revision,
    };
    if (selection.read().revision !== rules.revision)
      throw new SupplyError(
        "Le périmètre des produits a changé. Actualisez.",
        409,
      );
    return catalogue;
  }
  async function supplyWorkspace() {
    const catalogue = await supplyCatalogue();
    const forecast = await snapshot(
      new URLSearchParams({
        role: "dg",
        view: "forecast",
        level: "amId",
        days: "90",
      }),
    );
    if (forecast.selection.revision !== catalogue.selectionRevision)
      throw new SupplyError(
        "Les produits retenus ont changé. Actualisez.",
        409,
      );
    Object.assign(
      catalogue,
      supplyEstimates(forecast.analysis, catalogue.areaManagers),
    );
    const shipped = requestStore()
      .list()
      .filter((r) =>
        ["SHIPPED", "RECEIVED", "DISPUTED", "RESOLVED"].includes(r.status),
      );
    if (shipped.length) {
      const candidates = await querySupplyKits(
        pool,
        selection.read(),
        [...new Set(shipped.map((r) => r.warehouseId))],
        [...new Set(shipped.flatMap((r) => r.lines.map((l) => l.productId)))],
      );
      requestStore().reconcileSource(
        candidates,
        shipped.map((r) => r.id),
      );
    }
    return {
      catalogue,
      reservations: requestStore().reservations(),
      requests: requestStore().list(),
      inbounds: requestStore().inbounds(),
    };
  }
  async function supplyKitOptions(id) {
    const r = requestStore()
      .list()
      .find((r) => r.id === id);
    if (!r) throw new SupplyError("Demande introuvable.", 404);
    const candidates = await querySupplyKits(
      pool,
      selection.read(),
      [r.warehouseId],
      r.lines.map((l) => l.productId),
    );
    const allocated = requestStore().allocatedSerials();
    return {
      kits: candidates.filter(
        (k) =>
          !allocated.some(
            (a) => a.serialNumber === k.serialNumber && a.requestId !== id,
          ),
      ),
    };
  }
  async function areaManagerWorkspace(managerId, { kits = false } = {}) {
    const catalogue = await supplyCatalogue();
    if (!managerId)
      return { areaManagers: catalogue.areaManagers, chooseManager: true };
    const manager = catalogue.areaManagers.find((m) => m.id === managerId);
    if (!manager) throw new SupplyError("Area manager inconnu.", 404);
    const end = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const start = new Date(Date.parse(end) - 89 * 86400000)
      .toISOString()
      .slice(0, 10);
    const params = new URLSearchParams({
      role: "dg",
      view: "analytics",
      level: "holderId",
      amId: managerId,
      startDate: start,
      endDate: end,
    });
    if (kits) {
      params.set("exportDetails", "true");
      params.set("status", "INSTOCK");
      const result = await snapshot(params);
      return {
        kits: result.rows.filter(
          (r) => r.status === "INSTOCK" && r.areaManagerNumber === managerId,
        ),
      };
    }
    const scoped = await snapshot(params);
    if (scoped.selection.revision !== catalogue.selectionRevision)
      throw new SupplyError("Le périmètre a changé. Actualisez.", 409);
    return {
      manager,
      areaManagers: catalogue.areaManagers,
      catalogue: {
        products: catalogue.products,
        areaManagers: [manager],
        warehouses: [],
        stock: [],
        ...supplyEstimates(scoped.analysis, [manager]),
      },
      requests: requestStore()
        .list()
        .filter((r) => r.managerId === managerId),
      reservations: [],
      inbounds: [],
      metrics: scoped.metrics,
      products: scoped.products,
      holders: scoped.territories.rows,
      analysis: scoped.analysis,
    };
  }
  async function supplyAction(body, role, managerId) {
    assertSupplyAction(requestStore(), body, role, managerId);
    if (role === "am") {
      const catalogue = await supplyCatalogue();
      if (!catalogue.areaManagers.some((m) => m.id === managerId))
        throw new SupplyError("Area manager inconnu.", 404);
      if (body.action === "create")
        return requestStore().create(body, catalogue, { proposed: true });
      if (body.action === "update")
        return requestStore().update(body, catalogue);
    }
    if (["transmit", "reject-proposal"].includes(body.action))
      return requestStore().transmit(body);
    if (body.action === "cancel") return requestStore().cancel(body, role);
    if (body.action === "prepare" || body.action === "dispatch") {
      const candidates = (await supplyKitOptions(body.id)).kits;
      return requestStore()[body.action](body, candidates);
    }
    if (body.action === "receive") return requestStore().receive(body);
    if (body.action === "resolve") return requestStore().resolve(body);
    if (
      ["plan-inbound", "arrive-inbound", "cancel-inbound"].includes(body.action)
    )
      return requestStore().inbound(
        body,
        body.action === "plan-inbound" ? await supplyCatalogue() : {},
      );
    return requestStore().review(
      body,
      body.action === "approve" ? await supplyCatalogue(true) : {},
    );
  }
  let closing;
  return {
    snapshot,
    administration,
    saveSelection,
    exportSales,
    supplyWorkspace,
    supplyAction,
    supplyKitOptions,
    areaManagerWorkspace,
    health: async () => {
      await pool.query("SELECT 1");
    },
    close: () =>
      (closing ||= (async () => {
        cache.clear();
        contexts.clear();
        queries.clear();
        await pool.end();
        requests?.close();
        selection.close();
      })()),
  };
}
export function registerDatabaseRoutes(server, database) {
  registerSupplyRoutes(server, database);
  server.middlewares.use("/api/sales-export", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end('{"error":"Méthode non autorisée."}');
      return;
    }
    try {
      res.end(
        JSON.stringify(
          await database.exportSales(
            new URL(req.url, "http://localhost").searchParams,
          ),
        ),
      );
    } catch (error) {
      res.statusCode =
        error.message === "EXPORT_STALE_SELECTION"
          ? 409
          : error.message === "EXPORT_TOO_LARGE"
            ? 422
            : error.message.startsWith("INVALID_")
              ? 400
              : 503;
      if (res.statusCode === 503) reportDatabaseFailure("sales_export", error);
      res.end(
        JSON.stringify({
          error:
            res.statusCode === 409
              ? "La sélection ou les ventes ont changé. Actualisez les indicateurs puis relancez le téléchargement."
              : res.statusCode === 422
                ? "Cette sélection dépasse la capacité d’une feuille Excel. Choisissez une période plus courte."
                : res.statusCode === 400
                  ? "Période ou filtre invalide."
                  : "Téléchargement indisponible. Réessayez.",
        }),
      );
    }
  });
  server.middlewares.use("/api/analysis-selection", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      if (req.method === "GET") {
        res.end(
          JSON.stringify(
            await database.administration(
              new URL(req.url, "http://localhost").searchParams,
            ),
          ),
        );
        return;
      }
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end('{"error":"Méthode non autorisée"}');
        return;
      }
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) {
        res.statusCode = 403;
        res.end('{"error":"Origine non autorisée"}');
        return;
      }
      if (!req.headers["content-type"]?.includes("application/json"))
        throw new Error("INVALID_CONTENT_TYPE");
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1000000) throw new Error("INVALID_SIZE");
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new Error("INVALID_BODY");
      }
      res.end(JSON.stringify(await database.saveSelection(body)));
    } catch (error) {
      res.statusCode = error.message.startsWith("INVALID_") ? 400 : 503;
      res.end(
        JSON.stringify({
          error:
            res.statusCode === 400
              ? "Sélection ou filtre invalide."
              : "Enregistrement ou lecture indisponible.",
        }),
      );
    }
  });
  server.middlewares.use("/api/local-stock", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end('{"error":"Méthode non autorisée"}');
      return;
    }
    try {
      res.end(
        JSON.stringify(
          await database.snapshot(
            new URL(req.url, "http://localhost").searchParams,
          ),
        ),
      );
    } catch (error) {
      res.statusCode = error.message.startsWith("INVALID_") ? 400 : 503;
      const failure =
        res.statusCode === 503
          ? reportDatabaseFailure("snapshot", error)
          : null;
      res.end(
        JSON.stringify({
          error:
            res.statusCode === 400
              ? "Filtre ou page invalide."
              : "Connexion à PostgreSQL distant indisponible.",
          ...(failure ? { code: failure.code } : {}),
        }),
      );
    }
  });
}
export function localDatabasePlugin() {
  let database;
  function configure(server) {
    database ||= createLocalDatabase();
    registerDatabaseRoutes(server, database);
    server.httpServer?.once("close", () => database.close());
  }
  return {
    name: "ukit-local-database",
    configureServer: configure,
    configurePreviewServer: configure,
    closeBundle: () => database?.close(),
  };
}

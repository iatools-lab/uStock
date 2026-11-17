import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  initializeFulfillment,
  readShipment,
  fulfillmentMethods,
} from "./supply-fulfillment.mjs";

export class SupplyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status) => {
  throw new SupplyError(message, status);
};
const note = (value) => {
  if (typeof value !== "string" || value.length > 1000)
    fail("Le commentaire doit contenir au maximum 1 000 caractères.");
  return value.trim();
};
const text = (value, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    fail(`${label} invalide.`);
  return value.trim();
};
const count = (value) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000)
    fail("Quantité invalide.");
  return value;
};
function proposalFields(body, catalogue) {
  if (
    typeof body.neededOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.neededOn) ||
    !Number.isFinite(Date.parse(body.neededOn)) ||
    new Date(body.neededOn).toISOString().slice(0, 10) !== body.neededOn
  )
    fail("Date de besoin invalide.");
  if (
    !Array.isArray(body.lines) ||
    !body.lines.length ||
    body.lines.length > 100
  )
    fail("Ajoutez au moins un produit.");
  const seen = new Set();
  const lines = body.lines.map((line) => {
    const p = catalogue.products.find((p) => p.id === line.productId);
    if (!p || seen.has(p.id))
      fail("Produit inconnu ou présent plusieurs fois.");
    seen.add(p.id);
    const requested = count(line.quantity);
    if (!requested) fail("La quantité demandée doit être positive.");
    return { productId: p.id, productName: p.name, requested };
  });
  return { lines, message: note(body.note || "") };
}
export function openSupplyStore(
  filename = process.env.UKIT_SUPPLY_FILE ||
    fileURLToPath(new URL("./supply-requests.sqlite", import.meta.url)),
) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS supply_request(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,manager_id TEXT NOT NULL,manager_name TEXT NOT NULL,author TEXT NOT NULL,needed_on TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,warehouse_id TEXT,warehouse_name TEXT,reviewer TEXT,review_note TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS supply_line(request_id TEXT NOT NULL,product_id TEXT NOT NULL,product_name TEXT NOT NULL,requested INTEGER NOT NULL CHECK(requested>0),approved INTEGER NOT NULL DEFAULT 0 CHECK(approved>=0 AND approved<=requested),PRIMARY KEY(request_id,product_id));
 CREATE TABLE IF NOT EXISTS supply_history(id INTEGER PRIMARY KEY,request_id TEXT NOT NULL,action TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS supply_status ON supply_request(status,warehouse_id);
 CREATE INDEX IF NOT EXISTS supply_history_request ON supply_history(request_id,id);`);
  initializeFulfillment(db);
  const addColumn = (table, name, definition) => {
    if (
      !db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === name)
    )
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  addColumn("supply_request", "commercial_actor", "TEXT");
  addColumn("supply_request", "transmitted_at", "TEXT");
  addColumn("supply_request", "origin", "TEXT NOT NULL DEFAULT 'LEGACY'");
  addColumn("supply_line", "manager_proposed", "INTEGER");
  const get = (id) => {
    const r = db.prepare("SELECT * FROM supply_request WHERE id=?").get(id);
    if (!r) fail("Demande introuvable.", 404);
    const shipment = readShipment(db, id);
    return {
      id: r.id,
      managerId: r.manager_id,
      managerName: r.manager_name,
      author: r.author,
      neededOn: r.needed_on,
      note: r.note,
      status: r.status,
      version: r.version,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      reviewer: r.reviewer,
      reviewNote: r.review_note,
      commercialActor: r.commercial_actor,
      transmittedAt: r.transmitted_at,
      origin: r.origin,
      shipment,
      lines: db
        .prepare(
          "SELECT product_id AS productId,product_name AS productName,requested,approved,coalesce(manager_proposed,requested) AS managerProposed FROM supply_line WHERE request_id=? ORDER BY product_name",
        )
        .all(id)
        .map((line) => ({
          ...line,
          prepared:
            shipment?.kits.filter((k) => k.productId === line.productId)
              .length || 0,
          shipped: shipment?.shippedAt
            ? shipment.kits.filter((k) => k.productId === line.productId).length
            : 0,
          received: shipment?.receivedAt
            ? shipment.kits.filter(
                (k) => k.productId === line.productId && k.received,
              ).length
            : 0,
          damaged:
            shipment?.kits.filter(
              (k) =>
                k.productId === line.productId && k.condition === "DAMAGED",
            ).length || 0,
        })),
      history: db
        .prepare(
          "SELECT action,actor,note,created_at AS createdAt FROM supply_history WHERE request_id=? ORDER BY id",
        )
        .all(id),
    };
  };
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const log = (id, action, actor, message, at) =>
    db
      .prepare(
        "INSERT INTO supply_history(request_id,action,actor,note,created_at) VALUES(?,?,?,?,?)",
      )
      .run(id, action, actor, message, at);
  const reservations = () =>
    db
      .prepare(
        `SELECT r.warehouse_id AS warehouseId,l.product_id AS productId,
        sum(CASE WHEN r.status IN ('APPROVED','PREPARED') THEN l.approved ELSE
        (SELECT count(*) FROM supply_shipment_kit k WHERE k.request_id=r.id AND k.product_id=l.product_id AND k.active=1 AND k.source_confirmed=0) END) AS quantity
        FROM supply_request r JOIN supply_line l ON l.request_id=r.id WHERE r.status IN ('APPROVED','PREPARED','SHIPPED','RECEIVED','DISPUTED','RESOLVED') GROUP BY 1,2 HAVING sum(CASE WHEN r.status IN ('APPROVED','PREPARED') THEN l.approved ELSE (SELECT count(*) FROM supply_shipment_kit k WHERE k.request_id=r.id AND k.product_id=l.product_id AND k.active=1 AND k.source_confirmed=0) END)>0`,
      )
      .all();
  return {
    ...fulfillmentMethods({ db, get, transaction, log }),
    list() {
      return db
        .prepare(
          "SELECT id FROM supply_request ORDER BY created_at DESC,id DESC",
        )
        .all()
        .map((r) => get(r.id));
    },
    reservations,
    create(body, catalogue, { proposed = false } = {}) {
      const requestKey = text(body.requestKey, "Identifiant de saisie");
      const existing = db
        .prepare("SELECT id FROM supply_request WHERE request_key=?")
        .get(requestKey);
      if (existing) {
        const previous = get(existing.id);
        if (previous.managerId !== body.managerId)
          fail("Identifiant de saisie déjà utilisé.", 409);
        return previous;
      }
      const manager = catalogue.areaManagers.find(
        (a) => a.id === body.managerId,
      );
      if (!manager) fail("Choisissez un Area manager du référentiel.");
      const author = text(body.actor, "Nom"),
        { lines, message } = proposalFields(body, catalogue);
      return transaction(() => {
        const previous = db
          .prepare("SELECT id FROM supply_request WHERE request_key=?")
          .get(requestKey);
        if (previous) {
          const r = get(previous.id);
          if (r.managerId !== body.managerId)
            fail("Identifiant de saisie déjà utilisé.", 409);
          return r;
        }
        const id = randomUUID(),
          at = new Date().toISOString();
        db.prepare(
          `INSERT INTO supply_request(id,request_key,manager_id,manager_name,author,needed_on,note,status,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'SUBMITTED',1,?,?)`,
        ).run(
          id,
          requestKey,
          manager.id,
          manager.name,
          author,
          body.neededOn,
          message,
          at,
          at,
        );
        for (const l of lines)
          db.prepare(
            "INSERT INTO supply_line(request_id,product_id,product_name,requested) VALUES(?,?,?,?)",
          ).run(id, l.productId, l.productName, l.requested);
        db.prepare(
          "UPDATE supply_line SET manager_proposed=requested WHERE request_id=?",
        ).run(id);
        if (proposed)
          db.prepare(
            "UPDATE supply_request SET status='PROPOSED',origin='AM' WHERE id=?",
          ).run(id);
        log(id, proposed ? "PROPOSED" : "SUBMITTED", author, message, at);
        return get(id);
      });
    },
    update(body, catalogue) {
      return transaction(() => {
        const r = get(text(body.id, "Demande"));
        if (r.version !== body.version || r.status !== "PROPOSED")
          fail(
            "Cette proposition a changé ou a déjà été transmise. Actualisez.",
            409,
          );
        if (body.managerId !== r.managerId)
          fail("La demande doit rester dans le même réseau.", 403);
        const actor = text(body.actor, "Nom"),
          { lines, message } = proposalFields(body, catalogue),
          at = new Date().toISOString();
        const changes = `Avant : ${r.lines.map((l) => `${l.productName} : ${l.requested}`).join(", ")} ; après : ${lines.map((l) => `${l.productName} : ${l.requested}`).join(", ")}. Date souhaitée : ${r.neededOn} → ${body.neededOn}.`;
        db.prepare("DELETE FROM supply_line WHERE request_id=?").run(r.id);
        for (const l of lines)
          db.prepare(
            "INSERT INTO supply_line(request_id,product_id,product_name,requested,manager_proposed) VALUES(?,?,?,?,?)",
          ).run(r.id, l.productId, l.productName, l.requested, l.requested);
        db.prepare(
          "UPDATE supply_request SET needed_on=?,note=?,version=version+1,updated_at=? WHERE id=?",
        ).run(body.neededOn, message, at, r.id);
        log(r.id, "UPDATED", actor, changes, at);
        return get(r.id);
      });
    },
    transmit(body) {
      return transaction(() => {
        const r = get(text(body.id, "Demande"));
        if (r.version !== body.version || r.status !== "PROPOSED")
          fail("Cette proposition a changé. Actualisez.", 409);
        const actor = text(body.actor, "Nom du commercial"),
          message = note(body.note || "");
        const at = new Date().toISOString();
        if (body.action === "reject-proposal") {
          if (!message) fail("Indiquez le motif du refus.");
          db.prepare(
            "UPDATE supply_request SET status='REJECTED',commercial_actor=?,reviewer=?,review_note=?,version=version+1,updated_at=? WHERE id=?",
          ).run(actor, actor, message, at, r.id);
          log(r.id, "REJECTED", actor, message, at);
          return get(r.id);
        }
        if (body.action !== "transmit") fail("Action inconnue.");
        if (!Array.isArray(body.lines) || body.lines.length !== r.lines.length)
          fail("Vérifiez toutes les quantités.");
        const quantities = new Map();
        for (const l of body.lines) {
          if (
            quantities.has(l.productId) ||
            !r.lines.some((p) => p.productId === l.productId)
          )
            fail("Produit invalide ou répété.");
          const q = count(l.quantity);
          if (!q) fail("Une quantité transmise doit être positive.");
          quantities.set(l.productId, q);
        }
        for (const l of r.lines)
          db.prepare(
            "UPDATE supply_line SET requested=? WHERE request_id=? AND product_id=?",
          ).run(quantities.get(l.productId), r.id, l.productId);
        db.prepare(
          "UPDATE supply_request SET status='SUBMITTED',commercial_actor=?,transmitted_at=?,version=version+1,updated_at=? WHERE id=?",
        ).run(actor, at, at, r.id);
        log(r.id, "SUBMITTED", actor, message, at);
        return get(r.id);
      });
    },
    review(body, catalogue) {
      return transaction(() => {
        const r = get(text(body.id, "Demande"));
        if (r.version !== body.version)
          fail("Cette demande a changé. Actualisez avant de continuer.", 409);
        if (r.status !== "SUBMITTED")
          fail("Cette demande a déjà été traitée.", 409);
        const actor = text(body.actor, "Nom du validateur"),
          message = note(body.note || ""),
          at = new Date().toISOString();
        if (body.action === "reject") {
          if (!message) fail("Indiquez le motif du refus.");
          db.prepare(
            `UPDATE supply_request SET status='REJECTED',reviewer=?,review_note=?,version=version+1,updated_at=? WHERE id=?`,
          ).run(actor, message, at, r.id);
          log(r.id, "REJECTED", actor, message, at);
          return get(r.id);
        }
        if (body.action !== "approve") fail("Action inconnue.");
        const warehouse = catalogue.warehouses.find(
          (w) => w.id === body.warehouseId,
        );
        if (!warehouse) fail("Choisissez un entrepôt source.");
        if (!Array.isArray(body.lines) || body.lines.length !== r.lines.length)
          fail("Toutes les lignes doivent être vérifiées.");
        const quantities = new Map();
        for (const line of body.lines) {
          if (quantities.has(line.productId))
            fail("Produit présent plusieurs fois.");
          quantities.set(line.productId, count(line.quantity));
        }
        const reserved = reservations();
        let total = 0;
        for (const line of r.lines) {
          const approved = quantities.get(line.productId);
          if (approved === undefined || approved > line.requested)
            fail("Une quantité validée ne peut pas dépasser la demande.");
          const physical =
            catalogue.stock.find(
              (s) =>
                s.warehouseId === warehouse.id &&
                s.productId === line.productId,
            )?.quantity || 0;
          const held =
            reserved.find(
              (s) =>
                s.warehouseId === warehouse.id &&
                s.productId === line.productId,
            )?.quantity || 0;
          if (approved > Math.max(0, physical - held))
            fail(
              `Stock insuffisant pour ${line.productName}. Actualisez les quantités.`,
              409,
            );
          total += approved;
        }
        if (!total) fail("Validez au moins un kit ou refusez la demande.");
        for (const line of r.lines)
          db.prepare(
            "UPDATE supply_line SET approved=? WHERE request_id=? AND product_id=?",
          ).run(quantities.get(line.productId), r.id, line.productId);
        db.prepare(
          `UPDATE supply_request SET status='APPROVED',warehouse_id=?,warehouse_name=?,reviewer=?,review_note=?,version=version+1,updated_at=? WHERE id=?`,
        ).run(warehouse.id, warehouse.name, actor, message, at, r.id);
        log(r.id, "APPROVED", actor, message, at);
        return get(r.id);
      });
    },
    cancel(body, role) {
      return transaction(() => {
        const r = get(text(body.id, "Demande"));
        if (r.version !== body.version) fail("Cette demande a changé.", 409);
        if (
          !(
            (role === "am" && r.status === "PROPOSED") ||
            (role === "commercial" &&
              ["PROPOSED", "SUBMITTED"].includes(r.status))
          ) &&
          !(role === "supply" && ["APPROVED", "PREPARED"].includes(r.status))
        )
          fail("Cette demande ne peut plus être annulée.", 409);
        const actor = text(body.actor, "Nom"),
          message = note(body.note || "");
        if (!message) fail("Indiquez le motif de l’annulation.");
        const at = new Date().toISOString();
        db.prepare(
          `UPDATE supply_request SET status='CANCELLED',version=version+1,updated_at=? WHERE id=?`,
        ).run(at, r.id);
        db.prepare(
          "UPDATE supply_shipment_kit SET active=0 WHERE request_id=?",
        ).run(r.id);
        log(r.id, "CANCELLED", actor, message, at);
        return get(r.id);
      });
    },
    close() {
      db.close();
    },
  };
}

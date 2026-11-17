import { randomUUID } from "node:crypto";
import { SupplyError } from "./supply-store.mjs";

const fail = (message, status = 400) => {
  throw new SupplyError(message, status);
};
const text = (value, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    fail(`${label} invalide.`);
  return value.trim();
};
const note = (value) => {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 1000)
    fail("Commentaire trop long.");
  return value.trim();
};
const date = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail("Date invalide.");
  return value;
};

export function initializeFulfillment(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS supply_shipment(request_id TEXT PRIMARY KEY,prepared_at TEXT NOT NULL,shipped_at TEXT,carrier TEXT,tracking TEXT,received_at TEXT,received_by TEXT,receipt_note TEXT NOT NULL DEFAULT '',resolution_note TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS supply_shipment_kit(request_id TEXT NOT NULL,serial_number TEXT NOT NULL,product_id TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,source_confirmed INTEGER NOT NULL DEFAULT 0,received INTEGER NOT NULL DEFAULT 0,condition TEXT NOT NULL DEFAULT 'PENDING',PRIMARY KEY(request_id,serial_number));
 CREATE UNIQUE INDEX IF NOT EXISTS supply_kit_active ON supply_shipment_kit(serial_number) WHERE active=1;
 CREATE TABLE IF NOT EXISTS supply_receipt_extra(request_id TEXT NOT NULL,serial_number TEXT NOT NULL,PRIMARY KEY(request_id,serial_number));
 CREATE TABLE IF NOT EXISTS supply_inbound(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,warehouse_id TEXT NOT NULL,warehouse_name TEXT NOT NULL,product_id TEXT NOT NULL,product_name TEXT NOT NULL,quantity INTEGER NOT NULL,expected_on TEXT NOT NULL,reference TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
}
export function readShipment(db, id) {
  const s = db
    .prepare("SELECT * FROM supply_shipment WHERE request_id=?")
    .get(id);
  if (!s) return null;
  return {
    preparedAt: s.prepared_at,
    shippedAt: s.shipped_at,
    carrier: s.carrier,
    tracking: s.tracking,
    receivedAt: s.received_at,
    receivedBy: s.received_by,
    receiptNote: s.receipt_note,
    resolutionNote: s.resolution_note,
    extraSerialNumbers: db
      .prepare(
        "SELECT serial_number FROM supply_receipt_extra WHERE request_id=?",
      )
      .all(id)
      .map((r) => r.serial_number),
    kits: db
      .prepare(
        "SELECT serial_number AS serialNumber,product_id AS productId,source_confirmed AS sourceConfirmed,received,condition FROM supply_shipment_kit WHERE request_id=? AND active=1 ORDER BY product_id,serial_number",
      )
      .all(id),
  };
}
export function fulfillmentMethods({ db, get, transaction, log }) {
  const check = (body, statuses) => {
    const r = get(text(body.id, "Demande"));
    if (body.version !== r.version)
      fail("Cette demande a changé. Actualisez.", 409);
    if (!statuses.includes(r.status))
      fail("Cette action ne correspond pas à l’état de la demande.", 409);
    return r;
  };
  const update = (r, status, actor, message, at) => {
    db.prepare(
      "UPDATE supply_request SET status=?,version=version+1,updated_at=? WHERE id=?",
    ).run(status, at, r.id);
    log(r.id, status, actor, message, at);
    return get(r.id);
  };
  return {
    allocatedSerials() {
      return db
        .prepare(
          "SELECT serial_number AS serialNumber,request_id AS requestId FROM supply_shipment_kit WHERE active=1",
        )
        .all();
    },
    prepare(body, candidates) {
      return transaction(() => {
        const r = check(body, ["APPROVED"]),
          actor = text(body.actor, "Préparateur");
        if (
          !Array.isArray(body.serialNumbers) ||
          !body.serialNumbers.length ||
          body.serialNumbers.length > 10000
        )
          fail("Sélectionnez les identifiants des kits à préparer.");
        const serials = body.serialNumbers.map((s) =>
          text(s, "Identifiant kit"),
        );
        if (new Set(serials).size !== serials.length)
          fail("Un kit ne peut apparaître deux fois.");
        const selected = serials.map((serial) => {
          const kit = candidates.find((k) => k.serialNumber === serial);
          if (!kit || kit.warehouseId !== r.warehouseId)
            fail(
              "Un kit sélectionné n’est plus disponible dans cet entrepôt.",
              409,
            );
          return kit;
        });
        const allocated = db
          .prepare(
            "SELECT serial_number FROM supply_shipment_kit WHERE active=1",
          )
          .all();
        if (
          selected.some((k) =>
            allocated.some((a) => a.serial_number === k.serialNumber),
          )
        )
          fail("Un kit est déjà affecté à une autre demande.", 409);
        if (
          selected.some(
            (k) => !r.lines.some((l) => l.productId === k.productId),
          )
        )
          fail("Produit absent de la demande.");
        for (const line of r.lines)
          if (
            selected.filter((k) => k.productId === line.productId).length !==
            line.approved
          )
            fail(
              `Sélectionnez exactement ${line.approved} kit(s) pour ${line.productName}.`,
            );
        const at = new Date().toISOString();
        db.prepare(
          "INSERT INTO supply_shipment(request_id,prepared_at) VALUES(?,?)",
        ).run(r.id, at);
        for (const k of selected)
          db.prepare(
            "INSERT INTO supply_shipment_kit(request_id,serial_number,product_id) VALUES(?,?,?)",
          ).run(r.id, k.serialNumber, k.productId);
        return update(
          r,
          "PREPARED",
          actor,
          `${selected.length} kits identifiés pour la préparation.`,
          at,
        );
      });
    },
    dispatch(body, candidates) {
      return transaction(() => {
        const r = check(body, ["PREPARED"]),
          actor = text(body.actor, "Expéditeur"),
          carrier = text(body.carrier, "Transporteur"),
          tracking = text(body.tracking, "Référence d’expédition");
        if (!r.shipment?.kits.length)
          fail("Les identifiants des kits doivent être préparés.");
        for (const kit of r.shipment.kits)
          if (
            !candidates.some(
              (k) =>
                k.serialNumber === kit.serialNumber &&
                k.warehouseId === r.warehouseId &&
                k.productId === kit.productId,
            )
          )
            fail(
              `Le kit ${kit.serialNumber} n’est plus disponible à la source. Revoyez la préparation.`,
              409,
            );
        const at = new Date().toISOString();
        db.prepare(
          "UPDATE supply_shipment SET shipped_at=?,carrier=?,tracking=? WHERE request_id=?",
        ).run(at, carrier, tracking, r.id);
        return update(r, "SHIPPED", actor, `${carrier} · ${tracking}`, at);
      });
    },
    receive(body) {
      return transaction(() => {
        const r = check(body, ["SHIPPED"]),
          actor = text(body.actor, "Réceptionnaire");
        if (
          !Array.isArray(body.kits) ||
          body.kits.length !== r.shipment.kits.length
        )
          fail("Vérifiez tous les kits expédiés.");
        const seen = new Set();
        let discrepancy = false;
        for (const kit of body.kits) {
          if (
            seen.has(kit.serialNumber) ||
            !r.shipment.kits.some((k) => k.serialNumber === kit.serialNumber)
          )
            fail("Identifiant de réception invalide.");
          seen.add(kit.serialNumber);
          if (!["OK", "DAMAGED", "MISSING"].includes(kit.condition))
            fail("État de réception invalide.");
          discrepancy ||= kit.condition !== "OK";
        }
        const extras = body.extraSerialNumbers || [];
        if (!Array.isArray(extras) || extras.length > 1000)
          fail("Liste des kits supplémentaires invalide.");
        const extraIds = extras.map((s) =>
          text(s, "Identifiant supplémentaire"),
        );
        if (
          new Set(extraIds).size !== extraIds.length ||
          extraIds.some((s) => seen.has(s))
        )
          fail("Un identifiant de réception ne peut être compté deux fois.");
        discrepancy ||= extraIds.length > 0;
        const at = new Date().toISOString(),
          message = note(body.note);
        for (const serial of extraIds)
          db.prepare("INSERT INTO supply_receipt_extra VALUES(?,?)").run(
            r.id,
            serial,
          );
        for (const kit of body.kits)
          db.prepare(
            "UPDATE supply_shipment_kit SET received=?,condition=? WHERE request_id=? AND serial_number=?",
          ).run(
            kit.condition === "MISSING" ? 0 : 1,
            kit.condition,
            r.id,
            kit.serialNumber,
          );
        db.prepare(
          "UPDATE supply_shipment SET received_at=?,received_by=?,receipt_note=? WHERE request_id=?",
        ).run(at, actor, message, r.id);
        return update(
          r,
          discrepancy ? "DISPUTED" : "RECEIVED",
          actor,
          message,
          at,
        );
      });
    },
    resolve(body) {
      return transaction(() => {
        const r = check(body, ["DISPUTED"]),
          actor = text(body.actor, "Responsable"),
          message = note(body.note);
        if (!message) fail("Indiquez comment l’écart a été résolu.");
        const at = new Date().toISOString();
        db.prepare(
          "UPDATE supply_shipment SET resolution_note=? WHERE request_id=?",
        ).run(message, r.id);
        // Les quantités réellement reçues et les états d’origine restent conservés.
        return update(r, "RESOLVED", actor, message, at);
      });
    },
    reconcileSource(candidates, requestIds = null) {
      return transaction(() => {
        const kits = db
          .prepare(
            `SELECT k.request_id,k.serial_number,r.warehouse_id FROM supply_shipment_kit k JOIN supply_request r ON r.id=k.request_id WHERE k.active=1 AND k.source_confirmed=0 AND r.status IN ('SHIPPED','RECEIVED','DISPUTED','RESOLVED')`,
          )
          .all();
        let confirmed = 0;
        for (const kit of kits)
          if (
            (!requestIds || requestIds.includes(kit.request_id)) &&
            !candidates.some(
              (c) =>
                c.serialNumber === kit.serial_number &&
                c.warehouseId === kit.warehouse_id,
            )
          ) {
            db.prepare(
              "UPDATE supply_shipment_kit SET source_confirmed=1 WHERE serial_number=? AND active=1",
            ).run(kit.serial_number);
            confirmed++;
          }
        return confirmed;
      });
    },
    inbounds() {
      return db
        .prepare(
          "SELECT id,warehouse_id AS warehouseId,warehouse_name AS warehouseName,product_id AS productId,product_name AS productName,quantity,expected_on AS expectedOn,reference,status,version,actor,created_at AS createdAt FROM supply_inbound ORDER BY expected_on,id",
        )
        .all();
    },
    inbound(body, catalogue) {
      return transaction(() => {
        const actor = text(body.actor, "Responsable"),
          at = new Date().toISOString();
        if (body.action === "plan-inbound") {
          const key = text(body.requestKey, "Identifiant de saisie"),
            existing = db
              .prepare("SELECT id FROM supply_inbound WHERE request_key=?")
              .get(key);
          if (existing) return { id: existing.id };
          const warehouse = catalogue.warehouses.find(
              (w) => w.id === body.warehouseId,
            ),
            product = catalogue.products.find((p) => p.id === body.productId);
          if (!warehouse || !product) fail("Entrepôt ou produit inconnu.");
          if (
            !Number.isSafeInteger(body.quantity) ||
            body.quantity < 1 ||
            body.quantity > 100000
          )
            fail("Quantité invalide.");
          const id = randomUUID();
          db.prepare(
            `INSERT INTO supply_inbound VALUES(?,?,?,?,?,?,?,?,?,'PLANNED',1,?,?,?)`,
          ).run(
            id,
            key,
            warehouse.id,
            warehouse.name,
            product.id,
            product.name,
            body.quantity,
            date(body.expectedOn),
            text(body.reference, "Référence fournisseur"),
            actor,
            at,
            at,
          );
          return { id };
        }
        const r = db
          .prepare("SELECT * FROM supply_inbound WHERE id=?")
          .get(text(body.id, "Réception prévue"));
        if (!r) fail("Réception prévue introuvable.", 404);
        if (r.version !== body.version || r.status !== "PLANNED")
          fail("Cette réception a déjà changé.", 409);
        if (!["arrive-inbound", "cancel-inbound"].includes(body.action))
          fail("Action inconnue.");
        db.prepare(
          "UPDATE supply_inbound SET status=?,version=version+1,actor=?,updated_at=? WHERE id=?",
        ).run(
          body.action === "arrive-inbound" ? "ARRIVED" : "CANCELLED",
          actor,
          at,
          r.id,
        );
        return { id: r.id };
      });
    },
  };
}

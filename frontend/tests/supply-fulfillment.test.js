import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openSupplyStore } from "../server/supply-store.mjs";
import {
  requestsForTab,
  supplyMenus,
} from "../src/domain/supply-navigation.js";

const catalogue = {
  areaManagers: [{ id: "AM", name: "Manager" }],
  products: [{ id: "P", name: "Kit" }],
  warehouses: [{ id: "W", name: "Entrepôt" }],
  stock: [{ warehouseId: "W", productId: "P", quantity: 10 }],
};
const candidates = Array.from({ length: 10 }, (_, i) => ({
  serialNumber: `KIT${i + 1}`,
  warehouseId: "W",
  productId: "P",
}));
function approved(store, key = "one", quantity = 2) {
  const r = store.create(
    {
      requestKey: key,
      managerId: "AM",
      actor: "Commercial",
      neededOn: "2026-12-01",
      lines: [{ productId: "P", quantity }],
    },
    catalogue,
  );
  return store.review(
    {
      id: r.id,
      version: r.version,
      action: "approve",
      actor: "Supply",
      warehouseId: "W",
      lines: [{ productId: "P", quantity }],
    },
    catalogue,
  );
}
const body = (r) => ({ id: r.id, version: r.version, actor: "Supply" });

test("preparation, expedition, reception avec ecart et resolution conservent les quantites distinctes", () => {
  const folder = mkdtempSync(join(tmpdir(), "ustock-flow-")),
    file = join(folder, "supply.sqlite");
  let store = openSupplyStore(file);
  try {
    const a = approved(store);
    const p = store.prepare(
      { ...body(a), serialNumbers: ["KIT1", "KIT2"] },
      candidates,
    );
    assert.equal(p.status, "PREPARED");
    assert.equal(p.lines[0].prepared, 2);
    assert.equal(p.lines[0].shipped, 0);
    assert.throws(
      () =>
        store.prepare(
          { ...body(a), serialNumbers: ["KIT1", "KIT2"] },
          candidates,
        ),
      /changé/,
    );
    const s = store.dispatch(
      { ...body(p), carrier: "Transport", tracking: "REF-1" },
      candidates,
    );
    assert.equal(s.lines[0].shipped, 2);
    assert.equal(s.lines[0].received, 0);
    assert.throws(
      () => store.cancel({ ...body(s), note: "annuler" }, "supply"),
      /peut plus/,
    );
    const r = store.receive({
      ...body(s),
      actor: "Commercial",
      kits: [
        { serialNumber: "KIT1", condition: "DAMAGED" },
        { serialNumber: "KIT2", condition: "MISSING" },
      ],
      extraSerialNumbers: ["EXTRA1"],
    });
    assert.equal(r.status, "DISPUTED");
    assert.equal(r.lines[0].requested, 2);
    assert.equal(r.lines[0].approved, 2);
    assert.equal(r.lines[0].shipped, 2);
    assert.equal(r.lines[0].received, 1);
    assert.equal(r.lines[0].damaged, 1);
    assert.deepEqual(r.shipment.extraSerialNumbers, ["EXTRA1"]);
    assert.throws(() => store.resolve({ ...body(r), note: "" }), /résolu/);
    const closed = store.resolve({
      ...body(r),
      note: "Incident consigné et suivi SAV ouvert.",
    });
    assert.equal(closed.status, "RESOLVED");
    assert.equal(closed.lines[0].received, 1);
    store.close();
    store = openSupplyStore(file);
    assert.equal(store.list()[0].shipment.tracking, "REF-1");
    assert.equal(store.list()[0].history.length, 6);
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("un kit ne peut etre prepare deux fois et la source est recontrolee avant expedition", () => {
  const store = openSupplyStore(":memory:");
  try {
    const a = approved(store, "a"),
      b = approved(store, "b");
    assert.throws(
      () =>
        store.prepare(
          { ...body(a), serialNumbers: ["KIT1", "KIT1"] },
          candidates,
        ),
      /deux fois/,
    );
    assert.throws(
      () => store.prepare({ ...body(a), serialNumbers: ["KIT1"] }, candidates),
      /exactement/,
    );
    assert.throws(
      () =>
        store.prepare(
          { ...body(a), serialNumbers: ["KIT1", "absent"] },
          candidates,
        ),
      /plus disponible/,
    );
    const p = store.prepare(
      { ...body(a), serialNumbers: ["KIT1", "KIT2"] },
      candidates,
    );
    assert.throws(
      () =>
        store.prepare(
          { ...body(b), serialNumbers: ["KIT1", "KIT2"] },
          candidates,
        ),
      /déjà affecté/,
    );
    assert.throws(
      () =>
        store.dispatch(
          { ...body(p), carrier: "X", tracking: "REF" },
          candidates.slice(1),
        ),
      /plus disponible/,
    );
    store.cancel({ ...body(p), note: "Préparation annulée" }, "supply");
    assert.equal(store.allocatedSerials().length, 0);
    assert.equal(
      store.prepare({ ...body(b), serialNumbers: ["KIT1", "KIT2"] }, candidates)
        .status,
      "PREPARED",
    );
  } finally {
    store.close();
  }
});

test("les kits expedies restent reserves jusqu’au retrait confirme du stock source", () => {
  const store = openSupplyStore(":memory:");
  try {
    const p = store.prepare(
      { ...body(approved(store)), serialNumbers: ["KIT1", "KIT2"] },
      candidates,
    );
    const s = store.dispatch(
      { ...body(p), carrier: "Transport", tracking: "REF" },
      candidates,
    );
    assert.equal(store.reservations()[0].quantity, 2);
    assert.equal(
      store.reconcileSource([], []),
      0,
      "Ne pas rapprocher une expedition non couverte par la lecture source.",
    );
    assert.equal(store.reservations()[0].quantity, 2);
    assert.equal(store.reconcileSource(candidates), 0);
    assert.equal(
      store.reconcileSource(
        candidates.filter((k) => k.serialNumber !== "KIT1"),
      ),
      1,
    );
    assert.equal(store.reservations()[0].quantity, 1);
    const r = store.receive({
      ...body(s),
      kits: [
        { serialNumber: "KIT1", condition: "OK" },
        { serialNumber: "KIT2", condition: "OK" },
      ],
    });
    assert.equal(r.status, "RECEIVED");
    assert.equal(r.lines[0].received, 2);
    store.reconcileSource([]);
    assert.equal(store.reservations().length, 0);
    assert.equal(store.allocatedSerials().length, 2);
    assert.throws(() => store.receive({ ...body(r), kits: [] }), /état/);
  } finally {
    store.close();
  }
});

test("les receptions prevues restent distinctes du stock Upya et sont versionnees", () => {
  const store = openSupplyStore(":memory:");
  try {
    const plan = {
      action: "plan-inbound",
      requestKey: "plan",
      actor: "Supply",
      warehouseId: "W",
      productId: "P",
      quantity: 20,
      expectedOn: "2026-12-10",
      reference: "FOURN-1",
    };
    const r = store.inbound(plan, catalogue);
    assert.equal(store.inbound(plan, catalogue).id, r.id);
    assert.equal(store.inbounds().length, 1);
    assert.equal(catalogue.stock[0].quantity, 10);
    store.inbound(
      { action: "arrive-inbound", id: r.id, version: 1, actor: "Supply" },
      {},
    );
    assert.equal(store.inbounds()[0].status, "ARRIVED");
    assert.equal(catalogue.stock[0].quantity, 10);
    assert.throws(
      () =>
        store.inbound(
          { action: "cancel-inbound", id: r.id, version: 1, actor: "Supply" },
          {},
        ),
      /changé/,
    );
    assert.throws(
      () =>
        store.inbound(
          { ...plan, requestKey: "bad", productId: "accessoire" },
          catalogue,
        ),
      /inconnu/,
    );
  } finally {
    store.close();
  }
});

test("les menus et onglets orientent chaque role vers les demandes de son etape", () => {
  assert.equal(supplyMenus.commercial.length, 4);
  assert.equal(supplyMenus.supply.length, 6);
  const rows = [
    "SUBMITTED",
    "APPROVED",
    "PREPARED",
    "SHIPPED",
    "RECEIVED",
    "DISPUTED",
    "RESOLVED",
  ].map((status) => ({ status }));
  assert.deepEqual(
    requestsForTab(rows, "supply", "preparation", "ready").map((r) => r.status),
    ["PREPARED"],
  );
  assert.deepEqual(
    requestsForTab(rows, "commercial", "livraisons", "confirm").map(
      (r) => r.status,
    ),
    ["SHIPPED"],
  );
  assert.deepEqual(
    requestsForTab(rows, "supply", "livraisons", "issues").map((r) => r.status),
    ["DISPUTED"],
  );
});

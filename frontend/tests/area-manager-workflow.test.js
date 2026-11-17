import test from "node:test";
import assert from "node:assert/strict";
import { requestActions } from "../src/domain/request-actions.js";
import { openSupplyStore } from "../server/supply-store.mjs";
import {
  assertSupplyAction,
  visibleRequests,
} from "../server/supply-access.mjs";
import {
  requestsForTab,
  supplyMenus,
} from "../src/domain/supply-navigation.js";

const catalogue = {
  areaManagers: [
    { id: "A", name: "Centre" },
    { id: "B", name: "Ouest" },
  ],
  products: [{ id: "P", name: "Kit complet" }],
  warehouses: [{ id: "W", name: "Central" }],
  stock: [{ warehouseId: "W", productId: "P", quantity: 10 }],
};
test("une proposition se modifie uniquement avant transmission, dans son réseau et sans écraser un changement", () => {
  const store = openSupplyStore(":memory:");
  try {
    const original = proposal(store),
      body = {
        action: "update",
        id: original.id,
        version: 1,
        managerId: "A",
        actor: "Area manager",
        neededOn: "2026-12-03",
        lines: [{ productId: "P", quantity: 7 }],
      };
    assert.throws(
      () => assertSupplyAction(store, body, "am", "B"),
      /introuvable/,
    );
    assert.throws(
      () => assertSupplyAction(store, body, "commercial"),
      /autorisée/,
    );
    assert.throws(
      () =>
        store.update(
          { ...body, lines: [{ productId: "accessoire", quantity: 3 }] },
          catalogue,
        ),
      /inconnu/,
    );
    assert.equal(store.list()[0].version, 1);
    let r = store.update(body, catalogue);
    assert.equal(r.neededOn, "2026-12-03");
    assert.equal(r.lines[0].managerProposed, 7);
    assert.equal(r.version, 2);
    assert.match(r.history.at(-1).note, /5.*7/);
    assert.throws(() => store.update(body, catalogue), /changé/);
    r = store.transmit({
      action: "transmit",
      id: r.id,
      version: r.version,
      actor: "Commercial",
      lines: [{ productId: "P", quantity: 6 }],
    });
    assert.throws(
      () => store.update({ ...body, version: r.version }, catalogue),
      /transmise/,
    );
    assert.equal(r.lines[0].managerProposed, 7);
    assert.equal(r.lines[0].requested, 6);
    assert.deepEqual(requestActions("am", r.status), []);
    assert.deepEqual(
      requestActions("commercial", "PROPOSED").map(([a]) => a),
      ["review", "cancel"],
    );
    assert.deepEqual(
      requestActions("am", "SHIPPED").map(([a]) => a),
      ["receive"],
    );
    assert.deepEqual(requestActions("commercial", "SHIPPED"), []);
  } finally {
    store.close();
  }
});
const proposal = (store, managerId = "A", key = "key") =>
  store.create(
    {
      requestKey: key,
      managerId,
      actor: "Area manager",
      neededOn: "2026-12-01",
      lines: [{ productId: "P", quantity: 5 }],
    },
    catalogue,
    { proposed: true },
  );
test("AM → commercial → supply → expédition → réception : origine et quantités restent traçables", () => {
  const store = openSupplyStore(":memory:");
  try {
    let r = proposal(store);
    assert.equal(r.status, "PROPOSED");
    assert.deepEqual(visibleRequests(store.list(), "supply"), []);
    assert.throws(
      () =>
        store.review(
          { action: "approve", id: r.id, version: r.version, actor: "Supply" },
          catalogue,
        ),
      /traitée/,
    );
    assert.throws(
      () =>
        store.transmit({
          action: "transmit",
          id: r.id,
          version: r.version,
          actor: "Commercial",
          lines: [{ productId: "X", quantity: 3 }],
        }),
      /invalide/,
    );
    r = store.transmit({
      action: "transmit",
      id: r.id,
      version: r.version,
      actor: "Commercial",
      lines: [{ productId: "P", quantity: 4 }],
    });
    assert.equal(r.lines[0].managerProposed, 5);
    assert.equal(r.lines[0].requested, 4);
    assert.equal(r.commercialActor, "Commercial");
    assert.ok(r.transmittedAt);
    assert.equal(visibleRequests(store.list(), "supply").length, 1);
    assert.throws(
      () =>
        store.transmit({
          action: "transmit",
          id: r.id,
          version: 1,
          actor: "Other",
          lines: [],
        }),
      /changé/,
    );
    r = store.review(
      {
        action: "approve",
        id: r.id,
        version: r.version,
        actor: "Supply",
        warehouseId: "W",
        lines: [{ productId: "P", quantity: 2 }],
      },
      catalogue,
    );
    const kits = ["K1", "K2"].map((serialNumber) => ({
      serialNumber,
      warehouseId: "W",
      productId: "P",
    }));
    r = store.prepare(
      {
        id: r.id,
        version: r.version,
        actor: "Supply",
        serialNumbers: ["K1", "K2"],
      },
      kits,
    );
    r = store.dispatch(
      {
        id: r.id,
        version: r.version,
        actor: "Supply",
        carrier: "Transport",
        tracking: "EXP1",
      },
      kits,
    );
    const body = {
      action: "receive",
      id: r.id,
      version: r.version,
      actor: "Area manager",
      kits: kits.map((k) => ({
        serialNumber: k.serialNumber,
        condition: "OK",
      })),
    };
    assert.throws(
      () => assertSupplyAction(store, body, "commercial"),
      /autorisée/,
    );
    assert.throws(
      () => assertSupplyAction(store, body, "am", "B"),
      /introuvable/,
    );
    assert.doesNotThrow(() => assertSupplyAction(store, body, "am", "A"));
    r = store.receive(body);
    assert.equal(r.status, "RECEIVED");
    assert.equal(r.lines[0].received, 2);
    assert.deepEqual(
      r.history.map((h) => h.action),
      ["PROPOSED", "SUBMITTED", "APPROVED", "PREPARED", "SHIPPED", "RECEIVED"],
    );
    assert.equal(catalogue.stock[0].quantity, 10);
  } finally {
    store.close();
  }
});
test("les propositions non transmises et les autres réseaux ne sont jamais exposés", () => {
  const store = openSupplyStore(":memory:");
  try {
    const a = proposal(store),
      b = proposal(store, "B", "other");
    assert.deepEqual(
      visibleRequests(store.list(), "am", "A").map((r) => r.id),
      [a.id],
    );
    assert.deepEqual(visibleRequests(store.list(), "am", null), []);
    assert.throws(
      () =>
        assertSupplyAction(
          store,
          { action: "create", managerId: "B" },
          "am",
          "A",
        ),
      /votre réseau/,
    );
    assert.throws(
      () =>
        assertSupplyAction(
          store,
          { action: "create", managerId: "A" },
          "commercial",
        ),
      /autorisée/,
    );
    assert.throws(
      () =>
        assertSupplyAction(store, { action: "approve", id: a.id }, "supply"),
      /transmise/,
    );
    assert.throws(
      () =>
        store.create({ requestKey: "key", managerId: "B" }, catalogue, {
          proposed: true,
        }),
      /déjà utilisé/,
    );
    assert.throws(
      () =>
        store.transmit({
          action: "reject-proposal",
          id: a.id,
          version: 1,
          actor: "Commercial",
        }),
      /motif/,
    );
    store.transmit({
      action: "reject-proposal",
      id: a.id,
      version: 1,
      actor: "Commercial",
      note: "Besoin à revoir",
    });
    assert.deepEqual(visibleRequests(store.list(), "supply"), []);
    assert.equal(store.list().length, 2);
    assert.equal(
      requestsForTab(store.list(), "am", "besoins", "history").length,
      1,
    );
    assert.equal(
      requestsForTab(store.list(), "commercial", "", "verify")[0].id,
      b.id,
    );
    assert.equal(supplyMenus.am.length, 5);
  } finally {
    store.close();
  }
});

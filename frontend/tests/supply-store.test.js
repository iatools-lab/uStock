import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openSupplyStore } from "../server/supply-store.mjs";
import { assertLocalSupplyPrototype } from "../server/supply-routes.mjs";

export const catalogue = {
  areaManagers: [{ id: "AM1", name: "Area manager 1" }],
  products: [
    { id: "P1", name: "Kit Jua" },
    { id: "P2", name: "SunShine" },
  ],
  warehouses: [{ id: "W1", name: "Entrepot central" }],
  stock: [
    { warehouseId: "W1", productId: "P1", quantity: 10 },
    { warehouseId: "W1", productId: "P2", quantity: 3 },
  ],
};
const create = (key = "one") => ({
  requestKey: key,
  managerId: "AM1",
  actor: "Commercial",
  neededOn: "2026-12-01",
  note: "Priorite",
  lines: [
    { productId: "P1", quantity: 8 },
    { productId: "P2", quantity: 4 },
  ],
});
const review = (r, quantity = 6) => ({
  action: "approve",
  id: r.id,
  version: r.version,
  actor: "Supply",
  warehouseId: "W1",
  note: "Stock partiel",
  lines: [
    { productId: "P1", quantity },
    { productId: "P2", quantity: 2 },
  ],
});

test("demande persistante, saisie idempotente, validation partielle et historique", () => {
  const folder = mkdtempSync(join(tmpdir(), "ustock-supply-")),
    filename = join(folder, "requests.sqlite");
  let store = openSupplyStore(filename);
  try {
    const r = store.create(create(), catalogue);
    assert.equal(r.status, "SUBMITTED");
    assert.equal(r.lines[0].requested, 8);
    assert.equal(store.create(create(), catalogue).id, r.id);
    assert.equal(store.list().length, 1);
    store.close();
    store = openSupplyStore(filename);
    assert.equal(store.list()[0].id, r.id);
    const done = store.review(review(r), catalogue);
    assert.equal(done.status, "APPROVED");
    assert.equal(done.lines[0].approved, 6);
    assert.equal(done.lines[0].requested, 8);
    assert.equal(done.history.length, 2);
    assert.deepEqual(
      { ...store.reservations().find((r) => r.productId === "P1") },
      { warehouseId: "W1", productId: "P1", quantity: 6 },
    );
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("deux validateurs ne peuvent pas reserver deux fois le meme stock ni ecraser une decision", () => {
  const folder = mkdtempSync(join(tmpdir(), "ustock-supply-race-")),
    filename = join(folder, "requests.sqlite");
  const a = openSupplyStore(filename),
    b = openSupplyStore(filename);
  try {
    const one = a.create(create("one"), catalogue),
      two = b.create(create("two"), catalogue);
    a.review(review(one), catalogue);
    assert.throws(() => b.review(review(one), catalogue), /changé/);
    assert.throws(() => b.review(review(two), catalogue), /Stock insuffisant/);
    assert.equal(b.list().find((r) => r.id === two.id).status, "SUBMITTED");
    assert.throws(
      () =>
        a.cancel(
          { id: one.id, version: 2, actor: "Commercial", note: "Annulation" },
          "commercial",
        ),
      /peut plus/,
    );
    a.cancel(
      { id: one.id, version: 2, actor: "Supply", note: "Annulation" },
      "supply",
    );
    assert.equal(a.reservations().length, 0);
    assert.equal(b.review(review(two), catalogue).status, "APPROVED");
  } finally {
    a.close();
    b.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("produits inconnus, doublons, quantites, transitions et motifs invalides sont refuses", () => {
  const store = openSupplyStore(":memory:");
  try {
    assert.throws(
      () => store.create({ ...create(), managerId: "missing" }, catalogue),
      /Area manager/,
    );
    assert.throws(
      () =>
        store.create(
          { ...create(), lines: [{ productId: "PART", quantity: 1 }] },
          catalogue,
        ),
      /Produit inconnu/,
    );
    assert.throws(
      () =>
        store.create(
          {
            ...create(),
            lines: [
              { productId: "P1", quantity: 1 },
              { productId: "P1", quantity: 2 },
            ],
          },
          catalogue,
        ),
      /plusieurs fois/,
    );
    for (const n of [-1, 0, 1.5, "4"])
      assert.throws(() =>
        store.create(
          { ...create(), lines: [{ productId: "P1", quantity: n }] },
          catalogue,
        ),
      );
    const r = store.create(create(), catalogue);
    const partial = store.create(create("without-comment"), catalogue);
    assert.equal(
      store.review({ ...review(partial), note: "" }, catalogue).status,
      "APPROVED",
    );
    store.cancel(
      {
        id: partial.id,
        version: 2,
        actor: "Supply",
        note: "Libération pour le test",
      },
      "supply",
    );
    assert.throws(
      () =>
        store.review(
          {
            ...review(r),
            lines: [
              { productId: "P1", quantity: 9 },
              { productId: "P2", quantity: 0 },
            ],
          },
          catalogue,
        ),
      /dépasser/,
    );
    assert.throws(
      () =>
        store.review({ ...review(r), action: "reject", note: "" }, catalogue),
      /motif/,
    );
    assert.equal(
      store.review(
        { ...review(r), action: "reject", note: "Pas de stock" },
        catalogue,
      ).status,
      "REJECTED",
    );
    assert.throws(
      () =>
        store.cancel(
          { id: r.id, version: 2, actor: "Supply", note: "test" },
          "supply",
        ),
      /peut plus/,
    );
  } finally {
    store.close();
  }
});

test("le prototype sans comptes est bloque en production et pour les appelants distants", () => {
  const local = {
    socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "localhost:3000", origin: "http://localhost:3000" },
  };
  assert.doesNotThrow(() =>
    assertLocalSupplyPrototype(local, { NODE_ENV: "development" }),
  );
  assert.throws(
    () => assertLocalSupplyPrototype(local, { NODE_ENV: "production" }),
    /contrôle d’accès/,
  );
  assert.throws(
    () =>
      assertLocalSupplyPrototype(
        { ...local, socket: { remoteAddress: "82.165.222.49" } },
        { NODE_ENV: "development" },
      ),
    /uniquement en local/,
  );
  assert.throws(
    () =>
      assertLocalSupplyPrototype(
        {
          ...local,
          headers: { ...local.headers, "x-forwarded-for": "1.2.3.4" },
        },
        { NODE_ENV: "development" },
      ),
    /uniquement en local/,
  );
  assert.throws(
    () =>
      assertLocalSupplyPrototype(
        {
          ...local,
          headers: { ...local.headers, origin: "https://example.com" },
        },
        { NODE_ENV: "development" },
      ),
    /Origine/,
  );
});

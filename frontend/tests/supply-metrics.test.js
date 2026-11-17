import test from "node:test";
import assert from "node:assert/strict";
import { supplyMetrics } from "../src/domain/supply-metrics.js";
const request = (status, requested = 5, approved = 0) => ({
  status,
  lines: [
    {
      requested,
      approved,
      prepared: status === "PREPARED" ? approved : 0,
      shipped: status === "SHIPPED" ? approved : 0,
      received: status === "DISPUTED" ? 2 : 0,
    },
  ],
});
const data = {
  catalogue: {
    estimates: [
      { managerId: "A", productId: "P", stock: 4, estimatedNeed: 7 },
      { managerId: "B", productId: "P", stock: 3, estimatedNeed: 8 },
    ],
    stock: [
      { warehouseId: "W", productId: "P", quantity: 10 },
      { warehouseId: "W", productId: "Q", quantity: 5 },
    ],
  },
  reservations: [
    { warehouseId: "W", productId: "P", quantity: 6 },
    { warehouseId: "W", productId: "Q", quantity: 8 },
  ],
  holders: [{ key: "AG", productReference: "P", instock: 4 }],
  metrics: { available: { value: 4 }, deployed: { value: 9 } },
  requests: [
    request("PROPOSED"),
    request("SUBMITTED"),
    request("APPROVED", 5, 3),
    request("PREPARED", 5, 4),
    request("SHIPPED", 5, 3),
    request("DISPUTED", 5, 3),
  ],
  inbounds: [
    { status: "PLANNED", quantity: 20 },
    { status: "ARRIVED", quantity: 10 },
  ],
};
test("les KPI de chaque page distinguent stock, demandes, préparation, livraisons et planification", () => {
  const values = (role, page) =>
    supplyMetrics(data, role, page).map((r) => r[1]);
  assert.deepEqual(values("am", ""), [4, 1, 1, 15]);
  assert.deepEqual(values("commercial", "stock"), [7, 2, 1, 15]);
  assert.deepEqual(values("supply", "stock"), [15, 14, 4, 1]);
  assert.deepEqual(values("supply", "preparation"), [1, 3, 4, 3]);
  assert.deepEqual(values("supply", "livraisons"), [1, 3, 2, 1]);
  assert.deepEqual(values("supply", "plan"), [8, 1, 20, 1]);
  assert.deepEqual(values("am", "dashboard"), [4, 9, 2, 3]);
  assert.deepEqual(values("commercial", "dashboard"), [1, 1, 2, 1]);
  assert.deepEqual(values("supply", "dashboard"), [4, 1, 3, 3]);
  assert.deepEqual(
    supplyMetrics({ chooseManager: true }, "am", "dashboard"),
    [],
  );
});

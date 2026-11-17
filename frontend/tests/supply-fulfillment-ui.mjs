import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createProductionServer } from "../server/production.mjs";
import { assertSupplyAction } from "../server/supply-access.mjs";
import { openSupplyStore } from "../server/supply-store.mjs";

const catalogue = {
  areaManagers: [{ id: "AM", name: "Area manager Centre" }],
  products: [{ id: "P", name: "Kit Jua" }],
  warehouses: [{ id: "W", name: "Entrepôt central" }],
  stock: [{ warehouseId: "W", productId: "P", quantity: 10 }],
  estimates: [{ managerId: "AM", productId: "P", stock: 3, estimatedNeed: 8 }],
  sourceLoadedAt: "2026-11-16T18:00:00Z",
  observedAt: new Date().toISOString(),
};
const kits = Array.from({ length: 10 }, (_, i) => ({
  serialNumber: `KIT${i + 1}`,
  productId: "P",
  warehouseId: "W",
}));
const store = openSupplyStore(":memory:");
const requested = store.create(
  {
    requestKey: "seed",
    managerId: "AM",
    actor: "Commercial",
    neededOn: "2026-12-01",
    lines: [{ productId: "P", quantity: 2 }],
  },
  catalogue,
);
store.review(
  {
    action: "approve",
    id: requested.id,
    version: 1,
    actor: "Supply",
    warehouseId: "W",
    lines: [{ productId: "P", quantity: 2 }],
  },
  catalogue,
);
const database = {
  async supplyWorkspace() {
    return {
      catalogue,
      reservations: store.reservations(),
      requests: store.list(),
      inbounds: store.inbounds(),
    };
  },
  async supplyKitOptions() {
    return { kits };
  },
  async areaManagerWorkspace(managerId) {
    if (!managerId)
      return { chooseManager: true, areaManagers: catalogue.areaManagers };
    return {
      manager: catalogue.areaManagers[0],
      areaManagers: catalogue.areaManagers,
      catalogue,
      requests: store.list().filter((r) => r.managerId === managerId),
      reservations: [],
      holders: [],
    };
  },
  async supplyAction(body, role, managerId) {
    assertSupplyAction(store, body, role, managerId);
    if (["prepare", "dispatch"].includes(body.action))
      return store[body.action](body, kits);
    if (["receive", "resolve"].includes(body.action))
      return store[body.action](body);
    if (body.action.includes("inbound")) return store.inbound(body, catalogue);
    if (body.action === "cancel") return store.cancel(body, role);
    return store.review(body, catalogue);
  },
  health: async () => {},
  close: async () => store.close(),
};
const app = createProductionServer({ database });
let browser;
try {
  await new Promise((done) => app.server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/supply-chain/preparation");
  await page.getByRole("button", { name: "Préparer", exact: true }).click();
  await page.getByLabel("Votre nom").fill("Supply test");
  await page.getByLabel("KIT1", { exact: true }).check();
  await page.getByLabel("KIT2", { exact: true }).check();
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await page.getByText("Les kits sont préparés.", { exact: true }).waitFor();
  assert.equal(store.list()[0].status, "PREPARED");
  await page.getByRole("tab", { name: "Prêtes", exact: true }).click();
  await page.getByRole("button", { name: "Expédier", exact: true }).click();
  await page
    .getByLabel("Transporteur", { exact: true })
    .fill("Transport Centre");
  await page
    .getByLabel("Référence d’expédition", { exact: true })
    .fill("EXP-001");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await page.getByText("Expédition enregistrée.", { exact: true }).waitFor();
  assert.equal(store.list()[0].lines[0].shipped, 2);
  await page.goto(base + "/area-manager/livraisons?tab=confirm&managerId=AM");
  await page
    .getByRole("button", { name: "Confirmer la réception", exact: true })
    .click();
  await page.getByLabel("Votre nom").fill("Commercial test");
  await page
    .getByLabel("Réception KIT2", { exact: true })
    .selectOption("MISSING");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await page.getByText("Réception enregistrée.", { exact: true }).waitFor();
  assert.equal(store.list()[0].status, "DISPUTED");
  assert.equal(store.list()[0].lines[0].received, 1);
  await page.goto(base + "/supply-chain/livraisons?tab=issues");
  await page
    .getByRole("button", { name: "Résoudre l’écart", exact: true })
    .click();
  await page
    .getByLabel("Précisions sur la résolution")
    .fill("Le kit manquant est suivi dans le dossier transporteur.");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await page.getByText("Écart résolu.", { exact: true }).waitFor();
  assert.equal(store.list()[0].status, "RESOLVED");
  assert.equal(store.list()[0].lines[0].received, 1);
  await page.goto(base + "/supply-chain/plan?tab=inbound");
  await page
    .getByRole("button", { name: "Prévoir une réception", exact: true })
    .click();
  await page.getByLabel("Entrepôt", { exact: true }).selectOption("W");
  await page.getByLabel("Produit", { exact: true }).selectOption("P");
  await page.getByLabel("Quantité prévue").fill("20");
  await page.getByLabel("Date prévue").fill("2026-12-05");
  await page.getByLabel("Référence fournisseur").fill("FOURN-001");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await page.getByText("Réception planifiée.", { exact: true }).waitFor();
  assert.equal(store.inbounds().length, 1);
  await page
    .getByRole("button", { name: "Déclarer l’arrivée", exact: true })
    .click();
  await page
    .getByText("Arrivée déclarée. Le stock reste celui enregistré dans Upya.", {
      exact: true,
    })
    .waitFor();
  assert.equal(store.inbounds()[0].status, "ARRIVED");
  assert.equal(catalogue.stock[0].quantity, 10);
  for (const role of ["commercial", "supply-chain"]) {
    await page.goto(base + `/${role}/stock`);
    await page.getByRole("table").waitFor();
    assert.ok((await page.getByRole("table").innerText()).includes("Kit Jua"));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  const denied = await fetch(base + "/api/supply-requests?role=commercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "dispatch" }),
  });
  assert.equal(denied.status, 403);
  assert.deepEqual(errors, []);
  console.log(
    "Menus stock, preparation par identifiant, expedition, reception avec ecart, resolution, planification et mobile : OK.",
  );
} finally {
  await browser?.close();
  await app.close();
}

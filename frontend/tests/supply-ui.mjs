import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createProductionServer } from "../server/production.mjs";
import { assertSupplyAction } from "../server/supply-access.mjs";
import { openSupplyStore } from "../server/supply-store.mjs";

const catalogue = {
  areaManagers: [
    { id: "AM1", name: "Area manager Centre" },
    { id: "AM2", name: "Area manager Ouest" },
  ],
  products: [
    { id: "P1", name: "Kit Jua" },
    { id: "P2", name: "SunShine" },
  ],
  warehouses: [{ id: "W1", name: "Entrepôt central" }],
  stock: [
    { warehouseId: "W1", productId: "P1", quantity: 10 },
    { warehouseId: "W1", productId: "P2", quantity: 3 },
  ],
  estimates: [
    { managerId: "AM1", productId: "P1", stock: 2, estimatedNeed: 7 },
  ],
  estimation: {
    observationDays: 90,
    horizonDays: 90,
    bufferDays: 14,
    start: "2026-08-20",
    end: "2026-11-17",
  },
  sourceLoadedAt: "2026-11-16T18:00:00Z",
  observedAt: new Date().toISOString(),
};
const store = openSupplyStore(":memory:");
const database = {
  async supplyWorkspace() {
    return {
      catalogue,
      reservations: store.reservations(),
      requests: store.list(),
    };
  },
  async areaManagerWorkspace(managerId, { kits = false } = {}) {
    if (!managerId)
      return { chooseManager: true, areaManagers: catalogue.areaManagers };
    const manager = catalogue.areaManagers.find((m) => m.id === managerId);
    if (kits)
      return {
        kits:
          managerId === "AM1"
            ? [
                {
                  serialNumber: "KIT-CENTRE",
                  productReference: "P1",
                  productName: "Kit Jua",
                  agentName: "Agent Centre",
                },
              ]
            : [],
      };
    return {
      manager,
      areaManagers: catalogue.areaManagers,
      catalogue: { ...catalogue, areaManagers: [manager] },
      requests: store.list().filter((r) => r.managerId === managerId),
      reservations: [],
      holders:
        managerId === "AM1"
          ? [
              {
                key: "AG1",
                label: "Agent Centre",
                productReference: "P1",
                productName: "Kit Jua",
                instock: 2,
              },
            ]
          : [],
      metrics: {
        available: { value: managerId === "AM1" ? 2 : 0 },
        deployed: { value: 3 },
      },
      analysis: {
        window: {
          start: "2026-08-20",
          end: "2026-11-17",
          days: 90,
          granularity: "month",
        },
        months: ["2026-10", "2026-11"],
        rows: [
          {
            month: "2026-11",
            product: "P1",
            productName: "Kit Jua",
            status: "DEPLOYED",
            quantity: 3,
            amId: managerId,
          },
        ],
      },
    };
  },
  async supplyAction(body, role, managerId) {
    assertSupplyAction(store, body, role, managerId);
    if (["transmit", "reject-proposal"].includes(body.action))
      return store.transmit(body);
    if (body.action === "create")
      return store.create(body, catalogue, { proposed: true });
    if (body.action === "update") return store.update(body, catalogue);
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
  await page.goto(base + "/area-manager/besoins?managerId=AM1");
  assert.equal(
    await page.locator(".role-operations .app-shell > .sidebar").count(),
    1,
  );
  await page.locator(".overview-metric").first().waitFor();
  assert.equal(await page.locator(".overview-metric").count(), 4);
  assert.ok(
    await page
      .locator(".sidebar")
      .evaluate((node) =>
        getComputedStyle(node).backgroundImage.includes("linear-gradient"),
      ),
  );
  await page.getByRole("button", { name: "Réduire la barre latérale" }).click();
  assert.equal(await page.locator(".sidebar-collapsed").count(), 1);
  await page.getByRole("button", { name: "Déplier la barre latérale" }).click();
  await page
    .getByRole("button", { name: "Nouvelle demande", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Nouvelle demande de stock" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("navigation", {
        name: "Menu des approvisionnements",
        includeHidden: true,
      })
      .count(),
    1,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Nouvelle demande", exact: true })
    .click();
  await page.getByLabel("Votre nom", { exact: true }).fill("AM test");
  assert.equal(
    await page.getByLabel("Area manager", { exact: true }).isDisabled(),
    true,
  );
  await page.getByLabel("Produit", { exact: true }).selectOption("P1");
  await page.getByLabel("Quantité", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Envoyer au commercial" }).click();
  await page
    .getByText("Proposition envoyée au commercial.", { exact: true })
    .waitFor();
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].lines[0].requested, 8);
  await page
    .getByRole("button", { name: "Fermer la demande", exact: true })
    .click();
  assert.equal(
    await page.getByRole("combobox", { name: "État des demandes" }).count(),
    0,
  );
  await page.getByRole("tab", { name: "En cours", exact: true }).click();
  const columns = [
    "Kit",
    "En stock",
    "Besoin estimé",
    "Besoin proposé",
    "Besoin couvert",
    "Statut",
    "Actions",
  ];
  assert.deepEqual(
    await page.locator(".supply-request-table-panel th").allTextContents(),
    columns,
  );
  const cells = await page
    .locator(".supply-request-table-panel tbody tr")
    .first()
    .locator("td")
    .allTextContents();
  assert.equal(cells[1], "2");
  assert.equal(cells[2], "7");
  assert.equal(cells[3], "8");

  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page.getByLabel("Quantit\u00e9", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Enregistrer les modifications", exact: true })
    .click();
  await page.getByText("Proposition modifi\u00e9e.", { exact: true }).waitFor();
  assert.equal(store.list()[0].lines[0].managerProposed, 9);
  await page
    .getByRole("button", { name: "Fermer la demande", exact: true })
    .click();
  assert.equal(store.list()[0].status, "PROPOSED");
  const hidden = await (
    await fetch(base + "/api/supply-requests?role=supply")
  ).json();
  assert.equal(hidden.requests.length, 0);
  await page.goto(base + "/commercial");
  await page
    .getByRole("button", { name: "V\u00e9rifier", exact: true })
    .click();
  await page.getByLabel("Commercial", { exact: true }).fill("Commercial test");
  await page.getByLabel("Quantit\u00e9 transmise Kit Jua").fill("8");
  await page
    .getByRole("button", { name: "Transmettre \u00e0 la supply chain" })
    .click();
  await page
    .getByText("Demande transmise \u00e0 la supply chain.", { exact: true })
    .waitFor();
  assert.equal(store.list()[0].status, "SUBMITTED");
  await page.getByRole("link", { name: "Supply chain", exact: true }).click();
  await page
    .getByRole("heading", { name: "R\u00e9sum\u00e9", exact: true })
    .waitFor();
  await page.locator(".overview-metric").first().waitFor();
  assert.equal(await page.locator(".overview-metric").count(), 4);
  assert.equal(await page.getByRole("tablist").count(), 0);
  await page
    .getByRole("link", { name: "Traiter les demandes", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Demandes à approvisionner", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Traiter", exact: true })
    .first()
    .click();
  assert.equal(await page.getByRole("dialog").locator("table").count(), 0);
  assert.equal(
    await page
      .getByRole("dialog")
      .getByText("Historique de la demande", { exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Votre nom").fill("Supply test");
  await page.getByLabel("Quantité validée Kit Jua").fill("6");
  assert.equal(await page.getByLabel("Commentaire de traitement").count(), 0);
  assert.equal(await page.getByLabel("Motif du refus").count(), 0);
  await page.getByRole("button", { name: "Refuser", exact: true }).click();
  await page.getByLabel("Motif du refus").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirmer le refus", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  assert.equal(await page.getByLabel("Motif du refus").count(), 0);
  await page
    .getByRole("button", { name: "Valider les quantités", exact: true })
    .click();
  await page
    .getByText(
      "Demande validée. Les quantités sont réservées dans l’application.",
      { exact: true },
    )
    .waitFor();
  assert.equal(store.list()[0].status, "APPROVED");
  assert.equal(store.list()[0].lines[0].approved, 6);
  await page
    .getByRole("button", { name: "Fermer la demande", exact: true })
    .click();
  await page.goto(base + "/commercial?tab=current");
  await page
    .getByRole("button", { name: "D\u00e9tails", exact: true })
    .first()
    .click();
  assert.equal(store.list()[0].reviewer, "Supply test");
  assert.equal(store.list()[0].reviewNote, "");
  assert.ok(
    (
      await page.getByRole("dialog").locator(".supply-table").innerText()
    ).includes("6"),
  );
  await page
    .getByRole("button", { name: "Fermer la demande", exact: true })
    .click();
  await page.goto(base + "/area-manager/besoins?managerId=AM1&tab=current");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Nouvelle demande", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Nouvelle demande de stock" });
  await modal.waitFor();
  const bounds = await modal.boundingBox();
  assert.ok(bounds.width <= 390);
  await page
    .getByRole("button", { name: "Fermer la nouvelle demande" })
    .click();
  await modal.waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page
    .getByRole("combobox", { name: "Mon Area manager", exact: true })
    .selectOption("AM2");
  await page.getByRole("tab", { name: "En cours", exact: true }).click();
  await page
    .getByText("Aucune demande pour cette s\u00e9lection.", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".supply-request-table-panel h2").count(), 0);
  await page.goto(base + "/area-manager?managerId=AM1");
  await page
    .getByText("Stock disponible dans mon r\u00e9seau", { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Voir les kits", exact: true })
    .click();
  await page.getByRole("cell", { name: "KIT-CENTRE", exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "T\u00e9l\u00e9charger Excel : Liste compl\u00e8te des kits de mon r\u00e9seau",
      exact: true,
    })
    .click();
  assert.ok((await download).suggestedFilename().endsWith(".xlsx"));
  await page
    .getByRole("button", { name: "Voir tous les kits", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Par d\u00e9tenteur", exact: true })
    .click();
  await page.getByRole("cell", { name: "Agent Centre", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Liste des kits", exact: true }).click();
  await page.getByRole("cell", { name: "KIT-CENTRE", exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Mon activit\u00e9", exact: true })
    .click();
  await page
    .getByText("Ventes de mon r\u00e9seau", { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("tab", { name: "\u00c9volution du stock", exact: true })
    .click();
  await page
    .getByText("\u00c9volution du stock de mon r\u00e9seau", { exact: true })
    .first()
    .waitFor();
  store.create(
    {
      requestKey: "cancel-me",
      managerId: "AM1",
      actor: "AM test",
      neededOn: "2026-12-01",
      lines: [{ productId: "P1", quantity: 1 }],
    },
    catalogue,
    { proposed: true },
  );
  await page.goto(base + "/area-manager/besoins?managerId=AM1&tab=current");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirmer l\u2019annulation", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("Motif d\u2019annulation", { exact: true })
    .fill("Besoin d\u00e9j\u00e0 couvert");
  await page
    .getByRole("button", { name: "Confirmer l\u2019annulation", exact: true })
    .click();
  await page.getByText("Demande annul\u00e9e.", { exact: true }).waitFor();
  assert.equal(store.list().filter((r) => r.status === "CANCELLED").length, 1);
  await page.goto(base + "/area-manager?managerId=AM1");
  await page
    .getByRole("button", { name: "Demander ce kit", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Produit", { exact: true }).inputValue(),
    "P1",
  );
  assert.equal(
    await page.getByLabel("Quantit\u00e9", { exact: true }).inputValue(),
    "7",
  );
  await page
    .getByRole("button", { name: "Envoyer au commercial", exact: true })
    .click();
  await page.waitForURL("**/area-manager/besoins?managerId=AM1&tab=current");
  await page.getByRole("tab", { name: "En cours", exact: true }).waitFor();
  assert.equal(store.list().filter((r) => r.status === "PROPOSED").length, 1);
  for (const [path, scope] of [
    ["/area-manager/dashboard?managerId=AM1", "am"],
    ["/commercial/dashboard", "commercial"],
    ["/supply-chain/dashboard", "supply"],
  ]) {
    await page.goto(base + path);
    await page
      .getByRole("heading", { name: "R\u00e9sum\u00e9", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Mes raccourcis", exact: true })
      .waitFor();
    await page.locator(".overview-metric").first().waitFor();
  assert.equal(await page.locator(".overview-metric").count(), 4);
    assert.equal(await page.getByRole("tablist").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const summaryLabels = await page
      .locator(".overview-metric span")
      .allTextContents();
    const stockPath =
      scope === "am"
        ? "/area-manager?managerId=AM1"
        : scope === "commercial"
          ? "/commercial/stock"
          : "/supply-chain/stock";
    await page.goto(base + stockPath);
    await page.getByRole("table").first().waitFor();
    assert.notDeepEqual(
      await page.locator(".overview-metric span").allTextContents(),
      summaryLabels,
    );
  }
  const blocked = await fetch(base + "/api/supply-requests?role=commercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });
  assert.equal(blocked.status, 403);
  assert.deepEqual(errors, []);
  console.log(
    "Commercial → demande AM → supply → ajustement → validation → suivi commercial, mobile et separation des actions : OK.",
  );
} finally {
  await browser?.close();
  await app.close();
}

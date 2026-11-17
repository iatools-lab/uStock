const sum = (rows, key) => rows.reduce((n, r) => n + Number(r[key] || 0), 0);
const units = (rows, key) =>
  rows.reduce((n, r) => n + sum(r.lines || [], key), 0);
export function supplyMetrics(data, role, page) {
  if (!data || data.chooseManager) return [];
  const requests = data.requests || [],
    estimates = data.catalogue.estimates || [];
  const at = (...states) => requests.filter((r) => states.includes(r.status));
  const available = Number(data.metrics?.available?.value || 0),
    sales = Number(data.metrics?.deployed?.value || 0);
  const stocked = (data.holders || []).filter((r) => r.instock > 0);
  const products = new Set(stocked.map((r) => r.productReference)).size;
  const needs = sum(estimates, "estimatedNeed");
  const warehouseFree = (data.catalogue.stock || []).reduce(
    (n, r) =>
      n +
      Math.max(
        0,
        Number(r.quantity) -
          sum(
            (data.reservations || []).filter(
              (s) =>
                s.warehouseId === r.warehouseId && s.productId === r.productId,
            ),
            "quantity",
          ),
      ),
    0,
  );
  const transit = at("SHIPPED"),
    received = at("RECEIVED", "DISPUTED", "RESOLVED");
  if (page === "livraisons")
    return [
      ["Livraisons en transit", transit.length],
      ["Kits à réceptionner", units(transit, "shipped")],
      ["Kits réceptionnés", units(received, "received")],
      ["Livraisons avec écart ouvert", at("DISPUTED").length],
    ];
  if (role === "am") {
    if (page === "besoins")
      return [
        ["Propositions à vérifier", at("PROPOSED").length],
        ["Demandes en attente supply chain", at("SUBMITTED").length],
        ["Kits validés à préparer", units(at("APPROVED"), "approved")],
        ["Besoin estimé en kits", needs],
      ];
    if (page === "activite")
      return [
        ["Kits vendus sur 90 jours", sales],
        [
          "Produits vendus sur 90 jours",
          new Set(
            (data.analysis?.rows || [])
              .filter((r) => r.status === "DEPLOYED" && r.quantity > 0)
              .map((r) => r.product),
          ).size,
        ],
        ["Stock disponible de mon réseau", available],
        ["Produits disponibles", products],
      ];
    if (page === "dashboard")
      return [
        ["Stock disponible de mon réseau", available],
        ["Kits vendus sur 90 jours", sales],
        ["Besoins en attente", at("PROPOSED", "SUBMITTED").length],
        ["Kits à réceptionner", units(transit, "shipped")],
      ];
    return [
      ["Stock disponible de mon réseau", available],
      ["Produits disponibles", products],
      ["Détenteurs avec du stock", new Set(stocked.map((r) => r.key)).size],
      ["Besoin estimé en kits", needs],
    ];
  }
  if (role === "commercial") {
    if (page === "stock")
      return [
        ["Stock disponible des réseaux AM", sum(estimates, "stock")],
        [
          "Area managers avec du stock",
          new Set(estimates.filter((r) => r.stock > 0).map((r) => r.managerId))
            .size,
        ],
        [
          "Produits disponibles",
          new Set(estimates.filter((r) => r.stock > 0).map((r) => r.productId))
            .size,
        ],
        ["Besoin estimé en kits", needs],
      ];
    if (page === "dashboard")
      return [
        ["Propositions à vérifier", at("PROPOSED").length],
        ["Demandes en attente supply chain", at("SUBMITTED").length],
        [
          "Area managers avec un besoin estimé",
          new Set(
            estimates
              .filter((r) => r.estimatedNeed > 0)
              .map((r) => r.managerId),
          ).size,
        ],
        ["Livraisons en transit", transit.length],
      ];
    return [
      ["Propositions à vérifier", at("PROPOSED").length],
      ["Kits proposés à vérifier", units(at("PROPOSED"), "requested")],
      ["Demandes en attente supply chain", at("SUBMITTED").length],
      ["Demandes refusées", at("REJECTED").length],
    ];
  }
  if (page === "stock")
    return [
      [
        "Stock source des entrepôts",
        sum(data.catalogue.stock || [], "quantity"),
      ],
      ["Kits réservés", sum(data.reservations || [], "quantity")],
      ["Kits disponibles après réservation", warehouseFree],
      [
        "Entrepôts avec du stock",
        new Set(
          (data.catalogue.stock || [])
            .filter((r) => r.quantity > 0)
            .map((r) => r.warehouseId),
        ).size,
      ],
    ];
  if (page === "preparation")
    return [
      ["Demandes à préparer", at("APPROVED").length],
      ["Kits à préparer", units(at("APPROVED"), "approved")],
      ["Kits prêts à expédier", units(at("PREPARED"), "prepared")],
      ["Kits en transit", units(transit, "shipped")],
    ];
  if (page === "plan") {
    const planned = (data.inbounds || []).filter((r) => r.status === "PLANNED");
    const gaps = at("SUBMITTED", "APPROVED", "PREPARED")
      .flatMap((r) => r.lines)
      .reduce((n, l) => n + Math.max(0, l.requested - l.approved), 0);
    return [
      ["Kits demandés non couverts", gaps],
      ["Réceptions prévues", planned.length],
      ["Kits attendus des fournisseurs", sum(planned, "quantity")],
      [
        "Arrivées déclarées",
        (data.inbounds || []).filter((r) => r.status === "ARRIVED").length,
      ],
    ];
  }
  if (page === "dashboard")
    return [
      ["Kits disponibles après réservation", warehouseFree],
      ["Demandes à traiter", at("SUBMITTED").length],
      ["Kits à préparer", units(at("APPROVED"), "approved")],
      ["Kits en transit", units(transit, "shipped")],
    ];
  return [
    ["Demandes à traiter", at("SUBMITTED").length],
    ["Kits demandés en attente", units(at("SUBMITTED"), "requested")],
    ["Demandes validées à préparer", at("APPROVED").length],
    ["Demandes refusées", at("REJECTED").length],
  ];
}

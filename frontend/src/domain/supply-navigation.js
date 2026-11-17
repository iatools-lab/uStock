export const supplyMenus = {
  am: [
    { id: "dashboard", label: "Résumé", tabs: [] },
    {
      id: "",
      label: "Mon stock",
      tabs: [
        ["products", "Par produit"],
        ["holders", "Par détenteur"],
        ["kits", "Liste des kits"],
      ],
    },
    {
      id: "besoins",
      label: "Mes besoins",
      tabs: [
        ["propose", "À proposer"],
        ["current", "En cours"],
        ["history", "Historique"],
      ],
    },
    {
      id: "livraisons",
      label: "Mes livraisons",
      tabs: [
        ["expected", "Attendues"],
        ["confirm", "À réceptionner"],
        ["received", "Réceptionnées"],
      ],
    },
    {
      id: "activite",
      label: "Mon activité",
      tabs: [
        ["sales", "Ventes"],
        ["stock", "Évolution du stock"],
      ],
    },
  ],
  commercial: [
    { id: "dashboard", label: "Résumé", tabs: [] },
    {
      id: "",
      label: "Demandes de stock",
      tabs: [
        ["verify", "À vérifier"],
        ["current", "En cours"],
        ["processed", "Traitées"],
        ["history", "Historique"],
      ],
    },
    {
      id: "stock",
      label: "Stock des Area managers",
      tabs: [
        ["managers", "Par Area manager"],
        ["products", "Par produit"],
      ],
    },
    {
      id: "livraisons",
      label: "Livraisons et réceptions",
      tabs: [
        ["expected", "Attendues"],
        ["confirm", "En transit"],
        ["received", "Réceptionnées"],
      ],
    },
  ],
  supply: [
    { id: "dashboard", label: "Résumé", tabs: [] },
    {
      id: "",
      label: "Demandes reçues",
      tabs: [
        ["pending", "À traiter"],
        ["approved", "Validées"],
        ["rejected", "Refusées"],
      ],
    },
    {
      id: "stock",
      label: "Stock des entrepôts",
      tabs: [
        ["available", "Disponible"],
        ["reserved", "Réservé"],
        ["products", "Par produit"],
      ],
    },
    {
      id: "preparation",
      label: "Préparation et expédition",
      tabs: [
        ["prepare", "À préparer"],
        ["ready", "Prêtes"],
        ["shipped", "Expédiées"],
      ],
    },
    {
      id: "livraisons",
      label: "Suivi des livraisons",
      tabs: [
        ["transit", "En cours"],
        ["delivered", "Livrées"],
        ["issues", "Avec écart"],
      ],
    },
    {
      id: "plan",
      label: "Plan d’approvisionnement",
      tabs: [
        ["gaps", "Besoins non couverts"],
        ["inbound", "Réceptions prévues"],
      ],
    },
  ],
};
export const supplyStates = {
  PROPOSED: "À vérifier par le commercial",
  UPDATED: "Proposition modifiée",
  SUBMITTED: "À traiter",
  APPROVED: "Validée",
  PREPARED: "Prête",
  SHIPPED: "Expédiée",
  RECEIVED: "Réceptionnée",
  DISPUTED: "Avec écart",
  RESOLVED: "Écart résolu",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};
export function requestsForTab(requests, role, page, tab) {
  if (role === "am") {
    const statuses =
      page === "besoins"
        ? {
            propose: ["PROPOSED"],
            current: [
              "PROPOSED",
              "SUBMITTED",
              "APPROVED",
              "PREPARED",
              "SHIPPED",
              "DISPUTED",
            ],
            history: ["RECEIVED", "RESOLVED", "REJECTED", "CANCELLED"],
          }[tab]
        : page === "livraisons"
          ? {
              expected: ["APPROVED", "PREPARED"],
              confirm: ["SHIPPED"],
              received: ["RECEIVED", "DISPUTED", "RESOLVED"],
            }[tab]
          : null;
    return statuses
      ? requests.filter((r) => statuses.includes(r.status))
      : requests;
  }
  const groups =
    role === "commercial"
      ? {
          "": {
            verify: ["PROPOSED"],
            current: [
              "SUBMITTED",
              "APPROVED",
              "PREPARED",
              "SHIPPED",
              "DISPUTED",
            ],
            processed: ["RECEIVED", "RESOLVED", "REJECTED", "CANCELLED"],
          },
          livraisons: {
            expected: ["APPROVED", "PREPARED"],
            confirm: ["SHIPPED"],
            received: ["RECEIVED", "DISPUTED", "RESOLVED"],
          },
        }
      : {
          "": {
            pending: ["SUBMITTED"],
            approved: [
              "APPROVED",
              "PREPARED",
              "SHIPPED",
              "RECEIVED",
              "DISPUTED",
              "RESOLVED",
            ],
            rejected: ["REJECTED"],
          },
          preparation: {
            prepare: ["APPROVED"],
            ready: ["PREPARED"],
            shipped: ["SHIPPED", "RECEIVED", "DISPUTED", "RESOLVED"],
          },
          livraisons: {
            transit: ["SHIPPED"],
            delivered: ["RECEIVED", "RESOLVED"],
            issues: ["DISPUTED"],
          },
        };
  const statuses = groups[page]?.[tab];
  return statuses
    ? requests.filter((r) => statuses.includes(r.status))
    : requests;
}

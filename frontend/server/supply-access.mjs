import { SupplyError } from "./supply-store.mjs";

export const supplyPermissions = {
  create: ["am"],
  update: ["am"],
  transmit: ["commercial"],
  "reject-proposal": ["commercial"],
  approve: ["supply"],
  reject: ["supply"],
  cancel: ["am", "commercial", "supply"],
  prepare: ["supply"],
  dispatch: ["supply"],
  receive: ["am"],
  resolve: ["supply"],
  "plan-inbound": ["supply"],
  "arrive-inbound": ["supply"],
  "cancel-inbound": ["supply"],
};
export function visibleRequests(requests, role, managerId) {
  if (role === "am") return requests.filter((r) => r.managerId === managerId);
  if (role === "supply")
    return requests.filter(
      (r) => r.status !== "PROPOSED" && (r.origin !== "AM" || r.transmittedAt),
    );
  return requests;
}
export function assertSupplyAction(store, body, role, managerId) {
  if (!supplyPermissions[body.action]?.includes(role))
    throw new SupplyError("Action non autorisée pour ce rôle.", 403);
  if (role === "am") {
    if (!managerId)
      throw new SupplyError("Choisissez votre Area manager.", 400);
    if (body.action === "create") {
      if (body.managerId !== managerId)
        throw new SupplyError("La demande doit concerner votre réseau.", 403);
    } else if (
      !store.list().some((r) => r.id === body.id && r.managerId === managerId)
    ) {
      throw new SupplyError("Demande introuvable dans votre réseau.", 404);
    }
  }
  if (
    role === "supply" &&
    ["approve", "reject", "cancel"].includes(body.action)
  ) {
    if (!visibleRequests(store.list(), role).some((r) => r.id === body.id))
      throw new SupplyError(
        "La proposition n’a pas été transmise par le commercial.",
        403,
      );
  }
}

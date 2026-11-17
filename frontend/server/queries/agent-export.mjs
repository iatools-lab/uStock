// Le DILE est une relation déclarée dans le référentiel, jamais une déduction géographique.
export function agentExportFields(agentId, byId, fallbackRole = "") {
  const agent = byId.get(agentId),
    dileId = agent?.dileId || "";
  return {
    agentRole: agent?.role || fallbackRole || "",
    dileNumber: dileId,
    dileName: dileId ? byId.get(dileId)?.agent_name || "" : "",
  };
}

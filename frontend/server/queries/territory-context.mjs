import {
  loadTerritories,
  loadAgentAssignments,
  mapAgents,
  locateAgent,
  enrichAgentNetwork,
} from "./territories.mjs";

export async function loadStockContext(c, asOfDate) {
  const territories = await loadTerritories();
  const assignments = await loadAgentAssignments();
  // Les données CRM sont relues ; seules leurs correspondances géographiques inchangées sont mémorisées.
  const agents = mapAgents(
    (
      await c.query(
        `SELECT agent_number,agent_name,role,is_active,team,entity_name,location_region,location_district,location_arrondissement,location_commune,location_village,location_zone FROM bi_schema.dim_agents`,
      )
    ).rows,
    territories,
    assignments,
  );
  const daily = (
    await c.query(
      `SELECT DISTINCT ON(holder_id) holder_id,holder_name,holder_role FROM bi_schema.fct_asset_stock_daily WHERE holder_category='AGENT' AND holder_id IS NOT NULL ORDER BY holder_id,snapshot_date DESC`,
    )
  ).rows;
  const agentIndex = new Map(
    agents.map((agent) => [agent.agent_number, agent]),
  );
  for (const row of daily) {
    let agent = agentIndex.get(row.holder_id);
    if (!agent) {
      agent = {
        agent_number: row.holder_id,
        agent_name: row.holder_name,
        role: row.holder_role,
        ...locateAgent(
          { agent_name: row.holder_name, role: row.holder_role },
          territories,
        ),
      };
      agents.push(agent);
      agentIndex.set(agent.agent_number, agent);
    } else if (!agent.region || !agent.zone) {
      const old = locateAgent(
        { ...agent, agent_name: row.holder_name, role: row.holder_role },
        territories,
      );
      for (const field of ["region", "department", "arrondissement", "zone"])
        if (!agent[field] && old[field]) {
          agent[field] = old[field];
          agent.method = "daily_holder";
        }
    }
  }
  const network = (
    await c.query(
      `WITH ordered AS (
    SELECT holder_id,holder_category,start_at,
      lag(holder_id) OVER(PARTITION BY serial_number ORDER BY start_at,period_no) AS source_id,
      lag(holder_role) OVER(PARTITION BY serial_number ORDER BY start_at,period_no) AS source_role,
      lag(holder_category) OVER(PARTITION BY serial_number ORDER BY start_at,period_no) AS source_category
    FROM bi_schema.fct_asset_holding_periods WHERE start_at < (($1::date+1)::timestamp AT TIME ZONE 'Africa/Douala')
  ) SELECT DISTINCT holder_id,source_id,source_role FROM ordered WHERE holder_category='AGENT' AND source_category='AGENT' AND source_role IN ('POINT RELAIS','AREA MANAGER') AND holder_id<>source_id`,
      [asOfDate],
    )
  ).rows;
  enrichAgentNetwork(agents, network);
  const byId = new Map(agents.map((a) => [a.agent_number, a]));
  const decorate = (row) => {
    const agent = byId.get(row.holder_id);
    const route = byId.get(row.routing_shop_id);
    const useRoute =
      agent?.holderKind !== "central" &&
      route?.holderKind === "shop" &&
      (!agent?.zone || !route.zone || agent.zone === route.zone) &&
      (!agent?.region || !route.region || agent.region === route.region);
    return {
      ...row,
      productReference: row.product_reference,
      holderId: row.holder_id,
      holderName: row.holder_name || agent?.agent_name,
      holderKind: agent?.holderKind || "unknown",
      region: agent?.region || (useRoute ? route.region : null),
      department: agent?.department || (useRoute ? route.department : null),
      arrondissement:
        agent?.arrondissement || (useRoute ? route.arrondissement : null),
      zone: agent?.zone || (useRoute ? route.zone : null),
      amId: agent?.amId || (useRoute ? route.amId : null),
      shopId:
        row.status === "DEPLOYED" && useRoute
          ? route.agent_number
          : agent?.shopId || (useRoute ? route.agent_number : null),
      method: useRoute && !agent?.region ? "distribution_shop" : agent?.method,
      conflict: agent?.conflict,
    };
  };
  return { territories, agents, byId, decorate };
}

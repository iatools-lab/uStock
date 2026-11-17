import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAgentAssignments,
  mapAgents,
} from "../server/queries/territories.mjs";
import { agentExportFields } from "../server/queries/agent-export.mjs";
test("le DILE est issu du matricule déclaré, sans rattachement inventé ou ambigu", () => {
  const book = [
    {
      sheet: "Agents_uniformises",
      data: [
        ["Agent Number"],
        ["A", "Agent", "BA"],
        ["B", "Agent B", "BA"],
        ["D", "Responsable DILE", "DILE"],
        ["C", "Agent C", "BA"],
      ],
    },
    {
      sheet: "Informations_complementaires",
      data: [
        ["Agent Number"],
        ["A", null, null, null, "D"],
        ["B", null, null, null, null],
        ["C", null, null, null, "D"],
        ["C", null, null, null, "OTHER"],
      ],
    },
  ];
  const assignments = parseAgentAssignments(book);
  const agents = mapAgents([], [], assignments),
    byId = new Map(agents.map((a) => [a.agent_number, a]));
  assert.deepEqual(agentExportFields("A", byId), {
    agentRole: "BA",
    dileNumber: "D",
    dileName: "Responsable DILE",
  });
  assert.deepEqual(agentExportFields("B", byId), {
    agentRole: "BA",
    dileNumber: "",
    dileName: "",
  });
  assert.equal(agentExportFields("C", byId).dileNumber, "");
  assert.deepEqual(agentExportFields("absent", byId, "POINT RELAIS"), {
    agentRole: "POINT RELAIS",
    dileNumber: "",
    dileName: "",
  });
  byId.get("A").dileId = "UNKNOWN";
  assert.equal(agentExportFields("A", byId).dileName, "");
});

import assert from "node:assert/strict";
import test from "node:test";
import { getAgentCalls, getCallStatus, visibleAgentNodes } from "../app/chat/agentCalls.mjs";

const node = (id, kind = "agent") => ({ id, name: id, kind, x: 50, y: 50 });
const retention = ["retention", "technical", "legal", "parts", "warranty", "strategy", "claim-process"].map((id) => node(id));

test("Process calls every Data Agent through MCP, not through another Data Agent", () => {
  const calls = getAgentCalls("retention", retention);
  assert.deepEqual(calls.filter((call) => call.protocol === "MCP").map((call) => call.target).sort(), ["legal", "parts", "technical", "warranty"]);
  assert.ok(calls.filter((call) => call.protocol === "MCP").every((call) => call.source === "retention"));
  assert.match(calls.find((call) => call.target === "parts").input, /Technical Service.*12-36-8-099-417/);
});

test("A2A retains source and destination in both process views", () => {
  for (const phase of ["retention", "claim"]) {
    const call = getAgentCalls(phase, retention).find((call) => call.protocol === "A2A");
    assert.equal(call.source, "retention");
    assert.equal(call.target, "claim-process");
    assert.match(call.input, /DealerRepairAndClaimSubmitted/);
  }
});

test("future handoff stays pending even when all retention agents have completed", () => {
  const call = getAgentCalls("retention", retention).find((call) => call.protocol === "A2A");
  assert.equal(getCallStatus(call, { retention: "done", technical: "done", legal: "done", parts: "done", strategy: "done" }), "waiting");
  assert.equal(getCallStatus(call, { "claim-process": "running" }), "running");
  assert.equal(getCallStatus(call, { "claim-process": "done" }), "done");
});

test("intake has no invented Agent call; optional system links are not labeled MCP", () => {
  assert.deepEqual(getAgentCalls("intake", [node("router")]), []);
  const calls = getAgentCalls("intake", [node("router"), node("cco-intake", "system")]);
  assert.equal(calls[0].protocol, "连接");
  assert.deepEqual(getAgentCalls("retention", [node("retention")]), []);
});

test("Claim node and A2A link are absent before Dealer triggers approval", () => {
  // Covers initial planning, completed investigation, customer feedback,
  // waiting for Dealer materials, refusal, and a freshly reset demo.
  for (const statuses of [{}, { retention: "running", "claim-process": "waiting" }, { retention: "done", technical: "done", legal: "done", parts: "done", warranty: "done", strategy: "done", "claim-process": "waiting" }]) {
    const nodes = visibleAgentNodes(retention, statuses);
    assert.equal(nodes.length, 6);
    assert.ok(!nodes.some((node) => node.id === "claim-process"));
    const calls = getAgentCalls("retention", nodes);
    assert.ok(!calls.some((call) => call.protocol === "A2A"));
    assert.equal(calls.filter((call) => call.protocol === "MCP").length, 4);
  }
});

test("Claim and A2A appear when called, persist in history, and disappear on reset", () => {
  for (const status of ["running", "done"]) {
    const statuses = { "claim-process": status };
    const nodes = visibleAgentNodes(retention, statuses);
    assert.equal(nodes.length, 7);
    const call = getAgentCalls("retention", nodes).find((call) => call.protocol === "A2A");
    assert.ok(call);
    assert.equal(getCallStatus(call, statuses), status);
  }
  assert.ok(!visibleAgentNodes(retention, { router: "done" }).some((node) => node.id === "claim-process"));
});

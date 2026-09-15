import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workbench = readFileSync(new URL("../app/chat/ChatWorkbench.tsx", import.meta.url), "utf8");

test("complaint investigation task keeps the requested first-turn experience", () => {
  assert.match(workbench, /lead: "识别到一个高风险投诉。"/);
  assert.match(workbench, /showRecording: false/);
  assert.match(workbench, /actions: \["Start Compliant Investigation", "要求补充更多信息"\]/);
});

test("routers are presented as leading agents with an investigation process agent", () => {
  assert.doesNotMatch(workbench, /type: "Router Agent"/);
  assert.match(workbench, /name: "Complaint Leading Agent"/);
  assert.match(workbench, /name: "Compliant Investigation Process Agent"/);
});

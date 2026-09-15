import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workbench = readFileSync(new URL("../app/chat/ChatWorkbench.tsx", import.meta.url), "utf8");

test("complaint investigation task keeps the requested first-turn experience", () => {
  assert.match(workbench, /lead: "识别到一个高风险投诉。"/);
  assert.match(workbench, /showRecording: false/);
  assert.match(workbench, /streaming: true/);
  assert.match(workbench, /actions: \["Start Compliant Investigation", "要求补充更多信息"\]/);
  const taskMessages = workbench.slice(workbench.indexOf("const complaintInvestigationMessages"), workbench.indexOf("const callTranscript"));
  assert.doesNotMatch(taskMessages, /role: "system"/);
});

test("investigation agent appears only after the start action", () => {
  assert.match(workbench, /if \(!complaintInvestigationStarted\) return complaintInvestigationNodes\.filter/);
  assert.match(workbench, /setComplaintInvestigationStarted\(true\)/);
});

test("complaint task is the refreshed default and supports the same FRD plan update", () => {
  assert.match(workbench, /useState<TaskView>\("complaint-investigation"\)/);
  assert.match(workbench, /startComplaintInvestigationTask\(\);/);
  assert.match(workbench, /plan: retentionPlan/);
  assert.match(workbench, /plan: updatedRetentionPlan/);
  assert.match(workbench, /FRD 保修开始日和当前里程加入待执行计划/);
  assert.match(workbench, /complaint-investigation-command/);
  assert.match(workbench, /complaintPlanAgentsVisible/);
});

test("routers are presented as leading agents with an investigation process agent", () => {
  assert.doesNotMatch(workbench, /type: "Router Agent"/);
  assert.match(workbench, /name: "Complaint Leading Agent"/);
  assert.match(workbench, /name: "Compliant Investigation Process Agent"/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workbench = readFileSync(new URL("../app/chat/ChatWorkbench.tsx", import.meta.url), "utf8");

test("complaint investigation task keeps the requested first-turn experience", () => {
  assert.match(workbench, /lead: "A high-risk complaint has been identified\."/);
  assert.match(workbench, /showRecording: false/);
  assert.match(workbench, /streaming: true/);
  assert.match(workbench, /actions: \["Start Complaint Investigation", "Request more information"\]/);
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
  assert.match(workbench, /FRD warranty start date and current mileage are now included/);
  assert.match(workbench, /complaint-investigation-command/);
  assert.match(workbench, /complaintPlanAgentsVisible/);
});

test("completed complaint data checks create Technical and Mobility confirmation tasks", () => {
  assert.match(workbench, /setComplaintConfirmationsReady\(true\)/);
  assert.match(workbench, /Technical Service · Confirm repair plan · Ms\. Liao/);
  assert.match(workbench, /Mobility Team · Confirm replacement vehicle · Ms\. Liao/);
  assert.match(workbench, /Complaint background:/);
  assert.match(workbench, /Information to confirm:/);
  assert.match(workbench, /Confirm \{confirmationSubject\}/);
  assert.match(workbench, /Correct information/);
});

test("approved department tasks return a Complaint Knowledge Agent recommendation", () => {
  assert.match(workbench, /Complaint Knowledge Agent/);
  assert.match(workbench, /total value of RMB 8,300/);
  assert.match(workbench, /between RMB 7,000 and RMB 9,500/);
  assert.match(workbench, /actions: \["Approve proposal", "Update proposal"\]/);
  assert.match(workbench, /complaintKnowledgeStarted\.current/);
  assert.match(workbench, /placeholder="Do anything"/);
});

test("all complaint data agent results render in one table message", () => {
  assert.match(workbench, /const complaintDataResults: DataResultRow\[\]/);
  assert.match(workbench, /dataResults: complaintDataResults/);
  assert.match(workbench, /<th>Agent<\/th><th>Data checked<\/th><th>Result<\/th>/);
  assert.doesNotMatch(workbench, /Repair History Data Agent result:/);
  assert.match(workbench, /data: "Repair plan"/);
});

test("proposal approval ends with a confirmation-only message", () => {
  assert.match(workbench, /Complaint proposal approval is complete\./);
  assert.match(workbench, /message\.actions\?\.includes\("Approve proposal"\)/);
});

test("routers are presented as leading agents with an investigation process agent", () => {
  assert.doesNotMatch(workbench, /type: "Router Agent"/);
  assert.match(workbench, /name: "Complaint Leading Agent"/);
  assert.match(workbench, /name: "Compliant Investigation Process Agent"/);
});

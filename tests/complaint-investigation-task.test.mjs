import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workbench = readFileSync(new URL("../app/chat/ChatWorkbench.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../app/chat/i18n.tsx", import.meta.url), "utf8");

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

test("complaint streaming keeps the conversation scrolled to the latest output", () => {
  assert.match(workbench, /const messageList = useRef<HTMLDivElement>\(null\)/);
  assert.match(workbench, /if \(list\) list\.scrollTop = list\.scrollHeight/);
  assert.match(workbench, /<div className="chat-messages" ref=\{messageList\}>/);
});

test("complaint progress advances from classification to investigation and resolution review", () => {
  assert.match(workbench, /const steps = \["Risk & Request Classification", "Complaint Investigation", "Resolution Review"\]/);
  assert.match(workbench, /setComplaintExecutionStarted\(true\)/);
  assert.match(workbench, /complaintKnowledgeVisible \? 2 : complaintExecutionStarted \? 1 : 0/);
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
  assert.match(workbench, /Mobility Team · Confirm courtesy car · Ms\. Liao/);
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
  assert.match(workbench, /attachmentReview: dealerAttachmentReview/);
  assert.match(workbench, /Dealer attachments reviewed/);
  assert.match(workbench, /document: "Repair Work Order", status: "Pass"/);
  assert.match(workbench, /document: "Technical Solution", status: "Pass"/);
  assert.match(workbench, /document: "Agreement", status: "Pass"/);
});

test("all complaint data agent results render in one table message", () => {
  assert.match(workbench, /const complaintDataResults: DataResultRow\[\]/);
  assert.match(workbench, /dataResults: complaintDataResults/);
  assert.match(workbench, /<th>Agent<\/th><th>Data checked<\/th><th>Result<\/th>/);
  assert.doesNotMatch(workbench, /Repair History Data Agent result:/);
  assert.match(workbench, /data: "Repair plan"/);
  assert.match(workbench, /data: "Courtesy car"/);
  assert.doesNotMatch(workbench, /replacement[ -]vehicle/i);
  assert.match(workbench, /resultsDelayMs: 5000/);
  assert.match(workbench, />Loading data\.\.\.<\/span>/);
  assert.match(workbench, /!message\.resultsPending && message\.dataResults/);
});

test("courtesy car terminology is consistent across the English experience", () => {
  assert.doesNotMatch(`${workbench}\n${translations}`, /replacement[ -]vehicle|loaner/i);
  assert.match(workbench, /Confirm courtesy car/);
  assert.match(translations, /Courtesy car availability/);
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

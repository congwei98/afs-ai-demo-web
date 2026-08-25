"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Books,
  Car,
  CaretDown,
  ChatText,
  Check,
  CheckCircle,
  CheckSquare,
  ClipboardText,
  Database,
  Eye,
  FileText,
  Flag,
  FlowArrow,
  FolderOpen,
  LockKeyOpen,
  MagicWand,
  Microphone,
  Paperclip,
  Pause,
  PencilSimple,
  Plus,
  Play,
  PaperPlaneTilt,
  PhoneCall,
  Robot,
  Scan,
  ShieldCheck,
  SquaresFour,
  Target,
  Trash,
  UploadSimple,
  WarningCircle,
  Waveform,
  Wrench,
  X,
  Clock,
  Hourglass,
  Buildings,
  ListChecks,
  Headset,
  Sparkle,
} from "@phosphor-icons/react";
import workbenchData from "@/data/workbench.json";
import caseData from "@/data/demo-case.json";
import { historicalCalls, intakeDemo, type CallInsight, type ConversationLine, type HistoricalCall, type SemanticType } from "@/data/intake-demo";
import { optionalReviewAgents, recommendedReviewAgents, reviewPlanContext, settlementRecommendation, type AgentSources, type ReviewAgent } from "@/data/review-plan";

type ReviewState = "plan" | "running" | "results";
type ComplaintSource = "call" | "scan";
type DealerAttachment = {
  name: string;
  type: string;
  detail: string;
};
type DealerSubmission = {
  caseId: string;
  contactSummary: string;
  submittedAt: string;
  attachments: DealerAttachment[];
};
type DealerNegotiationUpdate = {
  outcome: "settled" | "still_requests_return";
  summary: string;
  updatedAt: string;
};
type ScopeCheckResult = "within" | "outside";
type InvestigationApprovalKey = "a6" | "a3";
type InvestigationApprovalStatus = "pending" | "approved" | "changes_requested";
type InvestigationApprovals = Record<InvestigationApprovalKey, InvestigationApprovalStatus>;
type BuybackSolution = typeof settlementRecommendation.solution;
type EditableAmountKey =
  | "actualVehiclePrice"
  | "purchaseTax"
  | "otherCost"
  | "usedCarPrice"
  | "customerCoverVehicle"
  | "customerCoverHumanityCare"
  | "dealerCoverVehicle"
  | "dealerCoverHumanityCare"
  | "bmwCoverVehicle"
  | "bmwCoverHumanityCare"
  | "bmwCoverOther";

const steps = ["Intake", "Route", "Dealer Negotiation", "3R Scope Check", "3R Case Setup", "Investigation", "Decision", "Execution"];
const reviewProcessAgentName = "3R Buyback Process Agent";
const complaintId = "CCO-CMP-2026-0096";
const processInstanceId = "BBP-2026-0096";
const dealerSetupAttachments: DealerAttachment[] = [
  { name: "Customer communication record.pdf", type: "PDF", detail: "Dealer discussion and confirmed customer request" },
  { name: "Repair history.pdf", type: "PDF", detail: "Repair orders and workshop findings" },
  { name: "Vehicle profile.json", type: "JSON", detail: "Vehicle master data captured in CCO" },
  { name: "Parts order timeline.xlsx", type: "XLSX", detail: "Parts order and arrival records" },
];

const ccoCreationActions = [
  { title: "Freeze the approved route", detail: "The Router Agent records the human instruction and the approved 3R vehicle-return risk label." },
  { title: "Build the Complaint request", detail: "The Router Agent prepares a standard CCO Complaint request with the call transcript and audit context." },
  { title: "Create the Complaint in CCO", detail: "The Execution Agent calls CCO once with the approved request and an idempotency key." },
  { title: "Receive the Complaint record", detail: `CCO returns Complaint ID ${complaintId}. No 3R Case is created at this stage.` },
  { title: "Close the Route task", detail: "The Route task completes and the Complaint waits for the Dealer's offline negotiation update." },
];

function calculateBuybackSolution(solution: BuybackSolution): BuybackSolution {
  const totalVehiclePurchaseCost = solution.actualVehiclePrice + solution.purchaseTax + solution.otherCost;
  const vehicleCost = Math.max(totalVehiclePurchaseCost - solution.usedCarPrice, 0);
  const humanityCareCost = solution.customerCoverHumanityCare + solution.dealerCoverHumanityCare + solution.bmwCoverHumanityCare;
  const customerCover = solution.customerCoverVehicle + solution.customerCoverHumanityCare;
  const dealerCover = solution.dealerCoverVehicle + solution.dealerCoverHumanityCare;
  const bmwTotalCover = solution.bmwCoverVehicle + solution.bmwCoverHumanityCare + solution.bmwCoverOther;
  return { ...solution, totalVehiclePurchaseCost, vehicleCost, humanityCareCost, customerCover, dealerCover, bmwTotalCover };
}

function createDecisionInstruction(solution: BuybackSolution = settlementRecommendation.solution) {
  const calculated = calculateBuybackSolution(solution);
  return `Approve the proposed ${calculated.finalSolution} solution. Record the edited vehicle valuation, customer cover of CNY ${calculated.customerCover.toLocaleString("en-US")}, dealer cover of CNY ${calculated.dealerCover.toLocaleString("en-US")} and BMW total cover of CNY ${calculated.bmwTotalCover.toLocaleString("en-US")} separately. Save the decision, evidence and action receipts in CCO.`;
}

function formatCny(value: number) {
  return `CNY ${value.toLocaleString("en-US")}`;
}

function CurrencyInput({ id, label, value, onChange, compact = false }: { id: string; label: string; value: number; onChange: (value: string) => void; compact?: boolean }) {
  return <label className={`currency-input ${compact ? "compact" : ""}`} htmlFor={id}><span>{label}</span><div><b>CNY</b><input id={id} type="number" min="0" step="1000" inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

function RoleBadge({ children }: { children: React.ReactNode }) {
  return <span className="role-badge">{children}</span>;
}

function rawLineText(line: ConversationLine) {
  return line.parts.map((part) => part.correction ? `${part.correction.before}${part.text}` : part.text).join("");
}

function StreamedLine({ line, visibleCharacters, corrected }: { line: ConversationLine; visibleCharacters: number; corrected: boolean }) {
  return <>{line.parts.map((part, index) => {
    const consumedCharacters = line.parts.slice(0, index).reduce((total, previousPart) => total + (previousPart.correction ? previousPart.correction.before.length + previousPart.text.length : previousPart.text.length), 0);
    const availableCharacters = Math.max(0, visibleCharacters - consumedCharacters);
    if (availableCharacters <= 0) return null;
    if (part.correction) {
      if (corrected) return <span className="self-correction" data-before={part.correction.before} key={index}>{part.correction.after}{part.text}</span>;
      const wrong = part.correction.before.slice(0, availableCharacters);
      const trailing = part.text.slice(0, Math.max(availableCharacters - part.correction.before.length, 0));
      return <span key={index}><span className="correction-error">{wrong}</span>{trailing}</span>;
    }
    const visibleText = part.text.slice(0, availableCharacters);
    return part.semantic ? <mark className={`${part.semantic}-mark`} key={index}>{visibleText}</mark> : <span key={index}>{visibleText}</span>;
  })}</>;
}

export default function ProcessApp() {
  const [view, setView] = useState<"workbench" | "case">("workbench");
  const [stage, setStage] = useState(1);
  const [reviewState, setReviewState] = useState<ReviewState>("plan");
  const [accessOpen, setAccessOpen] = useState(false);
  const [, setAccessGranted] = useState(false);
  const [resultAgentId, setResultAgentId] = useState<string | null>(null);
  const [source, setSource] = useState<ComplaintSource>("call");
  const [playing, setPlaying] = useState(false);
  const [intakeAnalyzed, setIntakeAnalyzed] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [routeExecutionStarted, setRouteExecutionStarted] = useState(false);
  const [ccoCaseCreated, setCcoCaseCreated] = useState(false);
  const [negotiationMockOpen, setNegotiationMockOpen] = useState(false);
  const [dealerSetupMockOpen, setDealerSetupMockOpen] = useState(false);
  const [dealerNegotiation, setDealerNegotiation] = useState<DealerNegotiationUpdate | null>(null);
  const [scopeCheckResult, setScopeCheckResult] = useState<ScopeCheckResult | null>(null);
  const [dealerSubmission, setDealerSubmission] = useState<DealerSubmission | null>(null);
  const [routedDomain, setRoutedDomain] = useState<string | null>(null);
  const [buybackDraft, setBuybackDraft] = useState<BuybackSolution>(() => calculateBuybackSolution({ ...settlementRecommendation.solution }));
  const [decisionInstruction, setDecisionInstruction] = useState(createDecisionInstruction);
  const [plannedAgents, setPlannedAgents] = useState<ReviewAgent[]>(() => recommendedReviewAgents.map((agent) => ({ ...agent })));
  const [investigationApprovals, setInvestigationApprovals] = useState<InvestigationApprovals>({ a6: "pending", a3: "pending" });

  const openCase = () => {
    setView("case");
    setStage(reviewState === "running" || reviewState === "results" ? 6 : dealerSubmission ? 5 : scopeCheckResult ? 4 : dealerNegotiation ? 3 : 1);
    if (reviewState === "plan") {
      setAccessGranted(false);
      setPlannedAgents(recommendedReviewAgents.map((agent) => ({ ...agent })));
      const initialBuybackDraft = calculateBuybackSolution({ ...settlementRecommendation.solution });
      setBuybackDraft(initialBuybackDraft);
      setDecisionInstruction(createDecisionInstruction(initialBuybackDraft));
    }
  };

  const backToWorkbench = () => {
    setView("workbench");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const allowAccess = () => {
    setAccessGranted(true);
    setAccessOpen(false);
    setReviewState("running");
  };

  const updateInvestigationApproval = (key: InvestigationApprovalKey, status: InvestigationApprovalStatus) => {
    setInvestigationApprovals((current) => ({ ...current, [key]: status }));
  };

  const resetInvestigationApprovals = () => setInvestigationApprovals({ a6: "pending", a3: "pending" });

  const completeCase = () => {
    setCaseCompleted(false);
    setStage(8);
  };

  const timeline = useMemo(() => {
    const events = [
      { label: "Complaint received", done: stage > 1 || caseCompleted },
      { label: "Route executed & CCO Complaint created", done: routeConfirmed && ccoCaseCreated },
      { label: "Dealer negotiation completed", done: Boolean(dealerNegotiation) },
      { label: "3R effective scope checked", done: Boolean(scopeCheckResult) },
      { label: "3R Case setup completed", done: Boolean(dealerSubmission) && getMissingDealerSetupItems(dealerSubmission).length === 0 },
      { label: "Investigation completed", done: reviewState === "results" || stage > 6 },
      { label: "Recommendation prepared", done: stage >= 7 },
      { label: "Case completed", done: caseCompleted },
    ];
    const firstPending = events.findIndex((event) => !event.done);
    return events.map((event, index) => ({ ...event, active: firstPending === index }));
  }, [caseCompleted, ccoCaseCreated, dealerNegotiation, dealerSubmission, reviewState, routeConfirmed, scopeCheckResult, stage]);

  if (view === "workbench") return <>
    <Workbench onOpen={openCase} onNegotiationMock={() => setNegotiationMockOpen(true)} onDealerSetupMock={() => setDealerSetupMockOpen(true)} completed={caseCompleted} routedDomain={routedDomain} ccoCaseCreated={ccoCaseCreated} dealerNegotiation={dealerNegotiation} scopeCheckResult={scopeCheckResult} dealerSubmission={dealerSubmission} reviewState={reviewState} agents={plannedAgents} approvals={investigationApprovals} onApproval={updateInvestigationApproval} onResult={setResultAgentId} />
    {negotiationMockOpen && <DealerNegotiationMockModal onCancel={() => setNegotiationMockOpen(false)} onSubmit={(update) => { setDealerNegotiation(update); setNegotiationMockOpen(false); }} />}
    {dealerSetupMockOpen && <DealerCaseSetupMockModal existing={dealerSubmission} onCancel={() => setDealerSetupMockOpen(false)} onSubmit={(submission) => { setDealerSubmission(submission); setDealerSetupMockOpen(false); }} />}
    {resultAgentId && <AgentResultDrawer agent={plannedAgents.find((agent) => agent.id === resultAgentId) ?? recommendedReviewAgents.find((agent) => agent.id === resultAgentId)!} returnLabel="Back to Workbench approval" onClose={() => setResultAgentId(null)} />}
  </>;

  return (
    <main className="app-shell">
      <ProductHeader onHome={backToWorkbench} showProcess />
      <StageStepper stage={stage} timeline={timeline} onSelect={(next) => next <= stage && setStage(next)} />
      <section className="case-layout">
        <div className="case-main">
          {stage <= 4 ? <ComplaintContext complaintCreated={ccoCaseCreated} stage={stage} /> : <CaseIdentity caseIdAvailable={Boolean(dealerSubmission)} stage={stage} />}
          {stage === 1 && (
            <IntakeScreen source={source} setSource={setSource} playing={playing} setPlaying={setPlaying} analyzed={intakeAnalyzed} setAnalyzed={setIntakeAnalyzed} onNext={() => setStage(2)} />
          )}
          {stage === 2 && !routeExecutionStarted && <RoutingDecisionScreen onConfirm={() => { setRouteConfirmed(true); setRouteExecutionStarted(true); }} onModify={(target) => { setRoutedDomain(target); backToWorkbench(); }} />}
          {stage === 2 && routeExecutionStarted && <CreateComplaintCaseExecution created={ccoCaseCreated} onCreated={() => setCcoCaseCreated(true)} onWorkbench={backToWorkbench} />}
          {stage === 3 && dealerNegotiation && <DealerNegotiationScreen update={dealerNegotiation} onContinue={() => setStage(4)} onWorkbench={backToWorkbench} />}
          {stage === 4 && dealerNegotiation?.outcome === "still_requests_return" && <ScopeCheckScreen storedResult={scopeCheckResult} onFinish={(result) => { setScopeCheckResult(result); backToWorkbench(); }} />}
          {stage === 5 && <DealerEvidenceScreen submission={dealerSubmission} onOpenMock={() => setDealerSetupMockOpen(true)} onContinue={() => setStage(6)} onWorkbench={backToWorkbench} />}
          {stage === 6 && (
            <ReviewScreen
              state={reviewState}
              agents={plannedAgents}
              setAgents={setPlannedAgents}
              onAccess={() => setAccessOpen(true)}
              onRunComplete={() => setReviewState("results")}
              onReplan={() => {
                setReviewState("plan");
                setAccessGranted(false);
              }}
              dealerSubmission={dealerSubmission}
              approvals={investigationApprovals}
              onResetApprovals={resetInvestigationApprovals}
              onResult={setResultAgentId}
              onNext={() => setStage(7)}
              onWorkbench={backToWorkbench}
            />
          )}
          {stage === 7 && <RecommendationScreen agents={plannedAgents} solution={buybackDraft} setSolution={setBuybackDraft} instruction={decisionInstruction} setInstruction={setDecisionInstruction} onResult={setResultAgentId} onBack={() => setStage(6)} onConfirm={completeCase} />}
          {stage === 8 && <ExecutionScreen instruction={decisionInstruction} completed={caseCompleted} onComplete={setCaseCompleted} onWorkbench={backToWorkbench} />}
        </div>
      </section>
      {accessOpen && <AccessModal agents={plannedAgents} onCancel={() => setAccessOpen(false)} onAllow={allowAccess} />}
      {negotiationMockOpen && <DealerNegotiationMockModal onCancel={() => setNegotiationMockOpen(false)} onSubmit={(update) => { setDealerNegotiation(update); setNegotiationMockOpen(false); }} />}
      {dealerSetupMockOpen && <DealerCaseSetupMockModal existing={dealerSubmission} onCancel={() => setDealerSetupMockOpen(false)} onSubmit={(submission) => { setDealerSubmission(submission); setDealerSetupMockOpen(false); }} />}
      {resultAgentId && <AgentResultDrawer agent={plannedAgents.find((agent) => agent.id === resultAgentId) ?? recommendedReviewAgents.find((agent) => agent.id === resultAgentId)!} returnLabel={stage === 7 ? "Back to Recommendation & Decision" : "Back to Review Results"} onClose={() => setResultAgentId(null)} />}
    </main>
  );
}

function ProductHeader({ onHome, showProcess = false }: { onHome?: () => void; showProcess?: boolean }) {
  return (
    <header className="topbar">
      <button className="brand-button" onClick={onHome}>AFS Process Management Center</button>
      {showProcess && <><span className="breadcrumb-separator">›</span><span className="breadcrumb">Customer Care · Customer Complaint Handling</span></>}
      <div className="topbar-spacer" />
      <button className="icon-button" aria-label="Notifications"><Bell size={24} weight="regular" /></button>
      <div className="profile" aria-label="Current user">CW</div>
    </header>
  );
}

function DomainIcon({ tone, size = 25 }: { tone: string; size?: number }) {
  if (tone === "technical") return <Wrench size={size} />;
  if (tone === "warranty") return <ShieldCheck size={size} />;
  return <Headset size={size} />;
}

function ComplaintContext({ complaintCreated, stage }: { complaintCreated: boolean; stage: number }) {
  const recordStatus = !complaintCreated ? "No CCO record has been created" : stage === 3 ? "Dealer negotiation update linked" : stage === 4 ? "3R process instance · BBP-2026-0096" : "Route execution completed";
  return (
    <section className="complaint-context" aria-labelledby="complaint-context-title">
      <span className="complaint-context-icon"><PhoneCall size={23} aria-hidden="true" /></span>
      <div><span>{complaintCreated ? "CCO COMPLAINT" : stage === 1 ? "INBOUND CALL" : "ROUTE REVIEW"}</span><strong id="complaint-context-title">{complaintCreated ? complaintId : "Customer requests to return the vehicle"}</strong><small>{recordStatus}</small></div>
      <dl><div><dt>Call ID</dt><dd>CALL-DEMO-0096</dd></div><div><dt>Vehicle</dt><dd>{caseData.vehicle.model} · {caseData.vehicle.vin}</dd></div><div><dt>Customer wording</dt><dd>Return the vehicle</dd></div></dl>
    </section>
  );
}

function Workbench({ onOpen, onNegotiationMock, onDealerSetupMock, completed, routedDomain, ccoCaseCreated, dealerNegotiation, scopeCheckResult, dealerSubmission, reviewState, agents, approvals, onApproval, onResult }: { onOpen: () => void; onNegotiationMock: () => void; onDealerSetupMock: () => void; completed: boolean; routedDomain: string | null; ccoCaseCreated: boolean; dealerNegotiation: DealerNegotiationUpdate | null; scopeCheckResult: ScopeCheckResult | null; dealerSubmission: DealerSubmission | null; reviewState: ReviewState; agents: ReviewAgent[]; approvals: InvestigationApprovals; onApproval: (key: InvestigationApprovalKey, status: InvestigationApprovalStatus) => void; onResult: (agentId: string) => void }) {
  const [selectedDomain, setSelectedDomain] = useState(routedDomain ?? "Customer Care");
  const items = workbenchData.workItems.map((item) => item.caseId === caseData.id && routedDomain ? { ...item, domain: routedDomain, status: "Human-rerouted" } : item).filter((item) => item.domain === selectedDomain);
  const activeDomain = workbenchData.domains.find((domain) => domain.name === selectedDomain) ?? workbenchData.domains[0];
  const featuredItem = items.find((item) => item.caseId === caseData.id);
  const queueItems = items.filter((item) => item.caseId !== caseData.id);
  const approvalsComplete = approvals.a6 === "approved" && approvals.a3 === "approved";
  const approvalTask = reviewState === "results" && selectedDomain === "Technical Service"
    ? { key: "a6" as const, owner: "A6" as const, agent: agents.find((agent) => agent.id === "technical") }
    : reviewState === "results" && selectedDomain === "Warranty"
      ? { key: "a3" as const, owner: "A3" as const, agent: agents.find((agent) => agent.id === "parts") }
      : null;
  const waitingForDealer = Boolean(featuredItem) && ccoCaseCreated && !dealerNegotiation && !completed;
  const dealerOutcomeReady = Boolean(featuredItem) && Boolean(dealerNegotiation) && !scopeCheckResult && !completed;
  const scopeComplete = Boolean(featuredItem) && Boolean(scopeCheckResult) && !completed;
  const resolvedByAgreement = dealerOutcomeReady && dealerNegotiation?.outcome === "settled";
  const featuredState = completed
    ? { title: "View completed case", description: "The current Demo flow is complete and its execution receipt is available.", stage: "Completed", waitingOn: "No blocker", status: "Completed", action: "View", handler: onOpen }
    : reviewState === "results"
      ? approvalsComplete
        ? { title: "Investigation approvals complete", description: "A6 approved the quality assessment and A3 approved the parts timeline. The investigation can now continue to the human Decision step.", stage: "Investigation Complete", waitingOn: "Customer Care · A7", status: "Action required", action: "Continue to Decision", handler: onOpen }
        : { title: "Investigation approvals pending", description: "Agent queries are complete. Open Technical Service for the A6 approval and Warranty for the A3 parts-timeline approval.", stage: "Investigation Approval", waitingOn: "A6 · A3", status: "Waiting for approval", action: "View investigation", handler: onOpen }
    : scopeComplete
      ? scopeCheckResult === "within"
        ? dealerSubmission
          ? { title: "Review 3R Case setup", description: `CCO returned 3R Case ${dealerSubmission.caseId}. Verify its link to the Complaint and review the Dealer-provided case information before investigation.`, stage: "3R Case Setup", waitingOn: "Customer Care · A7", status: "Action required", action: "Review setup", handler: onOpen }
          : { title: "Dealer 3R Case setup required", description: "The vehicle is within the configured 3R effective scope. The Dealer must manually create the 3R Case and complete its base information in CCO.", stage: "3R Case Setup", waitingOn: "Dealer", status: "Waiting externally", action: "Mock Dealer setup", handler: onDealerSetupMock }
        : { title: "Outside 3R effective scope", description: "The scope gate ended the 3R path. Converting the Complaint to another case type is outside this Demo.", stage: "Scope Check Complete", waitingOn: "No blocker", status: "Demo complete", action: "View result", handler: onOpen }
      : dealerOutcomeReady
        ? dealerNegotiation?.outcome === "settled"
          ? { title: "Complaint closed after Dealer agreement", description: "The Dealer and customer reached an agreement. The Complaint path is complete and no 3R processing was started.", stage: "Dealer Negotiation Complete", waitingOn: "No blocker", status: "Demo complete", action: "View result", handler: onOpen }
          : { title: "Review Dealer negotiation outcome", description: "The Dealer confirms that the customer still requests to return the vehicle. Review the update before triggering the 3R Process Agent.", stage: "Dealer Negotiation", waitingOn: "Customer Care · A7", status: "Action required", action: "Review outcome", handler: onOpen }
      : waitingForDealer
        ? { title: "Dealer negotiation in progress", description: "The CCO Complaint is paused for offline Dealer negotiation. The Workbench resumes only after the Dealer outcome arrives.", stage: "Dealer Negotiation", waitingOn: "Dealer", status: "Waiting externally", action: "Mock dealer update", handler: onNegotiationMock }
        : { title: "Review AI complaint label", description: "AI identified a complaint with a possible 3R vehicle-return risk. Review the transcript and confirm the label before creating any CCO record.", stage: "Complaint Intake", waitingOn: "Customer Care · A7", status: "Action required", action: "Review AI suggestion", handler: onOpen };
  return (
    <main className="app-shell">
      <ProductHeader />
      <div className="workspace">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="nav-section-label">AFS WORKBENCH</div>
          <button className="nav-item"><SquaresFour size={20} aria-hidden="true" />Overview</button>
          <div className="nav-section-label process-label-nav">PROCESS DOMAINS</div>
          {workbenchData.domains.map((domain) => <button className={`nav-item nav-domain ${selectedDomain === domain.name ? "active" : ""}`} onClick={() => setSelectedDomain(domain.name)} aria-current={selectedDomain === domain.name ? "page" : undefined} key={domain.id}><DomainIcon tone={domain.tone} size={20} /><span>{domain.name}<small>{domain.pending} pending</small></span></button>)}
          <div className="nav-divider" />
          <button className="nav-item"><CheckSquare size={20} aria-hidden="true" />My Tasks</button>
        </aside>
        <section className="content workbench-content">
          <div className="page-heading">
            <div><p className="eyebrow">AFS PROCESS MANAGEMENT</p><h1>AFS Process Workbench</h1><p>Prioritized by current owner, blocking state and the next action required</p></div>
            <span className="workbench-live"><span />Live process activity</span>
          </div>
          <div className="metrics" aria-label="AFS work summary">
            {workbenchData.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.label === "Completed today" && completed ? metric.value + 1 : metric.value}</strong></article>)}
          </div>
          {featuredItem && <section className="workbench-focus" aria-labelledby="next-action-title">
            <header><span className="focus-icon"><Sparkle size={24} weight="fill" aria-hidden="true" /></span><div><p>MY NEXT ACTION</p><h2 id="next-action-title">{featuredState.title}</h2><span>{featuredState.description}</span></div><b className={`focus-status ${waitingForDealer || (scopeCheckResult === "within" && scopeComplete && !dealerSubmission) || (reviewState === "results" && !approvalsComplete) ? "waiting" : completed || resolvedByAgreement || scopeCheckResult === "outside" ? "ready" : "action"}`}>{featuredState.status}</b></header>
            <div className="focus-body">
              <dl className="focus-records"><div><dt>Call ID</dt><dd>{featuredItem.callId}</dd></div><div><dt>Complaint ID</dt><dd>{ccoCaseCreated ? complaintId : "Not created"}</dd></div><div><dt>3R Case ID</dt><dd>{dealerSubmission?.caseId ?? "Not created"}</dd></div></dl>
              <div className="focus-routing"><div><span>CURRENT STAGE</span><strong>{featuredState.stage}</strong></div><ArrowRight size={20} aria-hidden="true" /><div><span>WAITING ON</span><strong>{featuredState.waitingOn}</strong></div></div>
              <button className="primary-button focus-action button-with-icon" onClick={featuredState.handler}>{featuredState.action}<ArrowRight size={18} aria-hidden="true" /></button>
            </div>
            <footer><span><Target size={17} aria-hidden="true" />Suggested label</span><strong>3R vehicle-return risk</strong><p>Risk label only · not a 3R eligibility decision</p></footer>
          </section>}

          {approvalTask?.agent && <InvestigationApprovalCard owner={approvalTask.owner} agent={approvalTask.agent} status={approvals[approvalTask.key]} onDecision={(status) => onApproval(approvalTask.key, status)} onView={() => onResult(approvalTask.agent!.id)} />}

          <section className="panel pending-panel domain-cases">
            <div className="panel-heading domain-panel-heading"><span className={`domain-heading-icon ${activeDomain.tone}`}><DomainIcon tone={activeDomain.tone} /></span><div><p className="eyebrow">{activeDomain.name.toUpperCase()}</p><h2>{featuredItem ? "Other active work" : "Active work"}</h2><p>{activeDomain.description}</p></div><dl><div><dt>Pending</dt><dd>{activeDomain.pending}</dd></div><div><dt>In progress</dt><dd>{activeDomain.inProgress}</dd></div></dl><span className="count-badge">{queueItems.length} active</span></div>
            <div className="work-table" role="table" aria-label={`${selectedDomain} active work`}>
              <div className="work-row table-header" role="row"><span>Work item</span><span>Business record</span><span>Current stage</span><span>Waiting on</span><span>Status</span><span>Next action</span></div>
              {queueItems.map((item) => <div className="work-row" role="row" key={item.caseId}>
                <strong>{item.process}<small>{item.trigger} · {item.intent}</small></strong>
                <span className="record-reference"><small>{item.recordType}</small><b>{item.recordId}</b></span>
                <span className="work-stage">{item.stage}</span>
                <span className="waiting-owner"><Hourglass size={16} aria-hidden="true" />{item.waitingOn}</span>
                <span><b className="case-status">{item.status}</b></span>
                <span><button className="text-button" disabled>{item.nextAction}</button></span>
              </div>)}
              {queueItems.length === 0 && <div className="domain-empty"><CheckCircle size={24} /><strong>No other active work in this domain</strong><span>Your priority task is shown above.</span></div>}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function InvestigationApprovalCard({ owner, agent, status, onDecision, onView }: { owner: "A6" | "A3"; agent: ReviewAgent; status: InvestigationApprovalStatus; onDecision: (status: InvestigationApprovalStatus) => void; onView: () => void }) {
  const approved = status === "approved";
  const changesRequested = status === "changes_requested";
  return (
    <section className={`approval-workbench-card ${approved ? "approved" : changesRequested ? "changes" : "pending"}`} aria-labelledby={`${owner}-approval-title`}>
      <header><span className={`approval-owner ${owner.toLowerCase()}`}>{owner}</span><div><p>INVESTIGATION APPROVAL</p><h2 id={`${owner}-approval-title`}>{agent.name}</h2><span>{agent.purpose}</span></div><b>{approved ? "Approved" : changesRequested ? "Changes requested" : "Approval required"}</b></header>
      <div className="approval-summary"><div><span>AGENT CONCLUSION</span><p>{agent.resultSummary}</p></div><button className="text-button button-with-icon" onClick={onView}><Eye size={16} aria-hidden="true" />View result &amp; sources</button></div>
      <footer><span><LockKeyOpen size={17} aria-hidden="true" />Current user has approval access · no role switch required</span><div><button className="secondary-button wide" onClick={() => onDecision("changes_requested")}>Request changes</button><button className="primary-button wide button-with-icon" onClick={() => onDecision("approved")}><CheckCircle size={18} weight="fill" />{approved ? "Approved" : "Approve result"}</button></div></footer>
    </section>
  );
}

function StageStepper({ stage, timeline, onSelect }: { stage: number; timeline: { label: string; done: boolean; active: boolean }[]; onSelect: (stage: number) => void }) {
  const stageStatuses = [
    timeline[0].done ? "Complaint captured" : "Current step",
    timeline[1].done ? "CCO Complaint created" : stage === 2 ? "Human gate / Complaint creation" : "Pending",
    timeline[2].done ? "Outcome received" : stage === 3 ? "Review outcome" : "Pending",
    timeline[3].done ? "Scope checked" : stage === 4 ? "FRD + mileage" : "Pending",
    timeline[4].done ? "Case data received" : stage === 5 ? "Waiting on Dealer" : "Pending",
    timeline[5].done ? "Review completed" : stage === 6 ? "Plan and investigation" : "Pending",
    timeline[6].done ? "Decision prepared" : stage === 7 ? "Human decision" : "Pending",
    timeline[7].done ? "Case completed" : stage === 8 ? "Automation running" : "Pending",
  ];
  return (
    <nav className="stepper compact" aria-label="Case progress">
      <div className="process-label"><span>{stage <= 3 ? "CUSTOMER COMPLAINT" : "3R BUYBACK PROCESS"}</span><strong>{stage <= 2 ? "Intake and routing" : stage === 3 ? "Dealer negotiation" : "Human-controlled investigation"}</strong></div>
      {steps.map((label, index) => {
        const number = index + 1;
        return <button key={label} className={`step ${stage === number ? "active" : ""} ${stage > number ? "done" : ""}`} onClick={() => onSelect(number)} disabled={number > stage}><span>{stage > number ? <Check size={15} weight="bold" aria-hidden="true" /> : number}</span><b>{label}<small>{stageStatuses[index]}</small></b></button>;
      })}
    </nav>
  );
}

function CaseIdentity({ caseIdAvailable, stage }: { caseIdAvailable: boolean; stage: number }) {
  const vehicle = caseData.vehicle;
  const details = [
    ["Model", vehicle.model],
    ["E-series", vehicle.eSeries],
    ["Brand", vehicle.brand],
    ["VIN", vehicle.vin],
    ["Mileage (KM)", vehicle.mileageKm.toLocaleString("en-US")],
    ["FRD", vehicle.frd],
    ["Complaint date", vehicle.complaintDate],
    ["Service Dealer Code & Name", `${vehicle.serviceDealer.code} · ${vehicle.serviceDealer.name}`],
    ["Dealer Group Name", vehicle.dealerGroupName],
    ["Wholesale Dealer Code & Name", `${vehicle.wholesaleDealer.code} · ${vehicle.wholesaleDealer.name}`],
    ["Mediated By Third Party", vehicle.mediatedByThirdParty],
  ];
  const recordLabel = caseIdAvailable ? "CCO 3R CASE" : stage === 1 ? "INTAKE CONTEXT" : "ROUTE IN PROGRESS";
  const recordTitle = caseIdAvailable ? caseData.id : stage === 1 ? "Inbound vehicle-return complaint" : "Complaint routing review";
  return (
    <section className="case-identity" aria-labelledby="case-identity-title">
      <header><span className="case-identity-icon"><FolderOpen size={24} aria-hidden="true" /></span><div><span>{recordLabel}</span><strong id="case-identity-title">{recordTitle}</strong><small><Car size={15} aria-hidden="true" />{vehicle.model} · {vehicle.vin}</small>{caseIdAvailable && <small><ShieldCheck size={15} aria-hidden="true" />Linked to {complaintId}</small>}</div></header>
      <dl className="case-identity-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}

type RouteInterpretation = { action: "confirm" | "modify" | "clarify"; destination: string; domain: string; summary: string };

function RoutingDecisionScreen({ onConfirm, onModify }: { onConfirm: () => void; onModify: (target: string) => void }) {
  const [instruction, setInstruction] = useState("");
  const [interpretation, setInterpretation] = useState<RouteInterpretation | null>(null);
  const [showRouteAction, setShowRouteAction] = useState(false);
  const updateRoutingAction = (nextInstruction: string, showAction = true) => {
    setInstruction(nextInstruction);
    setShowRouteAction(showAction);
    const value = nextInstruction.trim().toLowerCase();
    if (/warranty|保修|质保/.test(value)) return setInterpretation({ action: "modify", destination: "Warranty Exception Review", domain: "Warranty", summary: "Override the AI suggestion and route this case to the Warranty domain." });
    if (/technical|tsara|技术/.test(value)) return setInterpretation({ action: "modify", destination: "Technical Service Escalation", domain: "Technical Service", summary: "Override the AI suggestion and route this case to Technical Service." });
    if (/other complaint|general complaint|not a buyback|普通投诉|其他投诉|不是退车|不进入退车/.test(value)) return setInterpretation({ action: "modify", destination: "Customer Care · General Complaint", domain: "Customer Care", summary: "Change the AI label to a general complaint. No 3R risk label or 3R Case will be created." });
    if (/agree|confirm|proceed|create|complaint|同意|确认|执行|创建|投诉/.test(value)) return setInterpretation({ action: "confirm", destination: "CCO · Standard Complaint", domain: "Customer Care", summary: "Create one standard CCO Complaint with the approved risk label. This does not create a 3R Case or decide 3R eligibility." });
    setInterpretation({ action: "clarify", destination: "No action yet", domain: "Customer Care", summary: "Specify whether to accept the suggested label or route the complaint elsewhere." });
  };
  const agreeWithAi = () => {
    updateRoutingAction("Create a standard CCO Complaint with the label ‘3R vehicle-return risk’. Preserve the customer request as ‘return the vehicle’. Do not create a 3R Case.", false);
  };
  return (
    <section className="screen-panel routing-screen">
      <div className="screen-heading"><div><p className="section-kicker">ROUTER AGENT · HUMAN DECISION</p><h2>Review AI Complaint Label</h2><p>Confirm the complaint label and the CCO creation instruction. 3R eligibility is not assessed here.</p></div></div>
      <section className="route-decision-card" aria-labelledby="route-label-title">
        <header><span className="route-ai-icon"><MagicWand size={23} aria-hidden="true" /></span><div><span>AI-SUGGESTED LABEL</span><h3 id="route-label-title">3R vehicle-return risk</h3><p>Complaint detected · customer explicitly asks to return the vehicle</p></div><b>94% confidence</b></header>
        <dl><div><dt>Customer wording</dt><dd>Return the vehicle</dd></div><div><dt>Record to create</dt><dd>Standard CCO Complaint</dd></div><div><dt>3R Case</dt><dd>Not created</dd></div></dl>
        <blockquote><Eye size={18} aria-hidden="true" /><div><span>CALL EVIDENCE · 00:52</span><p>“The same problem keeps coming back. I want to return the vehicle.”</p></div></blockquote>
        <footer><WarningCircle size={17} aria-hidden="true" /><span>Five repair visits are customer-reported only. Dealer and Warranty records have not been verified.</span></footer>
      </section>
      <section className="nl-routing-command">
        <div className="nl-command-heading"><div className="ai-command-icon"><ChatText size={22} /></div><div><span>NATURAL-LANGUAGE CONTROL</span><h3>Approve or change the AI label</h3><p>“Agree with AI” only prepares an editable instruction. Nothing is sent to CCO until you select Execute route.</p></div></div>
        <div className="command-examples" aria-label="Example routing instructions"><button onClick={agreeWithAi}>Agree with AI</button><button onClick={() => updateRoutingAction("Treat this as a general Customer Care complaint without the 3R risk label.")}>General complaint</button><button onClick={() => updateRoutingAction("Change the route to Warranty Exception Review.")}>Route to Warranty</button><button onClick={() => updateRoutingAction("Send this complaint to Technical Service for diagnosis.")}>Technical Service</button></div>
        <label htmlFor="route-instruction"><span>Execution instruction <b>Editable</b></span><textarea id="route-instruction" placeholder="Describe the complaint label and the record Router should create." value={instruction} onChange={(event) => updateRoutingAction(event.target.value)} /></label>
        {showRouteAction && interpretation && <div className={`route-interpretation ${interpretation.action}`} role="status" aria-live="polite"><div><span>ROUTING ACTION</span><strong>{interpretation.action === "confirm" ? "CREATE_CCO_COMPLAINT" : interpretation.action === "modify" ? "MODIFY_ROUTE" : "NEEDS_CLARIFICATION"}</strong></div><div><span>DESTINATION</span><strong>{interpretation.destination}</strong></div><p>{interpretation.summary}</p></div>}
      </section>
      <div className="screen-actions"><span className="routing-audit-note"><ShieldCheck size={17} />The AI label, human instruction, CCO request and execution receipt remain in one audit trail.</span><button className="primary-button wide button-with-icon" onClick={() => interpretation?.action === "confirm" ? onConfirm() : interpretation?.action === "modify" ? onModify(interpretation.domain) : undefined} disabled={!interpretation || interpretation.action === "clarify"}><Play size={18} weight="fill" />{interpretation?.action === "modify" ? "Apply modified route" : "Execute route"}</button></div>
    </section>
  );
}

function CreateComplaintCaseExecution({ created, onCreated, onWorkbench }: { created: boolean; onCreated: () => void; onWorkbench: () => void }) {
  const [phase, setPhase] = useState(created ? ccoCreationActions.length : 0);

  useEffect(() => {
    if (created || phase >= ccoCreationActions.length) return;
    const timer = window.setTimeout(() => {
      const nextPhase = phase + 1;
      setPhase(nextPhase);
      if (nextPhase === ccoCreationActions.length) onCreated();
    }, phase === 0 ? 900 : 1150);
    return () => window.clearTimeout(timer);
  }, [created, onCreated, phase]);

  const complete = created || phase >= ccoCreationActions.length;
  const currentMessage = complete ? `CCO Complaint ${complaintId} was created. The Route task is complete.` : ccoCreationActions[phase].detail;
  return (
    <section className="screen-panel cco-create-screen">
      <div className="screen-heading"><div><p className="section-kicker">ROUTE EXECUTION</p><h2>{complete ? "CCO Complaint Created" : "Creating Complaint in CCO"}</h2></div></div>
      <section className="execution-network cco-create-network complaint-create-network" aria-label="The Router Agent invokes the Execution Agent to create a standard Complaint in CCO">
        <header><span>LIVE EXECUTION</span><h3>Router Agent → Execution Agent → CCO</h3><p>The animation shows the actual handoff and CCO call. No 3R Case or eligibility decision is created in this step.</p></header>
        <div className="execution-flow">
          <div className={`execution-node agent-node ${phase > 1 ? "done" : "active"}`}><div className="robot-avatar planner"><Robot size={70} weight="duotone" /><span><FlowArrow size={19} weight="bold" /></span></div><strong>Router Agent</strong><em>Leading Agent</em><small>Human-approved instruction</small></div>
          <div className={`execution-link ${phase < 2 ? "active" : "done"}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase < 2 ? "PREPARING REQUEST" : "REQUEST READY"}</b></div>
          <div className={`execution-node agent-node ${phase >= 4 ? "done" : phase >= 2 ? "active" : ""}`}><div className="robot-avatar execution"><Robot size={70} weight="duotone" /><span><UploadSimple size={18} weight="bold" /></span></div><strong>Execution &amp; Automation</strong><em>Execution Agent</em><small>Creates one standard Complaint</small></div>
          <div className={`execution-link ${phase >= 2 && phase < 4 ? "active" : phase >= 4 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase >= 4 ? "COMPLAINT RETURNED" : phase >= 2 ? "CALLING CCO" : "WAITING"}</b></div>
          <div className={`cco-system ${complete ? "done" : phase > 2 ? "active" : ""}`}><div className="system-window"><span /><span /><span /><SquaresFour size={34} weight="duotone" /></div><strong>CCO</strong><em>Existing system</em><small>Create Complaint</small></div>
        </div>
        <p className="execution-status" role="status" aria-live="polite"><span className={complete ? "map-check" : "spinner"}>{complete && <Check size={12} weight="bold" />}</span>{currentMessage}</p>
      </section>
      {complete && <section className="route-complete-banner"><CheckCircle size={28} weight="fill" /><div><strong>Route task complete · Complaint ID generated</strong><span>CCO Complaint {complaintId} · Status <b>DEALER_NEGOTIATION_PENDING</b> · 3R Case not created</span></div></section>}
      <div className="screen-actions completion-actions"><span>Next event: <b>DealerNegotiationUpdated</b></span><button className="primary-button wide button-with-icon" disabled={!complete} onClick={onWorkbench}><ArrowLeft size={18} />Return to Workbench</button></div>
    </section>
  );
}

function DealerNegotiationScreen({ update, onContinue, onWorkbench }: { update: DealerNegotiationUpdate; onContinue: () => void; onWorkbench: () => void }) {
  const stillRequestsReturn = update.outcome === "still_requests_return";
  return (
    <section className="screen-panel dealer-negotiation-screen">
      <div className="screen-heading"><div><p className="section-kicker">DEALER · OFFLINE ACTIVITY</p><h2>Dealer Negotiation Outcome</h2><p>The Workbench resumes only after the Dealer submits this external outcome.</p></div><span className="success-pill"><CheckCircle size={16} weight="fill" />Update received</span></div>
      <section className="negotiation-record"><div className="cco-icon"><SquaresFour size={27} aria-hidden="true" /></div><div><span>CCO COMPLAINT</span><h3>{complaintId}</h3><p>AI label · <b>3R vehicle-return risk</b></p></div><strong>DealerNegotiationUpdated</strong></section>
      <section className="offline-negotiation-map" aria-label="Dealer negotiated with the customer outside the Workbench"><div><Buildings size={37} aria-hidden="true" /><strong>Dealer</strong><span>Offline negotiation</span></div><i><ChatText size={18} aria-hidden="true" /></i><div><Headset size={37} aria-hidden="true" /><strong>Customer</strong><span>Confirms final request</span></div></section>
      <section className={`negotiation-outcome ${stillRequestsReturn ? "continue" : "settled"}`}><span>{stillRequestsReturn ? <WarningCircle size={24} weight="fill" /> : <CheckCircle size={24} weight="fill" />}</span><div><small>DEALER OUTCOME · {update.updatedAt}</small><h3>{stillRequestsReturn ? "Customer still requests to return the vehicle" : "Agreement reached with the customer"}</h3><p>{update.summary}</p></div></section>
      {stillRequestsReturn ? <section className="process-trigger-preview"><div className="robot-avatar planner"><Robot size={62} weight="duotone" /><span><FlowArrow size={18} weight="bold" /></span></div><div><span>NEXT PROCESS</span><h3>{reviewProcessAgentName}</h3><p>Starting the scope gate creates process instance <b>BBP-2026-0096</b> and links it to {complaintId}.</p></div><strong>Not started</strong></section> : <section className="negotiation-terminal"><CheckCircle size={25} weight="fill" /><div><strong>Complaint closed in CCO</strong><span>The agreed Complaint path is complete. No Process Agent, Data Agent or 3R Case was triggered.</span></div></section>}
      <div className="screen-actions split-actions"><button className="secondary-button wide button-with-icon" onClick={onWorkbench}><ArrowLeft size={18} />Return to Workbench</button>{stillRequestsReturn && <button className="primary-button wide button-with-icon" onClick={onContinue}>Start 3R Scope Check<ArrowRight size={18} /></button>}</div>
    </section>
  );
}

function DealerNegotiationMockModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (update: DealerNegotiationUpdate) => void }) {
  const [outcome, setOutcome] = useState<DealerNegotiationUpdate["outcome"]>("still_requests_return");
  const [summary, setSummary] = useState("Dealer discussed available repair and goodwill options with the customer. The customer declined and continues to request a vehicle return.");
  const chooseOutcome = (next: DealerNegotiationUpdate["outcome"]) => {
    setOutcome(next);
    setSummary(next === "settled" ? "Dealer and customer reached an agreement on the existing Complaint. The customer no longer requests to return the vehicle." : "Dealer discussed available repair and goodwill options with the customer. The customer declined and continues to request a vehicle return.");
  };
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal negotiation-mock" role="dialog" aria-modal="true" aria-labelledby="negotiation-mock-title">
        <div className="mock-banner"><Buildings size={21} aria-hidden="true" /><span>DEMO MOCK · DEALER OFFLINE UPDATE</span></div>
        <h2 id="negotiation-mock-title">Submit negotiation outcome</h2>
        <p className="modal-intro">This simulates the Dealer updating CCO after speaking with the customer. It does not send a message to the customer.</p>
        <fieldset className="outcome-options"><legend>Negotiation result</legend><label className={outcome === "still_requests_return" ? "selected" : ""}><input type="radio" name="dealer-outcome" checked={outcome === "still_requests_return"} onChange={() => chooseOutcome("still_requests_return")} /><span><WarningCircle size={21} /><strong>Still requests return</strong><small>Trigger the 3R Buyback Process Agent after A7 review.</small></span></label><label className={outcome === "settled" ? "selected" : ""}><input type="radio" name="dealer-outcome" checked={outcome === "settled"} onChange={() => chooseOutcome("settled")} /><span><CheckCircle size={21} /><strong>Agreement reached</strong><small>Close the Complaint path without starting 3R processing.</small></span></label></fieldset>
        <label><span>Dealer summary</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <div className="event-preview"><code>DealerNegotiationUpdated</code><span>Workbench resumes only after submission</span></div>
        <div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Cancel</button><button className="primary-button wide button-with-icon" disabled={summary.trim().length < 20} onClick={() => onSubmit({ outcome, summary, updatedAt: "25 Aug 2026 · 15:20" })}><CheckCircle size={18} />Submit update</button></div>
      </section>
    </div>
  );
}

const scopeSamples = {
  within: { frd: caseData.vehicle.frd, ageMonths: 18, mileage: caseData.vehicle.mileageKm },
  outside: { frd: "2022-02-14", ageMonths: 51, mileage: 68300 },
} as const;

function ScopeCheckScreen({ storedResult, onFinish }: { storedResult: ScopeCheckResult | null; onFinish: (result: ScopeCheckResult) => void }) {
  const [scenario, setScenario] = useState<ScopeCheckResult>(storedResult ?? "within");
  const [started, setStarted] = useState(Boolean(storedResult));
  const [phase, setPhase] = useState(storedResult ? 5 : 0);
  const sample = scopeSamples[scenario];
  const complete = phase >= 5;

  useEffect(() => {
    if (!started || complete) return;
    const timer = window.setTimeout(() => setPhase((current) => current + 1), phase === 0 ? 700 : 950);
    return () => window.clearTimeout(timer);
  }, [complete, phase, started]);

  const statusMessages = [
    "Ready to start the 3R effective-scope gate.",
    `The ${reviewProcessAgentName} loaded Complaint ${complaintId}.`,
    "The Data Agent is querying the vehicle FRD.",
    "The Data Agent is reading current mileage from the FASTA Key.",
    "The Data Agent is evaluating both configured thresholds.",
    scenario === "within" ? "The vehicle is within the configured 3R effective scope." : "The vehicle is outside the configured 3R effective scope.",
  ];

  return (
    <section className="screen-panel scope-check-screen">
      <div className="screen-heading"><div><p className="section-kicker">3R BUYBACK PROCESS AGENT</p><h2>3R Effective Scope Check</h2><p>This gate checks only FRD and FASTA Key mileage. It is not the final 3R eligibility decision.</p></div>{complete && <span className={scenario === "within" ? "success-pill" : "neutral-pill"}>{scenario === "within" ? <><CheckCircle size={16} weight="fill" />Within scope</> : <><WarningCircle size={16} weight="fill" />Outside scope</>}</span>}</div>
      <section className="scope-scenario"><div><span>DEMO SAMPLE</span><strong>Choose a stable test outcome</strong></div><button className={scenario === "within" ? "active" : ""} disabled={started} onClick={() => setScenario("within")}><CheckCircle size={18} />Within scope</button><button className={scenario === "outside" ? "active" : ""} disabled={started} onClick={() => setScenario("outside")}><WarningCircle size={18} />Outside scope</button></section>
      <section className="execution-network scope-network" aria-busy={started && !complete} aria-label="The 3R Buyback Process Agent calls the Data Agent to query FRD and FASTA Key mileage">
        <header><span>AGENT CALL</span><h3>3R Buyback Process Agent → Data Agent → Vehicle Data</h3><p>Process instance <b>BBP-2026-0096</b> · Complaint {complaintId}</p></header>
        <div className="execution-flow">
          <div className={`execution-node agent-node ${phase >= 2 ? "done" : started ? "active" : ""}`}><div className="robot-avatar planner"><Robot size={70} weight="duotone" /><span><FlowArrow size={19} weight="bold" /></span></div><strong>{reviewProcessAgentName}</strong><em>Process Agent</em><small>Starts the effective-scope gate</small></div>
          <div className={`execution-link ${phase === 1 ? "active" : phase > 1 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase > 1 ? "REQUEST SENT" : phase === 1 ? "CALLING DATA AGENT" : "WAITING"}</b></div>
          <div className={`execution-node agent-node ${phase >= 5 ? "done" : phase >= 2 ? "active" : ""}`}><div className="robot-avatar execution"><Robot size={70} weight="duotone" /><span><Database size={18} weight="bold" /></span></div><strong>Vehicle Scope Data Agent</strong><em>Data Agent</em><small>Queries FRD and mileage</small></div>
          <div className={`execution-link ${phase >= 2 && phase < 5 ? "active" : phase >= 5 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase >= 5 ? "DATA RETURNED" : phase >= 2 ? "QUERYING" : "WAITING"}</b></div>
          <div className={`scope-data-system ${complete ? "done" : phase >= 3 ? "active" : ""}`}><Database size={42} weight="duotone" /><strong>Vehicle Data</strong><em>FRD · FASTA Key</em><small>Read only</small></div>
        </div>
        <p className="execution-status" role="status" aria-live="polite" aria-atomic="true"><span className={complete ? "map-check" : started ? "spinner" : "status-dot"}>{complete && <Check size={12} weight="bold" />}</span>{statusMessages[phase]}</p>
      </section>
      {complete && <section className="scope-result"><header><span>{scenario === "within" ? <CheckCircle size={27} weight="fill" /> : <WarningCircle size={27} weight="fill" />}</span><div><small>DATA AGENT CONCLUSION</small><h3>{scenario === "within" ? "Within the configured 3R effective scope" : "Outside the configured 3R effective scope"}</h3></div></header><dl><div><dt>FRD</dt><dd>{sample.frd}</dd><small>Vehicle age · {sample.ageMonths} months</small><b className={sample.ageMonths <= 24 ? "pass" : "fail"}>{sample.ageMonths <= 24 ? "Within ≤ 24 months" : "Exceeds 24 months"}</b></div><div><dt>Current mileage</dt><dd>{sample.mileage.toLocaleString("en-US")} km</dd><small>Source · FASTA Key</small><b className={sample.mileage <= 50000 ? "pass" : "fail"}>{sample.mileage <= 50000 ? "Within ≤ 50,000 km" : "Exceeds 50,000 km"}</b></div></dl><footer><ShieldCheck size={17} /><span>{scenario === "within" ? "Next: Dealer manually creates the CCO 3R Case. No Case is created by this Agent." : "Next: Dealer may convert to CCA / Special Case outside this Demo. The 3R path stops here."}</span></footer></section>}
      <div className="screen-actions"><span className="routing-audit-note"><ShieldCheck size={17} />Rule configuration shown explicitly · both source values retained in the audit trail.</span>{!started ? <button className="primary-button wide button-with-icon" onClick={() => setStarted(true)}><Play size={18} weight="fill" />Run scope check</button> : <button className="primary-button wide button-with-icon" disabled={!complete} onClick={() => onFinish(scenario)}>{scenario === "within" ? "Return to Workbench" : "End 3R path"}<ArrowRight size={18} /></button>}</div>
    </section>
  );
}

function getMissingDealerSetupItems(submission: DealerSubmission | null) {
  if (!submission) return ["3R Case record", "Customer communication summary", ...dealerSetupAttachments.map((item) => item.detail)];
  const missing = dealerSetupAttachments.filter((required) => !submission.attachments.some((item) => item.name === required.name)).map((item) => item.detail);
  if (submission.contactSummary.trim().length < 20) missing.unshift("Customer communication summary");
  return missing;
}

function DealerEvidenceScreen({ submission, onOpenMock, onContinue, onWorkbench }: { submission: DealerSubmission | null; onOpenMock: () => void; onContinue: () => void; onWorkbench: () => void }) {
  const missingItems = getMissingDealerSetupItems(submission);
  const complete = Boolean(submission) && missingItems.length === 0;
  return (
    <section className="screen-panel dealer-wait-screen">
      <div className="screen-heading"><div><p className="section-kicker">3R CASE SETUP · CCO</p><h2>{submission ? "Review Dealer 3R Case Setup" : "Waiting for Dealer 3R Case Setup"}</h2><p>The Dealer owns Case creation and source-data entry. The Process Agent only reads and checks the returned record.</p></div><span className={complete ? "success-pill" : "waiting-pill"}>{complete ? <><CheckCircle size={16} weight="fill" />Ready for Review</> : <><Hourglass size={16} />Waiting externally</>}</span></div>
      {!submission ? <>
        <section className="async-boundary"><div className="async-visual"><div><Robot size={42} weight="duotone" /><span>Workbench</span></div><i /><div><Buildings size={42} weight="duotone" /><span>Dealer in CCO</span></div></div><div><span>PROCESS PAUSED AT EXTERNAL EVENT</span><h3>No 3R Case exists yet</h3><p>The Dealer must manually create the 3R Case in CCO and complete the required case information. The Agent cannot create or edit this source record.</p></div></section>
        <section className="evidence-checklist"><header><ListChecks size={21} /><div><span>REQUIRED BEFORE REVIEW</span><h3>Case record plus four information groups</h3></div></header>{["CCO 3R Case linked to the Complaint", "Customer communication summary", ...dealerSetupAttachments.map((item) => item.detail)].map((item) => <div key={item}><span /><strong>{item}</strong><small>Waiting</small></div>)}</section>
      </> : <>
        <section className="cco-case-created"><div className="cco-icon"><SquaresFour size={28} aria-hidden="true" /></div><div><span>DEALER-CREATED CCO 3R CASE</span><h3>{submission.caseId}</h3><p>Created manually in CCO · returned at {submission.submittedAt}</p></div><strong>Source · CCO</strong></section>
        <section className="case-linkage" aria-label="Verified record linkage"><header><ShieldCheck size={22} weight="fill" /><div><span>LINKAGE CHECK</span><h3>Complaint, 3R Case and process instance match uniquely</h3></div><b>Verified</b></header><dl><div><dt>Complaint ID</dt><dd>{complaintId}</dd></div><div><dt>3R Case ID</dt><dd>{submission.caseId}</dd></div><div><dt>Process instance</dt><dd>{processInstanceId}</dd></div></dl></section>
        <section className="dealer-case-document"><header><div><span>DEALER-PROVIDED CASE CONTENT</span><h3>Latest CCO information read by the Process Agent</h3></div><b>{submission.attachments.length} attachments</b></header><article><ChatText size={21} aria-hidden="true" /><div><strong>Customer communication</strong><p>{submission.contactSummary}</p></div></article><div className="case-attachment-list">{submission.attachments.map((attachment) => <article key={attachment.name}><Paperclip size={18} aria-hidden="true" /><div><strong>{attachment.name}</strong><span>{attachment.detail}</span></div><b>{attachment.type}</b></article>)}</div></section>
        <section className={`setup-completeness ${complete ? "complete" : "incomplete"}`} role="status" aria-atomic="true"><span>{complete ? <CheckCircle size={25} weight="fill" /> : <WarningCircle size={25} weight="fill" />}</span><div><small>PROCESS AGENT COMPLETENESS CHECK</small><h3>{complete ? "Base information is complete" : `${missingItems.length} required item${missingItems.length === 1 ? " is" : "s are"} missing`}</h3><p>{complete ? "The source record is unchanged. A7 may now generate and review the investigation plan." : missingItems.join(" · ")}</p></div></section>
      </>}
      <div className="screen-actions split-actions"><button className="secondary-button wide button-with-icon" onClick={submission && complete ? onWorkbench : onOpenMock}>{submission && complete ? <ArrowLeft size={18} /> : <Buildings size={18} />}{submission && complete ? "Back to Workbench" : submission ? "Update Dealer mock" : "Open Dealer CCO mock"}</button><button className="primary-button wide button-with-icon" onClick={onContinue} disabled={!complete}>Generate Review Plan<ArrowRight size={18} /></button></div>
    </section>
  );
}

function DealerCaseSetupMockModal({ existing, onCancel, onSubmit }: { existing: DealerSubmission | null; onCancel: () => void; onSubmit: (submission: DealerSubmission) => void }) {
  const [summary, setSummary] = useState(existing?.contactSummary ?? "Dealer confirmed the customer still requests a vehicle return after discussing repair and goodwill options. One repair remained open for 36 days while waiting for a power-control module; the repeated concern and full repair history are recorded in the 3R Case.");
  const [includedFiles, setIncludedFiles] = useState(() => dealerSetupAttachments.map((attachment) => existing ? existing.attachments.some((item) => item.name === attachment.name) : true));
  const selectedAttachments = dealerSetupAttachments.filter((_, index) => includedFiles[index]);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal dealer-mock dealer-setup-mock" role="dialog" aria-modal="true" aria-labelledby="dealer-setup-title">
        <div className="mock-banner"><Buildings size={21} aria-hidden="true" /><span>DEMO MOCK · DEALER CCO 3R CASE</span></div>
        <h2 id="dealer-setup-title">{existing ? "Update 3R Case information" : "Create and complete the 3R Case"}</h2>
        <p className="modal-intro">This simulates the Dealer manually creating the Case and entering source information in CCO. No Agent writes these fields.</p>
        <section className="mock-record-link"><span>RECORDS TO LINK</span><div><b>{complaintId}</b><ArrowRight size={17} aria-hidden="true" /><b>{caseData.id}</b><ArrowRight size={17} aria-hidden="true" /><b>{processInstanceId}</b></div></section>
        <label htmlFor="dealer-case-summary"><span>Customer communication summary <b>Required</b></span><textarea id="dealer-case-summary" value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <fieldset><legend>Case information and attachments <b>Required for Review</b></legend>{dealerSetupAttachments.map((attachment, index) => <label key={attachment.name}><input type="checkbox" checked={includedFiles[index]} onChange={() => setIncludedFiles((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span><Paperclip size={17} aria-hidden="true" />{attachment.name}</span><small>{includedFiles[index] ? attachment.detail : "Missing"}</small></label>)}</fieldset>
        <div className="event-preview"><code>ThreeRCaseReady</code><span>{selectedAttachments.length === dealerSetupAttachments.length && summary.trim().length >= 20 ? "Complete setup ready for Workbench review" : "Incomplete setup will return with missing items"}</span></div>
        <div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Cancel</button><button className="primary-button wide button-with-icon" disabled={!summary.trim()} onClick={() => onSubmit({ caseId: caseData.id, contactSummary: summary, submittedAt: "25 Aug 2026 · 15:34", attachments: selectedAttachments })}><CheckCircle size={18} />Submit CCO update</button></div>
      </section>
    </div>
  );
}

const insightLabels: Array<{ key: SemanticType; label: string }> = [
  { key: "reason", label: "Contact reason" },
  { key: "repair", label: "Repair history" },
  { key: "request", label: "Customer request" },
  { key: "sentiment", label: "Customer sentiment" },
  { key: "outcome", label: "Handling outcome" },
];

function InsightIcon({ type, size = 20 }: { type: SemanticType; size?: number }) {
  if (type === "reason") return <WarningCircle size={size} />;
  if (type === "repair") return <Wrench size={size} />;
  if (type === "request") return <ClipboardText size={size} />;
  if (type === "sentiment") return <ChatText size={size} />;
  return <CheckSquare size={size} />;
}

function AIUnderstandingPanel({ insights, narrative, revealed, onEvidence, working = false }: { insights: CallInsight[]; narrative: string; revealed: Set<SemanticType>; onEvidence: (id: string) => void; working?: boolean }) {
  return (
    <aside className="ai-extraction" aria-label="AI understanding">
      <div className="extraction-heading"><span><MagicWand size={19} />AI understanding</span><small>{revealed.size} of 5 dimensions</small></div>
      <div className="insight-list">{insights.map((insight) => {
        const isRevealed = revealed.has(insight.key);
        return <article className={`signal-card ${insight.key} ${isRevealed ? "revealed" : ""}`} key={insight.key}><InsightIcon type={insight.key} /><div><span>{insight.label}</span><strong>{isRevealed ? insight.value || "—" : "Listening…"}</strong>{isRevealed && insight.evidenceId && <button onClick={() => onEvidence(insight.evidenceId!)}><Eye size={15} />Evidence · {insight.evidenceTime}</button>}</div></article>;
      })}</div>
      {revealed.size === 5 && <div className="understanding-summary"><span>AI SUMMARY</span><p>{narrative}</p></div>}
      {working && <div className="ai-working"><span /><p><strong>AI is organizing the conversation</strong>Speaker separation, correction and five-dimension analysis</p></div>}
    </aside>
  );
}

function IntakeScreen({ source, setSource, playing, setPlaying, analyzed, setAnalyzed, onNext }: { source: ComplaintSource; setSource: (value: ComplaintSource) => void; playing: boolean; setPlaying: (value: boolean) => void; analyzed: boolean; setAnalyzed: (value: boolean) => void; onNext: () => void }) {
  const conversation: ConversationLine[] = intakeDemo.conversation;
  const [activeLine, setActiveLine] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [correctedLines, setCorrectedLines] = useState<Set<string>>(() => analyzed ? new Set(conversation.filter((line) => line.parts.some((part) => part.correction)).map((line) => line.id)) : new Set<string>());
  const [complete, setComplete] = useState(analyzed);
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string>("current");
  const [historyPlayingId, setHistoryPlayingId] = useState<string | null>(null);
  const [historyProgress, setHistoryProgress] = useState(0);
  const selectedHistoricalCall = historicalCalls.find((call) => call.id === selectedCallId);
  const currentLine = conversation[activeLine];
  const currentRawText = currentLine ? rawLineText(currentLine) : "";
  const totalCharacters = conversation.reduce((total, line) => total + rawLineText(line).length, 0);
  const priorCharacters = conversation.slice(0, activeLine).reduce((total, line) => total + rawLineText(line).length, 0);
  const progress = complete ? 100 : Math.min(99, ((priorCharacters + visibleCharacters) / totalCharacters) * 100);
  const hasStarted = activeLine > 0 || visibleCharacters > 0 || complete;
  const revealedCount = complete ? conversation.length : hasStarted ? activeLine + 1 : 0;
  const reasonDetected = complete || activeLine > 1 || (activeLine === 1 && visibleCharacters >= 20);
  const repairDetected = complete || activeLine > 2 || (activeLine === 1 && visibleCharacters >= 56);
  const sentimentDetected = complete || activeLine > 3 || (activeLine === 3 && visibleCharacters >= 22);
  const requestDetected = complete || activeLine > 5 || (activeLine === 5 && visibleCharacters >= 28);
  const revealedInsights = new Set<SemanticType>([
    ...(reasonDetected ? ["reason" as const] : []),
    ...(repairDetected ? ["repair" as const] : []),
    ...(requestDetected ? ["request" as const] : []),
    ...(sentimentDetected ? ["sentiment" as const] : []),
    ...(complete ? ["outcome" as const] : []),
  ]);

  useEffect(() => {
    if (!playing || source !== "call") return;
    if (visibleCharacters < currentRawText.length) {
      const previousCharacter = currentRawText.charAt(Math.max(0, visibleCharacters - 1));
      const delay = /[,.?!—]/.test(previousCharacter) ? 130 : 31;
      const timer = window.setTimeout(() => setVisibleCharacters((count) => count + 1), delay);
      return () => window.clearTimeout(timer);
    }

    const hasCorrection = currentLine.parts.some((part) => part.correction);
    if (hasCorrection && !correctedLines.has(currentLine.id)) {
      const timer = window.setTimeout(() => setCorrectedLines((lines) => new Set(lines).add(currentLine.id)), 575);
      return () => window.clearTimeout(timer);
    }

    if (activeLine < conversation.length - 1) {
      const timer = window.setTimeout(() => {
        setActiveLine((line) => line + 1);
        setVisibleCharacters(0);
      }, 360);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setComplete(true);
      setAnalyzed(true);
      setPlaying(false);
    }, 425);
    return () => window.clearTimeout(timer);
  }, [activeLine, conversation.length, correctedLines, currentLine, currentRawText, playing, setAnalyzed, setPlaying, source, visibleCharacters]);

  useEffect(() => {
    if (!historyPlayingId) return;
    const timer = window.setTimeout(() => {
      if (historyProgress >= 96) {
        setHistoryProgress(100);
        setHistoryPlayingId(null);
      } else {
        setHistoryProgress((current) => current + 4);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [historyPlayingId, historyProgress]);

  const toggleAnalysis = () => {
    setFocusedEvidence(null);
    if (complete) return;
    setPlaying(!playing);
  };

  const showEvidence = (id: string) => {
    setFocusedEvidence(id);
    document.getElementById(`transcript-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setFocusedEvidence(null), 2200);
  };

  const selectCall = (id: string) => {
    setPlaying(false);
    setSelectedCallId(id);
    setHistoryPlayingId(null);
    setHistoryProgress(0);
  };

  const toggleHistoryPlayback = (id: string) => {
    if (historyPlayingId === id) {
      setHistoryPlayingId(null);
      return;
    }
    if (historyProgress >= 100) setHistoryProgress(0);
    setHistoryPlayingId(id);
  };

  return (
    <section className="screen-panel intake-screen">
      <div className="screen-heading"><div><p className="section-kicker">CUSTOMER CARE</p><h2>Complaint Intake</h2></div><span className={`ai-intake-status ${playing ? "working" : complete || source === "scan" || (source === "call" && selectedHistoricalCall) ? "complete" : ""}`} role="status" aria-atomic="true"><MagicWand size={17} aria-hidden="true" />{source === "scan" ? "Document analyzed" : selectedHistoricalCall ? "Previously analyzed" : playing ? "AI is listening" : complete ? "Call analyzed" : "Ready to analyze"}</span></div>
      <section className="auto-created-case"><Sparkle size={19} weight="fill" /><div><span>AI-DETECTED COMPLAINT SIGNAL</span><strong>Complaint draft ready for Router review</strong><p>The customer asks to return the vehicle. AI suggests the label “3R vehicle-return risk”; this is not a 3R eligibility decision.</p></div><b>No CCO record yet</b></section>
      <div className="source-tabs" role="tablist">
        <button role="tab" aria-selected={source === "call"} className={source === "call" ? "active" : ""} onClick={() => setSource("call")}><PhoneCall size={18} aria-hidden="true" />Call Recording</button>
        <button role="tab" aria-selected={source === "scan"} className={source === "scan" ? "active" : ""} onClick={() => setSource("scan")}><Scan size={18} aria-hidden="true" />Scanned Complaint</button>
      </div>
      {source === "call" && <details className="call-sequence" aria-label="Related customer call history"><summary><span><Clock size={18} aria-hidden="true" />Related contact history</span><strong>4 calls</strong><small>Optional context</small><CaretDown size={17} aria-hidden="true" /></summary><div className="call-sequence-track">{historicalCalls.map((call) => <button key={call.id} className={selectedCallId === call.id ? "active" : ""} onClick={() => selectCall(call.id)}><span>{call.sequence}</span><div><small>{call.date}</small><strong>Call record {call.sequence}</strong><em>{call.duration}</em></div></button>)}<button className={`current ${selectedCallId === "current" ? "active" : ""}`} onClick={() => selectCall("current")}><span>4</span><div><small>12 May 2026</small><strong>Call record 4</strong><em>{caseData.complaint.callDuration} · Current</em></div></button></div></details>}
      {source === "call" && selectedCallId === "current" ? (
        <div className="intake-workspace">
          <div className="call-stage">
            <div className="audio-console">
              <div className={`recording-icon ${playing ? "live" : ""}`} aria-hidden="true"><Microphone size={22} /></div>
              <button className="audio-button" aria-label={complete ? "Call analysis complete" : playing ? "Pause call analysis" : "Play and analyze call"} onClick={toggleAnalysis} disabled={complete}>{complete ? <Check size={21} weight="bold" /> : playing ? <Pause size={21} weight="fill" /> : <Play size={21} weight="fill" />}</button>
              <div className="audio-track">
                <div className="audio-meta"><strong>Customer Call</strong><span>{complete ? caseData.complaint.callDuration : hasStarted ? currentLine.time : "00:00"}</span></div>
                <div className={`wave-bars ${playing ? "playing" : ""}`} aria-hidden="true">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 11) % 25)}px` }} />)}</div>
                <div className="audio-progress"><span style={{ width: `${Math.max(4, progress)}%` }} /></div>
              </div>
              <button className="analyze-button" onClick={toggleAnalysis} disabled={complete}>{playing ? "Pause" : complete ? "Analyzed" : "Play & analyze"}</button>
            </div>

            <div className="live-transcript" aria-busy={playing}>
              <div className="transcript-heading"><div><Waveform size={19} aria-hidden="true" /><strong>Live transcript</strong></div><div className="semantic-legend">{insightLabels.map((item) => <span className={`${item.key}-dot`} key={item.key}>{item.label}</span>)}</div></div>
              {!hasStarted && <div className="transcript-empty"><Microphone size={30} /><strong>Play the recording to see AI at work</strong><span>The conversation will be transcribed, corrected and structured in real time.</span></div>}
              <div className="conversation-stream">
                {conversation.slice(0, revealedCount).map((line, index) => (
                  <article id={`transcript-${line.id}`} className={`utterance ${line.speaker === "Customer" ? "customer" : "agent"} ${focusedEvidence === line.id ? "evidence-focus" : ""}`} key={line.id}>
                    <div className="speaker-line"><strong>{line.speaker}</strong><span>{line.time}</span>{index === activeLine && playing && <i>transcribing</i>}</div>
                    <p><StreamedLine line={line} visibleCharacters={index < activeLine || complete ? Number.POSITIVE_INFINITY : visibleCharacters} corrected={correctedLines.has(line.id)} />{index === activeLine && playing && visibleCharacters < currentRawText.length && <span className="stream-caret" aria-hidden="true" />}</p>
                    {line.id === "issue" && correctedLines.has("issue") && <div className="correction-note"><MagicWand size={14} />AI resolved self-correction: 2 visits → 3 visits</div>}
                  </article>
                ))}
              </div>
            </div>
          </div>

          <AIUnderstandingPanel insights={intakeDemo.insights} narrative={intakeDemo.narrative} revealed={revealedInsights} onEvidence={showEvidence} working={playing} />
        </div>
      ) : source === "call" && selectedHistoricalCall ? (
        <HistoricalCallView call={selectedHistoricalCall} playing={historyPlayingId === selectedHistoricalCall.id} progress={historyProgress} onToggle={() => toggleHistoryPlayback(selectedHistoricalCall.id)} />
      ) : (
        <div className="complaint-card scan-card"><div className="scan-preview"><FileText size={34} aria-hidden="true" /><span>SCANNED</span><strong>{caseData.complaint.scanReference}</strong></div><div><span className="field-label">Source</span><h3>{caseData.complaint.scanSource}</h3><p>{caseData.complaint.scanSummary}</p></div></div>
      )}
      {source === "scan" && <><h3 className="subheading">Extracted Information</h3><div className="extracted-grid"><article className="extracted-item issue"><div className="extracted-icon"><WarningCircle size={25} aria-hidden="true" /></div><div><span>Issue</span><strong>{caseData.issue}</strong></div></article><article className="extracted-item request"><div className="extracted-icon"><ClipboardText size={25} aria-hidden="true" /></div><div><span>Request</span><strong>{caseData.request}</strong></div></article><article className="extracted-item priority-item"><div className="extracted-icon"><Flag size={25} aria-hidden="true" /></div><div><span>Priority</span><strong>{caseData.priority}</strong></div></article></div></>}
      <div className="screen-actions"><span className="intake-action-hint">{source === "call" && !complete ? "Analyze the recording to continue" : "Complaint classification is ready for human review"}</span><button className="primary-button wide button-with-icon" onClick={onNext} disabled={source === "call" && !complete}>Review routing suggestion<ArrowRight size={18} aria-hidden="true" /></button></div>
    </section>
  );
}

function HistoricalCallView({ call, playing, progress, onToggle }: { call: HistoricalCall; playing: boolean; progress: number; onToggle: () => void }) {
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);
  const showEvidence = (id: string) => {
    setFocusedEvidence(id);
    document.getElementById(`${call.id}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setFocusedEvidence(null), 2200);
  };
  return (
    <section className="history-call-workspace">
      <div className="history-call-main">
        <div className="audio-console historical">
          <div className={`recording-icon ${playing ? "live" : ""}`} aria-hidden="true"><PhoneCall size={21} /></div>
          <button className="audio-button" aria-label={playing ? `Pause call record ${call.sequence}` : `Play call record ${call.sequence}`} onClick={onToggle}>{playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}</button>
          <div className="audio-track"><div className="audio-meta"><strong>Call record {call.sequence} · {call.date}</strong><span>{call.duration}</span></div><div className={`wave-bars ${playing ? "playing" : ""}`} aria-hidden="true">{Array.from({ length: 44 }, (_, index) => <i key={index} style={{ height: `${7 + ((index * 13) % 23)}px` }} />)}</div><div className="audio-progress"><span style={{ width: `${progress}%` }} /></div></div>
          <button className="analyze-button" onClick={onToggle}>{playing ? "Pause" : progress >= 100 ? "Replay" : "Play recording"}</button>
        </div>
        <div className="historical-transcript"><div className="transcript-heading"><div><Waveform size={19} aria-hidden="true" /><strong>Analyzed transcript</strong></div><div className="semantic-legend">{insightLabels.map((item) => <span className={`${item.key}-dot`} key={item.key}>{item.label}</span>)}</div></div><div className="conversation-stream">{call.conversation.map((line) => <article id={`${call.id}-${line.id}`} className={`utterance fixed ${line.speaker === "Customer" ? "customer" : "agent"} ${focusedEvidence === line.id ? "evidence-focus" : ""}`} key={line.id}><div className="speaker-line"><strong>{line.speaker}</strong><span>{line.time}</span></div><p><StreamedLine line={line} visibleCharacters={Number.POSITIVE_INFINITY} corrected /></p></article>)}</div></div>
      </div>
      <AIUnderstandingPanel insights={call.insights} narrative={call.narrative} revealed={new Set<SemanticType>(insightLabels.map((item) => item.key))} onEvidence={showEvidence} />
    </section>
  );
}

function ReviewAgentIcon({ category, size = 22 }: { category: ReviewAgent["category"]; size?: number }) {
  if (category === "warranty") return <ShieldCheck size={size} />;
  if (category === "technical") return <Wrench size={size} />;
  if (category === "knowledge") return <Books size={size} />;
  if (category === "ocr") return <Scan size={size} />;
  return <Database size={size} />;
}

function ReviewScreen({ state, agents, setAgents, dealerSubmission, approvals, onAccess, onRunComplete, onReplan, onResetApprovals, onResult, onNext, onWorkbench }: { state: ReviewState; agents: ReviewAgent[]; setAgents: React.Dispatch<React.SetStateAction<ReviewAgent[]>>; dealerSubmission: DealerSubmission | null; approvals: InvestigationApprovals; onAccess: () => void; onRunComplete: () => void; onReplan: () => void; onResetApprovals: () => void; onResult: (agentId: string) => void; onNext: () => void; onWorkbench: () => void }) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(["technical", "parts"]));
  const [contextOpen, setContextOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [runCursor, setRunCursor] = useState(0);
  const [runPhase, setRunPhase] = useState<"request" | "working" | "return">("request");

  useEffect(() => {
    if (state !== "running") return;
    if (runCursor >= agents.length) {
      const timer = window.setTimeout(onRunComplete, 700);
      return () => window.clearTimeout(timer);
    }
    const delay = runPhase === "request" ? 950 : runPhase === "working" ? 1750 : 1050;
    const timer = window.setTimeout(() => {
      if (runPhase === "request") setRunPhase("working");
      else if (runPhase === "working") setRunPhase("return");
      else {
        setRunCursor((cursor) => cursor + 1);
        setRunPhase("request");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [agents.length, onRunComplete, runCursor, runPhase, state]);

  const toggleExpanded = (id: string) => setExpandedAgents((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const updateAgent = (id: string, changes: Partial<ReviewAgent>) => setAgents((current) => current.map((agent) => agent.id === id ? { ...agent, ...changes } : agent));

  const addAgent = (agent: ReviewAgent) => {
    const sequence = agents.filter((item) => item.id.startsWith(`${agent.id}-`)).length + 1;
    const newAgent = { ...agent, id: `${agent.id}-${sequence}`, name: agent.category === "ocr" ? `New OCR Agent ${sequence}` : `New Data Agent ${sequence}` };
    setAgents((current) => [...current, newAgent]);
    setExpandedAgents((current) => new Set(current).add(newAgent.id));
    setAddOpen(false);
  };

  const removeAgent = (id: string) => {
    setAgents((current) => current.filter((agent) => agent.id !== id));
    setExpandedAgents((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const replanAgents = () => {
    setRunCursor(0);
    setRunPhase("request");
    onResetApprovals();
    onReplan();
  };

  const activeAgent = agents[runCursor];
  const approvalsComplete = approvals.a6 === "approved" && approvals.a3 === "approved";
  const runMessage = runCursor >= agents.length ? "All results are back. The Process Agent is preparing the report." : runPhase === "request" ? `Sending a task to ${activeAgent?.name}…` : runPhase === "working" ? `${activeAgent?.name} is checking its source…` : `${activeAgent?.name} is sending the result to the Process Agent…`;

  return (
    <section className="screen-panel review-plan-screen">
      <div className="screen-heading"><div><p className="section-kicker">{reviewProcessAgentName.toUpperCase()}</p><h2>{state === "results" ? "Investigation Results" : state === "running" ? "Running Investigation" : "Investigation Plan"}</h2><p>Agent selection and tasks remain configurable. Approval is handled from the relevant Workbench domain.</p></div></div>

      {state === "plan" && <section className="plan-rationale">
        <div className="rationale-icon"><MagicWand size={22} /></div>
        <div><span>WHY THIS PLAN</span><h3>{reviewPlanContext.recommendation}</h3><button onClick={() => setContextOpen(!contextOpen)} aria-expanded={contextOpen}><Eye size={16} />{contextOpen ? "Hide context" : "View complaint context"}</button></div>
        {contextOpen && <section className="plan-context-document" aria-label="Complaint and dealer context">
          <header><div><span>CASE CONTEXT</span><h4>Complaint and dealer submission</h4></div>{dealerSubmission && <small>Dealer submitted · {dealerSubmission.submittedAt}</small>}</header>
          <div className="context-narrative">
            <article><div className="context-source-icon"><Headset size={19} aria-hidden="true" /></div><div><span>Customer Care summary</span><p>{reviewPlanContext.complaintSummary}</p></div></article>
            <article><div className="context-source-icon dealer"><Buildings size={19} aria-hidden="true" /></div><div><span>Dealer follow-up</span><p>{dealerSubmission?.contactSummary ?? "Dealer follow-up has not been received."}</p></div></article>
          </div>
          <div className="context-attachments">
            <header><div><Paperclip size={18} aria-hidden="true" /><strong>Dealer attachments</strong></div><span>{dealerSubmission?.attachments.length ?? 0} files</span></header>
            {dealerSubmission?.attachments.map((attachment) => <article key={attachment.name}><FileText size={22} aria-hidden="true" /><div><strong>{attachment.name}</strong><span>{attachment.detail}</span></div><b>{attachment.type}</b></article>)}
          </div>
        </section>}
      </section>}

      {state === "plan" && <section className="investigation-triggers" aria-label="AI investigation triggers"><header><MagicWand size={20} aria-hidden="true" /><div><span>AI-RECOMMENDED PLAN</span><h3>Configured from Complaint and Dealer case signals</h3></div></header><div><article><b>A6 · Mandatory</b><strong>Quality issue and Dealer repair responsibility</strong><span>Required for every 3R investigation.</span></article><article><b>A3 · Triggered</b><strong>Parts order and arrival timeline</strong><span>Customer reports a repair over 30 days; Dealer supplied a parts timeline.</span></article><article><b>A8 · Triggered</b><strong>Repeated repair history</strong><span>Complaint reports five repairs for the same issue.</span></article></div></section>}

      {(state === "running" || state === "results") && (
        <section className={`agent-network ${state}`} aria-label={`${reviewProcessAgentName} orchestration`}>
          <header className="network-heading"><div><span>AGENT NETWORK</span><h3>{state === "running" ? "The Process Agent is running the review" : "All results are ready"}</h3><p>{state === "running" ? "Watch each task move to an Agent and return to the Process Agent." : "The network completed this review. Open a result only when you need its source."}</p></div></header>
          <div className="network-canvas">
            <div className="planner-robot">
              <div className="robot-avatar planner" aria-hidden="true"><Robot size={72} weight="duotone" /><span><FlowArrow size={20} weight="bold" /></span></div>
              <strong>{reviewProcessAgentName}</strong><em>Process Agent</em><small>Buyback complaint review orchestration</small>
            </div>
            <div className="agent-network-list">
              {agents.map((agent, index) => {
                const done = index < runCursor || state === "results";
                const active = index === runCursor && state === "running";
                const phase = active ? runPhase : done ? "complete" : "waiting";
                const status = done ? "Result returned" : active ? runPhase === "working" ? "Working in source system" : runPhase === "return" ? "Returning result to Process Agent" : "Request sent by Process Agent" : "Waiting for request";
                return <div className={`network-agent-row ${done ? "done" : ""} ${active ? "active" : ""}`} key={agent.id}>
                  <div className={`agent-connection ${phase}`}><span className="network-packet">{runPhase === "return" && active ? <Check size={14} weight="bold" /> : <PaperPlaneTilt size={15} weight="fill" />}</span><b>{active ? runPhase === "return" ? "RESULT" : runPhase === "working" ? "PROCESSING" : "REQUEST" : done ? "RESULT RECEIVED" : "QUEUED"}</b></div>
                  <div className="agent-robot-node">
                    <div className={`robot-avatar ${agent.category}`} aria-hidden="true"><Robot size={58} weight="duotone" /><span><ReviewAgentIcon category={agent.category} size={17} /></span></div>
                    <div className="robot-agent-copy"><strong>{agent.name}</strong><em>{agent.role}</em><small>{status}</small></div>
                    {state === "results" && <button onClick={() => onResult(agent.id)}><Eye size={16} />View result</button>}
                  </div>
                </div>;
              })}
            </div>
          </div>
          <p className="network-status" role="status" aria-atomic="true"><span className={state === "running" ? "spinner" : "map-check"}>{state === "results" && <Check size={12} weight="bold" />}</span>{state === "results" ? "The Process Agent has received and organized all selected Agent results." : runMessage}</p>
        </section>
      )}

      {state === "results" && <section className="investigation-approval-gate"><header><ShieldCheck size={21} aria-hidden="true" /><div><span>HUMAN APPROVAL GATE</span><h3>{approvalsComplete ? "Required approvals completed" : "Return to Workbench for A6 and A3 approvals"}</h3></div></header><div><article><span>A6 · Technical Service</span><strong>{approvals.a6 === "approved" ? "Approved" : approvals.a6 === "changes_requested" ? "Changes requested" : "Pending approval"}</strong></article><article><span>A3 · Warranty</span><strong>{approvals.a3 === "approved" ? "Approved" : approvals.a3 === "changes_requested" ? "Changes requested" : "Pending approval"}</strong></article></div><p>Current user has both approval permissions. No role switching is required.</p></section>}

      {state === "plan" && <div className="action-plan-heading"><div><p>INVESTIGATION PLAN</p><h3>{agents.length} configured Agent steps</h3><span>Open a step to rename the Agent or edit its query instruction.</span></div><button className="secondary-button button-with-icon" onClick={() => setAddOpen(!addOpen)}><Plus size={17} />Add Agent</button></div>}

      {state === "plan" && addOpen && <section className="add-agent-panel"><div><strong>Add an Agent type</strong><span>Add it to the plan, then define its business name and task.</span></div>{optionalReviewAgents.map((agent) => <button key={agent.id} onClick={() => addAgent(agent)}><span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span><strong>{agent.category === "ocr" ? "OCR Agent" : "Data Agent"}<small>{agent.category === "ocr" ? "Extract structured fields from documents" : "Define an additional data query"}</small></strong><Plus size={18} /></button>)}</section>}

      {state === "plan" && <div className="review-agent-list">
        {agents.map((agent, index) => {
          const expanded = expandedAgents.has(agent.id);
          return (
            <article className="review-agent-card" key={agent.id}>
              <div className="agent-card-top"><button className="agent-card-header" onClick={() => toggleExpanded(agent.id)} aria-expanded={expanded}>
                <span className="step-number">{index + 1}</span>
                <span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span>
                <span className="agent-card-title"><strong>{agent.name}</strong><span>{agent.purpose}</span></span>
                {agent.addedBy && <span className="human-added">Added by human</span>}
                <CaretDown className={expanded ? "expanded" : ""} size={18} />
              </button>{agent.addedBy && state === "plan" && <button className="remove-agent-button" aria-label={`Remove ${agent.name} from plan`} onClick={() => removeAgent(agent.id)}><Trash size={17} /><span>Remove</span></button>}</div>
              {expanded && <div className="agent-card-body"><label><span><PencilSimple size={15} />Agent name <b>Editable</b></span><input aria-label={`${agent.name} name`} value={agent.name} onChange={(event) => updateAgent(agent.id, { name: event.target.value })} /></label><label><span><PencilSimple size={15} />Agent task <b>AI draft · editable</b></span><textarea value={agent.requirement} onChange={(event) => updateAgent(agent.id, { requirement: event.target.value })} /></label></div>}
            </article>
          );
        })}
      </div>}

      {state !== "running" && <div className="screen-actions split-actions"><span className="review-action-note">{state === "plan" ? "Edit the configuration if needed, then run the investigation." : approvalsComplete ? "A6 and A3 approvals are complete." : "Investigation results cannot enter Decision before both approvals."}</span>{state === "plan" && <button className="primary-button wide button-with-icon" onClick={onAccess}><LockKeyOpen size={18} />Confirm &amp; Run Investigation</button>}{state === "results" && <div className="result-actions"><button className="secondary-button wide button-with-icon" onClick={replanAgents}><ArrowLeft size={18} />Edit Plan</button>{approvalsComplete ? <button className="primary-button wide button-with-icon" onClick={onNext}>Review Recommendation<ArrowRight size={18} /></button> : <button className="primary-button wide button-with-icon" onClick={onWorkbench}>Return to Workbench for Approvals<ArrowRight size={18} /></button>}</div>}</div>}
    </section>
  );
}

function RecommendationScreen({ agents, solution, setSolution, instruction, setInstruction, onResult, onBack, onConfirm }: { agents: ReviewAgent[]; solution: BuybackSolution; setSolution: (value: BuybackSolution) => void; instruction: string; setInstruction: (value: string) => void; onResult: (agentId: string) => void; onBack: () => void; onConfirm: () => void }) {
  const [reviewed, setReviewed] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const calculated = calculateBuybackSolution(solution);
  const allocatedVehicleCost = calculated.customerCoverVehicle + calculated.dealerCoverVehicle + calculated.bmwCoverVehicle;
  const allocationBalanced = allocatedVehicleCost === calculated.vehicleCost;
  const updateAmount = (key: EditableAmountKey, rawValue: string) => {
    const previousDraftInstruction = createDecisionInstruction(calculated);
    const next = calculateBuybackSolution({ ...calculated, [key]: Math.max(0, Number(rawValue) || 0) });
    setSolution(next);
    if (instruction === previousDraftInstruction) setInstruction(createDecisionInstruction(next));
  };
  return (
    <section className="screen-panel recommendation-screen">
      <div className="screen-heading"><div><p className="section-kicker">CUSTOMER CARE</p><h2>Recommendation &amp; Decision</h2></div></div>
      <div className="decision-workspace">
        <section className="decision-recommendation" aria-labelledby="decision-recommendation-title">
          <div className="decision-ai-mark"><MagicWand size={22} aria-hidden="true" /><span>AI RECOMMENDATION</span></div>
          <h3 id="decision-recommendation-title">{settlementRecommendation.title}</h3>
          <p>{settlementRecommendation.summary}</p>
          <div className="qualification-path" aria-label="Why this case meets the 3R condition">
            <article><span>APPLICABLE CONDITION</span><strong>{settlementRecommendation.eligibility.condition}</strong></article>
            <ArrowRight size={20} aria-hidden="true" />
            <article><span>CASE EVIDENCE</span><strong>{settlementRecommendation.eligibility.evidence}</strong></article>
            <ArrowRight size={20} aria-hidden="true" />
            <article className="qualification-result"><span>ASSESSMENT</span><strong><CheckCircle size={18} weight="fill" aria-hidden="true" />{settlementRecommendation.eligibility.result}</strong></article>
          </div>
          <div className="decision-boundary"><WarningCircle size={18} aria-hidden="true" /><span>Assessment only. A Customer Care specialist makes the final decision.</span></div>
        </section>

        <section className="buyback-solution" aria-labelledby="buyback-solution-title">
          <header><div><span>PROPOSED FINAL SOLUTION</span><h3 id="buyback-solution-title">{calculated.finalSolution}</h3><p>All entered amounts are editable. Calculated totals update automatically.</p></div><strong><PencilSimple size={15} aria-hidden="true" />Editable proposal</strong></header>
          <dl className="solution-context"><div><dt>Trade In</dt><dd>{calculated.tradeIn}</dd></div><div><dt>Trade In Model</dt><dd>{calculated.tradeInModel}</dd></div></dl>

          <section className="valuation-builder" aria-labelledby="valuation-title">
            <div className="solution-section-heading"><div><span>VEHICLE VALUATION</span><h4 id="valuation-title">How the vehicle cost loss is calculated</h4></div><small>Vehicle total cost − used car value = vehicle cost loss</small></div>
            <div className="valuation-equation">
              <article className="valuation-card total-cost"><header><span>VEHICLE TOTAL COST</span><strong>{formatCny(calculated.totalVehiclePurchaseCost)}</strong></header><div className="valuation-components">
                <CurrencyInput id="actual-vehicle-price" label="Actual Vehicle Price" value={calculated.actualVehiclePrice} onChange={(value) => updateAmount("actualVehiclePrice", value)} />
                <CurrencyInput id="purchase-tax" label="Purchase Tax" value={calculated.purchaseTax} onChange={(value) => updateAmount("purchaseTax", value)} />
                <CurrencyInput id="other-cost" label="Other Cost" value={calculated.otherCost} onChange={(value) => updateAmount("otherCost", value)} />
              </div></article>
              <span className="equation-operator" aria-hidden="true">−</span>
              <article className="valuation-card used-value"><header><span>USED CAR VALUE</span><strong>{formatCny(calculated.usedCarPrice)}</strong></header><CurrencyInput id="used-car-price" label="Used Car Price" value={calculated.usedCarPrice} onChange={(value) => updateAmount("usedCarPrice", value)} /></article>
              <span className="equation-operator" aria-hidden="true">=</span>
              <article className="valuation-card loss-result"><header><span>VEHICLE COST LOSS</span><strong>{formatCny(calculated.vehicleCost)}</strong></header><p>Automatically calculated from the editable valuation above.</p></article>
            </div>
          </section>

          <section className="allocation-builder" aria-labelledby="allocation-title">
            <div className="solution-section-heading"><div><span>COST ALLOCATION</span><h4 id="allocation-title">Edit each party&apos;s contribution</h4></div><small>Humanity Care total · {formatCny(calculated.humanityCareCost)}</small></div>
            <div className="allocation-editor" role="table" aria-label="Editable Buyback cost allocation by party">
              <div className="allocation-edit-row allocation-edit-head" role="row"><span role="columnheader">Party</span><span role="columnheader">Vehicle</span><span role="columnheader">Humanity Care</span><span role="columnheader">Other</span><span role="columnheader">Calculated Total</span></div>
              <div className="allocation-edit-row" role="row"><strong>Customer Cover</strong><CurrencyInput compact id="customer-cover-vehicle" label="Customer Cover - Vehicle" value={calculated.customerCoverVehicle} onChange={(value) => updateAmount("customerCoverVehicle", value)} /><CurrencyInput compact id="customer-cover-humanity" label="Customer Cover - Humanity Care" value={calculated.customerCoverHumanityCare} onChange={(value) => updateAmount("customerCoverHumanityCare", value)} /><span className="not-applicable">—</span><b>{formatCny(calculated.customerCover)}</b></div>
              <div className="allocation-edit-row" role="row"><strong>Dealer Cover</strong><CurrencyInput compact id="dealer-cover-vehicle" label="Dealer Cover - Vehicle" value={calculated.dealerCoverVehicle} onChange={(value) => updateAmount("dealerCoverVehicle", value)} /><CurrencyInput compact id="dealer-cover-humanity" label="Dealer Cover - Humanity Care" value={calculated.dealerCoverHumanityCare} onChange={(value) => updateAmount("dealerCoverHumanityCare", value)} /><span className="not-applicable">—</span><b>{formatCny(calculated.dealerCover)}</b></div>
              <div className="allocation-edit-row" role="row"><strong>BMW Cover</strong><CurrencyInput compact id="bmw-cover-vehicle" label="BMW Cover - Vehicle" value={calculated.bmwCoverVehicle} onChange={(value) => updateAmount("bmwCoverVehicle", value)} /><CurrencyInput compact id="bmw-cover-humanity" label="BMW Cover - Humanity Care" value={calculated.bmwCoverHumanityCare} onChange={(value) => updateAmount("bmwCoverHumanityCare", value)} /><CurrencyInput compact id="bmw-cover-other" label="BMW Cover - Other" value={calculated.bmwCoverOther} onChange={(value) => updateAmount("bmwCoverOther", value)} /><b>{formatCny(calculated.bmwTotalCover)}</b></div>
            </div>
            <div className={`allocation-reconciliation ${allocationBalanced ? "balanced" : "mismatch"}`} role="status"><span>{allocationBalanced ? <CheckCircle size={18} weight="fill" /> : <WarningCircle size={18} weight="fill" />}{allocationBalanced ? "Vehicle allocation is balanced" : "Vehicle allocation needs adjustment"}</span><strong>{formatCny(allocatedVehicleCost)} allocated / {formatCny(calculated.vehicleCost)} cost loss</strong></div>
          </section>
          <aside className="solution-remark"><span>BMW REMARK</span><p>{calculated.bmwRemark}</p></aside>
        </section>

        <section className="decision-agent-results" aria-label="Agent results supporting the recommendation">
          <button className="decision-results-toggle" onClick={() => setResultsOpen((open) => !open)} aria-expanded={resultsOpen}>
            <span><strong>Based on {agents.length} Agent {agents.length === 1 ? "result" : "results"}</strong><small>Open the result or source only when you need to verify the recommendation.</small></span>
            <CaretDown size={21} className={resultsOpen ? "expanded" : ""} aria-hidden="true" />
          </button>
          {resultsOpen && <div className="decision-results-list">
            {agents.map((agent) => <article key={agent.id}>
              <span className={`agent-symbol ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} /></span>
              <div><strong>{agent.name}</strong><p>{agent.resultSummary}</p><small>{agent.decisionImpact}</small></div>
              <button onClick={() => onResult(agent.id)}><Eye size={17} aria-hidden="true" />View result</button>
            </article>)}
          </div>}
        </section>

        <section className="decision-editor" aria-labelledby="human-decision-title">
          <div><span>HUMAN DECISION</span><h3 id="human-decision-title">Confirm or change the proposed action</h3><p>The draft is editable. Write the action in the language you want the Process Agent to execute.</p></div>
          <label htmlFor="decision-instruction"><span>Decision instruction <b>AI draft · editable</b></span><textarea id="decision-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label>
          <label className="decision-review-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>I reviewed the five same-issue repair records, Technical Service finding and internal allocation separately.</span></label>
        </section>
      </div>
      <div className="screen-actions"><button className="secondary-button wide button-with-icon" onClick={onBack}><ArrowLeft size={18} />Back to Review</button><button className="primary-button wide button-with-icon" disabled={!instruction.trim() || !reviewed} onClick={onConfirm}><CheckCircle size={18} />Confirm &amp; Execute</button></div>
    </section>
  );
}

function ExecutionScreen({ instruction, completed, onComplete, onWorkbench }: { instruction: string; completed: boolean; onComplete: (complete: boolean) => void; onWorkbench: () => void }) {
  const [phase, setPhase] = useState(completed ? 4 : 0);
  const actions = [
    { title: "Receive final decision", detail: "A7 sends the decision and the evidence list." },
    { title: "Upload case files", detail: "The Execution Agent uploads the report and source records to CCO." },
    { title: "Complete CCO approval", detail: "The Execution Agent enters the decision and approves the case in CCO." },
    { title: "Receive the CCO record", detail: "CCO provides approval ID CCO-DEMO-0096." },
  ];

  useEffect(() => {
    if (completed || phase >= actions.length) {
      if (!completed) onComplete(true);
      return;
    }
    const timer = window.setTimeout(() => setPhase((current) => current + 1), phase === 0 ? 1200 : 1550);
    return () => window.clearTimeout(timer);
  }, [actions.length, completed, onComplete, phase]);

  const currentMessage = completed || phase >= actions.length ? "CCO approval is complete." : actions[phase].detail;
  return (
    <section className="screen-panel execution-screen">
      <div className="screen-heading"><div><p className="section-kicker">EXECUTION</p><h2>{completed ? "Case Completed" : "Completing the Case"}</h2></div></div>
      <section className="execution-network" aria-label="A7 Planner sends the final decision to the Execution and Automation Agent, which operates the CCO system">
        <header><span>LIVE EXECUTION</span><h3>A7 sends the decision to CCO through the Execution Agent</h3><p>CCO is an existing business system. The Agent uploads files and completes the approval in it.</p></header>
        <div className="execution-flow">
          <div className={`execution-node agent-node ${phase > 0 ? "done" : "active"}`}><div className="robot-avatar planner"><Robot size={70} weight="duotone" /><span><FlowArrow size={19} weight="bold" /></span></div><strong>A7 Planner</strong><em>Planner Agent</em><small>BBS-A-7</small></div>
          <div className={`execution-link ${phase === 0 ? "active" : phase > 0 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase === 0 ? "SENDING DECISION" : "DECISION SENT"}</b></div>
          <div className={`execution-node agent-node ${phase > 2 ? "done" : phase > 0 ? "active" : ""}`}><div className="robot-avatar execution"><Robot size={70} weight="duotone" /><span><UploadSimple size={18} weight="bold" /></span></div><strong>Execution &amp; Automation</strong><em>Execution Agent</em><small>Uploads files · operates CCO</small></div>
          <div className={`execution-link ${phase > 0 && phase < 4 ? "active" : phase >= 4 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase >= 4 ? "APPROVAL RETURNED" : phase > 0 ? "WORKING IN CCO" : "WAITING"}</b></div>
          <div className={`cco-system ${phase >= 4 ? "done" : phase > 1 ? "active" : ""}`}><div className="system-window"><span /><span /><span /><SquaresFour size={34} weight="duotone" /></div><strong>CCO</strong><em>Existing system</em><small>Case approval</small></div>
        </div>
        <p className="execution-status" role="status" aria-live="polite"><span className={completed ? "map-check" : "spinner"}>{completed && <Check size={12} weight="bold" />}</span>{currentMessage}</p>
      </section>

      <section className="execution-instruction"><span>FINAL DECISION</span><p>{instruction}</p></section>
      {completed && <section className="execution-complete"><CheckCircle size={28} weight="fill" /><div><strong>CCO approval complete</strong><span>Approval ID: CCO-DEMO-0096 · 3R Case {caseData.id} is closed</span></div></section>}
      <div className="screen-actions completion-actions"><span>Status: <b>{completed ? "Completed" : "In progress"}</b></span><button className="primary-button wide button-with-icon" disabled={!completed} onClick={onWorkbench}><ArrowLeft size={18} aria-hidden="true" />Back to Workbench</button></div>
    </section>
  );
}

function AccessModal({ agents, onCancel, onAllow }: { agents: ReviewAgent[]; onCancel: () => void; onAllow: () => void }) {
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="access-title"><h2 id="access-title"><LockKeyOpen size={24} aria-hidden="true" />Confirm Investigation Access</h2><p className="modal-intro">The current Demo user can run every configured Agent and approve both A6 and A3 results. No role switch is required.</p><div className="access-sources dynamic">{agents.map((agent) => <div key={agent.id}><span className={`source-icon ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} size={20} /></span><strong>{agent.name}</strong><RoleBadge>{agent.role}</RoleBadge></div>)}</div><div className="access-scope"><span><Target size={18} aria-hidden="true" />{caseData.access.scope}</span><span><Eye size={18} aria-hidden="true" />{caseData.access.mode}</span><span><CheckCircle size={18} aria-hidden="true" />A6 + A3 approval access</span></div><p>Agent access ends when this investigation is done.</p><div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Back to Plan</button><button className="primary-button wide button-with-icon" onClick={onAllow}><LockKeyOpen size={18} aria-hidden="true" />Allow &amp; Run</button></div></section>
    </div>
  );
}

function DataAgentSourcesView({ sources }: { sources: Extract<AgentSources, { type: "data" }> }) {
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  return (
    <section className="agent-sources-view data-agent-sources" aria-labelledby="agent-sources-title">
      <header><div><span>DATA SOURCES</span><h3 id="agent-sources-title">{sources.title}</h3></div><strong>{sources.records.length} {sources.records.length === 1 ? "record" : "records"}</strong></header>
      <div className="data-source-head" aria-hidden="true"><span>Record</span><span>Extracted facts</span><span>Used in conclusion</span></div>
      <div className="data-source-list">
        {sources.records.map((record) => {
          const expanded = expandedRecord === record.id;
          return <article key={record.id}>
            <div className="source-record-id"><strong>{record.id}</strong>{record.date && <span>{record.date}</span>}</div>
            <ul>{record.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
            <div className="source-relevance"><p>{record.relevance}</p>{record.rawPreview && <button onClick={() => setExpandedRecord(expanded ? null : record.id)} aria-expanded={expanded}>{expanded ? "Hide raw record" : "View raw record"}</button>}</div>
            {expanded && record.rawPreview && <div className="raw-source-preview"><FileText size={18} aria-hidden="true" /><p>{record.rawPreview}</p></div>}
          </article>;
        })}
      </div>
    </section>
  );
}

function KnowledgeAgentSourcesView({ sources }: { sources: Extract<AgentSources, { type: "knowledge" }> }) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  return (
    <section className="agent-sources-view knowledge-agent-sources" aria-labelledby="agent-sources-title">
      <header><div><span>KNOWLEDGE MATCHES</span><h3 id="agent-sources-title">{sources.title}</h3></div><strong>{sources.matches.length} {sources.matches.length === 1 ? "match" : "matches"}</strong></header>
      <div className="knowledge-match-list">
        {sources.matches.map((match, index) => {
          const expanded = expandedMatch === match.id;
          return <article key={match.id}>
            <div className="knowledge-match-rank">{String(index + 1).padStart(2, "0")}</div>
            <div className="knowledge-match-body">
              <header><div><span>{match.sourceType}</span><h4>{match.title}</h4><small>{match.id}</small></div><strong>{match.relevance}% relevant</strong></header>
              <div className="knowledge-reasoning-grid">
                <div><span>WHY IT MATCHED</span><ul>{match.matchedOn.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><span>IMPORTANT DIFFERENCE</span><p>{match.caveat ?? "No material difference identified."}</p></div>
                <div><span>USED IN CONCLUSION</span><p>{match.contribution}</p></div>
              </div>
              {match.excerpt && <><button className="source-excerpt-toggle" onClick={() => setExpandedMatch(expanded ? null : match.id)} aria-expanded={expanded}>{expanded ? "Hide source excerpt" : "View source excerpt"}</button>{expanded && <blockquote>{match.excerpt}</blockquote>}</>}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}

function OCRAgentSourcesView({ sources }: { sources: Extract<AgentSources, { type: "ocr" }> }) {
  const [expandedDocument, setExpandedDocument] = useState<string | null>(null);
  return (
    <section className="agent-sources-view ocr-agent-sources" aria-labelledby="agent-sources-title">
      <header><div><span>OCR DOCUMENTS</span><h3 id="agent-sources-title">{sources.title}</h3></div><strong>{sources.documents.length} {sources.documents.length === 1 ? "document" : "documents"}</strong></header>
      <div className="ocr-document-list">
        {sources.documents.map((document) => {
          const expanded = expandedDocument === document.id;
          return <article key={document.id}>
            <header>
              <div className="ocr-document-title"><span><FileText size={22} aria-hidden="true" /></span><div><strong>{document.name}</strong><small>{document.id} · {document.pages} {document.pages === 1 ? "page" : "pages"}</small></div></div>
              <b>{document.confidence}% document confidence</b>
            </header>
            <div className="ocr-field-table">
              <div className="ocr-field-head" aria-hidden="true"><span>Field</span><span>Extracted value</span><span>Confidence</span></div>
              {document.fields.map((field) => <div className={field.confidence < 85 ? "needs-review" : ""} key={field.label}><strong>{field.label}</strong><span>{field.value}</span><b>{field.confidence}%{field.confidence < 85 && <small>Check</small>}</b></div>)}
            </div>
            {document.rawText && <><button className="source-excerpt-toggle" onClick={() => setExpandedDocument(expanded ? null : document.id)} aria-expanded={expanded}>{expanded ? "Hide extracted text" : "View extracted text"}</button>{expanded && <blockquote>{document.rawText}</blockquote>}</>}
          </article>;
        })}
      </div>
    </section>
  );
}

function AgentResultDrawer({ agent, returnLabel, onClose }: { agent: ReviewAgent; returnLabel: string; onClose: () => void }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourceCount = agent.sources.type === "data" ? agent.sources.records.length : agent.sources.type === "knowledge" ? agent.sources.matches.length : agent.sources.documents.length;
  const sourceLabel = agent.sources.type === "data" ? sourceCount === 1 ? "record" : "records" : agent.sources.type === "knowledge" ? sourceCount === 1 ? "knowledge match" : "knowledge matches" : sourceCount === 1 ? "document" : "documents";
  return (
    <div className="overlay drawer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="drawer agent-result-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-heading"><div><p className="section-kicker">AGENT RESULT</p><h2 id="drawer-title"><span className={`agent-symbol ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} size={24} /></span>{agent.name}</h2><span>{agent.role}</span></div><button className="close-button" aria-label="Close Agent result" onClick={onClose}><X size={22} /></button></div>
        <section className="agent-result-overview">
          <span>RESULT</span>
          <h3>{agent.resultSummary}</h3>
          <div><strong>Decision impact</strong><p>{agent.decisionImpact}</p></div>
        </section>
        <button className="view-sources-toggle" onClick={() => setSourcesOpen((open) => !open)} aria-expanded={sourcesOpen}>
          <span><strong>View sources</strong><small>{sourceCount} supporting {sourceLabel}</small></span>
          <CaretDown size={21} className={sourcesOpen ? "expanded" : ""} aria-hidden="true" />
        </button>
        {sourcesOpen && (agent.sources.type === "data" ? <DataAgentSourcesView sources={agent.sources} /> : agent.sources.type === "knowledge" ? <KnowledgeAgentSourcesView sources={agent.sources} /> : <OCRAgentSourcesView sources={agent.sources} />)}
        <div className="drawer-footer"><button className="primary-button wide button-with-icon" onClick={onClose}><ArrowLeft size={18} />{returnLabel}</button></div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  Bell,
  Books,
  Car,
  CaretRight,
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
  User,
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
import { optionalReviewAgents, recommendedReviewAgents, reviewPlanContext, settlementRecommendation, type EvidenceBlock, type ReviewAgent } from "@/data/review-plan";

type ReviewState = "plan" | "running" | "results";
type ComplaintSource = "call" | "scan";
type DealerSubmission = {
  contactSummary: string;
  submittedAt: string;
  evidenceCount: number;
};

const steps = ["Intake", "Route", "Dealer Evidence", "Review", "Decision", "Execution"];
const reviewProcessAgentName = "Three Guarantees Vehicle Return Process Agent";

const ccoCreationActions = [
  { title: "Hand over the approved route", detail: `The Router Agent hands the case and call evidence to the ${reviewProcessAgentName}.` },
  { title: "Build the complaint-case request", detail: "The Process Agent prepares the CCO request with the approved route and customer context." },
  { title: "Create the complaint case in CCO", detail: "The Execution Agent calls CCO once with the Process Agent request and an idempotency key." },
  { title: "Receive the CCO case record", detail: `CCO returns case ${caseData.id} and confirms that the record was created.` },
  { title: "Set the asynchronous wait state", detail: "The Process Agent records WAITING_DEALER_EVIDENCE and closes this Route task." },
];

function createDecisionInstruction() {
  return `Start the vehicle-return handling process under the Three Guarantees policy. Record the approved customer remedy separately from the internal BMW ${settlementRecommendation.bmwShare}% / dealer ${settlementRecommendation.dealerShare}% allocation. Save the decision, evidence and action receipts in CCO.`;
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
  const [accessGranted, setAccessGranted] = useState(false);
  const [recommendationEvidence, setRecommendationEvidence] = useState<string | null>(null);
  const [source, setSource] = useState<ComplaintSource>("call");
  const [playing, setPlaying] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [routeExecutionStarted, setRouteExecutionStarted] = useState(false);
  const [ccoCaseCreated, setCcoCaseCreated] = useState(false);
  const [dealerMockOpen, setDealerMockOpen] = useState(false);
  const [dealerSubmission, setDealerSubmission] = useState<DealerSubmission | null>(null);
  const [routedDomain, setRoutedDomain] = useState<string | null>(null);
  const [decisionInstruction, setDecisionInstruction] = useState(createDecisionInstruction);
  const [plannedAgents, setPlannedAgents] = useState<ReviewAgent[]>(() => recommendedReviewAgents.map((agent) => ({ ...agent })));

  const openCase = () => {
    setView("case");
    setStage(dealerSubmission ? 4 : 1);
    setReviewState("plan");
    setAccessGranted(false);
    setPlannedAgents(recommendedReviewAgents.map((agent) => ({ ...agent })));
    setDecisionInstruction(createDecisionInstruction());
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

  const completeCase = () => {
    setCaseCompleted(false);
    setStage(6);
  };

  const timeline = useMemo(() => {
    const events = [
      { label: "Complaint received", done: stage > 1 || caseCompleted },
      { label: "Route confirmed & CCO case created", done: routeConfirmed && ccoCaseCreated },
      { label: "Dealer evidence received", done: Boolean(dealerSubmission) },
      { label: "Review plan prepared", done: stage > 4 || reviewState !== "plan" },
      { label: "Case access allowed", done: accessGranted },
      { label: "Agent review completed", done: reviewState === "results" || stage > 4 },
      { label: "Recommendation prepared", done: stage >= 5 },
      { label: "Case completed", done: caseCompleted },
    ];
    const firstPending = events.findIndex((event) => !event.done);
    return events.map((event, index) => ({ ...event, active: firstPending === index }));
  }, [accessGranted, caseCompleted, ccoCaseCreated, dealerSubmission, reviewState, routeConfirmed, stage]);

  if (view === "workbench") return <>
    <Workbench onOpen={openCase} onDealerMock={() => setDealerMockOpen(true)} completed={caseCompleted} routedDomain={routedDomain} ccoCaseCreated={ccoCaseCreated} dealerSubmission={dealerSubmission} />
    {dealerMockOpen && <DealerMockModal onCancel={() => setDealerMockOpen(false)} onSubmit={(submission) => { setDealerSubmission(submission); setDealerMockOpen(false); }} />}
  </>;

  return (
    <main className="app-shell">
      <ProductHeader onHome={backToWorkbench} showProcess />
      <StageStepper stage={stage} timeline={timeline} onSelect={(next) => next <= stage && setStage(next)} />
      <section className="case-layout">
        <div className="case-main">
          <CaseIdentity />
          {stage === 1 && (
            <IntakeScreen source={source} setSource={setSource} playing={playing} setPlaying={setPlaying} onNext={() => setStage(2)} />
          )}
          {stage === 2 && !routeExecutionStarted && <RoutingDecisionScreen onConfirm={() => { setRouteConfirmed(true); setRouteExecutionStarted(true); }} onModify={(target) => { setRoutedDomain(target); backToWorkbench(); }} />}
          {stage === 2 && routeExecutionStarted && <CreateComplaintCaseExecution created={ccoCaseCreated} onCreated={() => setCcoCaseCreated(true)} onWorkbench={backToWorkbench} />}
          {stage === 3 && <DealerEvidenceScreen submission={dealerSubmission} onOpenMock={() => setDealerMockOpen(true)} onContinue={() => setStage(4)} onWorkbench={backToWorkbench} />}
          {stage === 4 && (
            <ReviewScreen
              state={reviewState}
              accessGranted={accessGranted}
              agents={plannedAgents}
              setAgents={setPlannedAgents}
              onAccess={() => setAccessOpen(true)}
              onRunComplete={() => setReviewState("results")}
              onReplan={() => {
                setReviewState("plan");
                setAccessGranted(false);
              }}
              onNext={() => setStage(5)}
            />
          )}
          {stage === 5 && <RecommendationScreen agents={plannedAgents} instruction={decisionInstruction} setInstruction={setDecisionInstruction} onEvidence={setRecommendationEvidence} onBack={() => setStage(4)} onConfirm={completeCase} />}
          {stage === 6 && <ExecutionScreen instruction={decisionInstruction} completed={caseCompleted} onComplete={setCaseCompleted} onWorkbench={backToWorkbench} />}
        </div>
      </section>
      {accessOpen && <AccessModal agents={plannedAgents} onCancel={() => setAccessOpen(false)} onAllow={allowAccess} />}
      {dealerMockOpen && <DealerMockModal onCancel={() => setDealerMockOpen(false)} onSubmit={(submission) => { setDealerSubmission(submission); setDealerMockOpen(false); }} />}
      {recommendationEvidence && <RecommendationEvidenceDrawer agent={plannedAgents.find((agent) => agent.id === recommendationEvidence) ?? recommendedReviewAgents.find((agent) => agent.id === recommendationEvidence)!} returnLabel={stage === 5 ? "Back to Recommendation & Decision" : "Back to Recommendation"} onClose={() => setRecommendationEvidence(null)} />}
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

function Workbench({ onOpen, onDealerMock, completed, routedDomain, ccoCaseCreated, dealerSubmission }: { onOpen: () => void; onDealerMock: () => void; completed: boolean; routedDomain: string | null; ccoCaseCreated: boolean; dealerSubmission: DealerSubmission | null }) {
  const [selectedDomain, setSelectedDomain] = useState(routedDomain ?? "Customer Care");
  const items = workbenchData.workItems.map((item) => item.caseId === caseData.id && routedDomain ? { ...item, domain: routedDomain, status: "Human-rerouted" } : item).filter((item) => item.domain === selectedDomain);
  const activeDomain = workbenchData.domains.find((domain) => domain.name === selectedDomain) ?? workbenchData.domains[0];
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
            <div><p className="eyebrow">AFS PROCESS MANAGEMENT</p><h1>AFS Process Workbench</h1><p>One place to monitor and operate aftersales processes across business domains</p></div>
            <span className="workbench-live"><span />Live process activity</span>
          </div>
          <div className="metrics" aria-label="AFS work summary">
            {workbenchData.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.label === "Completed today" && completed ? metric.value + 1 : metric.value}</strong></article>)}
          </div>
          <section className="panel pending-panel domain-cases">
            <div className="panel-heading domain-panel-heading"><span className={`domain-heading-icon ${activeDomain.tone}`}><DomainIcon tone={activeDomain.tone} /></span><div><p className="eyebrow">{activeDomain.name.toUpperCase()}</p><h2>Active cases</h2><p>{activeDomain.description}</p></div><dl><div><dt>Pending</dt><dd>{activeDomain.pending}</dd></div><div><dt>In progress</dt><dd>{activeDomain.inProgress}</dd></div></dl><span className="count-badge">{items.length} visible</span></div>
            <div className="work-table" role="table" aria-label={`${selectedDomain} active cases`}>
              <div className="work-row table-header" role="row"><span>Process</span><span>Case</span><span>Trigger</span><span>Detected intent</span><span>Status</span><span>Action</span></div>
              {items.map((item) => {
                const isDemo = item.caseId === caseData.id;
                const waitingForDealer = isDemo && ccoCaseCreated && !dealerSubmission && !completed;
                const reviewReady = isDemo && Boolean(dealerSubmission) && !completed;
                const status = completed ? "Completed" : reviewReady ? "REVIEW_READY" : waitingForDealer ? "WAITING_DEALER_EVIDENCE" : item.status;
                const actionLabel = completed ? "View" : reviewReady ? "Open Review" : waitingForDealer ? "Mock Dealer Submit" : "Open";
                const action = waitingForDealer ? onDealerMock : onOpen;
                return <div className={`work-row ${isDemo ? "featured" : ""}`} role="row" key={item.caseId}><strong>{item.process}{isDemo && <small className="ai-created-label"><Sparkle size={13} weight="fill" />{ccoCaseCreated ? "CCO case created" : "AI-created from call"}</small>}</strong><span>{item.caseId}</span><span>{item.trigger}</span><span>{item.intent}</span><span><b className={`${isDemo ? "case-status new" : "case-status"} ${waitingForDealer ? "waiting" : ""} ${reviewReady ? "ready" : ""}`}>{isDemo ? status : item.status}</b></span><span><button className={isDemo ? waitingForDealer ? "secondary-button" : "primary-button" : "text-button"} onClick={isDemo ? action : undefined} disabled={!isDemo}>{actionLabel}</button></span></div>;
              })}
              {items.length === 0 && <div className="domain-empty"><CheckCircle size={24} /><strong>No active cases in this domain</strong><span>Select another process domain.</span></div>}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function StageStepper({ stage, timeline, onSelect }: { stage: number; timeline: { label: string; done: boolean; active: boolean }[]; onSelect: (stage: number) => void }) {
  const stageStatuses = [
    timeline[0].done ? "Complaint captured" : "Current step",
    timeline[1].done ? "CCO case created" : stage === 2 ? "Human gate / CCO creation" : "Pending",
    timeline[2].done ? "Submission received" : stage === 3 ? "Waiting externally" : "Pending",
    timeline[5].done ? "Review completed" : timeline[4].done ? "Agents executing" : stage === 4 ? "Plan approval" : "Pending",
    stage > 5 ? "Decision submitted" : stage === 5 ? "Human decision" : "Pending",
    timeline[7].done ? "Case completed" : stage === 6 ? "Automation running" : "Pending",
  ];
  return (
    <nav className="stepper compact" aria-label="Case progress">
      <div className="process-label"><span>RETURN COMPLAINT QUICK WIN</span><strong>Human-controlled case flow</strong></div>
      {steps.map((label, index) => {
        const number = index + 1;
        return <button key={label} className={`step ${stage === number ? "active" : ""} ${stage > number ? "done" : ""}`} onClick={() => onSelect(number)} disabled={number > stage}><span>{stage > number ? <Check size={15} weight="bold" aria-hidden="true" /> : number}</span><b>{label}<small>{stageStatuses[index]}</small></b></button>;
      })}
    </nav>
  );
}

function CaseIdentity() {
  return (
    <div className="case-identity">
      <strong><FolderOpen size={24} aria-hidden="true" />Case: {caseData.id}</strong>
      <span><User size={22} aria-hidden="true" />{caseData.customer}</span>
      <span><Car size={24} aria-hidden="true" />{caseData.vehicle}</span>
      <span><Barcode size={24} aria-hidden="true" />VIN {caseData.vin}</span>
    </div>
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
    if (/other complaint|not a return|普通投诉|其他投诉|不是退车|不进入退车/.test(value)) return setInterpretation({ action: "modify", destination: "Customer Care · Other Complaint Queue", domain: "Customer Care", summary: "Keep the complaint in Customer Care without starting the Return Complaint Process Agent." });
    if (/agree|confirm|start|proceed|create|同意|确认|启动|进入退车|创建/.test(value)) return setInterpretation({ action: "confirm", destination: reviewProcessAgentName, domain: "Customer Care", summary: "Accept the AI route and hand the case from the Router Agent to the Three Guarantees Vehicle Return Process Agent." });
    setInterpretation({ action: "clarify", destination: "No action yet", domain: "Customer Care", summary: "The instruction does not identify whether to start or change the route. Add a destination or an explicit approval." });
  };
  const agreeWithAi = () => {
    updateRoutingAction("I agree with the AI. Hand this case to the Three Guarantees Vehicle Return Process Agent.", false);
  };
  return (
    <section className="screen-panel routing-screen">
      <div className="screen-heading"><div><p className="section-kicker">LEADING / ROUTER AGENT</p><h2>Review AI Routing Suggestion</h2></div><span className="waiting-pill"><User size={16} />Human instruction required</span></div>
      <section className="routing-summary">
        <div className="routing-score"><MagicWand size={26} aria-hidden="true" /><span>ROUTING SUGGESTION</span><strong>Return complaint candidate</strong><small>94% confidence · Decision RD-0088 v1</small></div>
        <div className="routing-facts">
          <article><span>Complaint classification</span><strong>COMPLAINT</strong><p>Recurring unresolved fault, safety concern and a requested remedy.</p></article>
          <article><span>Candidate signal</span><strong>RETURN_CANDIDATE</strong><p>Customer explicitly asks for a vehicle return under Three Guarantees.</p></article>
          <article><span>Approved next action</span><strong>HAND_OFF_TO_RETURN_PROCESS_AGENT</strong><p>After human confirmation, the Router Agent hands the case to the Process Agent, which then creates the CCO complaint case.</p></article>
          <article className="caution"><span>Important boundary</span><strong>Not an eligibility decision</strong><p>Three repair visits do not by themselves satisfy the “more than four repairs” condition.</p></article>
        </div>
      </section>
      <section className="routing-evidence"><header><Eye size={19} /><div><span>CALL EVIDENCE · 00:52</span><h3>“I want BMW to accept a vehicle return under the Three Guarantees policy.”</h3></div></header><div><span className="signal-tag">Explicit return request</span><span className="signal-tag">Recurring power loss</span><span className="risk-tag">Safety concern</span></div></section>
      <section className="nl-routing-command">
        <div className="nl-command-heading"><div className="ai-command-icon"><ChatText size={22} /></div><div><span>NATURAL-LANGUAGE CONTROL</span><h3>Tell the Router whether you agree or how to change the decision</h3><p>Agree with AI pre-fills the handoff instruction. You can edit it before executing the route.</p></div></div>
        <div className="command-examples" aria-label="Example routing instructions"><button onClick={agreeWithAi}>Agree with AI</button><button onClick={() => updateRoutingAction("Do not start the return process. Keep this as another Customer Care complaint.")}>Keep as other complaint</button><button onClick={() => updateRoutingAction("Change the route to Warranty Exception Review.")}>Route to Warranty</button><button onClick={() => updateRoutingAction("Send this case to Technical Service for diagnosis.")}>Route to Technical Service</button></div>
        <label htmlFor="route-instruction"><span>Your instruction</span><textarea id="route-instruction" placeholder="For example: Route this case to Warranty Exception Review." value={instruction} onChange={(event) => updateRoutingAction(event.target.value)} /></label>
        {showRouteAction && interpretation && <div className={`route-interpretation ${interpretation.action}`} role="status" aria-live="polite"><div><span>ROUTING ACTION</span><strong>{interpretation.action === "confirm" ? "HAND_OFF_TO_PROCESS_AGENT" : interpretation.action === "modify" ? "MODIFY_ROUTE" : "NEEDS_CLARIFICATION"}</strong></div><div><span>DESTINATION</span><strong>{interpretation.destination}</strong></div><p>{interpretation.summary}</p></div>}
      </section>
      <div className="screen-actions"><span className="routing-audit-note"><ShieldCheck size={17} />The route, human instruction, Process Agent handoff and CCO receipt are retained in one audit trail.</span><button className="primary-button wide button-with-icon" onClick={() => interpretation?.action === "confirm" ? onConfirm() : interpretation?.action === "modify" ? onModify(interpretation.domain) : undefined} disabled={!interpretation || interpretation.action === "clarify"}><CheckCircle size={18} />{interpretation?.action === "modify" ? "Apply modified routing" : "Hand off to Process Agent"}</button></div>
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
  const currentMessage = complete ? `CCO case ${caseData.id} was created. The Route task is complete.` : ccoCreationActions[phase].detail;
  return (
    <section className="screen-panel cco-create-screen">
      <div className="screen-heading"><div><p className="section-kicker">ROUTE EXECUTION</p><h2>{complete ? "CCO Complaint Case Created" : "Creating Complaint Case in CCO"}</h2></div><span className={complete ? "success-pill" : "network-live"}>{complete ? <><CheckCircle size={16} weight="fill" />Route complete</> : <><span />Executing</>}</span></div>
      <section className="execution-network cco-create-network" aria-label="The Router hands the case to the Three Guarantees Vehicle Return Process Agent, which creates a complaint case in CCO through the Execution Agent">
        <header><span>LIVE EXECUTION</span><h3>Router Agent → Process Agent → Execution Agent → CCO</h3><p>The Route decision is not complete until the Process Agent receives the CCO complaint-case record.</p></header>
        <div className="execution-flow">
          <div className={`execution-node agent-node ${phase > 0 ? "done" : "active"}`}><div className="robot-avatar planner"><Robot size={70} weight="duotone" /><span><FlowArrow size={19} weight="bold" /></span></div><strong>Router Agent</strong><em>Leading Agent</em><small>Approved route RD-0088 v1</small></div>
          <div className={`execution-link ${phase === 0 ? "active" : phase > 0 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase === 0 ? "HANDOFF" : "HANDED OFF"}</b></div>
          <div className={`execution-node agent-node process-agent-node ${phase >= 2 ? "done" : phase > 0 ? "active" : ""}`}><div className="robot-avatar planner"><Robot size={70} weight="duotone" /><span><FlowArrow size={19} weight="bold" /></span></div><strong>{reviewProcessAgentName}</strong><em>Process Agent</em><small>Owns the return complaint process</small></div>
          <div className={`execution-link ${phase === 1 ? "active" : phase > 1 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase === 1 ? "SENDING CASE REQUEST" : phase > 1 ? "REQUEST SENT" : "WAITING"}</b></div>
          <div className={`execution-node agent-node ${phase >= 4 ? "done" : phase > 1 ? "active" : ""}`}><div className="robot-avatar execution"><Robot size={70} weight="duotone" /><span><UploadSimple size={18} weight="bold" /></span></div><strong>Execution &amp; Automation</strong><em>Execution Agent</em><small>Creates the complaint case once</small></div>
          <div className={`execution-link ${phase > 1 && phase < 5 ? "active" : phase >= 5 ? "done" : ""}`}><span><PaperPlaneTilt size={16} weight="fill" /></span><b>{phase >= 5 ? "CASE RETURNED" : phase > 1 ? "WORKING IN CCO" : "WAITING"}</b></div>
          <div className={`cco-system ${complete ? "done" : phase > 2 ? "active" : ""}`}><div className="system-window"><span /><span /><span /><SquaresFour size={34} weight="duotone" /></div><strong>CCO</strong><em>Existing system</em><small>Create complaint case</small></div>
        </div>
        <p className="execution-status" role="status" aria-live="polite"><span className={complete ? "map-check" : "spinner"}>{complete && <Check size={12} weight="bold" />}</span>{currentMessage}</p>
      </section>
      <section className="cco-create-receipts" aria-label="CCO creation receipts">
        <header><span>EXECUTION RECEIPTS</span><h3>Complaint-case creation</h3></header>
        {ccoCreationActions.map((action, index) => {
          const done = complete || phase > index;
          const active = !complete && phase === index;
          return <div className={done ? "done" : active ? "active" : ""} key={action.title}><span>{done ? <Check size={14} weight="bold" /> : index + 1}</span><div><strong>{action.title}</strong><small>{action.detail}</small></div><b>{done ? "Done" : active ? "In progress" : "Waiting"}</b></div>;
        })}
      </section>
      {complete && <section className="route-complete-banner"><CheckCircle size={28} weight="fill" /><div><strong>Route task complete · waiting happens in the Workbench</strong><span>CCO Case {caseData.id} · Status <b>WAITING_DEALER_EVIDENCE</b> · Idempotency key verified</span></div></section>}
      <div className="screen-actions completion-actions"><span>Next event: <b>DealerSubmissionCompleted</b></span><button className="primary-button wide button-with-icon" disabled={!complete} onClick={onWorkbench}><ArrowLeft size={18} />Return to Workbench</button></div>
    </section>
  );
}

function DealerEvidenceScreen({ submission, onOpenMock, onContinue, onWorkbench }: { submission: DealerSubmission | null; onOpenMock: () => void; onContinue: () => void; onWorkbench: () => void }) {
  return (
    <section className="screen-panel dealer-wait-screen">
      <div className="screen-heading"><div><p className="section-kicker">RETURN COMPLAINT PROCESS AGENT</p><h2>{submission ? "Dealer Submission Received" : "Waiting for Dealer Evidence"}</h2></div><span className={submission ? "success-pill" : "waiting-pill"}>{submission ? <><CheckCircle size={16} weight="fill" />Event received</> : <><Hourglass size={16} />Asynchronous wait</>}</span></div>
      <section className="cco-case-created"><div className="cco-icon"><SquaresFour size={28} /></div><div><span>CCO CASE CREATED</span><h3>{caseData.id}</h3><p>Created once from Call ID CALL-2026-0088 · Status <b>{submission ? "DEALER_SUBMISSION_RECEIVED" : "WAITING_DEALER_EVIDENCE"}</b></p></div><strong>Idempotency key verified</strong></section>
      {!submission ? <>
        <section className="async-boundary"><div className="async-visual"><div><Robot size={42} weight="duotone" /><span>Process Agent</span></div><i /><div><Buildings size={42} weight="duotone" /><span>Dealer in CCO</span></div></div><div><span>PROCESS PAUSED AT EXTERNAL EVENT</span><h3>The Review Plan cannot start yet</h3><p>The dealer must contact the customer and submit evidence in CCO. The Process Agent resumes only after receiving <code>DealerSubmissionCompleted</code>.</p></div></section>
        <section className="evidence-checklist"><header><ListChecks size={21} /><div><span>DEALER EVIDENCE REQUEST</span><h3>4 required evidence groups</h3></div></header>{["Customer communication summary", "Repair orders and diagnosis records", "TSARA / technical evidence", "Parts orders and arrival timeline"].map((item) => <div key={item}><span /><strong>{item}</strong><small>Waiting</small></div>)}</section>
      </> : <section className="dealer-receipt"><header><CheckCircle size={24} weight="fill" /><div><span>DEALER SUBMISSION COMPLETED</span><h3>External event accepted and matched to {caseData.id}</h3></div></header><div><span>Submitted</span><strong>{submission.submittedAt}</strong></div><div><span>Evidence files</span><strong>{submission.evidenceCount} items · hashes recorded</strong></div><div><span>Customer communication</span><strong>{submission.contactSummary}</strong></div></section>}
      <div className="screen-actions split-actions"><button className="secondary-button wide button-with-icon" onClick={submission ? onWorkbench : onOpenMock}>{submission ? <ArrowLeft size={18} /> : <Buildings size={18} />}{submission ? "Back to Workbench" : "Open Dealer CCO Mock"}</button><button className="primary-button wide button-with-icon" onClick={onContinue} disabled={!submission}>Generate Review Plan<ArrowRight size={18} /></button></div>
    </section>
  );
}

function DealerMockModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (submission: DealerSubmission) => void }) {
  const [summary, setSummary] = useState("Customer confirms recurring power loss and requests a vehicle return. Dealer explained that eligibility requires BMW review.");
  const [files, setFiles] = useState([true, true, true, true]);
  const labels = ["3 repair orders", "TSARA result TS-2026-117", "Parts order timeline", "Customer contact record"];
  const ready = summary.trim().length >= 20 && files.every(Boolean);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal dealer-mock" role="dialog" aria-modal="true" aria-labelledby="dealer-mock-title">
        <div className="mock-banner"><Buildings size={21} /><span>DEMO MOCK · EXTERNAL CCO DEALER VIEW</span></div>
        <h2 id="dealer-mock-title">Complete Dealer Evidence</h2>
        <p className="modal-intro">This simulates the dealer completing the real CCO task. Closing this window does not advance the process.</p>
        <label><span>Customer communication summary</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <fieldset><legend>Evidence manifest</legend>{labels.map((label, index) => <label key={label}><input type="checkbox" checked={files[index]} onChange={() => setFiles((current) => current.map((value, fileIndex) => fileIndex === index ? !value : value))} /><span><Paperclip size={17} />{label}</span><small>{files[index] ? "Ready to submit" : "Required"}</small></label>)}</fieldset>
        <div className="event-preview"><code>DealerSubmissionCompleted</code><span>Emitted only after this form is submitted</span></div>
        <div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Cancel</button><button className="primary-button wide button-with-icon" disabled={!ready} onClick={() => onSubmit({ contactSummary: summary, submittedAt: "23 Aug 2026 · 14:42", evidenceCount: files.filter(Boolean).length })}><CheckCircle size={18} />Submit evidence to CCO</button></div>
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

function IntakeScreen({ source, setSource, playing, setPlaying, onNext }: { source: ComplaintSource; setSource: (value: ComplaintSource) => void; playing: boolean; setPlaying: (value: boolean) => void; onNext: () => void }) {
  const [activeLine, setActiveLine] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [correctedLines, setCorrectedLines] = useState<Set<string>>(new Set());
  const [complete, setComplete] = useState(false);
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string>("current");
  const [historyPlayingId, setHistoryPlayingId] = useState<string | null>(null);
  const [historyProgress, setHistoryProgress] = useState(0);
  const conversation: ConversationLine[] = intakeDemo.conversation;
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
      setPlaying(false);
    }, 425);
    return () => window.clearTimeout(timer);
  }, [activeLine, conversation.length, correctedLines, currentLine, currentRawText, playing, setPlaying, source, visibleCharacters]);

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
    if (complete) {
      setActiveLine(0);
      setVisibleCharacters(0);
      setCorrectedLines(new Set());
      setComplete(false);
    }
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
      <section className="auto-created-case"><Sparkle size={19} weight="fill" /><div><span>AI-GENERATED COMPLAINT CASE</span><strong>Created automatically from inbound call intent</strong><p>Intent detected: complaint · potential vehicle-return request. Open the current recording to review the live transcript and AI extraction.</p></div><b>Case {caseData.id}</b></section>
      <div className="source-tabs" role="tablist">
        <button role="tab" aria-selected={source === "call"} className={source === "call" ? "active" : ""} onClick={() => setSource("call")}><PhoneCall size={18} aria-hidden="true" />Call Recording</button>
        <button role="tab" aria-selected={source === "scan"} className={source === "scan" ? "active" : ""} onClick={() => setSource("scan")}><Scan size={18} aria-hidden="true" />Scanned Complaint</button>
      </div>
      {source === "call" && <section className="call-sequence" aria-label="Related customer call history"><header><div><span>RELATED CONTACT HISTORY</span><h3>4 linked call records</h3></div><small>Chronological order</small></header><div className="call-sequence-track">{historicalCalls.map((call) => <button key={call.id} className={selectedCallId === call.id ? "active" : ""} onClick={() => selectCall(call.id)}><span>{call.sequence}</span><div><small>{call.date}</small><strong>Call record {call.sequence}</strong><em>{call.duration}</em></div></button>)}<button className={`current ${selectedCallId === "current" ? "active" : ""}`} onClick={() => selectCall("current")}><span>4</span><div><small>12 May 2026</small><strong>Call record 4</strong><em>{caseData.complaint.callDuration} · Current</em></div></button></div></section>}
      {source === "call" && selectedCallId === "current" ? (
        <div className="intake-workspace">
          <div className="call-stage">
            <div className="audio-console">
              <div className={`recording-icon ${playing ? "live" : ""}`} aria-hidden="true"><Microphone size={22} /></div>
              <button className="audio-button" aria-label={playing ? "Pause call analysis" : "Play and analyze call"} onClick={toggleAnalysis}>{playing ? <Pause size={21} weight="fill" /> : <Play size={21} weight="fill" />}</button>
              <div className="audio-track">
                <div className="audio-meta"><strong>Customer Call</strong><span>{complete ? caseData.complaint.callDuration : hasStarted ? currentLine.time : "00:00"}</span></div>
                <div className={`wave-bars ${playing ? "playing" : ""}`} aria-hidden="true">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 11) % 25)}px` }} />)}</div>
                <div className="audio-progress"><span style={{ width: `${Math.max(4, progress)}%` }} /></div>
              </div>
              <button className="analyze-button" onClick={toggleAnalysis}>{playing ? "Pause" : complete ? "Replay analysis" : "Play & analyze"}</button>
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

function AgentEvidence({ evidence }: { evidence: EvidenceBlock }) {
  return (
    <section className="inline-evidence">
      <div className="inline-evidence-heading"><div><p>EVIDENCE</p><h4>{evidence.title}</h4></div><span><CheckCircle size={15} weight="fill" />Done</span></div>
      <p className="evidence-explanation">{evidence.summary}</p>
      {evidence.kind === "records" && <div className="evidence-records">{evidence.rows.map((row) => <div className={row.highlight ? "highlight" : ""} key={row.record}><span>{row.date}</span><strong>{row.record}</strong><p>{row.finding}</p>{row.highlight && <b>Eligibility evidence</b>}</div>)}</div>}
      {evidence.kind === "diagnosis" && <div className="diagnosis-document">{evidence.documents.map((document) => <article key={document.title}><header><FileText size={18} /><strong>{document.title}</strong><span>{document.date}</span></header>{document.statements.map((statement) => <p className={statement.highlight ? "highlight" : ""} key={statement.text}>{statement.highlight && <CheckCircle size={16} weight="fill" />}{statement.text}</p>)}</article>)}</div>}
      {evidence.kind === "cases" && <div className="case-matches">{evidence.cases.map((item) => <article key={item.id}><div className="case-match-title"><strong>{item.id}</strong><span className={item.score >= 85 ? "high" : "medium"}>{item.score}% match</span></div><div className="match-dimensions"><span>{item.issue}</span><span>{item.request}</span><span className={item.score < 75 ? "difference" : ""}>{item.repairs}</span></div><p><b>Outcome:</b> {item.outcome}</p><small>{item.differences}</small></article>)}</div>}
      {evidence.kind === "parts" && <div className="evidence-records parts-records">{evidence.rows.map((row) => <div className={row.highlight ? "highlight" : ""} key={row.order}><span>{row.date}</span><strong>{row.part}</strong><p>{row.order} · {row.result}</p>{row.highlight && <b>Over 30 days</b>}</div>)}</div>}
      {evidence.kind === "ocr" && <div className="ocr-fields">{evidence.fields.map((field) => <div className={field.highlight ? "highlight" : ""} key={field.label}><span>{field.label}</span><strong>{field.value}</strong><small>{field.confidence} confidence</small></div>)}</div>}
    </section>
  );
}

function ReviewScreen({ state, accessGranted, agents, setAgents, onAccess, onRunComplete, onReplan, onNext }: { state: ReviewState; accessGranted: boolean; agents: ReviewAgent[]; setAgents: React.Dispatch<React.SetStateAction<ReviewAgent[]>>; onAccess: () => void; onRunComplete: () => void; onReplan: () => void; onNext: () => void }) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(["warranty"]));
  const [evidenceAgentId, setEvidenceAgentId] = useState<string | null>(null);
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

  const toggleEvidence = (id: string) => setEvidenceAgentId((current) => current === id ? null : id);

  const updateAgent = (id: string, changes: Partial<ReviewAgent>) => setAgents((current) => current.map((agent) => agent.id === id ? { ...agent, ...changes } : agent));

  const addAgent = (agent: ReviewAgent) => {
    const sequence = agents.filter((item) => item.id.startsWith(`${agent.id}-`)).length + 1;
    const newAgent = { ...agent, id: `${agent.id}-${sequence}`, name: agent.category === "parts" ? `New Data Agent ${sequence}` : `OCR Agent ${sequence}` };
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
    setEvidenceAgentId((current) => current === id ? null : current);
  };

  const replanAgents = () => {
    setRunCursor(0);
    setRunPhase("request");
    setEvidenceAgentId(null);
    onReplan();
  };

  const activeAgent = agents[runCursor];
  const runMessage = runCursor >= agents.length ? "All results are back. The Process Agent is preparing the report." : runPhase === "request" ? `Sending a task to ${activeAgent?.name}…` : runPhase === "working" ? `${activeAgent?.name} is checking its source…` : `${activeAgent?.name} is sending the result to the Process Agent…`;

  return (
    <section className="screen-panel review-plan-screen">
      <div className="screen-heading"><div><p className="section-kicker">{reviewProcessAgentName.toUpperCase()} <RoleBadge>Process Agent</RoleBadge></p><h2>{state === "results" ? "Review Results" : state === "running" ? "Running Review" : "Review Plan"}</h2></div>{accessGranted ? <span className="success-pill">Access allowed</span> : <span className="ai-plan-badge"><MagicWand size={16} />AI-made plan</span>}</div>

      {state === "plan" && <section className="plan-rationale">
        <div className="rationale-icon"><MagicWand size={22} /></div>
        <div><span>AI SUGGESTION</span><h3>{reviewPlanContext.recommendation}</h3><button onClick={() => setContextOpen(!contextOpen)}><Eye size={16} />{contextOpen ? "Hide sources" : "Open sources"}</button></div>
        {contextOpen && <div className="plan-context-evidence">{reviewPlanContext.evidence.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>From complaint intake</small></div>)}</div>}
      </section>}

      {(state === "running" || state === "results") && (
        <section className={`agent-network ${state}`} aria-label={`${reviewProcessAgentName} orchestration`}>
          <header className="network-heading"><div><span>AGENTS AT WORK</span><h3>{state === "running" ? "The Process Agent is running the review" : "All results are ready"}</h3><p>{state === "running" ? "The Process Agent sends each task and waits for the result." : "Open any Agent to see its result and source records."}</p></div><span className={state === "running" ? "network-live" : "network-complete"}>{state === "running" ? <><span />Working</> : <><CheckCircle size={16} weight="fill" />Done</>}</span></header>
          <div className="network-canvas">
            <div className="planner-robot">
              <div className="robot-avatar planner" aria-hidden="true"><Robot size={72} weight="duotone" /><span><FlowArrow size={20} weight="bold" /></span></div>
              <strong>{reviewProcessAgentName}</strong><em>Process Agent</em><small>Return complaint review orchestration</small>
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
                    {state === "results" && <button onClick={() => toggleEvidence(agent.id)} aria-expanded={evidenceAgentId === agent.id}><Eye size={16} />{evidenceAgentId === agent.id ? "Hide Evidence" : "View Evidence"}</button>}
                  </div>
                </div>;
              })}
            </div>
          </div>
          <p className="network-status" role="status" aria-atomic="true"><span className={state === "running" ? "spinner" : "map-check"}>{state === "results" && <Check size={12} weight="bold" />}</span>{state === "results" ? "The Process Agent has received and organized all selected Agent results." : runMessage}</p>
          {state === "results" && evidenceAgentId && <div className="network-evidence"><AgentEvidence evidence={agents.find((agent) => agent.id === evidenceAgentId)!.evidence} /></div>}
        </section>
      )}

      {state === "plan" && <div className="action-plan-heading"><div><p>REVIEW PLAN</p><h3>{agents.length} review steps</h3><span>Open a step to check or edit its task.</span></div><button className="secondary-button button-with-icon" onClick={() => setAddOpen(!addOpen)}><Plus size={17} />Add Agent</button></div>}

      {state === "plan" && addOpen && <section className="add-agent-panel"><div><strong>Add an Agent type</strong><span>Add it to the plan, then define its business name and task.</span></div>{optionalReviewAgents.map((agent) => <button key={agent.id} onClick={() => addAgent(agent)}><span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span><strong>{agent.category === "parts" ? "Data Agent" : "OCR Agent"}<small>{agent.category === "parts" ? "Define an additional review query" : "Read and validate complaint documents"}</small></strong><Plus size={18} /></button>)}</section>}

      {state === "plan" && <div className="review-agent-list">
        {agents.map((agent, index) => {
          const expanded = expandedAgents.has(agent.id);
          return (
            <article className="review-agent-card" key={agent.id}>
              <div className="agent-card-top"><button className="agent-card-header" onClick={() => toggleExpanded(agent.id)} aria-expanded={expanded}>
                <span className="step-number">{index + 1}</span>
                <span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span>
                <span className="agent-card-title"><strong>{agent.name} <small>{agent.system}</small></strong><span>{agent.purpose}</span></span>
                <RoleBadge>{agent.role}</RoleBadge>
                {agent.addedBy && <span className="human-added">Added by human</span>}
                <span className="card-status">Ready</span>
                <CaretDown className={expanded ? "expanded" : ""} size={18} />
              </button>{agent.addedBy && state === "plan" && <button className="remove-agent-button" aria-label={`Remove ${agent.name} from plan`} onClick={() => removeAgent(agent.id)}><Trash size={17} /><span>Remove</span></button>}</div>
              {expanded && <div className="agent-card-body"><label><span><PencilSimple size={15} />Agent name <b>Editable</b></span><input aria-label={`${agent.name} name`} value={agent.name} onChange={(event) => updateAgent(agent.id, { name: event.target.value })} /></label><label><span><PencilSimple size={15} />Agent task <b>AI draft · editable</b></span><textarea value={agent.requirement} onChange={(event) => updateAgent(agent.id, { requirement: event.target.value })} /></label></div>}
            </article>
          );
        })}
      </div>}

      <div className="screen-actions split-actions"><span className="review-action-note">{state === "plan" ? "You can edit the plan before allowing access." : state === "running" ? runMessage : `${agents.length} of ${agents.length} Agent tasks are done.`}</span>{state === "plan" && <button className="primary-button wide button-with-icon" onClick={onAccess}><LockKeyOpen size={18} />Check Access &amp; Run</button>}{state === "results" && <div className="result-actions"><button className="secondary-button wide button-with-icon" onClick={replanAgents}><ArrowLeft size={18} />Edit Plan</button><button className="primary-button wide button-with-icon" onClick={onNext}>Create Report<ArrowRight size={18} /></button></div>}</div>
    </section>
  );
}

function RecommendationScreen({ agents, instruction, setInstruction, onEvidence, onBack, onConfirm }: { agents: ReviewAgent[]; instruction: string; setInstruction: (value: string) => void; onEvidence: (agentId: string) => void; onBack: () => void; onConfirm: () => void }) {
  const [reviewed, setReviewed] = useState(false);
  return (
    <section className="screen-panel recommendation-screen">
      <div className="screen-heading"><div><p className="section-kicker">CUSTOMER CARE (BBS-A-7) <RoleBadge>Planner</RoleBadge></p><h2>Recommendation &amp; Decision</h2></div><span className="ai-plan-badge"><MagicWand size={16} />Report from {agents.length} Agent results</span></div>
      <article className="case-report">
        <header className="report-header">
          <div><span>CASE HANDLING REPORT</span><h3>{caseData.id}</h3><p>Prepared by A7 Planner · 18 Aug 2026</p></div>
          <div className="report-status"><CheckCircle size={20} weight="fill" /><span>Ready for decision</span></div>
        </header>

        <section className="report-section report-suggestion" aria-label="AI suggestion">
          <div className="report-section-number">01</div>
          <div><span>AI SUGGESTION</span><div className="ai-decision-boundary"><WarningCircle size={15} />Likely assessment only · human decision required</div><h3>{settlementRecommendation.title}</h3><p>{settlementRecommendation.summary}</p></div>
        </section>

        <section className="report-section report-key-evidence" aria-label="Key evidence">
          <div className="report-section-number">02</div>
          <div className="report-section-body">
            <span>KEY EVIDENCE</span>
            <h3>Why the AI made this suggestion</h3>
            <div className="report-findings">
              {settlementRecommendation.conclusions.map((conclusion) => {
                const agent = agents.find((item) => item.id === conclusion.agentId) ?? recommendedReviewAgents.find((item) => item.id === conclusion.agentId)!;
                return <article key={conclusion.id}><span className={`agent-symbol ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} /></span><div><small>{conclusion.label}</small><strong>{conclusion.value}</strong><p>{conclusion.rationale}</p></div><button onClick={() => onEvidence(agent.id)}><Eye size={16} />Open source</button></article>;
              })}
            </div>
          </div>
        </section>

        <section className="report-agent-results">
          <div><span>FULL RESULTS</span><h3>Open results by Agent</h3><p>Use this when you need every source record from the review.</p></div>
          <div>{agents.map((agent) => <button key={agent.id} onClick={() => onEvidence(agent.id)}><span className={`agent-symbol ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} /></span><span><strong>{agent.name}</strong><small>{agent.system} · {agent.role}</small></span><CaretRight size={17} /></button>)}</div>
        </section>

        <section className="report-section report-decision">
          <div className="report-section-number">03</div>
          <div className="report-section-body"><span>HUMAN DECISION</span><h3>Write the final decision</h3><p>You can use the AI draft or change it for this case.</p><label htmlFor="decision-instruction"><span>Decision <b>AI draft · editable</b></span><textarea id="decision-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label><label className="decision-review-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>I reviewed the policy conditions, source evidence and internal allocation separately.</span></label></div>
        </section>
      </article>
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
    { title: "Return the CCO record", detail: "CCO returns approval ID CCO-2026-0088." },
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
      <div className="screen-heading"><div><p className="section-kicker">EXECUTION</p><h2>{completed ? "Case Completed" : "Completing the Case"}</h2></div><span className={completed ? "success-pill" : "network-live"}>{completed ? <><CheckCircle size={16} weight="fill" />Done</> : <><span />Working</>}</span></div>
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

      <div className="execution-detail-grid">
        <section className="execution-package"><header><span>FILES SENT TO CCO</span><h3>Case package</h3></header>{[
          { label: "Final decision", icon: FileText },
          { label: "Agent evidence", icon: Paperclip },
          { label: "Case history", icon: FolderOpen },
        ].map((item, index) => { const Icon = item.icon; const done = phase > index; return <div key={item.label} className={done ? "done" : phase === index ? "active" : ""}><Icon size={20} /><span>{item.label}</span><b>{done ? "Uploaded" : phase === index ? "Uploading" : "Ready"}</b></div>; })}</section>
        <section className="cco-actions"><header><span>CCO ACTIONS</span><h3>Approval steps</h3></header>{["Open case", "Upload files", "Enter final decision", "Approve case"].map((action, index) => <div className={phase > index ? "done" : phase === index ? "active" : ""} key={action}><span>{phase > index ? <Check size={14} weight="bold" /> : index + 1}</span><strong>{action}</strong><small>{phase > index ? "Done" : phase === index ? "In progress" : "Waiting"}</small></div>)}</section>
      </div>

      <section className="execution-instruction"><span>FINAL DECISION</span><p>{instruction}</p></section>
      {completed && <section className="execution-complete"><CheckCircle size={28} weight="fill" /><div><strong>CCO approval complete</strong><span>Approval ID: CCO-2026-0088 · Case {caseData.id} is closed</span></div></section>}
      <div className="screen-actions completion-actions"><span>Status: <b>{completed ? "Completed" : "In progress"}</b></span><button className="primary-button wide button-with-icon" disabled={!completed} onClick={onWorkbench}><ArrowLeft size={18} aria-hidden="true" />Back to Workbench</button></div>
    </section>
  );
}

function AccessModal({ agents, onCancel, onAllow }: { agents: ReviewAgent[]; onCancel: () => void; onAllow: () => void }) {
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="access-title"><h2 id="access-title"><LockKeyOpen size={24} aria-hidden="true" />Check Agent Access</h2><p className="modal-intro">A7 will send these case tasks.</p><div className="access-sources dynamic">{agents.map((agent) => <div key={agent.id}><span className={`source-icon ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} size={20} /></span><strong>{agent.name} {agent.system !== "Enterprise Knowledge" ? `(${agent.system})` : ""}</strong><RoleBadge>{agent.role}</RoleBadge><span>{agent.purpose}</span></div>)}</div><div className="access-scope"><span><Target size={18} aria-hidden="true" />{caseData.access.scope}</span><span><Eye size={18} aria-hidden="true" />{caseData.access.mode}</span><span><Clock size={18} aria-hidden="true" />{caseData.access.duration}</span></div><p>Access ends when this review is done.</p><div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Back to Plan</button><button className="primary-button wide button-with-icon" onClick={onAllow}><LockKeyOpen size={18} aria-hidden="true" />Allow &amp; Run</button></div></section>
    </div>
  );
}

function RecommendationEvidenceDrawer({ agent, returnLabel, onClose }: { agent: ReviewAgent; returnLabel: string; onClose: () => void }) {
  const conclusion = settlementRecommendation.conclusions.find((item) => item.agentId === agent.id);
  return (
    <div className="overlay drawer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="drawer recommendation-evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-heading"><div><p className="section-kicker">EVIDENCE</p><h2 id="drawer-title"><ReviewAgentIcon category={agent.category} size={25} />{agent.evidence.title}</h2><span>{agent.name} · {agent.system} · {agent.role}</span></div><button className="close-button" aria-label="Close evidence" onClick={onClose}><X size={22} /></button></div>
        {conclusion && <section className="decision-linkage"><span>SUPPORTS</span><div><strong>{conclusion.label}</strong><b>{conclusion.value}</b></div><p>{conclusion.rationale}</p></section>}
        <section className="evidence-query-detail"><div><span>TASK</span><p>{agent.requirement}</p></div><div><span>RESULT</span><p>{agent.resultSummary}</p></div><div><span>WHY IT MATTERS</span><p>{agent.decisionImpact}</p></div></section>
        <AgentEvidence evidence={agent.evidence} />
        <section className="evidence-audit"><div><span>Source system</span><strong>{agent.system}</strong></div><div><span>Case scope</span><strong>{caseData.id} · VIN {caseData.vin}</strong></div><div><span>Retrieved</span><strong>18 Aug 2026 · 14:32</strong></div><div><span>Access</span><strong>Read only · Case specific</strong></div></section>
        <div className="drawer-footer"><button className="primary-button wide button-with-icon" onClick={onClose}><ArrowLeft size={18} />{returnLabel}</button></div>
      </section>
    </div>
  );
}

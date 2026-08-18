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
  Microphone,
  Paperclip,
  Pause,
  Play,
  PhoneCall,
  Scan,
  ShieldCheck,
  SquaresFour,
  Target,
  UploadSimple,
  User,
  WarningCircle,
  Wrench,
  X,
  Clock,
} from "@phosphor-icons/react";
import workbenchData from "@/data/workbench.json";
import caseData from "@/data/demo-case.json";

type ReviewState = "plan" | "running" | "results";
type Drawer = "records" | "cases" | null;
type ComplaintSource = "call" | "scan";

const steps = ["Intake", "Review", "Recommendation", "Confirmation", "Execution"];

function RoleBadge({ children }: { children: React.ReactNode }) {
  return <span className="role-badge">{children}</span>;
}

function CompletionActionIcon({ index }: { index: number }) {
  const Icon = [CheckSquare, UploadSimple, Paperclip, ChatText][index] ?? CheckCircle;
  return <span className="completion-icon" aria-hidden="true"><Icon size={17} weight="regular" /></span>;
}

function StatusMark({ complete, active }: { complete?: boolean; active?: boolean }) {
  return <span className={`status-mark ${complete ? "complete" : ""} ${active ? "active" : ""}`} aria-hidden="true">{complete ? <Check size={18} weight="bold" /> : active ? <span className="active-dot" /> : null}</span>;
}

export default function ProcessApp() {
  const [view, setView] = useState<"workbench" | "case">("workbench");
  const [stage, setStage] = useState(1);
  const [reviewState, setReviewState] = useState<ReviewState>("plan");
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [source, setSource] = useState<ComplaintSource>("call");
  const [playing, setPlaying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);

  useEffect(() => {
    if (reviewState !== "running") return;
    const timer = window.setTimeout(() => setReviewState("results"), 1500);
    return () => window.clearTimeout(timer);
  }, [reviewState]);

  const openCase = () => {
    setView("case");
    setStage(1);
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
    if (!confirmed) return;
    setCaseCompleted(true);
    setStage(5);
  };

  const timeline = useMemo(() => {
    const events = [
      { label: "Complaint received", done: stage > 1 || caseCompleted },
      { label: "Review plan prepared", done: stage > 2 || reviewState !== "plan" },
      { label: "Case access allowed", done: accessGranted },
      { label: "Agent review completed", done: reviewState === "results" || stage > 2 },
      { label: "Recommendation prepared", done: stage > 3 },
      { label: "Case completed", done: caseCompleted },
    ];
    const firstPending = events.findIndex((event) => !event.done);
    return events.map((event, index) => ({ ...event, active: firstPending === index }));
  }, [accessGranted, caseCompleted, reviewState, stage]);

  if (view === "workbench") return <Workbench onOpen={openCase} completed={caseCompleted} />;

  return (
    <main className="app-shell">
      <ProductHeader onHome={backToWorkbench} showProcess />
      <StageStepper stage={stage} onSelect={(next) => next <= stage && setStage(next)} />
      <section className="case-layout">
        <div className="case-main">
          <CaseIdentity />
          {stage === 1 && (
            <IntakeScreen source={source} setSource={setSource} playing={playing} setPlaying={setPlaying} onNext={() => setStage(2)} />
          )}
          {stage === 2 && (
            <ReviewScreen
              state={reviewState}
              accessGranted={accessGranted}
              onAccess={() => setAccessOpen(true)}
              onRecords={() => setDrawer("records")}
              onCases={() => setDrawer("cases")}
              onNext={() => setStage(3)}
            />
          )}
          {stage === 3 && <RecommendationScreen onRecords={() => setDrawer("records")} onCases={() => setDrawer("cases")} onNext={() => setStage(4)} />}
          {stage === 4 && <ConfirmationScreen confirmed={confirmed} setConfirmed={setConfirmed} onBack={() => setStage(3)} onConfirm={completeCase} />}
          {stage === 5 && <CompletionScreen onWorkbench={backToWorkbench} />}
        </div>
        <ExecutionPanel timeline={timeline} />
      </section>
      {accessOpen && <AccessModal onCancel={() => setAccessOpen(false)} onAllow={allowAccess} />}
      {drawer && <EvidenceDrawer type={drawer} onClose={() => setDrawer(null)} />}
    </main>
  );
}

function ProductHeader({ onHome, showProcess = false }: { onHome?: () => void; showProcess?: boolean }) {
  return (
    <header className="topbar">
      <button className="brand-button" onClick={onHome}>My Process Management Center</button>
      {showProcess && <><span className="breadcrumb-separator">›</span><span className="breadcrumb">Customer Complaints &amp; Quality Handling</span></>}
      <div className="topbar-spacer" />
      <button className="icon-button" aria-label="Notifications"><Bell size={24} weight="regular" /></button>
      <div className="profile" aria-label="Current user">CW</div>
    </header>
  );
}

function Workbench({ onOpen, completed }: { onOpen: () => void; completed: boolean }) {
  return (
    <main className="app-shell">
      <ProductHeader />
      <div className="workspace">
        <aside className="sidebar" aria-label="Primary navigation">
          <button className="nav-item active"><SquaresFour size={20} aria-hidden="true" />Workbench</button>
          <button className="nav-item"><FlowArrow size={20} aria-hidden="true" />Processes</button>
          <button className="nav-item"><CheckSquare size={20} aria-hidden="true" />Tasks</button>
        </aside>
        <section className="content workbench-content">
          <div className="page-heading">
            <div><h1>My Workbench</h1><p>Business processes requiring your attention</p></div>
          </div>
          <div className="workbench-grid">
            <div>
              <div className="metrics" aria-label="Work summary">
                {workbenchData.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.label === "Completed Today" && completed ? metric.value + 1 : metric.value}</strong></article>)}
              </div>
              <section className="panel pending-panel">
                <div className="panel-heading"><div><h2>My Pending Work</h2><p>Prioritized by due date and business impact</p></div><span className="count-badge">7 items</span></div>
                <div className="work-table" role="table" aria-label="Pending work">
                  <div className="work-row table-header" role="row"><span>Process</span><span>Case</span><span>Request</span><span>Priority</span><span>Status</span><span>Action</span></div>
                  {workbenchData.workItems.map((item) => {
                    const isDemo = item.caseId === caseData.id;
                    return (
                      <div className={`work-row ${isDemo ? "featured" : ""}`} role="row" key={item.caseId}>
                        <strong>{item.process}</strong><span>{item.caseId}</span><span>{item.request}</span>
                        <span><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span></span>
                        <span>{isDemo && completed ? "Completed" : item.status}</span>
                        <span><button className={isDemo ? "primary-button" : "text-button"} onClick={isDemo ? onOpen : undefined}>{isDemo && completed ? "View" : "Open"}</button></span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            <aside className="panel process-panel">
              <div className="panel-heading"><h2>Business Processes</h2></div>
              {workbenchData.processes.map((process) => <button className="process-link" key={process.name}><span>{process.name}<small>{process.pending} pending</small></span><CaretRight size={20} aria-hidden="true" /></button>)}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function StageStepper({ stage, onSelect }: { stage: number; onSelect: (stage: number) => void }) {
  return (
    <nav className="stepper" aria-label="Case progress">
      {steps.map((label, index) => {
        const number = index + 1;
        return <button key={label} className={`step ${stage === number ? "active" : ""} ${stage > number ? "done" : ""}`} onClick={() => onSelect(number)} disabled={number > stage}><span>{stage > number ? <Check size={17} weight="bold" aria-hidden="true" /> : number}</span>{label}</button>;
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

function IntakeScreen({ source, setSource, playing, setPlaying, onNext }: { source: ComplaintSource; setSource: (value: ComplaintSource) => void; playing: boolean; setPlaying: (value: boolean) => void; onNext: () => void }) {
  return (
    <section className="screen-panel">
      <div className="screen-heading"><div><p className="section-kicker">ORIGINAL COMPLAINT</p><h2>Complaint Intake</h2></div><span className="priority high">High</span></div>
      <div className="source-tabs" role="tablist">
        <button role="tab" aria-selected={source === "call"} className={source === "call" ? "active" : ""} onClick={() => setSource("call")}><PhoneCall size={18} aria-hidden="true" />Call Recording</button>
        <button role="tab" aria-selected={source === "scan"} className={source === "scan" ? "active" : ""} onClick={() => setSource("scan")}><Scan size={18} aria-hidden="true" />Scanned Complaint</button>
      </div>
      {source === "call" ? (
        <div className="complaint-card">
          <div className="audio-row"><div className="recording-icon" aria-hidden="true"><Microphone size={23} /></div><button className="audio-button" aria-label={playing ? "Pause call recording" : "Play call recording"} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}</button><div><strong>Customer Call · {caseData.complaint.callDuration}</strong><div className={`waveform ${playing ? "playing" : ""}`} aria-hidden="true">▂▅▃▆▂▇▃▅▂▆▃▇▂▅▃▆▂</div></div></div>
          <div className="transcript"><span>Transcript excerpt</span><p>{caseData.complaint.transcript}</p></div>
        </div>
      ) : (
        <div className="complaint-card scan-card"><div className="scan-preview"><FileText size={34} aria-hidden="true" /><span>SCANNED</span><strong>{caseData.complaint.scanReference}</strong></div><div><span className="field-label">Source</span><h3>{caseData.complaint.scanSource}</h3><p>{caseData.complaint.scanSummary}</p></div></div>
      )}
      <h3 className="subheading">Extracted Information</h3>
      <div className="extracted-grid">
        <article className="extracted-item issue"><div className="extracted-icon"><WarningCircle size={25} weight="regular" aria-hidden="true" /></div><div><span>Issue</span><strong>{caseData.issue}</strong></div></article>
        <article className="extracted-item request"><div className="extracted-icon"><ClipboardText size={25} weight="regular" aria-hidden="true" /></div><div><span>Request</span><strong>{caseData.request}</strong></div></article>
        <article className="extracted-item priority-item"><div className="extracted-icon"><Flag size={25} weight="regular" aria-hidden="true" /></div><div><span>Priority</span><strong>{caseData.priority}</strong></div></article>
      </div>
      <div className="screen-actions"><button className="primary-button wide button-with-icon" onClick={onNext}>Start Review<ArrowRight size={18} aria-hidden="true" /></button></div>
    </section>
  );
}

function ReviewScreen({ state, accessGranted, onAccess, onRecords, onCases, onNext }: { state: ReviewState; accessGranted: boolean; onAccess: () => void; onRecords: () => void; onCases: () => void; onNext: () => void }) {
  return (
    <section className="screen-panel">
      <div className="screen-heading"><div><p className="section-kicker">CUSTOMER CARE (BBS-A-7) <RoleBadge>Planner</RoleBadge></p><h2>{state === "results" ? "Coordinated Case Review" : "Review Plan"}</h2></div>{accessGranted && <span className="success-pill">Access allowed</span>}</div>
      <div className="objective"><span className="objective-icon"><Target size={25} aria-hidden="true" /></span><div><strong>Objective</strong><p>{caseData.objective}</p></div></div>
      <div className="agent-list">
        {caseData.agents.slice(1).map((agent, index) => (
          <article className="agent-row" key={agent.name}>
            <div className={`agent-symbol ${agent.role === "Knowledge Agent" ? "knowledge" : index === 0 ? "warranty" : "technical"}`} aria-hidden="true">{agent.role === "Knowledge Agent" ? <Books size={25} /> : index === 0 ? <ShieldCheck size={25} /> : <Wrench size={25} />}</div>
            <div className="agent-name"><strong>{agent.name}{agent.system !== "Enterprise Knowledge" ? ` (${agent.system})` : ""}</strong><RoleBadge>{agent.role}</RoleBadge><small>{agent.task}</small></div>
            {state === "results" ? <div className="finding-list">{agent.findings.map((finding) => <span key={finding}><CheckCircle size={17} weight="regular" aria-hidden="true" />{finding}</span>)}</div> : <div className={`agent-status ${state}`}><span />{state === "running" ? "Working" : "Waiting"}</div>}
          </article>
        ))}
      </div>
      {state === "running" && <div className="working-note"><span className="spinner" />Agents are retrieving evidence and comparing previous cases…</div>}
      <div className="screen-actions split-actions">
        <div>{state === "results" && <><button className="link-button button-with-icon" onClick={onRecords}><Database size={18} aria-hidden="true" />View Records</button><button className="link-button button-with-icon" onClick={onCases}><Books size={18} aria-hidden="true" />View Previous Cases</button></>}</div>
        {state === "plan" && <button className="primary-button wide button-with-icon" onClick={onAccess}><LockKeyOpen size={18} aria-hidden="true" />Request Case Access</button>}
        {state === "results" && <button className="primary-button wide button-with-icon" onClick={onNext}>Prepare Recommendation<ArrowRight size={18} aria-hidden="true" /></button>}
      </div>
    </section>
  );
}

function RecommendationScreen({ onRecords, onCases, onNext }: { onRecords: () => void; onCases: () => void; onNext: () => void }) {
  return (
    <section className="screen-panel recommendation-screen">
      <div className="screen-heading"><div><p className="section-kicker">RECOMMENDATION</p><h2>Recommended Resolution</h2></div></div>
      <div className="recommendation-card"><span className="large-check"><Check size={42} weight="bold" aria-hidden="true" /></span><div><h3>{caseData.recommendation.title}</h3>{caseData.recommendation.reasons.map((reason) => <p key={reason}><span><Check size={13} weight="bold" aria-hidden="true" /></span>{reason}</p>)}</div></div>
      <div className="prepared-by"><User size={19} aria-hidden="true" /><span>Prepared by Customer Care (BBS-A-7)</span><RoleBadge>Planner</RoleBadge></div>
      <div className="evidence-links"><button onClick={onRecords}><Database size={24} aria-hidden="true" /><strong>Data Agent evidence</strong><span>Warranty and technical records <CaretRight size={14} aria-hidden="true" /></span></button><button onClick={onCases}><Books size={24} aria-hidden="true" /><strong>Knowledge Agent guidance</strong><span>3 comparable cases <CaretRight size={14} aria-hidden="true" /></span></button></div>
      <div className="next-step"><strong>Next step</strong><p>Human confirmation is required before the case is completed.</p></div>
      <div className="screen-actions"><button className="primary-button wide button-with-icon" onClick={onNext}>Continue to Confirmation<ArrowRight size={18} aria-hidden="true" /></button></div>
    </section>
  );
}

function ConfirmationScreen({ confirmed, setConfirmed, onBack, onConfirm }: { confirmed: boolean; setConfirmed: (value: boolean) => void; onBack: () => void; onConfirm: () => void }) {
  return (
    <section className="screen-panel">
      <div className="screen-heading"><div><p className="section-kicker">HUMAN DECISION</p><h2>Confirm Vehicle Return</h2></div></div>
      <div className="summary-table"><div><strong><ClipboardText size={19} aria-hidden="true" />Customer request</strong><span>{caseData.request}</span></div><div><strong><CheckCircle size={19} aria-hidden="true" />Recommendation</strong><span>{caseData.recommendation.title}</span></div><div><strong><ShieldCheck size={19} aria-hidden="true" />Warranty</strong><span>Return criteria matched</span></div><div><strong><Wrench size={19} aria-hidden="true" />Technical Service</strong><span>Recurring fault confirmed</span></div></div>
      <label className="review-checkbox"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I have reviewed the supporting records.</span></label>
      <div className="post-actions"><h3>Actions after confirmation</h3><p><UploadSimple size={20} aria-hidden="true" />Upload warranty evidence</p><p><Paperclip size={20} aria-hidden="true" />Attach technical findings</p><p><ChatText size={20} aria-hidden="true" />Prepare customer response draft</p></div>
      <div className="screen-actions"><button className="secondary-button wide button-with-icon" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Back</button><button className="primary-button wide button-with-icon" disabled={!confirmed} onClick={onConfirm}><CheckCircle size={18} aria-hidden="true" />Confirm &amp; Complete Case</button></div>
    </section>
  );
}

function CompletionScreen({ onWorkbench }: { onWorkbench: () => void }) {
  return (
    <section className="screen-panel completion-screen">
      <div className="screen-heading"><div><p className="section-kicker">EXECUTION</p><h2>Case Completed</h2></div></div>
      <div className="success-banner"><span><Check size={20} weight="bold" aria-hidden="true" /></span><strong>Success</strong><p>The vehicle return recommendation has been confirmed.</p></div>
      <h3 className="subheading">Actions completed</h3>
      <div className="completed-actions">{caseData.completionActions.map((action, index) => <p key={action}><CompletionActionIcon index={index} />{action}</p>)}</div>
      <div className="case-record"><span>Case record</span><strong><FolderOpen size={19} aria-hidden="true" />Customer Care Case</strong><b>{caseData.id}</b></div>
      <div className="screen-actions completion-actions"><span>Status: <b>Completed</b></span><button className="primary-button wide button-with-icon" onClick={onWorkbench}><ArrowLeft size={18} aria-hidden="true" />Back to Workbench</button></div>
    </section>
  );
}

function ExecutionPanel({ timeline }: { timeline: { label: string; done: boolean; active: boolean }[] }) {
  return (
    <aside className="execution-panel"><h2>Customer Complaint &amp; Quality Handling Execution</h2><div className="timeline">{timeline.map((event) => <div className={`timeline-event ${event.done ? "done" : ""} ${event.active ? "active" : ""}`} key={event.label}><StatusMark complete={event.done} active={event.active} /><span>{event.label}</span></div>)}</div></aside>
  );
}

function AccessModal({ onCancel, onAllow }: { onCancel: () => void; onAllow: () => void }) {
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="access-title"><h2 id="access-title"><LockKeyOpen size={24} aria-hidden="true" />Case Access Required</h2><div className="access-sources">{caseData.access.sources.map((source, index) => <div key={source.name}><span className={`source-icon ${index === 0 ? "warranty" : "technical"}`} aria-hidden="true">{index === 0 ? <ShieldCheck size={22} /> : <Wrench size={22} />}</span><strong>{source.name}</strong><RoleBadge>Data Agent</RoleBadge><span>{source.detail}</span></div>)}</div><div className="access-scope"><span><Target size={18} aria-hidden="true" />{caseData.access.scope}</span><span><Eye size={18} aria-hidden="true" />{caseData.access.mode}</span><span><Clock size={18} aria-hidden="true" />{caseData.access.duration}</span></div><p>Customer Care needs access to complete the case review.</p><div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Cancel</button><button className="primary-button wide button-with-icon" onClick={onAllow}><LockKeyOpen size={18} aria-hidden="true" />Allow Case Access</button></div></section>
    </div>
  );
}

function EvidenceDrawer({ type, onClose }: { type: Exclude<Drawer, null>; onClose: () => void }) {
  return (
    <div className="overlay drawer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-heading"><div><p className="section-kicker">ORIGINAL EVIDENCE</p><h2 id="drawer-title">{type === "records" ? <><Database size={25} aria-hidden="true" />Supporting Records</> : <><Books size={25} aria-hidden="true" />Previous Case Guidance</>}</h2></div><button className="close-button" aria-label="Close evidence" onClick={onClose}><X size={22} aria-hidden="true" /></button></div>
        {type === "records" ? <RecordsTable /> : <CasesTable />}
        <div className="drawer-footer"><button className="primary-button wide button-with-icon" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" />Back to Review</button></div>
      </section>
    </div>
  );
}

function RecordsTable() {
  return <><div className="evidence-summary"><RoleBadge>Data Agent Results</RoleBadge><span><Barcode size={18} aria-hidden="true" />VIN {caseData.vin}</span><span><Eye size={18} aria-hidden="true" />Read only</span></div><div className="data-table"><div className="data-row data-head"><span>Date</span><span>Record</span><span>Finding</span><span>Source</span></div>{caseData.records.map((record) => <div className="data-row" key={record.record}><span>{record.date}</span><strong><FileText size={18} aria-hidden="true" />{record.record}</strong><span>{record.finding}</span><span>{record.source}</span></div>)}</div></>;
}

function CasesTable() {
  return <><div className="evidence-summary"><RoleBadge>Knowledge Agent</RoleBadge><span><Books size={18} aria-hidden="true" />3 comparable cases</span><span><Target size={18} aria-hidden="true" />Relevance: High</span></div><div className="data-table cases-table"><div className="data-row data-head"><span>Case</span><span>Issue</span><span>Handling</span><span>Outcome</span></div>{caseData.previousCases.map((record) => <div className="data-row" key={record.caseId}><strong><FolderOpen size={18} aria-hidden="true" />{record.caseId}</strong><span>{record.issue}</span><span>{record.handling}</span><span className="completed-text"><CheckCircle size={18} aria-hidden="true" />{record.outcome}</span></div>)}</div><aside className="guidance-box"><strong><Books size={20} aria-hidden="true" />Handling Guidance</strong><p>Use the Three Guarantees vehicle-return route when configured criteria are met.</p><p>Attach warranty and technical findings to the Customer Care case.</p></aside></>;
}

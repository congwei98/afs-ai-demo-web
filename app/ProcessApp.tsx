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
} from "@phosphor-icons/react";
import workbenchData from "@/data/workbench.json";
import caseData from "@/data/demo-case.json";
import { intakeDemo, type ConversationLine } from "@/data/intake-demo";
import { optionalReviewAgents, recommendedReviewAgents, reviewPlanContext, settlementRecommendation, type EvidenceBlock, type ReviewAgent } from "@/data/review-plan";

type ReviewState = "plan" | "running" | "results";
type ComplaintSource = "call" | "scan";
type CaseDecision = "allocation" | "not-covered";

const steps = ["Intake", "Review", "Recommendation", "Decision", "Execution"];

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
  const [recommendationEvidence, setRecommendationEvidence] = useState<string | null>(null);
  const [source, setSource] = useState<ComplaintSource>("call");
  const [playing, setPlaying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [caseCompleted, setCaseCompleted] = useState(false);
  const [caseDecision, setCaseDecision] = useState<CaseDecision>("allocation");
  const [bmwShare, setBmwShare] = useState(settlementRecommendation.bmwShare);
  const [dealerShare, setDealerShare] = useState(settlementRecommendation.dealerShare);
  const [plannedAgents, setPlannedAgents] = useState<ReviewAgent[]>(() => recommendedReviewAgents.map((agent) => ({ ...agent })));

  const openCase = () => {
    setView("case");
    setStage(1);
    setReviewState("plan");
    setAccessGranted(false);
    setPlannedAgents(recommendedReviewAgents.map((agent) => ({ ...agent })));
    setConfirmed(false);
    setCaseCompleted(false);
    setCaseDecision("allocation");
    setBmwShare(settlementRecommendation.bmwShare);
    setDealerShare(settlementRecommendation.dealerShare);
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
              agents={plannedAgents}
              setAgents={setPlannedAgents}
              onAccess={() => setAccessOpen(true)}
              onRunComplete={() => setReviewState("results")}
              onNext={() => setStage(3)}
            />
          )}
          {stage === 3 && <RecommendationScreen agents={plannedAgents} onEvidence={setRecommendationEvidence} onNext={() => setStage(4)} />}
          {stage === 4 && <ConfirmationScreen decision={caseDecision} setDecision={setCaseDecision} bmwShare={bmwShare} setBmwShare={setBmwShare} dealerShare={dealerShare} setDealerShare={setDealerShare} confirmed={confirmed} setConfirmed={setConfirmed} onBack={() => setStage(3)} onConfirm={completeCase} />}
          {stage === 5 && <CompletionScreen decision={caseDecision} bmwShare={bmwShare} dealerShare={dealerShare} onWorkbench={backToWorkbench} />}
        </div>
        <ExecutionPanel timeline={timeline} />
      </section>
      {accessOpen && <AccessModal agents={plannedAgents} onCancel={() => setAccessOpen(false)} onAllow={allowAccess} />}
      {recommendationEvidence && <RecommendationEvidenceDrawer agent={plannedAgents.find((agent) => agent.id === recommendationEvidence) ?? recommendedReviewAgents.find((agent) => agent.id === recommendationEvidence)!} onClose={() => setRecommendationEvidence(null)} />}
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
  const [activeLine, setActiveLine] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [correctedLines, setCorrectedLines] = useState<Set<string>>(new Set());
  const [complete, setComplete] = useState(false);
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);
  const conversation = intakeDemo.conversation;
  const currentLine = conversation[activeLine];
  const currentRawText = currentLine ? rawLineText(currentLine) : "";
  const totalCharacters = conversation.reduce((total, line) => total + rawLineText(line).length, 0);
  const priorCharacters = conversation.slice(0, activeLine).reduce((total, line) => total + rawLineText(line).length, 0);
  const progress = complete ? 100 : Math.min(99, ((priorCharacters + visibleCharacters) / totalCharacters) * 100);
  const hasStarted = activeLine > 0 || visibleCharacters > 0 || complete;
  const revealedCount = complete ? conversation.length : hasStarted ? activeLine + 1 : 0;
  const issueDetected = complete || activeLine > 1 || (activeLine === 1 && visibleCharacters >= 20);
  const repairDetected = complete || activeLine > 1 || (activeLine === 1 && correctedLines.has("issue"));
  const emotionDetected = complete || activeLine > 3 || (activeLine === 3 && visibleCharacters >= 22);
  const requestDetected = complete || activeLine > 5 || (activeLine === 5 && visibleCharacters >= 28);
  const signalCount = [issueDetected, repairDetected, emotionDetected, requestDetected].filter(Boolean).length;

  useEffect(() => {
    if (!playing || source !== "call") return;
    if (visibleCharacters < currentRawText.length) {
      const previousCharacter = currentRawText.charAt(Math.max(0, visibleCharacters - 1));
      const delay = /[,.?!—]/.test(previousCharacter) ? 260 : 62;
      const timer = window.setTimeout(() => setVisibleCharacters((count) => count + 1), delay);
      return () => window.clearTimeout(timer);
    }

    const hasCorrection = currentLine.parts.some((part) => part.correction);
    if (hasCorrection && !correctedLines.has(currentLine.id)) {
      const timer = window.setTimeout(() => setCorrectedLines((lines) => new Set(lines).add(currentLine.id)), 1150);
      return () => window.clearTimeout(timer);
    }

    if (activeLine < conversation.length - 1) {
      const timer = window.setTimeout(() => {
        setActiveLine((line) => line + 1);
        setVisibleCharacters(0);
      }, 720);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setComplete(true);
      setPlaying(false);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [activeLine, conversation.length, correctedLines, currentLine, currentRawText, playing, setPlaying, source, visibleCharacters]);

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

  return (
    <section className="screen-panel intake-screen">
      <div className="screen-heading"><div><p className="section-kicker">ORIGINAL COMPLAINT</p><h2>Complaint Intake</h2></div><span className={`ai-intake-status ${playing ? "working" : complete ? "complete" : ""}`} role="status" aria-atomic="true"><MagicWand size={17} aria-hidden="true" />{playing ? "AI is listening" : complete ? "Call analyzed" : "Ready to analyze"}</span></div>
      <div className="source-tabs" role="tablist">
        <button role="tab" aria-selected={source === "call"} className={source === "call" ? "active" : ""} onClick={() => setSource("call")}><PhoneCall size={18} aria-hidden="true" />Call Recording</button>
        <button role="tab" aria-selected={source === "scan"} className={source === "scan" ? "active" : ""} onClick={() => setSource("scan")}><Scan size={18} aria-hidden="true" />Scanned Complaint</button>
      </div>
      {source === "call" ? (
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
              <div className="transcript-heading"><div><Waveform size={19} aria-hidden="true" /><strong>Live transcript</strong></div><div className="semantic-legend"><span className="quality-dot">Quality issue</span><span className="request-dot">Request</span><span className="emotion-dot">Emotion</span></div></div>
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

          <aside className="ai-extraction" aria-label="AI extracted information">
            <div className="extraction-heading"><span><MagicWand size={18} />AI understanding</span><small>{complete ? "4 fields confirmed" : `${signalCount} signals found`}</small></div>
            <div className={`signal-card quality ${issueDetected ? "revealed" : ""}`}><WarningCircle size={21} /><div><span>Quality issue</span><strong>{issueDetected ? "Recurring loss of power" : "Listening…"}</strong></div></div>
            <div className={`signal-card context ${repairDetected ? "revealed" : ""}`}><Wrench size={21} /><div><span>Repair history</span><strong>{repairDetected ? "3 visits · issue recurring" : "Listening…"}</strong></div></div>
            <div className={`signal-card emotion ${emotionDetected ? "revealed" : ""}`}><ChatText size={21} /><div><span>Customer sentiment</span><strong>{emotionDetected ? "Frustrated · safety concern" : "Listening…"}</strong></div></div>
            <div className={`signal-card request ${requestDetected ? "revealed" : ""}`}><ClipboardText size={21} /><div><span>Requested resolution</span><strong>{requestDetected ? "Vehicle return" : "Listening…"}</strong></div></div>
            {playing && <div className="ai-working"><span /><p><strong>AI is organizing the conversation</strong>Speaker separation, correction and intent detection</p></div>}
          </aside>

          {complete && (
            <section className="call-summary">
              <div className="summary-title"><span><CheckCircle size={22} weight="fill" /></span><div><p>AI-GENERATED CALL SUMMARY</p><h3>Complaint ready for review</h3></div><small>Generated from 03:42 recording</small></div>
              <div className="consolidated-statement"><MagicWand size={19} /><p><strong>Customer statement, organized by AI</strong>{intakeDemo.consolidatedStatement}</p></div>
              <div className="summary-grid">
                {intakeDemo.summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><button onClick={() => showEvidence(item.evidenceId)}><Eye size={15} />Evidence · {item.evidenceTime}</button></div>)}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="complaint-card scan-card"><div className="scan-preview"><FileText size={34} aria-hidden="true" /><span>SCANNED</span><strong>{caseData.complaint.scanReference}</strong></div><div><span className="field-label">Source</span><h3>{caseData.complaint.scanSource}</h3><p>{caseData.complaint.scanSummary}</p></div></div>
      )}
      {source === "scan" && <><h3 className="subheading">Extracted Information</h3><div className="extracted-grid"><article className="extracted-item issue"><div className="extracted-icon"><WarningCircle size={25} aria-hidden="true" /></div><div><span>Issue</span><strong>{caseData.issue}</strong></div></article><article className="extracted-item request"><div className="extracted-icon"><ClipboardText size={25} aria-hidden="true" /></div><div><span>Request</span><strong>{caseData.request}</strong></div></article><article className="extracted-item priority-item"><div className="extracted-icon"><Flag size={25} aria-hidden="true" /></div><div><span>Priority</span><strong>{caseData.priority}</strong></div></article></div></>}
      <div className="screen-actions"><span className="intake-action-hint">{source === "call" && !complete ? "Analyze the recording to continue" : "Complaint information is ready"}</span><button className="primary-button wide button-with-icon" onClick={onNext} disabled={source === "call" && !complete}>Start Review<ArrowRight size={18} aria-hidden="true" /></button></div>
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
      <div className="inline-evidence-heading"><div><p>AGENT EVIDENCE</p><h4>{evidence.title}</h4></div><span><CheckCircle size={15} weight="fill" />Query completed</span></div>
      <p className="evidence-explanation">{evidence.summary}</p>
      {evidence.kind === "records" && <div className="evidence-records">{evidence.rows.map((row) => <div className={row.highlight ? "highlight" : ""} key={row.record}><span>{row.date}</span><strong>{row.record}</strong><p>{row.finding}</p>{row.highlight && <b>Eligibility evidence</b>}</div>)}</div>}
      {evidence.kind === "diagnosis" && <div className="diagnosis-document">{evidence.documents.map((document) => <article key={document.title}><header><FileText size={18} /><strong>{document.title}</strong><span>{document.date}</span></header>{document.statements.map((statement) => <p className={statement.highlight ? "highlight" : ""} key={statement.text}>{statement.highlight && <CheckCircle size={16} weight="fill" />}{statement.text}</p>)}</article>)}</div>}
      {evidence.kind === "cases" && <div className="case-matches">{evidence.cases.map((item) => <article key={item.id}><div className="case-match-title"><strong>{item.id}</strong><span className={item.score >= 85 ? "high" : "medium"}>{item.score}% match</span></div><div className="match-dimensions"><span>{item.issue}</span><span>{item.request}</span><span className={item.score < 75 ? "difference" : ""}>{item.repairs}</span></div><p><b>Outcome:</b> {item.outcome}</p><small>{item.differences}</small></article>)}</div>}
      {evidence.kind === "parts" && <div className="evidence-records parts-records">{evidence.rows.map((row) => <div className={row.highlight ? "highlight" : ""} key={row.order}><span>{row.date}</span><strong>{row.part}</strong><p>{row.order} · {row.result}</p>{row.highlight && <b>Over 30 days</b>}</div>)}</div>}
      {evidence.kind === "ocr" && <div className="ocr-fields">{evidence.fields.map((field) => <div className={field.highlight ? "highlight" : ""} key={field.label}><span>{field.label}</span><strong>{field.value}</strong><small>{field.confidence} confidence</small></div>)}</div>}
    </section>
  );
}

function ReviewScreen({ state, accessGranted, agents, setAgents, onAccess, onRunComplete, onNext }: { state: ReviewState; accessGranted: boolean; agents: ReviewAgent[]; setAgents: React.Dispatch<React.SetStateAction<ReviewAgent[]>>; onAccess: () => void; onRunComplete: () => void; onNext: () => void }) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(["warranty"]));
  const [evidenceAgents, setEvidenceAgents] = useState<Set<string>>(new Set());
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

  const toggleEvidence = (id: string) => setEvidenceAgents((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const updateRequirement = (id: string, requirement: string) => setAgents((current) => current.map((agent) => agent.id === id ? { ...agent, requirement } : agent));

  const addAgent = (agent: ReviewAgent) => {
    setAgents((current) => current.some((item) => item.id === agent.id) ? current : [...current, { ...agent }]);
    setExpandedAgents((current) => new Set(current).add(agent.id));
    setAddOpen(false);
  };

  const removeAgent = (id: string) => {
    setAgents((current) => current.filter((agent) => agent.id !== id));
    setExpandedAgents((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setEvidenceAgents((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const activeAgent = agents[runCursor];
  const runMessage = runCursor >= agents.length ? "All evidence received. Customer Care is consolidating the findings." : runPhase === "request" ? `Sending the review request to ${activeAgent?.name}…` : runPhase === "working" ? `${activeAgent?.name} is querying its business source…` : `${activeAgent?.name} is returning evidence to Customer Care…`;

  return (
    <section className="screen-panel review-plan-screen">
      <div className="screen-heading"><div><p className="section-kicker">CUSTOMER CARE (BBS-A-7) <RoleBadge>Planner</RoleBadge></p><h2>{state === "results" ? "Agent Review Results" : state === "running" ? "Executing Review Plan" : "Review Plan"}</h2></div>{accessGranted ? <span className="success-pill">Access allowed</span> : <span className="ai-plan-badge"><MagicWand size={16} />AI-generated plan</span>}</div>

      <section className="plan-rationale">
        <div className="rationale-icon"><MagicWand size={22} /></div>
        <div><span>AI RECOMMENDATION</span><h3>{reviewPlanContext.recommendation}</h3><button onClick={() => setContextOpen(!contextOpen)}><Eye size={16} />{contextOpen ? "Hide complaint evidence" : "View referenced evidence"}</button></div>
        {contextOpen && <div className="plan-context-evidence">{reviewPlanContext.evidence.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>From complaint intake</small></div>)}</div>}
      </section>

      {(state === "running" || state === "results") && (
        <section className={`orchestration-map ${state}`} aria-label="Customer Care agent orchestration">
          <div className="planner-node"><span><FlowArrow size={22} /></span><div><strong>Customer Care</strong><em>Planner Agent</em><small>BBS-A-7</small></div></div>
          <div className={`request-lane ${state === "running" ? runPhase : "complete"}`}><span className="request-packet"><PaperPlaneTilt size={17} /></span><b>{state === "results" ? "Evidence consolidated" : runPhase === "return" ? "Evidence response" : "Business request"}</b></div>
          <div className="orchestrated-agents">{agents.map((agent, index) => <div className={`${index < runCursor || state === "results" ? "done" : ""} ${index === runCursor && state === "running" ? "active" : ""}`} key={agent.id}><span><ReviewAgentIcon category={agent.category} size={18} /></span><div><strong>{agent.name}</strong><em>{agent.role}</em><small>{index < runCursor || state === "results" ? "Evidence returned" : index === runCursor && state === "running" ? runPhase === "working" ? "Querying source" : runPhase === "return" ? "Returning result" : "Request received" : "Waiting"}</small></div></div>)}</div>
          <p role="status" aria-atomic="true"><span className={state === "running" ? "spinner" : "map-check"}>{state === "results" && <Check size={12} weight="bold" />}</span>{state === "results" ? "All selected agents returned evidence to Customer Care." : runMessage}</p>
        </section>
      )}

      <div className="action-plan-heading"><div><p>RECOMMENDED ACTION PLAN</p><h3>{agents.length} review steps</h3><span>{state === "plan" ? "Open any step to review or edit the AI-generated requirement." : state === "running" ? "Requests run sequentially so each result remains attributable." : "Open Evidence on each step to inspect its source and decision relevance."}</span></div>{state === "plan" && <button className="secondary-button button-with-icon" onClick={() => setAddOpen(!addOpen)}><Plus size={17} />Add Agent</button>}</div>

      {addOpen && <section className="add-agent-panel"><div><strong>Add another review step</strong><span>Human-added Agents join the same authorization and execution flow.</span></div>{optionalReviewAgents.map((agent) => <button key={agent.id} disabled={agents.some((item) => item.id === agent.id)} onClick={() => addAgent(agent)}><span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span><strong>{agent.name}<small>{agent.system} · {agent.role}</small></strong><Plus size={18} /></button>)}</section>}

      <div className="review-agent-list">
        {agents.map((agent, index) => {
          const expanded = expandedAgents.has(agent.id);
          const evidenceOpen = evidenceAgents.has(agent.id);
          const completed = state === "results" || (state === "running" && index < runCursor);
          const active = state === "running" && index === runCursor;
          return (
            <article className={`review-agent-card ${active ? "active" : ""} ${completed ? "completed" : ""}`} key={agent.id}>
              <div className="agent-card-top"><button className="agent-card-header" onClick={() => toggleExpanded(agent.id)} aria-expanded={expanded}>
                <span className="step-number">{completed ? <Check size={16} weight="bold" /> : index + 1}</span>
                <span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span>
                <span className="agent-card-title"><strong>{agent.name} <small>{agent.system}</small></strong><span>{agent.purpose}</span></span>
                <RoleBadge>{agent.role}</RoleBadge>
                {agent.addedBy && <span className="human-added">Added by human</span>}
                <span className={`card-status ${active ? "active" : completed ? "done" : ""}`}>{active ? runPhase === "working" ? "Querying" : runPhase === "return" ? "Returning" : "Requested" : completed ? "Completed" : "Ready"}</span>
                <CaretDown className={expanded ? "expanded" : ""} size={18} />
              </button>{agent.addedBy && state === "plan" && <button className="remove-agent-button" aria-label={`Remove ${agent.name} from plan`} onClick={() => removeAgent(agent.id)}><Trash size={17} /><span>Remove</span></button>}</div>
              {expanded && <div className="agent-card-body"><label><span><PencilSimple size={15} />Instructions for this Agent <b>AI generated · editable</b></span><textarea value={agent.requirement} disabled={state !== "plan"} onChange={(event) => updateRequirement(agent.id, event.target.value)} /></label>{state === "results" && <div className="agent-result"><CheckCircle size={19} weight="fill" /><p><span>Result</span><strong>{agent.resultSummary}</strong></p><button onClick={() => toggleEvidence(agent.id)}><Eye size={16} />{evidenceOpen ? "Hide Evidence" : "View Evidence"}</button></div>}{evidenceOpen && <AgentEvidence evidence={agent.evidence} />}</div>}
            </article>
          );
        })}
      </div>

      <div className="screen-actions split-actions"><span className="review-action-note">{state === "plan" ? "You can edit the plan before granting access." : state === "running" ? runMessage : `${agents.length} of ${agents.length} Agent requests completed.`}</span>{state === "plan" && <button className="primary-button wide button-with-icon" onClick={onAccess}><LockKeyOpen size={18} />Review Access &amp; Run Plan</button>}{state === "results" && <button className="primary-button wide button-with-icon" onClick={onNext}>Prepare Recommendation<ArrowRight size={18} /></button>}</div>
    </section>
  );
}

function RecommendationScreen({ agents, onEvidence, onNext }: { agents: ReviewAgent[]; onEvidence: (agentId: string) => void; onNext: () => void }) {
  return (
    <section className="screen-panel recommendation-screen">
      <div className="screen-heading"><div><p className="section-kicker">CUSTOMER CARE RECOMMENDATION</p><h2>Compensation Recommendation</h2></div><span className="ai-plan-badge"><MagicWand size={16} />Based on 3 Agent results</span></div>
      <section className="settlement-overview">
        <div className="coverage-result"><span>THREE GUARANTEES ASSESSMENT</span><strong><CheckCircle size={20} weight="fill" />Applicable</strong></div>
        <div className="allocation-result"><span>RECOMMENDED COMMERCIAL COMPENSATION</span><div><strong>BMW <b>{settlementRecommendation.bmwShare}%</b></strong><strong>Dealer <b>{settlementRecommendation.dealerShare}%</b></strong></div><div className="allocation-bar" aria-label={`BMW ${settlementRecommendation.bmwShare} percent, Dealer ${settlementRecommendation.dealerShare} percent`}><span style={{ width: `${settlementRecommendation.bmwShare}%` }} /><i style={{ width: `${settlementRecommendation.dealerShare}%` }} /></div><small>Commercial cost sharing · not technical fault attribution</small></div>
        <p>{settlementRecommendation.summary}</p>
      </section>
      <div className="recommendation-conclusions">
        {settlementRecommendation.conclusions.map((conclusion) => {
          const agent = agents.find((item) => item.id === conclusion.agentId) ?? recommendedReviewAgents.find((item) => item.id === conclusion.agentId)!;
          return <article key={conclusion.id}><span className={`agent-symbol ${agent.category}`}><ReviewAgentIcon category={agent.category} /></span><div><small>{conclusion.label}</small><strong>{conclusion.value}</strong><p>{conclusion.rationale}</p></div><button onClick={() => onEvidence(agent.id)}><Eye size={16} /><span>View Agent Evidence</span><small>{agent.name} · {agent.system}</small><CaretRight size={16} /></button></article>;
        })}
      </div>
      <div className="prepared-by"><User size={19} aria-hidden="true" /><span>Prepared by Customer Care (BBS-A-7)</span><RoleBadge>Planner</RoleBadge></div>
      <div className="next-step"><strong>Human decision required</strong><p>Confirm or adjust the compensation shares, or determine that the case is not covered and notify the dealer.</p></div>
      <div className="screen-actions"><button className="primary-button wide button-with-icon" onClick={onNext}>Review Human Decision<ArrowRight size={18} aria-hidden="true" /></button></div>
    </section>
  );
}

function ConfirmationScreen({ decision, setDecision, bmwShare, setBmwShare, dealerShare, setDealerShare, confirmed, setConfirmed, onBack, onConfirm }: { decision: CaseDecision; setDecision: (decision: CaseDecision) => void; bmwShare: number; setBmwShare: (value: number) => void; dealerShare: number; setDealerShare: (value: number) => void; confirmed: boolean; setConfirmed: (value: boolean) => void; onBack: () => void; onConfirm: () => void }) {
  const allocationValid = bmwShare >= 0 && dealerShare >= 0 && bmwShare + dealerShare === 100;
  const chooseDecision = (next: CaseDecision) => {
    setDecision(next);
    setConfirmed(false);
  };
  return (
    <section className="screen-panel decision-screen">
      <div className="screen-heading"><div><p className="section-kicker">HUMAN DECISION</p><h2>Confirm Case Outcome</h2></div></div>
      <div className="decision-options" role="radiogroup" aria-label="Case outcome">
        <label className={decision === "allocation" ? "selected" : ""}><input type="radio" name="case-decision" checked={decision === "allocation"} onChange={() => chooseDecision("allocation")} /><span><CheckCircle size={21} /><strong>Three Guarantees applies</strong><small>Confirm or adjust the BMW/dealer compensation allocation.</small></span><b>AI recommended</b></label>
        <label className={decision === "not-covered" ? "selected not-covered" : ""}><input type="radio" name="case-decision" checked={decision === "not-covered"} onChange={() => chooseDecision("not-covered")} /><span><WarningCircle size={21} /><strong>Not covered by Three Guarantees</strong><small>Close this case and notify the dealer of the decision.</small></span></label>
      </div>
      {decision === "allocation" ? <section className="allocation-editor"><div className="editor-heading"><div><span>COMPENSATION ALLOCATION</span><h3>Set the final commercial shares</h3></div><small>Must total 100%</small></div><div className="share-inputs"><label><span>BMW share</span><div><input aria-label="BMW compensation share" type="number" min="0" max="100" value={bmwShare} onChange={(event) => setBmwShare(Number(event.target.value))} /><b>%</b></div></label><span>+</span><label><span>Dealer share</span><div><input aria-label="Dealer compensation share" type="number" min="0" max="100" value={dealerShare} onChange={(event) => setDealerShare(Number(event.target.value))} /><b>%</b></div></label><strong className={allocationValid ? "valid" : "invalid"}>{bmwShare + dealerShare}%</strong></div><div className="allocation-bar large"><span style={{ width: `${Math.max(0, Math.min(100, bmwShare))}%` }} /><i style={{ width: `${Math.max(0, Math.min(100, dealerShare))}%` }} /></div><p><ShieldCheck size={17} />Three Guarantees: Applicable <span>·</span> TSARA: Product-related fault <span>·</span> Dealer-induced damage: Not found</p></section> : <section className="not-covered-form"><WarningCircle size={24} /><div><h3>Close as not covered</h3><p>This path records a non-coverage decision and prepares a notification for the dealer.</p><label>Decision reason<textarea defaultValue="The available evidence does not meet the Three Guarantees eligibility criteria." /></label></div></section>}
      <label className="review-checkbox"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{decision === "allocation" ? "I have reviewed the Agent evidence and confirm this compensation allocation." : "I confirm that this case should be closed as not covered and the dealer should be notified."}</span></label>
      <div className="post-actions"><h3>Actions after confirmation</h3>{decision === "allocation" ? <><p><CheckSquare size={20} />Record Three Guarantees applicability</p><p><Paperclip size={20} />Attach Agent evidence to the allocation decision</p><p><ChatText size={20} />Prepare BMW/dealer settlement instruction</p></> : <><p><CheckSquare size={20} />Close the Customer Care case as not covered</p><p><ChatText size={20} />Send the decision notice to the dealer</p><p><FileText size={20} />Prepare customer response draft</p></>}</div>
      <div className="screen-actions"><button className="secondary-button wide button-with-icon" onClick={onBack}><ArrowLeft size={18} />Back</button><button className="primary-button wide button-with-icon" disabled={!confirmed || (decision === "allocation" && !allocationValid)} onClick={onConfirm}><CheckCircle size={18} />{decision === "allocation" ? "Confirm Allocation & Close" : "Close Case & Notify Dealer"}</button></div>
    </section>
  );
}

function CompletionScreen({ decision, bmwShare, dealerShare, onWorkbench }: { decision: CaseDecision; bmwShare: number; dealerShare: number; onWorkbench: () => void }) {
  const actions = decision === "allocation" ? ["Three Guarantees applicability recorded", `Compensation allocation confirmed: BMW ${bmwShare}% / Dealer ${dealerShare}%`, "Agent evidence attached to the decision", "BMW/dealer settlement instruction prepared"] : ["Case closed as not covered by Three Guarantees", "Non-coverage reason recorded", "Dealer decision notice prepared", "Customer response draft prepared"];
  return (
    <section className="screen-panel completion-screen">
      <div className="screen-heading"><div><p className="section-kicker">EXECUTION</p><h2>Case Completed</h2></div></div>
      <div className="success-banner"><span><Check size={20} weight="bold" /></span><strong>Success</strong><p>{decision === "allocation" ? `Three Guarantees confirmed with BMW ${bmwShare}% / Dealer ${dealerShare}% compensation allocation.` : "Case closed as not covered; the dealer notification is ready."}</p></div>
      <h3 className="subheading">Actions completed</h3>
      <div className="completed-actions">{actions.map((action, index) => <p key={action}><CompletionActionIcon index={index} />{action}</p>)}</div>
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

function AccessModal({ agents, onCancel, onAllow }: { agents: ReviewAgent[]; onCancel: () => void; onAllow: () => void }) {
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="access-title"><h2 id="access-title"><LockKeyOpen size={24} aria-hidden="true" />Review Selected Agent Access</h2><p className="modal-intro">Customer Care will send the following case-specific requests.</p><div className="access-sources dynamic">{agents.map((agent) => <div key={agent.id}><span className={`source-icon ${agent.category}`} aria-hidden="true"><ReviewAgentIcon category={agent.category} size={20} /></span><strong>{agent.name} {agent.system !== "Enterprise Knowledge" ? `(${agent.system})` : ""}</strong><RoleBadge>{agent.role}</RoleBadge><span>{agent.purpose}</span></div>)}</div><div className="access-scope"><span><Target size={18} aria-hidden="true" />{caseData.access.scope}</span><span><Eye size={18} aria-hidden="true" />{caseData.access.mode}</span><span><Clock size={18} aria-hidden="true" />{caseData.access.duration}</span></div><p>Access expires automatically after this review plan completes.</p><div className="modal-actions"><button className="secondary-button wide" onClick={onCancel}>Back to Plan</button><button className="primary-button wide button-with-icon" onClick={onAllow}><LockKeyOpen size={18} aria-hidden="true" />Allow &amp; Run Plan</button></div></section>
    </div>
  );
}

function RecommendationEvidenceDrawer({ agent, onClose }: { agent: ReviewAgent; onClose: () => void }) {
  const conclusion = settlementRecommendation.conclusions.find((item) => item.agentId === agent.id);
  return (
    <div className="overlay drawer-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="drawer recommendation-evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-heading"><div><p className="section-kicker">RECOMMENDATION EVIDENCE</p><h2 id="drawer-title"><ReviewAgentIcon category={agent.category} size={25} />{agent.evidence.title}</h2><span>{agent.name} · {agent.system} · {agent.role}</span></div><button className="close-button" aria-label="Close recommendation evidence" onClick={onClose}><X size={22} /></button></div>
        {conclusion && <section className="decision-linkage"><span>CONCLUSION SUPPORTED</span><div><strong>{conclusion.label}</strong><b>{conclusion.value}</b></div><p>{conclusion.rationale}</p></section>}
        <section className="evidence-query-detail"><div><span>REQUEST SENT TO AGENT</span><p>{agent.requirement}</p></div><div><span>AGENT RESULT</span><p>{agent.resultSummary}</p></div><div><span>IMPACT ON DECISION</span><p>{agent.decisionImpact}</p></div></section>
        <AgentEvidence evidence={agent.evidence} />
        <section className="evidence-audit"><div><span>Source system</span><strong>{agent.system}</strong></div><div><span>Case scope</span><strong>{caseData.id} · VIN {caseData.vin}</strong></div><div><span>Retrieved</span><strong>18 Aug 2026 · 14:32</strong></div><div><span>Access</span><strong>Read only · Case specific</strong></div></section>
        <div className="drawer-footer"><button className="primary-button wide button-with-icon" onClick={onClose}><ArrowLeft size={18} />Back to Recommendation</button></div>
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { LanguageProvider, LanguageToggle, useLanguage } from "./i18n";
import { layoutOrchestration, nodeExecution } from "./orchestration.mjs";
import { getAgentCalls, getCallStatus, visibleAgentNodes } from "./agentCalls.mjs";
import {
  ArrowRight,
  Bell,
  CaretDown,
  CaretRight,
  Check,
  Clock,
  CornersOut,
  Database,
  FileText,
  FlowArrow,
  Paperclip,
  PaperPlaneTilt,
  Pause,
  Play,
  Plus,
  Robot,
  Sparkle,
  SpeakerHigh,
  UserCircle,
  WarningCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";

type Phase = "intake" | "retention" | "claim";
type Stage =
  | "classifying"
  | "ready_create"
  | "ready_retention"
  | "waiting_plan_confirmation"
  | "ready_investigation"
  | "running_investigation"
  | "waiting_investigation_approvals"
  | "ready_solution"
  | "waiting_customer"
  | "waiting_repair"
  | "ready_claim"
  | "ready_approval"
  | "waiting_supplement"
  | "complete"
  | "blocked";
type AgentStatus = "waiting" | "running" | "done";
type TaskView = "main" | "complaint-investigation" | "repair-query" | "repair-history" | "technical" | "mobility" | "warranty" | "legal" | "parts";
type ApprovalTaskView = Exclude<TaskView, "main" | "complaint-investigation" | "repair-query">;
type AgentKind = "agent" | "system" | "source";
type MessageRole = "assistant" | "user" | "system";
type MessageCard = { label: string; value: string; meta?: string };
type MessageNote = { label: string; text: string; tone?: "evidence" | "decision" | "next" };
type PlanRow = { purpose: string; action: string; expected: string };
type Message = {
  id: number;
  role: MessageRole;
  title?: string;
  lead?: string;
  body: string;
  bullets?: string[];
  notes?: MessageNote[];
  card?: MessageCard;
  plan?: PlanRow[];
  visible: number;
  streaming?: boolean;
  tone?: "risk" | "approval";
  showRecording?: boolean;
  actions?: string[];
};
type AgentNode = {
  id: string;
  name: string;
  type: string;
  kind: AgentKind;
  detail: string;
  evidence: string;
  instruction: string;
  x: number;
  y: number;
  optional?: boolean;
};

const processDefinitions: Record<Phase, { title: string; short: string; steps: string[] }> = {
  intake: { title: "客诉接入与分类", short: "客诉分类", steps: ["风险与诉求分类", "创建 CCO 投诉"] },
  retention: { title: "客户维修挽留", short: "维修挽留", steps: ["案件调查", "维修挽留方案", "客户确认"] },
  claim: { title: "CCA Case 审批", short: "CCA 审批", steps: ["创建 CCA Case", "资料审核", "审批完成"] },
};

const baseGraphs: Record<Phase, AgentNode[]> = {
  intake: [
    { id: "router", name: "Complaint Leading Agent", type: "Leading Agent", kind: "agent", detail: "我在原话里听到了三个需要立即升级的信号：行驶中失去动力、同一问题修了五次、客户明确要求退车。综合判断，这是高风险投诉，建议先创建 CCO 案件保留原始语境。", evidence: "本次电话逐字稿、车辆 VIN 与客户主数据", instruction: "先完整听完来电，保留客户原话；再判断诉求、风险和应进入的业务流程。", x: 50, y: 48 },
    { id: "cco-execution", name: "CCO Case Execution Agent", type: "Execution Agent", kind: "agent", detail: "将客户原话、基础信息和投诉诉求写入 CCO，并创建当前投诉案件。", evidence: "已完成风险识别的投诉内容", instruction: "创建 CCO 投诉案件，并保留原始录音与客户诉求。", x: 50, y: 78 },
  ],
  retention: [
    { id: "retention", name: "Retention Process", type: "Process Agent", kind: "agent", detail: "根据客户确认的计划，编排维修记录、技术方案和代步车查询；如业务人员补充新车状态核验，再加入 Warranty Data Agent。", evidence: "当前 CCO 投诉与用户确认的执行计划", instruction: "基于已确认的计划调用所需 Data Agents，并汇总可供客户沟通的事实。", x: 50, y: 15 },
    { id: "repair-history", name: "Repair History Data Agent", type: "Data Agent", kind: "agent", detail: "查询购车日附近的进店与维修记录，核实客户所述故障。", evidence: "Dealer 维修工单", instruction: "查询 4 月 1 日至 4 月 8 日的维修工单，返回诊断结论。", x: 15, y: 48 },
    { id: "technical", name: "Technical Service Data Agent", type: "Data Agent", kind: "agent", detail: "查询已登记的维修方案，明确车辆的修复安排。", evidence: "Technical Service 维修方案", instruction: "返回当前已登记的点火系统维修方案。", x: 39, y: 48 },
    { id: "mobility", name: "Mobility Data Agent", type: "Data Agent", kind: "agent", detail: "查询经销商未来一周的可用代步车。", evidence: "Dealer Mobility 库存", instruction: "确认未来一周是否有可用的同级代步车。", x: 63, y: 48 },
    { id: "warranty", name: "Warranty Data Agent", type: "Data Agent", kind: "agent", detail: "仅在业务人员补充后，查询 FRD 保修开始日和当前里程以核实新车状态。", evidence: "FRD 与车辆里程数据", instruction: "返回 FRD 保修开始日及当前里程。", x: 85, y: 48 },
    { id: "customer-care", name: "Customer Care Knowledge Agent", type: "Knowledge Agent", kind: "agent", detail: "基于已确认的车辆、质量问题和服务资源，生成客户补偿方案与沟通话术。", evidence: "已审批的 Agent 查询结果与客户关怀知识库", instruction: "生成与当前客户投诉相匹配的补偿方案及 Customer Care 沟通话术。", x: 50, y: 75 },
  ],
  claim: [
    { id: "claim-process", name: "CLAIM Approval", type: "Process Agent", kind: "agent", detail: "Dealer 材料到达后，我自动启动了 OCR 核验。资料完整就交给审批人；缺件则暂停并告诉 Dealer 具体要补什么。审批完成后，最后一步才会回写 CCO。", evidence: "CCA-2026-0068 与 DealerRepairAndClaimSubmitted 事件", instruction: "材料一到就开始审批流程：先查完整性，再等待审批意见，最后回写结果。", x: 50, y: 18 },
    { id: "ocr", name: "Claim Document Review", type: "Document & OCR Agent", kind: "agent", detail: "我逐份比对了申请表、维修完成单和延保文件。VIN、日期与签字一致，维修结论也能对应当前 CCA Case，因此建议进入审批。", evidence: "3 份 CLAIM 文件及字段级 OCR 比对结果", instruction: "读完 Dealer 上传的全部文件，找出缺件或字段冲突，并说明是否足以进入审批。", x: 28, y: 58 },
    { id: "writer", name: "CCO Result Writer", type: "Execution Agent", kind: "agent", detail: "审批结果为通过后，我把 CCA 决定、维修结果和客户关怀信息写回 CCO，并拿到了成功回执。当前案件可以闭环。", evidence: "审批决定 Approved、CCO 写入回执 WR-2026-0068", instruction: "确认审批已经完成后再回写 CCO；写完要检查回执，失败时不要把案件标记为完成。", x: 72, y: 58 },
  ],
};

const complaintInvestigationNodes: AgentNode[] = [
  {
    id: "complaint-leading",
    name: "Complaint Leading Agent",
    type: "Leading Agent",
    kind: "agent",
    detail: "识别客户投诉中的风险信号，汇总客户、车辆与经销商信息，并提出下一步处理建议。",
    evidence: "客户来电转写、车辆 VIN 与客户主数据",
    instruction: "识别投诉风险，保留客户原话，并决定是否启动投诉调查流程。",
    x: 50,
    y: 30,
  },
  {
    id: "complaint-investigation-process",
    name: "Compliant Investigation Process Agent",
    type: "Process Agent",
    kind: "agent",
    detail: "等待业务人员确认后，启动投诉调查并编排所需的信息补充与事实核验。",
    evidence: "高风险投诉摘要与业务人员确认",
    instruction: "收到确认后启动投诉调查；如信息不足，先列出需要补充的材料。",
    x: 50,
    y: 70,
  },
];

const graphExtras: Record<Phase, AgentNode[]> = {
  intake: [
    { id: "cco-intake", name: "CCO", type: "Business System", kind: "system", detail: "接收结构化投诉记录。", evidence: "Complaint API", instruction: "创建投诉记录并返回案件号。", x: 50, y: 82, optional: true },
  ],
  retention: [
    { id: "frd", name: "FRD / FASTA", type: "Data Source", kind: "source", detail: "里程与技术诊断来源。", evidence: "只读查询", instruction: "按 VIN 返回当前里程和诊断数据。", x: 50, y: 82, optional: true },
    { id: "cco-retention", name: "CCO", type: "Business System", kind: "system", detail: "保存调查结论和 Dealer 回写。", evidence: "CCO Case", instruction: "监听 Dealer 回写并更新客户反馈与案件状态。", x: 72, y: 82, optional: true },
  ],
  claim: [
    { id: "cco-claim", name: "CCO / CCA", type: "Business System", kind: "system", detail: "保存 CLAIM 文件和审批结果。", evidence: "CCA Case API", instruction: "创建 CCA Case、保存文件并接收审批结果。", x: 50, y: 86, optional: true },
  ],
};

const repairQueryAgent: AgentNode = {
  id: "adhoc-repair-history",
  name: "Repair History Data Agent",
  type: "Data Agent",
  kind: "agent",
  detail: "已按用户提供的车辆标识查询全部维修记录，并将工单按时间顺序整理。",
  evidence: "Dealer Repair History 数据源与维修工单",
  instruction: "识别用户指定的车辆，查询全部维修记录，并以结构化表格返回。",
  x: 50,
  y: 50,
};

type RepairRecord = { date: string; dealer: string; mileage: string; type: string; details: string; status: string };
const mockRepairRecords: RepairRecord[] = [
  { date: "2026-04-04", dealer: "珠海锦泰宝汇", mileage: "91 km", type: "故障诊断", details: "检测发现二缸点火线圈工作不良，导致缺火抖动。", status: "已完成" },
  { date: "2026-04-08", dealer: "珠海锦泰宝汇", mileage: "91 km", type: "维修作业", details: "更换全部点火线圈（6 个）。", status: "已完成" },
  { date: "2026-04-08", dealer: "珠海锦泰宝汇", mileage: "98 km", type: "质量检查", details: "完成故障码清除及道路测试，发动机运行正常。", status: "已完成" },
];

const initialConclusion = "我已经听完这段投诉电话。廖女士描述，她于 2026 年 4 月 1 日在珠海锦泰宝汇购买 BMW X5，提车当天回家路上便出现发动机抖动。\n\n这是一项发生在新车交付当天的质量投诉，且客户已明确提出退车。为了完整保留录音、经销商检查结论和客户诉求，我建议先创建 CCO 高风险退车投诉案例，用于跟进当前客诉。";

const initialMessages: Message[] = [
  { id: 1, role: "system", body: "后台处理完成｜来电已转写并完成风险识别", visible: 22 },
  { id: 2, role: "assistant", body: initialConclusion, visible: initialConclusion.length, tone: "risk", actions: ["请创建 CCO 投诉，并告诉我接下来如何处理"] },
];

const complaintInvestigationMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    lead: "识别到一个高风险投诉。",
    body: "客户廖女士于 2026 年 4 月 1 日在珠海锦泰宝汇购买 BMW X5，提车当天回家路上出现发动机抖动。经销商初步判断为点火线圈故障并建议维修，但客户认为新车存在质量问题，不接受维修并明确要求退车。",
    visible: 0,
    streaming: true,
    tone: "risk",
    showRecording: false,
    actions: ["Start Compliant Investigation", "要求补充更多信息"],
  },
];

const callTranscript = "客户（廖女士）：我 4 月 1 日在珠海锦泰宝汇买了一辆 BMW X5，今天刚提车回家，路上就发现发动机一直抖动。\n\nST：我们已经收到您的反馈。车辆现在已经送回经销商了吗？\n\n客户：是的，送回去检查了。他们说是点火线圈故障，需要换点火线圈。新车第一天就出这种问题，我认为是车辆质量有问题。\n\nST：我会完整记录本次投诉和经销商的检查结论。\n\n客户：我不接受维修，我要求退车。请尽快告诉我怎么处理。";

const retentionPlan: PlanRow[] = [
  { purpose: "核实故障事实", action: "查询购车日附近的维修工单", expected: "确认故障记录与客户描述是否一致" },
  { purpose: "确认修复安排", action: "查询已登记的维修方案", expected: "明确后续维修安排" },
  { purpose: "确认出行保障", action: "查询经销商是否有可用代步车", expected: "明确维修期间的出行支持条件" },
];

const updatedRetentionPlan: PlanRow[] = [
  ...retentionPlan,
  { purpose: "确认新车状态", action: "查询 FRD 保修开始日与当前里程", expected: "补充车辆状态判断依据" },
];

const pendingTaskItems = [
  { id: "t2", title: "延保资料待补充｜CCA-2026-0041", status: "待处理" },
  { id: "t3", title: "零件延迟投诉｜CCO-CMP-0087", status: "待处理" },
  { id: "t5", title: "道路救援费用核验｜王先生", status: "待处理" },
  { id: "t6", title: "重复维修客户关怀｜李女士", status: "待处理" },
  { id: "t7", title: "代步车权益确认｜CCO-CMP-0102", status: "待处理" },
  { id: "t8", title: "Dealer 沟通记录待补充｜赵先生", status: "待处理" },
  { id: "t9", title: "维修方案技术复核｜BMW X5", status: "待处理" },
  { id: "t10", title: "客户授权文件待签署｜CCA-2026-0071", status: "待处理" },
];

const completedTaskItems = [
  { id: "c1", title: "维修关怀已完成｜CCA-2026-0032", status: "已完成" },
  { id: "c2", title: "客户回访已完成｜CCO-CMP-0068", status: "已完成" },
  { id: "c3", title: "零件加急调拨完成｜刘先生", status: "已完成" },
  { id: "c4", title: "延保申请审批完成｜CCA-2026-0029", status: "已完成" },
  { id: "c5", title: "投诉分类与转派完成｜CCO-CMP-0054", status: "已完成" },
];

function phaseForStage(stage: Stage): Phase {
  if (["classifying", "ready_create", "ready_retention"].includes(stage)) return "intake";
  if (["waiting_plan_confirmation", "ready_investigation", "running_investigation", "waiting_investigation_approvals", "ready_solution", "waiting_customer", "waiting_repair", "ready_claim", "blocked"].includes(stage)) return "retention";
  return "claim";
}

function progressFor(stage: Stage): number {
  const map: Record<Stage, number> = {
    classifying: 0,
    ready_create: 1,
    ready_retention: 2,
    waiting_plan_confirmation: 0,
    ready_investigation: 0,
    running_investigation: 0,
    waiting_investigation_approvals: 0,
    ready_solution: 1,
    waiting_customer: 2,
    waiting_repair: 3,
    ready_claim: 3,
    ready_approval: 1,
    waiting_supplement: 1,
    complete: 3,
    blocked: 2,
  };
  return map[stage];
}

function stagePrompt(stage: Stage) {
  const prompts: Partial<Record<Stage, string>> = {
    ready_create: "请创建 CCO 投诉",
    ready_retention: "启动维修挽留流程",
    waiting_plan_confirmation: "可补充信息，或按建议开始",
    ready_investigation: "按建议运行调查",
    ready_solution: "确认生成客户补偿方案与沟通话术",
    waiting_customer: "例如：沟通完成，客户接受方案",
    ready_claim: "启动 CCA 审批",
    ready_approval: "批准并回写结果",
  };
  return prompts[stage] ?? "当前步骤无需输入";
}

function repairQueryVehicleFrom(value: string) {
  const chinese = value.match(/(?:查询|查一下|查)\s*(.+?)(?:车|车辆)(?:的)?(?:所有|全部)?维修记录/i);
  if (chinese?.[1]) return chinese[1].trim();
  const english = value.match(/(?:repair history|repair records).*?(?:for|of)\s+(?:vehicle\s+)?(.+)$/i);
  if (english?.[1]) return english[1].trim();
  return "XXX";
}

export default function ChatWorkbench() {
  return <LanguageProvider><ChatWorkbenchContent /></LanguageProvider>;
}

function ChatWorkbenchContent() {
  const { t } = useLanguage();
  const [stage, setStage] = useState<Stage>("classifying");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [customerOpen, setCustomerOpen] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [ccaId, setCcaId] = useState<string | null>(null);
  const [history, setHistory] = useState<Phase[]>([]);
  const [graphView, setGraphView] = useState<Phase | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [enabledExtras, setEnabledExtras] = useState<Record<Phase, string[]>>({ intake: [], retention: [], claim: [] });
  const [dealerModal, setDealerModal] = useState<"repair" | "supplement" | null>(null);
  const [documentsComplete, setDocumentsComplete] = useState(true);
  const [drawer, setDrawer] = useState<"tasks" | "agents" | null>(null);
  const [taskView, setTaskView] = useState<TaskView>("complaint-investigation");
  const [agentStates, setAgentStates] = useState<Record<string, AgentStatus>>({ router: "running" });
  const [approvals, setApprovals] = useState({ "repair-history": false, technical: false, mobility: false, warranty: false, legal: false, parts: false });
  const [partsReady] = useState(false);
  const [warrantyRequested, setWarrantyRequested] = useState(false);
  const [planAgentsVisible, setPlanAgentsVisible] = useState(false);
  const [careAgentVisible, setCareAgentVisible] = useState(false);
  const [ccoExecutionVisible, setCcoExecutionVisible] = useState(false);
  const [agentInstructions, setAgentInstructions] = useState<Record<string, string>>({});
  const [repairQueryInput, setRepairQueryInput] = useState("");
  const [repairQueryRequest, setRepairQueryRequest] = useState<string | null>(null);
  const [repairQueryVehicle, setRepairQueryVehicle] = useState("XXX");
  const [repairQueryStatus, setRepairQueryStatus] = useState<AgentStatus | null>(null);
  const [repairQueryNeedsDetail, setRepairQueryNeedsDetail] = useState(false);
  const [complaintMessages, setComplaintMessages] = useState<Message[]>(complaintInvestigationMessages);
  const [complaintAgentStates, setComplaintAgentStates] = useState<Record<string, AgentStatus>>({
    "complaint-leading": "waiting",
  });
  const [complaintInvestigationStarted, setComplaintInvestigationStarted] = useState(false);
  const [complaintPlanAgentsVisible, setComplaintPlanAgentsVisible] = useState(false);
  const [complaintWarrantyRequested, setComplaintWarrantyRequested] = useState(false);
  const [complaintInput, setComplaintInput] = useState("");
  const nextId = useRef(3);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const repairQueryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const complaintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const complaintNextId = useRef(2);
  const complaintInitialStarted = useRef(false);
  const messageEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const initialStarted = useRef(false);
  const remainingStarted = useRef(false);

  const phase = phaseForStage(stage);
  const displayPhase = graphView ?? phase;
  const readOnlyGraph = graphView !== null && graphView !== phase;
  const progress = progressFor(stage);
  const waitingCustomerCareFeedback = stage === "waiting_customer";
  const waitingExternal = ["waiting_repair", "waiting_supplement"].includes(stage);
  const waitingApproval = stage === "waiting_investigation_approvals";
  const canSend = taskView === "main" && !busy && !waitingExternal && !waitingApproval && !["complete", "blocked"].includes(stage);
  const latestActionMessageId = [...messages].reverse().find((message) => message.actions?.length)?.id;

  const graphNodes = useMemo(() => {
    const extras = graphExtras[displayPhase].filter((node) => enabledExtras[displayPhase].includes(node.id));
    const baseNodes = displayPhase === "intake" ? baseGraphs.intake.filter((node) => node.id !== "cco-execution" || ccoExecutionVisible) : displayPhase === "retention" ? baseGraphs.retention.filter((node) => node.id === "retention" || (node.id === "customer-care" ? careAgentVisible : planAgentsVisible && (warrantyRequested || node.id !== "warranty"))) : baseGraphs[displayPhase];
    const nodes = [...baseNodes, ...extras];
    // Introduce the cross-process handoff only when it starts; retain it afterward.
    if (displayPhase === "retention") {
      const positions: Record<string, [number, number]> = { retention: [50, 12], "repair-history": [15, 43], technical: [39, 43], mobility: [63, 43], warranty: [85, 43], "customer-care": [50, 75], frd: [28, 94], "cco-retention": [58, 94] };
      return visibleAgentNodes([...nodes.map((node) => ({ ...node, x: positions[node.id]?.[0] ?? node.x, y: positions[node.id]?.[1] ?? node.y })), { ...baseGraphs.claim[0], name: "Claim Process", x: 85, y: 88 }], agentStates);
    }
    if (displayPhase === "claim") return [...nodes.map((node) => node.id === "claim-process" ? { ...node, name: "Claim Process", x: 50, y: 38 } : node.id === "ocr" || node.id === "writer" ? { ...node, y: 70 } : node), { ...baseGraphs.retention[0], x: 18, y: 15 }];
    return nodes;
  }, [displayPhase, enabledExtras, agentStates, warrantyRequested, planAgentsVisible, careAgentVisible, ccoExecutionVisible]);

  const repairQueryNodes = useMemo(() => repairQueryStatus ? [{
    ...repairQueryAgent,
    detail: repairQueryStatus === "done" ? `已查询 ${repairQueryVehicle} 的全部维修记录，共返回 ${mockRepairRecords.length} 条。` : "正在识别车辆标识并查询全部维修工单。",
    instruction: `查询 ${repairQueryVehicle} 的全部维修记录，并按时间顺序返回。`,
  }] : [], [repairQueryStatus, repairQueryVehicle]);
  const complaintGraphNodes = useMemo(() => {
    if (!complaintInvestigationStarted) return complaintInvestigationNodes.filter((node) => node.id === "complaint-leading");
    return [
      ...complaintInvestigationNodes,
      ...baseGraphs.retention.filter((node) => node.id === "retention" || (complaintPlanAgentsVisible && node.id !== "customer-care" && (complaintWarrantyRequested || node.id !== "warranty"))),
    ];
  }, [complaintInvestigationStarted, complaintPlanAgentsVisible, complaintWarrantyRequested]);
  const activeGraphNodes = taskView === "repair-query" ? repairQueryNodes : taskView === "complaint-investigation" ? complaintGraphNodes : graphNodes;
  const activeAgentStates = taskView === "repair-query" && repairQueryStatus ? { "adhoc-repair-history": repairQueryStatus } : taskView === "complaint-investigation" ? complaintAgentStates : agentStates;
  const selected = activeGraphNodes.find((node) => node.id === selectedNode) ?? activeGraphNodes[0];

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const clearComplaintTimers = () => {
    complaintTimers.current.forEach(clearTimeout);
    complaintTimers.current = [];
  };

  useEffect(() => () => {
    clearTimers();
    clearComplaintTimers();
    if (repairQueryTimer.current) clearTimeout(repairQueryTimer.current);
    initialStarted.current = false;
  }, []);

  const startComplaintInvestigationTask = () => {
    clearComplaintTimers();
    setComplaintInvestigationStarted(false);
    setComplaintPlanAgentsVisible(false);
    setComplaintWarrantyRequested(false);
    setComplaintInput("");
    complaintNextId.current = 2;
    setComplaintAgentStates({ "complaint-leading": "running" });
    setComplaintMessages(complaintInvestigationMessages.map((message) => ({ ...message, visible: 0, streaming: true })));
    let visible = 0;
    const streamResponse = () => {
      visible += 1;
      setComplaintMessages((current) => current.map((message) => ({ ...message, visible })));
      if (visible < complaintInvestigationMessages[0].body.length) {
        complaintTimers.current.push(setTimeout(streamResponse, 24));
        return;
      }
      setComplaintMessages((current) => current.map((message) => ({ ...message, visible: complaintInvestigationMessages[0].body.length, streaming: false })));
      setComplaintAgentStates({ "complaint-leading": "done" });
    };
    complaintTimers.current.push(setTimeout(streamResponse, 180));
  };

  const streamComplaintAssistant = (body: string, options?: { plan?: PlanRow[]; actions?: string[]; onDone?: () => void }) => {
    const id = complaintNextId.current++;
    setComplaintMessages((current) => [...current, { id, role: "assistant", body, plan: options?.plan, actions: options?.actions, visible: 0, streaming: true }]);
    let visible = 0;
    const tick = () => {
      visible += 1;
      setComplaintMessages((current) => current.map((message) => message.id === id ? { ...message, visible } : message));
      if (visible < body.length) {
        complaintTimers.current.push(setTimeout(tick, 30));
        return;
      }
      setComplaintMessages((current) => current.map((message) => message.id === id ? { ...message, visible: body.length, streaming: false } : message));
      options?.onDone?.();
    };
    complaintTimers.current.push(setTimeout(tick, 180));
  };

  useEffect(() => {
    if (complaintInitialStarted.current) return;
    complaintInitialStarted.current = true;
    startComplaintInvestigationTask();
    // The starter intentionally runs once per page load so refresh always begins in this task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialStarted.current) return;
    initialStarted.current = true;
    timers.current.push(setTimeout(() => {
      setProfileReady(true);
      setAgentStates({ router: "done" });
      setStage("ready_create");
      setBusy(false);
    }, 650));
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLElement>(drawer === "tasks" ? ".task-sidebar .drawer-close" : ".agent-workspace .drawer-close")?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setDrawer(null); origin?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [drawer]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "end" });
  }, [messages]);

  const addMessage = (message: Omit<Message, "id" | "visible">) => {
    const id = nextId.current++;
    setMessages((current) => [...current, { ...message, id, visible: message.body.length }]);
    return id;
  };

  const streamAssistant = (title: string, body: string, options?: { card?: MessageCard; bullets?: string[]; notes?: MessageNote[]; plan?: PlanRow[]; tone?: Message["tone"]; actions?: string[]; onDone?: () => void }) => {
    const id = nextId.current++;
    setBusy(true);
    setMessages((current) => [...current, { id, role: "assistant", title, body, bullets: options?.bullets, notes: options?.notes, plan: options?.plan, tone: options?.tone, actions: options?.actions, visible: 0, streaming: true }]);
    let index = 0;
    const tick = () => {
      index += 1;
      setMessages((current) => current.map((message) => message.id === id ? { ...message, visible: index } : message));
      if (index < body.length) {
        timers.current.push(setTimeout(tick, 36));
      } else {
        setMessages((current) => current.map((message) => message.id === id ? { ...message, visible: body.length, streaming: false, card: options?.card } : message));
        setBusy(false);
        options?.onDone?.();
      }
    };
    timers.current.push(setTimeout(tick, 180));
  };

  const pauseBeforeAgentStep = (next: () => void, delay = 1800) => {
    setBusy(true);
    timers.current.push(setTimeout(next, delay));
  };

  const completePhase = (completed: Phase, next?: Phase) => {
    setHistory((current) => current.includes(completed) ? current : [...current, completed]);
    if (next) setGraphView(null);
  };

  const runRemainingInvestigation = () => {
    setStage("running_investigation");
    setAgentStates((current) => ({ ...current, warranty: "running" }));
    streamAssistant("", "Technical Service、Legal 和 Parts 的审批均已完成。我正在补充客户关怀权益，并据此生成沟通建议。", {
      notes: [{ label: "接下来我会", text: "核验 Warranty、代步车和可申请的延保权益。", tone: "next" }, { label: "为什么还要查", text: "一份可信的沟通方案，不只要说明怎么修，也要解决客户维修期间的出行和后续保障。" }],
      onDone: () => pauseBeforeAgentStep(() => streamAssistant("", "保障数据已经核验完成：车辆仍在保，Dealer 可以提供代步车，同时可申请一年延保。", {
      notes: [{ label: "我查到的", text: "Warranty 状态有效，珠海锦泰宝汇当前有可用代步车。", tone: "evidence" }, { label: "这意味着", text: "客户等待维修时不必承担出行中断。", tone: "decision" }, { label: "可以这样处理", text: "把代步车和一年延保一起放进沟通方案。", tone: "next" }],
      card: { label: "Warranty & Mobility", value: "在保｜代步车可用", meta: "建议一年延保" },
      onDone: () => {
        setAgentStates((current) => ({ ...current, warranty: "done", strategy: "running" }));
        pauseBeforeAgentStep(() => streamAssistant("", "建议 Customer Care 使用下面的话术与客户线下沟通：\n\n“陈女士，我们理解多次维修给您带来的不安。这次 Technical Service 已提供新的维修方案，所需零件预计 3 天到店。等待期间我们提供代步车；维修完成后，再为您申请一年延保。您可以考虑后再告诉我们是否接受。”", {
          notes: [{ label: "为什么这样说", text: "先回应安全担忧，再给出明确时间和保障，客户会感觉问题被真正理解，而不是再次被要求继续维修。" }, { label: "参考依据", text: "3 个同类高风险案例采用相同结构后，都获得了明确客户反馈。", tone: "evidence" }, { label: "接下来", text: "请 Customer Care 完成线下沟通，再直接在聊天框输入客户反馈。", tone: "next" }],
          card: { label: "沟通方案", value: "维修＋代步车＋一年延保", meta: "等待 Customer Care 反馈" },
          actions: ["沟通完成，客户接受方案", "客户仍要求退车"],
          onDone: () => {
            setAgentStates((current) => ({ ...current, strategy: "done" }));
            setStage("waiting_customer");
          },
        }), 2200);
      },
    }), 1800) });
  };

  const continueAfterApprovals = (next: { technical: boolean; legal: boolean; parts: boolean }) => {
    if (!next.technical || !next.legal || !next.parts || !partsReady || remainingStarted.current) return;
    remainingStarted.current = true;
    timers.current.push(setTimeout(runRemainingInvestigation, 80));
  };

  const approveLegal = () => {
    const next = { ...approvals, legal: true };
    setApprovals(next);
    setAgentStates((current) => ({ ...current, legal: "done" }));
    addMessage({ role: "system", body: "Legal 已确认本次三包核验数据" });
    continueAfterApprovals(next);
  };

  const approveParts = () => {
    const next = { ...approvals, parts: true };
    setApprovals(next);
    setAgentStates((current) => ({ ...current, parts: "done" }));
    addMessage({ role: "system", body: "Parts 已确认零件库存与调拨时间" });
    continueAfterApprovals(next);
  };

  const runCustomerCareRecommendation = () => {
    setStage("ready_solution");
    streamAssistant("", "审批已完成。客户投诉的质量问题属实，已有对应的维修方案，未来一周可提供代步车；结合 FRD 与当前里程，车辆属于新车。\n\n接下来建议基于车型、质量问题和已确认的维修资源，生成客户补偿方案及对应沟通话术。", {
      actions: ["确认生成客户补偿方案与沟通话术"],
    });
  };

  const approveAgentResult = (type: "repair-history" | "technical" | "mobility" | "warranty") => {
    const next = { ...approvals, [type]: true };
    setApprovals(next);
    setAgentStates((current) => ({ ...current, [type]: "done" }));
    const allRequiredApproved = next["repair-history"] && next.technical && next.mobility && (!warrantyRequested || next.warranty);
    if (allRequiredApproved) runCustomerCareRecommendation();
  };

  const runParallelInvestigation = () => {
    setStage("running_investigation");
    setAgentStates((current) => ({ ...current, "repair-history": "running", technical: "running", mobility: "running", ...(warrantyRequested ? { warranty: "running" } : {}) }));
    streamAssistant("", "我已按确认后的计划启动 Data Agent 查询。", {
      onDone: () => pauseBeforeAgentStep(() => streamAssistant("", "Repair History Data Agent 返回：4 月 4 日有进店记录，检测发现二缸点火线圈工作不良，导致缺火抖动。", {
        onDone: () => {
          setAgentStates((current) => ({ ...current, "repair-history": "done" }));
          pauseBeforeAgentStep(() => streamAssistant("", "Technical Service Data Agent 返回：4 月 7 日反馈，更换所有点火线圈（6 个）。", {
            onDone: () => {
              setAgentStates((current) => ({ ...current, technical: "done" }));
              pauseBeforeAgentStep(() => streamAssistant("", "Mobility Data Agent 返回：未来一周有一辆 5 系代步车可以使用。", {
                onDone: () => {
                  setAgentStates((current) => ({ ...current, mobility: "done" }));
                  if (!warrantyRequested) { setStage("waiting_investigation_approvals"); return; }
                  pauseBeforeAgentStep(() => streamAssistant("", "Warranty Data Agent 返回：FRD 保修开始日为 2026 年 4 月 3 日，当前里程为 91 km。", {
                    onDone: () => { setAgentStates((current) => ({ ...current, warranty: "done" })); setStage("waiting_investigation_approvals"); },
                  }), 1200);
                },
              }), 1200);
            },
          }), 1200);
        },
      }), 1200),
    });
  };

  const executeCommand = (value: string) => {
    if (!value || !canSend) return;
    addMessage({ role: "user", body: value });
    setInput("");

    if (stage === "ready_create") {
      setStage("ready_retention");
      setCcoExecutionVisible(true);
      setAgentStates((current) => ({ ...current, "cco-execution": "running" }));
      pauseBeforeAgentStep(() => streamAssistant("", "CCO-CMP-2026-0096 已创建，客户原话、经销商初步检查结论和退车诉求均已归入案件。\n\n我优先推荐启动客户挽留流程。车辆为新车，且故障发生在交付当天；在已有初步处理方向的情况下，先围绕客户的质量担忧提供解决方案，更有机会恢复客户信心，也有助于避免不必要的业务损失。\n\n同时，客户已经明确提到退车，因此也可以直接进入退车流程；该诉求会被完整保留，不会因启动挽留流程而被覆盖。", {
        actions: ["启动客户挽留流程", "启动退车流程"],
        onDone: () => setAgentStates((current) => ({ ...current, "cco-execution": "done" })),
      }), 1600);
    } else if (stage === "ready_retention" && /退车流程/.test(value)) {
      setStage("blocked");
      streamAssistant("", "我已保留当前 CCO 案件中的录音、经销商检查结论和客户退车诉求，并将案件转入退车流程。该流程不在本 Demo 中继续展开。", {});
    } else if (stage === "ready_retention") {
      completePhase("intake", "retention");
      setAgentStates((current) => ({ ...current, retention: "running", "repair-history": "waiting", technical: "waiting", mobility: "waiting", "claim-process": "waiting" }));
      setStage("waiting_plan_confirmation");
      setPlanAgentsVisible(false);
      streamAssistant("", "我推荐按下面的顺序执行。\n\n客户在购车当日就发现故障，因此先核实购车日附近的维修工单，确认客户提供的故障信息与经销商记录是否一致。随后查询已登记的维修方案，明确后续修复安排。\n\n维修期间的出行安排也会影响客户是否愿意继续沟通，因此我会查询经销商是否有可用代步车。", {
        plan: retentionPlan,
        actions: ["按建议开始"],
        onDone: () => { setAgentStates((current) => ({ ...current, retention: "done" })); setPlanAgentsVisible(true); },
      });
    } else if (stage === "waiting_plan_confirmation" && /按建议开始/.test(value)) {
      setStage("ready_investigation");
      runParallelInvestigation();
    } else if (stage === "waiting_plan_confirmation") {
      streamAssistant("", `我已收到你的补充：“${value}”。\n\n我已将 FRD 保修开始日和当前里程加入待执行计划。它们会与购车日附近的维修工单、维修方案和代步车可用性一并核对；目前尚未发起数据查询。下面是更新后的计划，请确认后开始执行。`, {
        plan: updatedRetentionPlan,
        actions: ["按建议开始"],
        onDone: () => setWarrantyRequested(true),
      });
    } else if (stage === "ready_investigation") {
      runParallelInvestigation();
    } else if (stage === "ready_solution") {
      setCareAgentVisible(true);
      setAgentStates((current) => ({ ...current, "customer-care": "running" }));
      streamAssistant("", "Customer Care Knowledge Agent 已基于已审批的车辆信息、质量问题、维修方案和代步车资源生成客户补偿方案与沟通话术。\n\n我建议在完成全部 6 个点火线圈更换的基础上，为廖女士提供发动机一年延保、一次火花塞保养、两次机油保养，并在维修期间安排一辆 5 系代步车。\n\n建议 Customer Care 使用以下话术：\n\n“廖女士，我们确认您的车辆在交付后很快出现了点火系统故障。我们将完成全部 6 个点火线圈的更换；维修期间为您安排 5 系代步车。为回应您对新车可靠性和后续使用的担忧，我们还将提供发动机一年延保、一次火花塞保养和两次机油保养。您可以了解方案后，再决定是否接受。”", {
        actions: ["沟通完成，客户接受方案", "客户仍要求退车"],
        onDone: () => { setAgentStates((current) => ({ ...current, "customer-care": "done" })); setStage("waiting_customer"); },
      });
    } else if (stage === "waiting_customer") {
      const rejected = /拒绝|不接受|不认可|仍.*退车|要求退车/.test(value);
      if (rejected) {
        setStage("blocked");
        streamAssistant("", "收到 Customer Care 的沟通结果。客户仍不接受维修与关怀方案，并继续要求退车；我会保留本次沟通记录，并把案件转入退车流程。", {
          notes: [{ label: "反馈依据", text: value, tone: "evidence" }, { label: "处理建议", text: "转交退车流程；该流程不在本 Demo 中继续展开。", tone: "next" }],
          card: { label: "流程结果", value: "转退车流程", meta: "Out of scope" },
        });
      } else {
        setStage("waiting_repair");
        setCcaId("CCA-2026-0068");
        streamAssistant("", "收到 Customer Care 的沟通结果。客户已接受维修与关怀方案，我已自动更新 CCO 并创建 CCA Case；现在等待 Dealer 上传待审核材料。", {
          notes: [{ label: "反馈依据", text: value, tone: "evidence" }, { label: "系统已完成", text: "客户选择已写入 CCO，CCA-2026-0068 已自动创建。", tone: "decision" }, { label: "接下来", text: "等待 Dealer 上传维修单、CLAIM 和客户授权文件。", tone: "next" }],
          card: { label: "CCA Case", value: "CCA-2026-0068", meta: "等待 Dealer 上传材料" },
        });
      }
    } else if (stage === "ready_claim") {
      completePhase("retention", "claim");
      setAgentStates((current) => ({ ...current, "claim-process": "done", ocr: "running", writer: "waiting" }));
      setStage("ready_approval");
      streamAssistant("", documentsComplete ? "我已核对 Dealer 上传的申请表、维修完成单和延保文件，VIN、日期与签字一致。" : "我已核对 Dealer 上传的材料，但客户授权签字缺失。", {
        notes: documentsComplete ? [{ label: "我核对过", text: "3 份文件的关键字段一致，维修结论也能对应当前 CCA Case。", tone: "evidence" }, { label: "可以继续", text: "资料完整，建议给出审批意见并回写结果。", tone: "next" }] : [{ label: "我发现", text: "客户授权文件的签字字段为空。", tone: "evidence" }, { label: "暂时不能继续", text: "请等待 Dealer 补充签字文件，系统会自动重新核验。", tone: "next" }],
        card: { label: "OCR 检查", value: documentsComplete ? "资料完整" : "缺少 1 项", meta: documentsComplete ? "建议批准" : "等待补件" },
        actions: documentsComplete ? ["批准并回写结果"] : undefined,
        onDone: () => {
          setAgentStates((current) => ({ ...current, ocr: "done" }));
          if (!documentsComplete) setStage("waiting_supplement");
        },
      });
    } else if (stage === "ready_approval") {
      setStage("complete");
      completePhase("claim");
      setAgentStates((current) => ({ ...current, writer: "running" }));
      streamAssistant("", "审批已经完成，结果已回写 CCO。维修、延保和客户关怀记录均已闭环。", {
        notes: [{ label: "系统回执", text: "审批决定为 Approved，CCO 写入成功。", tone: "evidence" }, { label: "现在的状态", text: "CCA Case 已完成，维修和客户关怀记录都已闭环。", tone: "decision" }, { label: "接下来", text: "当前任务不需要继续操作。", tone: "next" }],
        card: { label: "CCA Case", value: ccaId ?? "CCA-2026-0068", meta: "Approved" },
        onDone: () => setAgentStates((current) => ({ ...current, writer: "done" })),
      });
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    executeCommand(input.trim());
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    addMessage({ role: "system", body: `已添加附件｜${file.name}｜Demo 中不上传真实文件` });
  };

  const submitRepairMock = () => {
    setDealerModal(null);
    setCcaId("CCA-2026-0068");
    completePhase("retention", "claim");
    setStage("ready_approval");
    setAgentStates((current) => ({ ...current, "claim-process": "running", ocr: "waiting", writer: "waiting" }));
    addMessage({ role: "system", body: "DealerRepairAndClaimSubmitted｜Dealer 已上传待审核材料" });
    streamAssistant("", "Dealer 已上传维修单、CLAIM 和客户授权材料。挽留 Process Agent 正通过 A2A 将 CCA Case 和待审核材料交给 Claim Process Agent，自动启动审批流程。", {
      notes: [{ label: "刚刚发生了什么", text: "系统收到 DealerRepairAndClaimSubmitted 事件。", tone: "evidence" }, { label: "我会自动完成", text: "先做 OCR 核验，再等待审批意见，最后回写 CCO。", tone: "next" }, { label: "为什么直接启动", text: "CCA Case 已存在，Dealer 的待审核材料也已经到齐。" }],
      card: { label: "CCA Case", value: "CCA-2026-0068", meta: "审批 Process 已启动" },
      onDone: () => {
        setAgentStates((current) => ({ ...current, "claim-process": "done", ocr: "running", writer: "waiting" }));
        pauseBeforeAgentStep(() => streamAssistant("", documentsComplete ? "文档核验完成：申请表、维修完成单和延保文件中的 VIN、日期与签字一致。" : "文档核验发现客户授权签字缺失，暂时不能批准。", {
          notes: documentsComplete ? [{ label: "我看到的", text: "3 份文件中的 VIN、日期、签字和维修结论彼此一致。", tone: "evidence" }, { label: "我的判断", text: "资料足以支持审批。", tone: "decision" }, { label: "建议", text: "请在对话中给出审批意见，确认后我会回写 CCO。", tone: "next" }] : [{ label: "缺少的内容", text: "客户授权文件没有签字。", tone: "evidence" }, { label: "当前判断", text: "资料还不足以支持审批。", tone: "decision" }, { label: "接下来", text: "等待 Dealer 补件，收到后自动重新核验。", tone: "next" }],
          card: { label: "OCR 检查", value: documentsComplete ? "资料完整" : "缺少授权签字", meta: documentsComplete ? "建议批准" : "等待 Dealer 补件" },
          actions: documentsComplete ? ["批准并回写结果"] : undefined,
          onDone: () => {
            setAgentStates((current) => ({ ...current, ocr: "done" }));
            setStage(documentsComplete ? "ready_approval" : "waiting_supplement");
          },
        }), 2200);
      },
    });
  };

  const submitSupplementMock = () => {
    setDealerModal(null);
    setDocumentsComplete(true);
    setStage("ready_approval");
    addMessage({ role: "system", body: "CCO 回写｜Dealer 已补充客户授权文件" });
    setAgentStates((current) => ({ ...current, ocr: "running" }));
    streamAssistant("", "Dealer 已经补上客户授权文件。我重新核验后，签字、VIN 和日期都能与当前 CCA Case 对上。", { notes: [{ label: "补件核验", text: "新增文件与案件字段一致。", tone: "evidence" }, { label: "现在可以", text: "资料已经完整，请在对话中给出审批意见。", tone: "next" }], card: { label: "OCR 检查", value: "资料完整", meta: "建议批准" }, actions: ["批准并回写结果"], onDone: () => setAgentStates((current) => ({ ...current, ocr: "done" })) });
  };

  const submitRepairQuery = (event: FormEvent) => {
    event.preventDefault();
    const request = repairQueryInput.trim();
    if (!request || repairQueryStatus === "running") return;
    const isRepairHistoryRequest = /维修记录|维修历史|repair\s+(?:history|records?)/i.test(request);
    setRepairQueryRequest(request);
    setRepairQueryInput("");
    if (!isRepairHistoryRequest) {
      setRepairQueryNeedsDetail(true);
      return;
    }
    const vehicle = repairQueryVehicleFrom(request);
    setRepairQueryVehicle(vehicle);
    setRepairQueryNeedsDetail(false);
    setRepairQueryStatus("running");
    setSelectedNode("adhoc-repair-history");
    if (repairQueryTimer.current) clearTimeout(repairQueryTimer.current);
    repairQueryTimer.current = setTimeout(() => { setRepairQueryStatus("done"); repairQueryTimer.current = null; }, 1800);
  };

  const mockLabel = stage === "waiting_repair" ? "维修与 CLAIM 回写" : stage === "waiting_supplement" ? "提交 Dealer 补件" : null;
  const activeApproval = taskView === "main" || taskView === "complaint-investigation" || taskView === "repair-query" ? null : taskView;
  const activeApprovalDone = activeApproval ? approvals[activeApproval] : false;
  const approveActiveTask = () => {
    if (activeApproval === "repair-history" || activeApproval === "technical" || activeApproval === "mobility" || activeApproval === "warranty") approveAgentResult(activeApproval);
    else if (activeApproval === "legal") approveLegal();
    else if (activeApproval === "parts") approveParts();
  };

  const handleComplaintAction = (action: string) => {
    const userMessage: Message = { id: complaintNextId.current++, role: "user", body: action, visible: action.length };
    if (action === "Start Compliant Investigation") {
      setComplaintMessages((current) => [...current, userMessage]);
      setComplaintInvestigationStarted(true);
      setComplaintAgentStates({ "complaint-leading": "done", "complaint-investigation-process": "running" });
      streamComplaintAssistant("我推荐按下面的顺序执行。\n\n客户在购车当日就发现故障，因此先核实购车日附近的维修工单，确认客户提供的故障信息与经销商记录是否一致。随后查询已登记的维修方案，明确后续修复安排。\n\n维修期间的出行安排也会影响客户是否愿意继续沟通，因此我会查询经销商是否有可用代步车。", {
        plan: retentionPlan,
        actions: ["按建议开始"],
        onDone: () => {
          setComplaintAgentStates({ "complaint-leading": "done", "complaint-investigation-process": "done", retention: "done", "repair-history": "waiting", technical: "waiting", mobility: "waiting" });
          setComplaintPlanAgentsVisible(true);
        },
      });
      return;
    }
    if (action === "按建议开始") {
      setComplaintMessages((current) => [...current, userMessage]);
      setComplaintAgentStates((current) => ({ ...current, retention: "running", "repair-history": "running", technical: "running", mobility: "running", ...(complaintWarrantyRequested ? { warranty: "running" } : {}) }));
      streamComplaintAssistant("我已按确认后的计划启动 Data Agent 查询。", { onDone: () => setComplaintAgentStates((current) => ({ ...current, retention: "done", "repair-history": "done", technical: "done", mobility: "done", ...(complaintWarrantyRequested ? { warranty: "done" } : {}) })) });
      return;
    }
    setComplaintMessages((current) => [...current, userMessage, {
      id: complaintNextId.current++,
      role: "assistant",
      body: "请补充经销商完整检测报告、维修工单、车辆当前里程，以及客户是否已提交书面退车申请。收到后，我会更新投诉风险判断与调查建议。",
      visible: 62,
    }]);
  };

  const submitComplaintInput = (event: FormEvent) => {
    event.preventDefault();
    const value = complaintInput.trim();
    if (!value || !complaintInvestigationStarted) return;
    setComplaintInput("");
    setComplaintMessages((current) => [...current, { id: complaintNextId.current++, role: "user", body: value, visible: value.length }]);
    setComplaintAgentStates((current) => ({ ...current, retention: "running", warranty: "waiting" }));
    streamComplaintAssistant(`我已收到你的补充：“${value}”。\n\n我已将 FRD 保修开始日和当前里程加入待执行计划。它们会与购车日附近的维修工单、维修方案和代步车可用性一并核对；目前尚未发起数据查询。下面是更新后的计划，请确认后开始执行。`, {
      plan: updatedRetentionPlan,
      actions: ["按建议开始"],
      onDone: () => {
        setComplaintWarrantyRequested(true);
        setComplaintPlanAgentsVisible(true);
        setComplaintAgentStates((current) => ({ ...current, retention: "done", warranty: "waiting" }));
      },
    });
  };

  return (
    <main className="chat-app">
      <header className="chat-topbar">
        <Link className="chat-brand" href="/">AFS AI Workbench</Link>
        <nav className="top-mock-nav" aria-label={t("主菜单")}>
          <button type="button" className="selected" aria-current="page">{t("任务管理")}</button>
          <button type="button">{t("流程管理")}</button>
          <button type="button">{t("权限管理")}</button>
        </nav>
        <div className="chat-topbar-spacer" />
        <LanguageToggle />
        <ThemeToggle />
        <button className="chat-mobile-button" aria-expanded={drawer === "tasks"} aria-controls="workbench-tasks" onClick={() => setDrawer(drawer === "tasks" ? null : "tasks")} aria-label={t("打开任务列表")}><FlowArrow size={20} /></button>
        <button className="chat-icon-button" aria-label={t("通知")}><Bell size={21} /></button>
        <button className="chat-profile" aria-label={t("账户")}><UserCircle size={22} /></button>
      </header>

      <div className="chat-layout">
        <TaskSidebar
          stage={stage}
          taskView={taskView}
          approvals={approvals}
          onSelectTask={(task) => { if (task === "complaint-investigation") startComplaintInvestigationTask(); setTaskView(task); setDrawer(null); setGraphOpen(false); setSelectedNode(null); }}
          onCreateTask={() => {
            if (repairQueryTimer.current) clearTimeout(repairQueryTimer.current);
            setTaskView("repair-query");
            setRepairQueryInput("");
            setRepairQueryRequest(null);
            setRepairQueryVehicle("XXX");
            setRepairQueryStatus(null);
            setRepairQueryNeedsDetail(false);
            setDrawer(null);
            setGraphOpen(false);
            setSelectedNode(null);
          }}
          repairQueryStatus={repairQueryStatus}
          repairQueryRequest={repairQueryRequest}
          repairQueryVehicle={repairQueryVehicle}
          mockLabel={mockLabel}
          onMock={() => setDealerModal(stage === "waiting_repair" ? "repair" : "supplement")}
          drawer={drawer === "tasks"}
          onClose={() => setDrawer(null)}
        />

        <section className={`chat-main ${taskView === "repair-query" ? "adhoc" : ""}`} aria-label={t("任务对话工作区")}>
          {taskView !== "repair-query" && <ProcessTracker
            phase={taskView === "complaint-investigation" ? "intake" : phase}
            stage={taskView === "complaint-investigation" ? "classifying" : stage}
            taskView={taskView === "complaint-investigation" ? "main" : taskView}
            approvalCompleted={activeApprovalDone}
            progress={taskView === "complaint-investigation" ? 0 : progress}
            history={history}
            graphView={graphView}
            onViewHistory={setGraphView}
          />}
          {taskView === "main" ? <>
            <CustomerCard open={customerOpen} onToggle={() => setCustomerOpen((current) => !current)} ready={profileReady} />
            <div className="chat-thread" aria-live="polite" aria-busy={busy}>
            <div className="chat-thread-heading">
              <div><span><Sparkle size={17} weight="fill" /></span><div><b>{t("AI 协作对话")}</b></div></div>
              <button onClick={() => setDrawer("agents")} className="chat-mobile-button"><Robot size={18} /> Agents</button>
            </div>
            <div className="chat-messages">
              {messages.map((message) => <ChatMessage key={message.id} message={message} onAction={executeCommand} actionsDisabled={!canSend || message.id !== latestActionMessageId} />)}
              {waitingCustomerCareFeedback && <div className="a7-wait"><Clock size={20} /><div><strong>{t("等待 Customer Care 与客户线下沟通")}</strong><span>{t("沟通完成后，请在下方直接输入客户是否接受方案。")}</span></div></div>}
              {waitingExternal && <div className="external-wait"><Clock size={20} /><div><strong>{t("等待 Dealer 线下处理")}</strong><span>{t("请从左侧当前任务提交 CCO 回写。")}</span></div></div>}
              {waitingApproval && <div className="approval-wait"><Clock size={20} /><div><strong>{t("主任务已暂停")}</strong><span>{t("请完成左侧仍待处理的跨部门审批任务。")}</span></div></div>}
              <div ref={messageEnd} />
            </div>
            </div>
            <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-command">{t("业务指令")}</label>
            <div>
              <button className="file-upload-button" type="button" onClick={() => fileInput.current?.click()} aria-label={t("上传附件")}><Paperclip size={20} /></button>
              <input ref={fileInput} className="sr-only" type="file" tabIndex={-1} onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }} />
              <input
                id="chat-command"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t(waitingExternal ? "等待 CCO 回写后继续" : waitingApproval ? "等待审批任务完成" : stagePrompt(stage))}
                disabled={!canSend}
              />
              <button type="submit" disabled={!canSend || !input.trim()} aria-label={t("发送指令")}><PaperPlaneTilt size={20} weight="fill" /></button>
            </div>
            </form>
          </> : taskView === "complaint-investigation" ? <ComplaintInvestigationTask messages={complaintMessages} onAction={handleComplaintAction} input={complaintInput} onInput={setComplaintInput} onSubmit={submitComplaintInput} investigationStarted={complaintInvestigationStarted} customerOpen={customerOpen} onToggleCustomer={() => setCustomerOpen((current) => !current)} profileReady={profileReady} /> : taskView === "repair-query" ? <RepairQueryTask input={repairQueryInput} onInput={setRepairQueryInput} request={repairQueryRequest} vehicle={repairQueryVehicle} status={repairQueryStatus} needsDetail={repairQueryNeedsDetail} onSubmit={submitRepairQuery} /> : <ApprovalTask key={taskView} type={taskView} approved={activeApprovalDone} onApprove={approveActiveTask} onBack={() => setTaskView("main")} />}
        </section>

        <AgentWorkspace
          phase={taskView === "complaint-investigation" ? "intake" : displayPhase}
          currentPhase={taskView === "complaint-investigation" ? "intake" : phase}
          nodes={activeGraphNodes}
          readOnly={taskView === "complaint-investigation" ? false : readOnlyGraph}
          onExpand={() => { setSelectedNode(activeGraphNodes[0]?.id ?? null); setGraphOpen(true); }}
          drawer={drawer === "agents"}
          onClose={() => setDrawer(null)}
          stage={taskView === "complaint-investigation" ? "classifying" : stage}
          statuses={activeAgentStates}
          onOpenNode={(id) => { setSelectedNode(id); setGraphOpen(true); }}
        />
      </div>

      {graphOpen && <AgentGraphModal
        phase={taskView === "complaint-investigation" ? "intake" : displayPhase}
        title={taskView === "repair-query" ? "车辆维修记录查询" : taskView === "complaint-investigation" ? "Compliant Investigation" : processDefinitions[displayPhase].title}
        nodes={activeGraphNodes}
        selected={selected}
        readOnly={taskView === "complaint-investigation" ? false : readOnlyGraph}
        enabledExtras={taskView === "complaint-investigation" ? [] : enabledExtras[displayPhase]}
        onSelect={setSelectedNode}
        onToggleExtra={(id) => setEnabledExtras((current) => ({ ...current, [displayPhase]: current[displayPhase].includes(id) ? current[displayPhase].filter((item) => item !== id) : [...current[displayPhase], id] }))}
        onClose={() => setGraphOpen(false)}
        stage={taskView === "complaint-investigation" ? "classifying" : stage}
        statuses={activeAgentStates}
        instructionValue={selected ? agentInstructions[selected.id] ?? selected.instruction : ""}
        onInstructionChange={(value) => selected && setAgentInstructions((current) => ({ ...current, [selected.id]: value }))}
      />}
      {dealerModal && <DealerMockModal
        type={dealerModal}
        documentsComplete={documentsComplete}
        onDocumentsComplete={setDocumentsComplete}
        onClose={() => setDealerModal(null)}
        onSubmit={dealerModal === "repair" ? submitRepairMock : submitSupplementMock}
      />}
    </main>
  );
}

function TaskSidebar({ stage, taskView, approvals, onSelectTask, onCreateTask, repairQueryStatus, repairQueryRequest, repairQueryVehicle, mockLabel, onMock, drawer, onClose }: { stage: Stage; taskView: TaskView; approvals: { "repair-history": boolean; technical: boolean; mobility: boolean; warranty: boolean; legal: boolean; parts: boolean }; onSelectTask: (task: TaskView) => void; onCreateTask: () => void; repairQueryStatus: AgentStatus | null; repairQueryRequest: string | null; repairQueryVehicle: string; mockLabel: string | null; onMock: () => void; drawer: boolean; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const compactStatus = (status: string) => {
    if (["已完成", "已审批"].includes(status)) return locale === "en" ? "Done" : "完成";
    if (status === "已转出") return locale === "en" ? "Routed" : "转出";
    if (status === "处理中") return locale === "en" ? "Running" : "处理中";
    return locale === "en" ? "Waiting" : "等待";
  };
  const [showAll, setShowAll] = useState(false);
  const [createdTasks, setCreatedTasks] = useState<{ id: string; title: string; status: string }[]>([]);
  const isStarted = !["classifying", "ready_create", "ready_retention"].includes(stage);
  const isFinished = ["complete", "blocked"].includes(stage);
  const currentStatus = !isStarted ? "待处理" : stage === "complete" ? "已完成" : stage === "blocked" ? "已转出" : stage === "waiting_investigation_approvals" ? "等待审批" : stage === "waiting_customer" ? "等待 Customer Care" : stage.startsWith("waiting") ? "等待外部" : "处理中";
  const currentTitle = stage === "classifying" || stage === "ready_create" ? "AI 识别高风险投诉｜廖女士" : stage === "ready_retention" ? "高风险投诉待启动挽留｜廖女士" : ["ready_investigation", "running_investigation"].includes(stage) ? "高风险投诉调查中｜廖女士" : stage === "waiting_investigation_approvals" ? "高风险投诉等待跨部门审批｜廖女士" : stage === "waiting_customer" ? "维修挽留等待 Customer Care 反馈｜廖女士" : stage === "waiting_repair" ? "客户已接受，等待 Dealer 上传材料｜廖女士" : phaseForStage(stage) === "claim" ? "CCA 案件审批｜廖女士｜CCA-2026-0068" : "高风险投诉案件｜廖女士";
  const approvalTasks: { id: TaskView; title: string }[] = [];
  if (stage === "waiting_investigation_approvals" && !approvals["repair-history"]) approvalTasks.push({ id: "repair-history", title: "Repair History Data Agent 请求业务审批｜4/4 维修记录" });
  if (stage === "waiting_investigation_approvals" && !approvals.technical) approvalTasks.push({ id: "technical", title: "Technical Service Data Agent 请求业务审批｜4/7 维修方案" });
  if (stage === "waiting_investigation_approvals" && !approvals.mobility) approvalTasks.push({ id: "mobility", title: "Mobility Data Agent 请求业务审批｜代步车可用性" });
  if (stage === "waiting_investigation_approvals" && !approvals.warranty) approvalTasks.push({ id: "warranty", title: "Warranty Data Agent 请求业务审批｜FRD 与里程" });
  const completedApprovalTasks = [
    approvals["repair-history"] ? { id: "repair-history" as TaskView, title: "Repair History 已确认｜维修记录" } : null,
    approvals.technical ? { id: "technical" as TaskView, title: "Technical Service 已确认｜维修方案" } : null,
    approvals.mobility ? { id: "mobility" as TaskView, title: "Mobility 已确认｜代步车安排" } : null,
    approvals.warranty ? { id: "warranty" as TaskView, title: "Warranty 已确认｜FRD 与里程" } : null,
  ].filter((task): task is { id: TaskView; title: string } => task !== null);
  const visiblePending = showAll ? [...createdTasks, ...pendingTaskItems] : [...createdTasks, ...pendingTaskItems].slice(0, 4);
  const visibleCompleted = showAll ? completedTaskItems : completedTaskItems.slice(0, 2);
  const totalTasks = 2 + pendingTaskItems.length + completedTaskItems.length + approvalTasks.length + completedApprovalTasks.length + createdTasks.length;
  const createTask = () => {
    setCreatedTasks((current) => current.length ? current : [{ id: "repair-query", title: "新建任务", status: "待处理" }]);
    onCreateTask();
  };
  const demoTask = <button className={`task-list-item primary risk-task ${taskView === "main" ? "active" : ""}`} onClick={() => onSelectTask("main")}><WarningCircle size={18} weight="fill" /><span title={t(currentTitle)}>{t(currentTitle)}</span><b title={t(currentStatus)}>{compactStatus(currentStatus)}</b></button>;
  const investigationTask = <button className={`task-list-item primary risk-task ${taskView === "complaint-investigation" ? "active" : ""}`} onClick={() => onSelectTask("complaint-investigation")}><WarningCircle size={18} weight="fill" /><span title={t("高风险投诉调查｜廖女士")}>{t("高风险投诉调查｜廖女士")}</span><b title={t("待处理")}>{compactStatus("待处理")}</b></button>;
  return <aside id="workbench-tasks" className={`task-sidebar ${drawer ? "drawer-open" : ""}`} aria-label={t("任务列表")}>
    <header><div><span>{t("任务中心")}</span><strong>{totalTasks}{t(" 个任务")}</strong></div><button className="drawer-close" onClick={onClose} aria-label={t("关闭任务列表")}><X size={20} /></button></header>
    <button className="new-task-button" onClick={createTask}><Plus size={17} />{t("新建任务")}</button>
    {isStarted && !isFinished && <><div className="task-section-label">{t("进行中")}</div>{demoTask}{mockLabel && <button className="mock-task-button" onClick={onMock}>{t(mockLabel)}<ArrowRight size={16} /></button>}</>}
    <div className="task-section-label">{t("待处理")}</div>
    {investigationTask}
    {!isStarted && demoTask}
    {approvalTasks.map((task) => <button className={`task-list-item approval ${taskView === task.id ? "active" : ""}`} key={task.id} onClick={() => onSelectTask(task.id)}><span title={t(task.title)}>{t(task.title)}</span><b title={t("需审批")}>{compactStatus("需审批")}</b></button>)}
    {visiblePending.map((task) => <button className={`task-list-item ${task.id === "repair-query" && taskView === "repair-query" ? "active" : ""}`} key={task.id} onClick={() => task.id === "repair-query" && onSelectTask("repair-query")}><span title={task.id === "repair-query" && repairQueryRequest ? `${t("车辆维修记录查询")} | ${repairQueryVehicle}` : t(task.title)}>{task.id === "repair-query" && repairQueryRequest ? `${t("车辆维修记录查询")} | ${repairQueryVehicle}` : t(task.title)}</span><b>{compactStatus(task.id === "repair-query" ? repairQueryStatus === "done" ? "已完成" : repairQueryStatus === "running" ? "处理中" : task.status : task.status)}</b></button>)}
    <div className="task-section-label">{t("已完成")}</div>
    {isFinished && demoTask}
    {completedApprovalTasks.map((task) => <button className={`task-list-item muted ${taskView === task.id ? "active" : ""}`} key={task.id} onClick={() => onSelectTask(task.id)}><span title={t(task.title)}>{t(task.title)}</span><b title={t("已审批")}>{compactStatus("已审批")}</b></button>)}
    {visibleCompleted.map((task) => <button className="task-list-item muted" key={task.id}><span title={t(task.title)}>{t(task.title)}</span><b title={t(task.status)}>{compactStatus(task.status)}</b></button>)}
    <button className="show-all-tasks" onClick={() => setShowAll((current) => !current)}>{showAll ? t("收起任务列表") : `${t("展开完整列表")} (${totalTasks})`}<CaretDown size={15} /></button>
  </aside>;
}

function ComplaintInvestigationTask({ messages, onAction, input, onInput, onSubmit, investigationStarted, customerOpen, onToggleCustomer, profileReady }: { messages: Message[]; onAction: (value: string) => void; input: string; onInput: (value: string) => void; onSubmit: (event: FormEvent) => void; investigationStarted: boolean; customerOpen: boolean; onToggleCustomer: () => void; profileReady: boolean }) {
  const { t } = useLanguage();
  const latestActionMessageId = [...messages].reverse().find((message) => message.actions?.length)?.id;
  return <>
    <CustomerCard open={customerOpen} onToggle={onToggleCustomer} ready={profileReady} />
    <div className="chat-thread" aria-live="polite">
      <div className="chat-thread-heading"><div><span><Sparkle size={17} weight="fill" /></span><div><b>{t("AI 协作对话")}</b></div></div></div>
      <div className="chat-messages">
        {messages.map((message) => <ChatMessage key={message.id} message={message} onAction={onAction} actionsDisabled={message.id !== latestActionMessageId} />)}
      </div>
    </div>
    <form className="chat-composer complaint-investigation-composer" onSubmit={onSubmit} aria-busy={!investigationStarted}>
      <label className="sr-only" htmlFor="complaint-investigation-command">{t("补充调查信息")}</label>
      <div><input id="complaint-investigation-command" value={input} onChange={(event) => onInput(event.target.value)} disabled={!investigationStarted} placeholder={investigationStarted ? "例如：FRD 保修开始日为 2026-04-03，Mileage 为 91 km" : "Start investigation 后可补充 FRD 和 Mileage"} /><button type="submit" disabled={!investigationStarted || !input.trim()} aria-label={t("发送指令")}><PaperPlaneTilt size={20} weight="fill" /></button></div>
    </form>
  </>;
}

function RepairQueryTask({ input, onInput, request, vehicle, status, needsDetail, onSubmit }: { input: string; onInput: (value: string) => void; request: string | null; vehicle: string; status: AgentStatus | null; needsDetail: boolean; onSubmit: (event: FormEvent) => void }) {
  const { t } = useLanguage();
  return <>
    <div className="chat-thread adhoc-thread" aria-live="polite" aria-busy={status === "running"}>
      <div className="chat-thread-heading"><div><span><Sparkle size={17} weight="fill" /></span><div><b>{t("AI 协作对话")}</b></div></div></div>
      <div className="chat-messages">
        {!request && <div className="adhoc-empty"><Database size={30} /><strong>{t("描述你的任务")}</strong><span>{t("系统会理解你的自然语言，并在需要时动态添加合适的 Agent。")}</span></div>}
        {request && <article className="chat-message user"><div><p>{request}</p></div></article>}
        {needsDetail && <article className="chat-message assistant"><span className="message-avatar"><Robot size={36} /></span><div><p>{t("请提供车辆标识，并明确需要查询维修记录。")}</p></div></article>}
        {status && <article className="chat-message assistant"><span className="message-avatar"><Robot size={36} /></span><div>
          <p>{status === "running" ? t("我识别到这是车辆维修历史查询。已根据你的需求动态加入 Repair History Data Agent，正在查询全部维修工单。") : t(`Repair History Data Agent 已完成查询。我按时间顺序整理了 ${vehicle} 的全部维修记录，共 ${mockRepairRecords.length} 条。`)}</p>
          {status === "running" && <span className="agent-inline-running">{t("正在查询")}<i /><i /><i /></span>}
          {status === "done" && <RepairHistoryTable records={mockRepairRecords} />}
        </div></article>}
      </div>
    </div>
    <form className="chat-composer adhoc-composer" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="repair-query-command">{t("业务指令")}</label>
      <div><input id="repair-query-command" value={input} onChange={(event) => onInput(event.target.value)} disabled={status === "running"} placeholder={t("例如：帮我查询 XXX 车的所有维修记录")} /><button type="submit" disabled={!input.trim() || status === "running"} aria-label={t("发送指令")}><PaperPlaneTilt size={20} weight="fill" /></button></div>
    </form>
  </>;
}

function RepairHistoryTable({ records }: { records: RepairRecord[] }) {
  const { t } = useLanguage();
  return <div className="repair-history-table"><table><thead><tr><th>{t("日期")}</th><th>{t("经销商")}</th><th>{t("里程")}</th><th>{t("类型")}</th><th>{t("维修记录")}</th><th>{t("状态")}</th></tr></thead><tbody>
    {records.map((record) => <tr key={`${record.date}-${record.type}`}><td>{record.date}</td><td>{t(record.dealer)}</td><td>{record.mileage}</td><td>{t(record.type)}</td><td>{t(record.details)}</td><td>{t(record.status)}</td></tr>)}
  </tbody></table></div>;
}

function ApprovalTask({ type, approved, onApprove, onBack }: { type: ApprovalTaskView; approved: boolean; onApprove: () => void; onBack: () => void }) {
  const { t } = useLanguage();
  const approvalContent: Record<ApprovalTaskView, { role: string; reason: string; result: string }> = {
    "repair-history": { role: "Repair History", reason: "客户在购车当日提出发动机抖动投诉，需要查询购车日附近的维修记录，核实客户描述是否与经销商记录一致。", result: "4 月 4 日有进店记录，检测发现二缸点火线圈工作不良，导致缺火抖动。" },
    technical: { role: "Technical Service", reason: "客户挽留方案需要以已登记的修复安排为基础，因此查询当前技术维修方案。", result: "4 月 7 日技术反馈为更换所有点火线圈（6 个）。" },
    mobility: { role: "Mobility", reason: "维修期间的出行支持会影响客户是否接受挽留方案，因此查询经销商的代步车可用性。", result: "未来一周有一辆 5 系代步车可以使用。" },
    warranty: { role: "Warranty", reason: "该查询由业务人员补充，用于核实车辆的新车状态，并为当前案件提供车辆状态依据。", result: "FRD 保修开始日为 2026 年 4 月 3 日，当前里程为 91 km。" },
    legal: { role: "Legal", reason: "等待业务部门确认。", result: "本次核验结果已返回。" },
    parts: { role: "Parts", reason: "等待业务部门确认。", result: "本次核验结果已返回。" },
  };
  const { role, reason, result } = approvalContent[type];
  const [reply, setReply] = useState("");
  const [submittedReply, setSubmittedReply] = useState("");
  const approvalFileInput = useRef<HTMLInputElement>(null);
  const approveWith = (value: string) => {
    if (approved) return;
    setSubmittedReply(value);
    setReply("");
    onApprove();
  };
  const submitApproval = (event: FormEvent) => {
    event.preventDefault();
    const value = reply.trim();
    if (!value || approved) return;
    approveWith(value);
  };
  return <section className="approval-task" aria-labelledby="approval-task-title">
    <header>
      <button onClick={onBack}>{t("返回主任务")}</button>
      <div><span>{role.toUpperCase()} APPROVAL</span><h2 id="approval-task-title">{t("高风险投诉案件")} · {t("审批")} {role}</h2></div>
    </header>
    <div className="approval-customer"><UserCircle size={22} /><strong>{t("廖女士 · BMW X5")}</strong><span>VIN LBV41EP0…J47787</span><span>91 km</span></div>
    <div className="approval-conversation">
    <article className="approval-recommendation chat-style">
      <div className="approval-ai-icon"><Robot size={48} /></div>
      <div>
        <div className="approval-basic-table"><table><tbody><tr><th>{t("客户")}</th><td>{t("廖女士")}</td><th>{t("车型")}</th><td>BMW X5</td></tr><tr><th>VIN</th><td>LBV41EP0…J47787</td><th>{t("当前里程")}</th><td>91 km</td></tr></tbody></table></div>
        <p>{t("查询原因")}：{t(reason)}</p>
        <p>{t("查询结果")}：{t(result)}</p>
      </div>
    </article>
    {!approved && <nav className="message-actions approval-message-actions" aria-label={`${role} ${t("审批")}`}><button onClick={() => approveWith(`我确认 ${role} 的数据，可以继续`)}>{t("确认数据并继续")}</button><button onClick={() => setReply(t("请补充说明证据来源"))}>{t("要求补充证据")}</button></nav>}
    {submittedReply && <article className="approval-user-reply"><UserCircle size={22} /><p>{t(submittedReply)}</p></article>}
    {approved && <article className="approval-confirmed"><Robot size={44} /><p>{t("收到，我已经记录你的审批意见。请继续完成左侧其余 Agent 结果的审批。")}</p></article>}
    </div>
    <form className="approval-chat-composer" onSubmit={submitApproval}>
      <label className="sr-only" htmlFor={`approval-reply-${type}`}>{t("审批意见")}</label>
      <div><button className="file-upload-button" type="button" onClick={() => approvalFileInput.current?.click()} disabled={approved} aria-label={t("上传审批附件")}><Paperclip size={20} /></button><input ref={approvalFileInput} className="sr-only" type="file" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) setReply(`${t("已附加")} ${file.name}`); event.target.value = ""; }} /><input id={`approval-reply-${type}`} value={reply} onChange={(event) => setReply(event.target.value)} disabled={approved} placeholder={approved ? t("审批意见已记录") : `${t("例如")}：${t("我确认")} ${role} ${t("的数据，可以继续")}`} /><button type="submit" disabled={approved || !reply.trim()} aria-label={`${t("发送")} ${role} ${t("审批意见")}`}><PaperPlaneTilt size={19} weight="fill" /></button></div>
    </form>
  </section>;
}

function ProcessTracker({ phase, stage, taskView, approvalCompleted, progress, history, graphView, onViewHistory }: { phase: Phase; stage: Stage; taskView: TaskView; approvalCompleted: boolean; progress: number; history: Phase[]; graphView: Phase | null; onViewHistory: (phase: Phase | null) => void }) {
  const { t } = useLanguage();
  if (taskView !== "main") {
    const role = taskView === "repair-history" ? "Repair History" : taskView === "technical" ? "Technical Service" : taskView === "mobility" ? "Mobility" : taskView === "warranty" ? "Warranty" : taskView === "legal" ? "Legal" : "Parts";
    return <section className="process-tracker approval-process" aria-label={t("审批流程进度")}>
      <header><div><span>{t("当前审批任务")}</span><strong>{t("高风险投诉案件")} · {t("审批")} {role}</strong></div></header>
      <ol><li className="done"><span><Check size={15} weight="bold" /></span><b>{t("高风险投诉案件")}</b><i /></li><li className={approvalCompleted ? "done" : "active waiting"}><span>{approvalCompleted ? <Check size={15} weight="bold" /> : 2}</span><b>{approvalCompleted ? `${role} ${t("已确认")}` : `${t("审批")} ${role}`}</b></li></ol>
    </section>;
  }
  const definition = processDefinitions[phase];
  return <section className="process-tracker" aria-label={t("当前流程进度")}>
    <header>
      <div><span>{t("当前 Process")}</span><strong>{t(definition.title)}</strong></div>
      <div className="process-history">
        {history.map((item) => <button key={item} className={graphView === item ? "selected" : ""} onClick={() => onViewHistory(graphView === item ? null : item)}><Check size={12} />{t(processDefinitions[item].short)}</button>)}
      </div>
    </header>
    <ol>
      {definition.steps.map((step, index) => {
        const done = progress > index;
        const active = progress === index;
        const waiting = active && stage.startsWith("waiting");
        const blocked = active && stage === "blocked";
        return <li key={step} className={`${done ? "done" : ""} ${active ? "active" : ""} ${waiting ? "waiting" : ""} ${blocked ? "blocked" : ""}`}>
          <span>{done ? <Check size={15} weight="bold" /> : index + 1}</span><b>{t(step)}</b>{index < definition.steps.length - 1 && <i />}
        </li>;
      })}
    </ol>
  </section>;
}

function CustomerCard({ open, onToggle, ready }: { open: boolean; onToggle: () => void; ready: boolean }) {
  const { t } = useLanguage();
  return <section className={`customer-card ${open ? "open" : ""}`}>
    <button onClick={onToggle} aria-expanded={open}>
      <span className="customer-avatar"><UserCircle size={24} weight="fill" /></span>
      <span><small>{t("客户信息")}</small><strong>{t(ready ? "廖女士 · BMW X5" : "正在识别客户信息…")}</strong></span>
      <CaretDown size={18} />
    </button>
    {open && <dl>
      <div><dt>{t("联系电话")}</dt><dd>{ready ? "138 **** 6821" : t("识别中")}</dd></div>
      <div><dt>VIN</dt><dd>{ready ? "LBV41EP0…J47787" : t("识别中")}</dd></div>
      <div><dt>{t("经销商")}</dt><dd>{ready ? t("珠海锦泰宝汇") : t("识别中")}</dd></div>
    </dl>}
  </section>;
}

function ChatMessage({ message, onAction, actionsDisabled }: { message: Message; onAction: (value: string) => void; actionsDisabled: boolean }) {
  const { t } = useLanguage();
  const localizedBody = t(message.body);
  const visibleBody = message.streaming ? localizedBody.slice(0, Math.ceil((message.visible / Math.max(message.body.length, 1)) * localizedBody.length)) : localizedBody;
  return <article className={`chat-message ${message.role} ${message.tone ?? ""}`}>
    {message.role === "assistant" && <span className="message-avatar"><Robot size={36} /></span>}
    <div>
      {message.role !== "assistant" && message.title && <h3>{t(message.title)}</h3>}
      {message.lead && <strong className="message-lead">{t(message.lead)}</strong>}
      <p>{visibleBody}{message.streaming && <i className="stream-cursor" />}</p>
      {!message.streaming && message.plan && <div className="ai-plan-table"><table><thead><tr><th>{t("目标")}</th><th>{t("执行动作")}</th><th>{t("预期产出")}</th></tr></thead><tbody>{message.plan.map((row) => <tr key={row.purpose}><td>{t(row.purpose)}</td><td>{t(row.action)}</td><td>{t(row.expected)}</td></tr>)}</tbody></table></div>}
      {!message.streaming && message.bullets && <ul>{message.bullets.map((item) => <li key={item}>{t(item)}</li>)}</ul>}
      {!message.streaming && message.notes && <div className="ai-notes">{message.notes.map((note) => <p key={`${note.label}-${note.text}`}>{t(note.text)}</p>)}</div>}
      {!message.streaming && message.card && <p className="ai-result">{t(message.card.label)}: {t(message.card.value)}{message.card.meta && ` (${t(message.card.meta)})`}</p>}
      {message.tone === "risk" && message.showRecording !== false && <CallRecording />}
    </div>
    {!message.streaming && message.actions?.length && <nav className="message-actions" aria-label={t("AI 建议操作")}>{message.actions.map((action) => <button key={action} disabled={actionsDisabled} onClick={() => onAction(action)}>{t(action)}</button>)}</nav>}
  </article>;
}

function CallRecording() {
  const { t } = useLanguage();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(0);
  const duration = 24;
  const localizedTranscript = t(callTranscript);
  const elapsed = Math.min(duration, Math.round((visible / callTranscript.length) * duration));
  const localizedVisible = Math.ceil((visible / callTranscript.length) * localizedTranscript.length);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setVisible((current) => {
        const next = Math.min(callTranscript.length, current + 2);
        if (next >= callTranscript.length) setPlaying(false);
        return next;
      });
    }, 110);
    return () => clearInterval(timer);
  }, [playing]);

  const toggle = () => {
    if (!started) {
      setStarted(true);
      setVisible(0);
      setPlaying(true);
      return;
    }
    if (visible >= callTranscript.length) setVisible(0);
    setPlaying((current) => !current);
  };

  return <section className={`call-recording ${playing ? "playing" : ""}`} aria-label={t("客户与 ST 的原始通话录音")}>
    <button type="button" onClick={toggle} aria-label={t(playing ? "暂停原始录音" : "播放原始录音")}>{playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}</button>
    <div className="recording-track">
      <div className="recording-meta"><span><SpeakerHigh size={14} />{t("客户与 ST 原始录音")}</span><time>{`0:${String(elapsed).padStart(2, "0")} / 0:${duration}`}</time></div>
      <div className="recording-wave" aria-hidden="true">{Array.from({ length: 24 }).map((_, index) => <i key={index} style={{ height: `${6 + ((index * 7) % 15)}px` }} />)}</div>
      <div className="recording-progress"><i style={{ width: `${(visible / callTranscript.length) * 100}%` }} /></div>
    </div>
    {started && <div className="recording-transcript"><b>{t("录音转写")}</b><p>{localizedTranscript.slice(0, localizedVisible)}{playing && <i className="stream-cursor" />}</p></div>}
  </section>;
}

function AgentWorkspace({ phase, currentPhase, nodes, readOnly, onExpand, onOpenNode, drawer, onClose, stage, statuses }: { phase: Phase; currentPhase: Phase; nodes: AgentNode[]; readOnly: boolean; onExpand: () => void; onOpenNode: (id: string) => void; drawer: boolean; onClose: () => void; stage: Stage; statuses: Record<string, AgentStatus> }) {
  const { t } = useLanguage();
  return <aside className={`agent-workspace ${drawer ? "drawer-open" : ""}`} aria-label={t("AI Agent编排器")}>
    <header><div><strong>{t("AI Agent编排器")}</strong>{readOnly && <span>{t("历史记录")} · {t("只读")}</span>}</div><button className="drawer-close" onClick={onClose} aria-label={t("关闭 Agent 区")}><X size={20} /></button></header>
    <button className="agent-mini-map" onClick={onExpand} aria-label={t("展开 Agent 编排")}>
      <MiniGraph nodes={nodes} stage={stage} active={phase === currentPhase} statuses={statuses} />
      <span><CornersOut size={16} />{t("展开编排")}</span>
    </button>
    <AgentCallList phase={phase} nodes={nodes} statuses={statuses} onSelect={onOpenNode} compact />
    <div className="agent-list-heading"><span>Agents</span><b>{nodes.filter((node) => node.kind === "agent").length}</b></div>
    <div className="agent-list">
      {nodes.filter((node) => node.kind === "agent").map((node, index) => {
        const status = agentStatus(index, stage, statuses, node.id);
        return <button className={`agent-result-button ${status}`} key={node.id} onClick={() => onOpenNode(node.id)} aria-busy={status === "running"}>
          <span className={`agent-status ${status}`}><Robot size={17} /></span>
          <div><strong>{node.name}</strong><small>{node.type}</small></div>
          <b>{status === "running" ? <span className="agent-running-copy">{t("执行中")}<i /><i /><i /></span> : t(statusLabel(status))}<CaretRight size={13} /></b>
        </button>;
      })}
    </div>
    <button className="agent-add" onClick={onExpand}><Plus size={17} />{t("调整编排")}</button>
  </aside>;
}

function agentStatus(index: number, stage: Stage, statuses?: Record<string, AgentStatus>, nodeId?: string): AgentStatus {
  if (nodeId) return statuses?.[nodeId] ?? "waiting";
  if (["classifying", "ready_investigation", "ready_claim"].includes(stage)) return index === 0 ? "running" : "waiting";
  if (["ready_solution", "ready_approval", "waiting_supplement"].includes(stage)) return index <= 1 ? "done" : index === 2 ? "running" : "done";
  if (["waiting_customer", "waiting_repair", "complete", "blocked", "ready_retention", "ready_create"].includes(stage)) return "done";
  return "waiting";
}

function statusLabel(status: AgentStatus) {
  return status === "done" ? "完成" : status === "running" ? "运行中" : "等待";
}

function callStatusLabel(status: AgentStatus) {
  return status === "done" ? "已返回" : status === "running" ? "调用中" : "待调用";
}

function AgentCallList({ phase, nodes, statuses, onSelect, compact = false }: { phase: Phase; nodes: AgentNode[]; statuses: Record<string, AgentStatus>; onSelect: (id: string) => void; compact?: boolean }) {
  const { t } = useLanguage();
  const calls = getAgentCalls(phase, nodes).filter((call) => call.protocol === "MCP" || call.protocol === "A2A");
  if (!calls.length) return null;
  const dataCalls = calls.filter((call) => call.protocol === "MCP");
  const visible = compact ? calls.filter((call) => call.protocol === "A2A") : calls;
  return <section className={`agent-call-list ${compact ? "compact" : ""}`} aria-label={t("Agent 调用关系")}>
    <header>{t("调用链路")}</header>
    {compact && dataCalls.length > 0 && <button onClick={() => onSelect(dataCalls.find((call) => getCallStatus(call, statuses) === "running")?.target ?? dataCalls[0].target)}><b className="protocol-badge mcp">MCP</b><span>Retention Process → Data Agents<small>{dataCalls.filter((call) => getCallStatus(call, statuses) === "done").length}/{dataCalls.length} {t("已返回")} · {dataCalls.filter((call) => getCallStatus(call, statuses) === "running").length} {t("调用中")}</small></span></button>}
    {visible.map((call) => <button key={call.id} onClick={() => onSelect(call.target)}><b className={`protocol-badge ${call.protocol.toLowerCase()}`}>{call.protocol}</b><span>{call.sourceName} → {call.targetName}<small>{t(callStatusLabel(getCallStatus(call, statuses)))}</small></span></button>)}
  </section>;
}

function MiniGraph({ nodes, stage, active, statuses }: { nodes: AgentNode[]; stage: Stage; active: boolean; statuses: Record<string, AgentStatus> }) {
  const visible = nodes.filter((node) => node.kind === "agent");
  return <div className="mini-graph" aria-hidden="true" data-current={active}>
    <div className="mini-root"><FlowArrow size={17} /></div>
    <i />
    <div className="mini-nodes">{visible.map((node, index) => <span key={node.id} className={agentStatus(index, stage, statuses, node.id)}><Robot size={14} /><b>{node.type.replace(" Agent", "")}</b></span>)}</div>
  </div>;
}

// Keep modal keyboard navigation inside the active task and restore its origin.
function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
    (focusable()[0] ?? dialog).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", handleKey);
    return () => { dialog.removeEventListener("keydown", handleKey); if (origin?.isConnected) origin.focus(); };
  }, []);
  return ref;
}

function AgentGraphModal({ phase, title, nodes, selected, readOnly, enabledExtras, onSelect, onToggleExtra, onClose, stage, statuses, instructionValue, onInstructionChange }: { phase: Phase; title: string; nodes: AgentNode[]; selected?: AgentNode; readOnly: boolean; enabledExtras: string[]; onSelect: (id: string) => void; onToggleExtra: (id: string) => void; onClose: () => void; stage: Stage; statuses: Record<string, AgentStatus>; instructionValue: string; onInstructionChange: (value: string) => void }) {
  const { t } = useLanguage();
  const dialogRef = useDialogFocus(onClose);
  const calls = getAgentCalls(phase, nodes);
  const selectedStatus = selected ? statuses[selected.id] ?? "waiting" : "waiting";
  const graph = layoutOrchestration(phase, nodes, calls);
  const execution = selected ? nodeExecution(selected, selectedStatus, stage) : null;
  const connectedCalls = selected ? calls.filter((call) => call.target === selected.id || call.source === selected.id) : [];
  return <div className="chat-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="agent-modal" role="dialog" aria-modal="true" aria-labelledby="agent-modal-title">
      <header><div><span>{readOnly ? `${t("历史记录")} · ${t("只读")}` : t("AI Agent编排器")}</span><h2 id="agent-modal-title">{t(title)}</h2></div><button onClick={onClose} aria-label={t("关闭 Agent 编排")}><X size={22} /></button></header>
      <div className="agent-modal-layout">
        <div className="orchestration-workspace">
          <div className="orchestration-toolbar">
            <span><FlowArrow size={18} />{t("调用关系")} <small>{nodes.length} {t("个节点")}</small></span>
            <details className="orchestration-resources"><summary>{t("系统与数据源")}</summary>
              <div>{graphExtras[phase].map((node) => <button key={node.id} disabled={readOnly} onClick={() => onToggleExtra(node.id)} aria-pressed={enabledExtras.includes(node.id)}>
                <Database size={18} /><span>{node.name}</span>{enabledExtras.includes(node.id) ? <Check size={16} /> : <Plus size={16} />}
              </button>)}</div>
            </details>
          </div>
          {/* Keyboard focus lets users scroll the diagram without a pointer. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="orchestration-scroll" tabIndex={0} role="region" aria-label={t("编排画布，可滚动查看")}>
            <div className="orchestration-canvas" style={{ width: graph.width, height: graph.height }}>
              <svg width={graph.width} height={graph.height} viewBox={`0 0 ${graph.width} ${graph.height}`} aria-hidden="true">
                <defs><marker id="call-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" /></marker></defs>
                {graph.edges.map((call) => <path key={call.id} className={`call-edge ${call.protocol.toLowerCase()} ${getCallStatus(call, statuses)} ${selected && (call.source === selected.id || call.target === selected.id) ? "highlighted" : ""}`} d={call.route.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ")} markerEnd="url(#call-arrow)" />)}
              </svg>
              {graph.edges.map((call) => <button key={call.id} className="orchestration-edge-label" style={{ left: call.label[0], top: call.label[1] }} onClick={() => onSelect(call.target)} aria-label={`${call.sourceName} → ${call.targetName} · ${call.protocol} · ${t(callStatusLabel(getCallStatus(call, statuses)))}`}>{t(call.protocol)}</button>)}
              {graph.nodes.map((node) => <button key={node.id} onClick={() => onSelect(node.id)} aria-pressed={selected?.id === node.id}
                className={`orchestration-node ${selected?.id === node.id ? "selected" : ""} ${statuses[node.id] ?? "waiting"}`}
                style={{ left: node.x - node.width / 2, top: node.y - node.height / 2, width: node.width, height: node.height }}>
                <span className="orchestration-node-icon">{node.kind === "agent" ? <Robot size={19} /> : <Database size={19} />}</span>
                <strong>{node.name}</strong>
                <small>{node.kind !== "agent" ? t("数据连接") : t(statusLabel(statuses[node.id] ?? "waiting"))}</small>
              </button>)}
            </div>
          </div>
          <div className="orchestration-legend"><span>{t("箭头表示调用方向")}</span><span>MCP · {t("数据查询")} · A2A · {t("流程委派")}</span></div>
        </div>
        <aside className="node-inspector execution-inspector" aria-label={t("节点详情")}>
          {selected && <>
            <header><span>{t("节点详情")}</span><b className={`execution-status ${selectedStatus}`}>{t(selected.kind !== "agent" ? "数据连接" : statusLabel(selectedStatus))}</b></header>
            <div className="inspector-icon">{selected.kind === "agent" ? <Robot size={24} /> : <Database size={24} />}</div>
            <h3>{selected.name}</h3><p className="execution-type">{selected.type}</p>
            <section className="execution-plan"><h4>{t("执行计划")}</h4>
              {selectedStatus === "waiting" && !readOnly ? <textarea aria-label={`${t("编辑执行计划")} ${selected.name}`} value={t(instructionValue)} onChange={(event) => onInstructionChange(event.target.value)} /> : <p>{t(instructionValue)}</p>}
              <small>{t("参考来源")} · {t(selected.evidence)}</small>
            </section>
            {execution && execution.events.length > 0 && <section className="execution-record" aria-live="polite">
              <h4>{t("执行过程")}</h4>
              <ol>{execution.events.map((event, index) => <li key={index} className={event.state}><span>{event.state === "done" ? <Check size={14} /> : <Clock size={14} />}</span>{t(event.label)}</li>)}</ol>
              {execution.result && <div className="execution-result"><h4>{t("执行结果")}</h4><p>{t(execution.result)}</p></div>}
            </section>}
            {connectedCalls.length > 0 && <details className="execution-connections" key={selected.id}><summary>{t("查看调用关系")} · {connectedCalls.length}</summary>
              {connectedCalls.map((call) => <div key={call.id}><b>{call.sourceName} → {call.targetName}</b><small>{t(call.protocol)} · {t(callStatusLabel(getCallStatus(call, statuses)))}</small><p>{t(call.command)}</p><p>{t(call.input)}</p></div>)}
            </details>}
          </>}
        </aside>
      </div>
      <footer><span>{t("点击节点查看计划与执行记录")}</span><button onClick={onClose}>{t(readOnly ? "返回当前流程" : "完成")}</button></footer>
    </section>
  </div>;
}

function DealerMockModal({ type, documentsComplete, onDocumentsComplete, onClose, onSubmit }: { type: "repair" | "supplement"; documentsComplete: boolean; onDocumentsComplete: (value: boolean) => void; onClose: () => void; onSubmit: () => void }) {
  const { t } = useLanguage();
  const dialogRef = useDialogFocus(onClose);
  const title = type === "repair" ? "维修与 CLAIM 回写" : "Dealer 补件回写";
  return <div className="chat-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="dealer-modal" role="dialog" aria-modal="true" aria-labelledby="dealer-modal-title">
      <header><div><span>CCO</span><h2 id="dealer-modal-title">{t(title)}</h2></div><button onClick={onClose} aria-label={t("关闭 CCO 回写")}><X size={22} /></button></header>
      {type === "repair" && <><div className="mock-receipt"><Wrench size={22} /><div><strong>{t("车辆维修与一年延保已完成")}</strong><span>{t("Dealer 将维修单和 CLAIM 文件回写 CCO。")}</span></div></div><fieldset><legend>{t("资料状态")}</legend><label className={documentsComplete ? "selected" : ""}><input type="radio" checked={documentsComplete} onChange={() => onDocumentsComplete(true)} /><span><FileText size={20} /><b>{t("资料完整")}</b><small>{t("进入正常审批")}</small></span></label><label className={!documentsComplete ? "selected" : ""}><input type="radio" checked={!documentsComplete} onChange={() => onDocumentsComplete(false)} /><span><WarningCircle size={20} /><b>{t("缺少授权签字")}</b><small>{t("需要补充资料")}</small></span></label></fieldset></>}
      {type === "supplement" && <div className="mock-receipt"><FileText size={22} /><div><strong>{t("客户授权文件已补充")}</strong><span>{t("提交后将重新触发 OCR 审核。")}</span></div></div>}
      <footer><button onClick={onClose}>{t("取消")}</button><button onClick={onSubmit}>{t("提交 CCO 回写")}</button></footer>
    </section>
  </div>;
}

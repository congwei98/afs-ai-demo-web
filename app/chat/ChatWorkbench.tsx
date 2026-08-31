"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
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
type TaskView = "main" | "technical" | "legal" | "parts";
type AgentKind = "agent" | "system" | "source";
type MessageRole = "assistant" | "user" | "system";
type MessageCard = { label: string; value: string; meta?: string };
type MessageNote = { label: string; text: string; tone?: "evidence" | "decision" | "next" };
type Message = {
  id: number;
  role: MessageRole;
  title?: string;
  body: string;
  bullets?: string[];
  notes?: MessageNote[];
  card?: MessageCard;
  visible: number;
  streaming?: boolean;
  tone?: "risk" | "approval";
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
    { id: "router", name: "Complaint Router", type: "Router Agent", kind: "agent", detail: "我在原话里听到了三个需要立即升级的信号：行驶中失去动力、同一问题修了五次、客户明确要求退车。综合判断，这是高风险投诉，建议先创建 CCO 案件保留原始语境。", evidence: "本次电话逐字稿、车辆 VIN 与客户主数据", instruction: "先完整听完来电，保留客户原话；再判断诉求、风险和应进入的业务流程。", x: 50, y: 48 },
  ],
  retention: [
    { id: "retention", name: "Retention Process", type: "Process Agent", kind: "agent", detail: "我需要回答五个问题：同一故障维修了几次、现在有没有新的维修方案、需要什么零件、是否满足三包条件，以及零件什么时候到。技术方案与三包可以同时核验；库存要等零件号确认后再查。建议把这些事实确认清楚后，再为 Customer Care 生成客户沟通话术。", evidence: "当前 CCO 投诉、挽留流程规则和用户启动指令", instruction: "围绕客户能否接受继续维修，规划一条能查清维修历史、技术方案、三包条件和零件时间的调查路径。", x: 50, y: 15 },
    { id: "technical", name: "Technical Service", type: "Data Agent", kind: "agent", detail: "我对比了五张工单与最新 TSARA。之前的维修没有采用这次的新方案；当前可以更换高压功率控制模块并刷新软件。建议确认方案和零件号，再让 Parts 查询真实库存。", evidence: "5 张维修工单、TSARA SI-61-2026-08、零件号 12-36-8-099-417", instruction: "帮我看看过去五次到底修了什么，是否有新的可执行方案；如果有，把准确零件号一起找出来。", x: 16, y: 48 },
    { id: "legal", name: "Legal Risk Validation", type: "Data Agent", kind: "agent", detail: "我只看了本次核验需要的数据。车辆仍在有效范围内，同一质量问题维修五次，已经超过当前流程的四次阈值。因此三包条件成立，建议由 Legal 确认这项判断。", evidence: "FRD 2025-03-18、FASTA 18,420 km、5 张同故障维修工单", instruction: "只用车辆基础数据和本次维修记录核验三包条件，不要读取客户沟通和其他历史案件。", x: 39, y: 48 },
    { id: "warranty", name: "Warranty & Mobility", type: "Data Agent", kind: "agent", detail: "车辆仍在保，Dealer 当前有代步车，也符合一年延保关怀的申请条件。建议把三项权益一起告诉客户，减少她对维修期间出行和后续风险的担忧。", evidence: "Warranty 有效状态、Dealer 当日代步车库存、延保关怀规则", instruction: "看看客户维修期间有哪些真实可用的保障，不要只返回保修状态，还要确认代步车和可申请的关怀权益。", x: 62, y: 48 },
    { id: "strategy", name: "Communication Strategy", type: "Knowledge Agent", kind: "agent", detail: "我建议先回应客户对安全和重复维修的担忧，再说明这次的新方案、3 天到件、代步车和一年延保。最后把选择权交还客户，等待她反馈，而不是要求立即确认。", evidence: "3 个同类高风险投诉的已完成沟通案例，以及本案已确认的技术、零件与关怀结论", instruction: "把已经确认的事实组织成一段可以直接对客户说的话；语气要诚恳，并解释为什么这样表达。", x: 84, y: 48 },
    { id: "parts", name: "Parts", type: "Data Agent", kind: "agent", detail: "我按 Technical Service 给出的零件号查询到一笔可用调拨库存，预计三天到店。建议 Parts 确认这笔调拨，再把到货时间写进客户沟通方案。", evidence: "零件号 12-36-8-099-417、调拨单 TR-2026-0827-031", instruction: "只按已确认的零件号查询当前库存、调拨状态和预计到店时间，并返回可以复核的单号。", x: 28, y: 80, optional: true },
  ],
  claim: [
    { id: "claim-process", name: "CLAIM Approval", type: "Process Agent", kind: "agent", detail: "Dealer 材料到达后，我自动启动了 OCR 核验。资料完整就交给审批人；缺件则暂停并告诉 Dealer 具体要补什么。审批完成后，最后一步才会回写 CCO。", evidence: "CCA-2026-0068 与 DealerRepairAndClaimSubmitted 事件", instruction: "材料一到就开始审批流程：先查完整性，再等待审批意见，最后回写结果。", x: 50, y: 18 },
    { id: "ocr", name: "Claim Document Review", type: "Document & OCR Agent", kind: "agent", detail: "我逐份比对了申请表、维修完成单和延保文件。VIN、日期与签字一致，维修结论也能对应当前 CCA Case，因此建议进入审批。", evidence: "3 份 CLAIM 文件及字段级 OCR 比对结果", instruction: "读完 Dealer 上传的全部文件，找出缺件或字段冲突，并说明是否足以进入审批。", x: 28, y: 58 },
    { id: "writer", name: "CCO Result Writer", type: "Execution Agent", kind: "agent", detail: "审批结果为通过后，我把 CCA 决定、维修结果和客户关怀信息写回 CCO，并拿到了成功回执。当前案件可以闭环。", evidence: "审批决定 Approved、CCO 写入回执 WR-2026-0068", instruction: "确认审批已经完成后再回写 CCO；写完要检查回执，失败时不要把案件标记为完成。", x: 72, y: 58 },
  ],
};

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

const initialConclusion = "我已经听完这通来电。客户描述车辆在行驶中再次失去动力，同一问题已维修五次，并明确提出退车。这里同时涉及安全风险和强烈退车诉求，我建议按高风险投诉立即建案。";

const initialMessages: Message[] = [
  { id: 1, role: "system", body: "后台处理完成｜来电已转写并完成风险识别", visible: 22 },
  { id: 2, role: "assistant", body: initialConclusion, visible: initialConclusion.length, tone: "risk", notes: [{ label: "判断依据", text: "行驶中失去动力、同故障维修五次、明确要求退车。", tone: "evidence" }, { label: "建议下一步", text: "创建 CCO 投诉，完整保留原始录音和客户措辞。", tone: "next" }], card: { label: "AI 识别结果", value: "高风险投诉｜退车诉求", meta: "建议立即建案" }, actions: ["请创建 CCO 投诉"] },
];

const callTranscript = "客户：你好，我的 iX3 刚才行驶中又突然失去动力了。\n\nST：车辆现在停在安全位置吗？人员是否安全？\n\n客户：已经靠边了，人没事。但同一个问题已经修了五次，我现在不敢再开。\n\nST：我先记录车辆和维修情况，并立即升级处理。\n\n客户：我要求退车，请尽快给我一个明确答复。";

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
  if (["ready_investigation", "running_investigation", "waiting_investigation_approvals", "ready_solution", "waiting_customer", "waiting_repair", "ready_claim", "blocked"].includes(stage)) return "retention";
  return "claim";
}

function progressFor(stage: Stage): number {
  const map: Record<Stage, number> = {
    classifying: 0,
    ready_create: 1,
    ready_retention: 2,
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
    ready_investigation: "按建议运行调查",
    waiting_customer: "例如：沟通完成，客户接受方案",
    ready_claim: "启动 CCA 审批",
    ready_approval: "批准并回写结果",
  };
  return prompts[stage] ?? "当前步骤无需输入";
}

export default function ChatWorkbench() {
  const [stage, setStage] = useState<Stage>("classifying");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [customerOpen, setCustomerOpen] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [ccoId, setCcoId] = useState<string | null>(null);
  const [ccaId, setCcaId] = useState<string | null>(null);
  const [history, setHistory] = useState<Phase[]>([]);
  const [graphView, setGraphView] = useState<Phase | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [enabledExtras, setEnabledExtras] = useState<Record<Phase, string[]>>({ intake: [], retention: [], claim: [] });
  const [dealerModal, setDealerModal] = useState<"repair" | "supplement" | null>(null);
  const [documentsComplete, setDocumentsComplete] = useState(true);
  const [drawer, setDrawer] = useState<"tasks" | "agents" | null>(null);
  const [taskView, setTaskView] = useState<TaskView>("main");
  const [agentStates, setAgentStates] = useState<Record<string, AgentStatus>>({ router: "running" });
  const [approvals, setApprovals] = useState({ technical: false, legal: false, parts: false });
  const [partsReady, setPartsReady] = useState(false);
  const [agentInstructions, setAgentInstructions] = useState<Record<string, string>>({});
  const [demoVersion, setDemoVersion] = useState(0);
  const nextId = useRef(3);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
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
    const nodes = [...baseGraphs[displayPhase], ...extras];
    // Introduce the cross-process handoff only when it starts; retain it afterward.
    if (displayPhase === "retention") {
      const positions: Record<string, [number, number]> = { retention: [50, 12], technical: [15, 43], legal: [50, 43], warranty: [85, 43], parts: [15, 75], strategy: [50, 75], frd: [28, 94], "cco-retention": [58, 94] };
      return visibleAgentNodes([...nodes.map((node) => ({ ...node, x: positions[node.id]?.[0] ?? node.x, y: positions[node.id]?.[1] ?? node.y })), { ...baseGraphs.claim[0], name: "Claim Process", x: 85, y: 88 }], agentStates);
    }
    if (displayPhase === "claim") return [...nodes.map((node) => node.id === "claim-process" ? { ...node, name: "Claim Process", x: 50, y: 38 } : node.id === "ocr" || node.id === "writer" ? { ...node, y: 70 } : node), { ...baseGraphs.retention[0], x: 18, y: 15 }];
    return nodes;
  }, [displayPhase, enabledExtras, agentStates]);

  const selected = graphNodes.find((node) => node.id === selectedNode) ?? graphNodes[0];

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => {
    clearTimers();
    initialStarted.current = false;
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
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const addMessage = (message: Omit<Message, "id" | "visible">) => {
    const id = nextId.current++;
    setMessages((current) => [...current, { ...message, id, visible: message.body.length }]);
    return id;
  };

  const streamAssistant = (title: string, body: string, options?: { card?: MessageCard; bullets?: string[]; notes?: MessageNote[]; tone?: Message["tone"]; actions?: string[]; onDone?: () => void }) => {
    const id = nextId.current++;
    setBusy(true);
    setMessages((current) => [...current, { id, role: "assistant", title, body, bullets: options?.bullets, notes: options?.notes, tone: options?.tone, actions: options?.actions, visible: 0, streaming: true }]);
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
      notes: [{ label: "我查到的", text: "Warranty 状态有效，上海宝诚当前有可用代步车。", tone: "evidence" }, { label: "这意味着", text: "客户等待维修时不必承担出行中断。", tone: "decision" }, { label: "可以这样处理", text: "把代步车和一年延保一起放进沟通方案。", tone: "next" }],
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

  const approveTechnical = () => {
    setApprovals((current) => ({ ...current, technical: true }));
    setAgentStates((current) => ({ ...current, technical: "done", parts: "running" }));
    setStage("running_investigation");
    addMessage({ role: "system", body: "Technical Service 已确认维修数据、技术方案和零件号" });
    streamAssistant("", "Technical Service 已确认零件号 12-36-8-099-417。我现在按这个零件号查询 Parts 库存和调拨时间。", {
      notes: [{ label: "为什么现在才查", text: "只有 Technical Service 确认零件号后，才能避免查到不适配的库存。" }, { label: "我正在做", text: "用 12-36-8-099-417 查询 Parts 库存和调拨计划。", tone: "next" }],
      onDone: () => pauseBeforeAgentStep(() => streamAssistant("", "Parts 查询完成：零件号 12-36-8-099-417 有调拨库存，预计 3 天到店。", {
        notes: [{ label: "找到的记录", text: "调拨单 TR-2026-0827-031 对应这个零件号。", tone: "evidence" }, { label: "我的判断", text: "库存可用，按当前计划预计 3 天到店。", tone: "decision" }, { label: "还需要", text: "请 Parts 确认这笔库存和到店时间。", tone: "next" }],
        tone: "approval",
        card: { label: "Parts 待确认", value: "12-36-8-099-417", meta: "预计 3 天到店" },
        onDone: () => {
          setPartsReady(true);
          setAgentStates((current) => ({ ...current, parts: "done" }));
          setStage("waiting_investigation_approvals");
        },
      }), 2200),
    });
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

  const runParallelInvestigation = () => {
    setStage("running_investigation");
    setAgentStates((current) => ({ ...current, technical: "running", legal: "running" }));
    streamAssistant("", "我已同时发起 Technical Service 和 Legal 两项核验。前者确认维修方案和零件号，后者只核验本次三包数据。", {
      notes: [{ label: "处理方式", text: "两项核验会并行运行，不必相互等待。", tone: "next" }, { label: "这样安排的原因", text: "技术方案与三包判断使用不同的数据范围，可以由两个部门独立确认。" }],
      onDone: () => pauseBeforeAgentStep(() => streamAssistant("", "Technical Service 返回：同一动力中断故障已维修 5 次，当前可执行的新方案是更换高压功率控制模块并刷新软件。", {
        notes: [{ label: "我对比了", text: "5 张维修工单和 TSARA SI-61-2026-08。", tone: "evidence" }, { label: "发现", text: "这次方案不同于前五次处理，具备执行条件；零件号是 12-36-8-099-417。", tone: "decision" }, { label: "建议", text: "先让 Technical Service 确认方案和零件号，再继续查库存。", tone: "next" }],
        tone: "approval",
        card: { label: "Technical Service 待确认", value: "5 次维修｜方案可执行", meta: "零件号 12-36-8-099-417" },
        onDone: () => {
          setAgentStates((current) => ({ ...current, technical: "done" }));
          pauseBeforeAgentStep(() => streamAssistant("", "Legal 返回：车辆处于三包有效范围，同一质量问题已维修 5 次，超过当前流程配置的 4 次阈值。", {
          notes: [{ label: "本次只看了", text: "车龄 18 个月、里程 18,420 km，以及 5 张同故障维修工单。", tone: "evidence" }, { label: "据此判断", text: "车辆仍在有效范围，维修次数超过当前流程阈值，三包条件成立。", tone: "decision" }, { label: "建议", text: "由 Legal 只确认这次核验结论，不需要查看客户沟通历史。", tone: "next" }],
          tone: "approval",
          card: { label: "Legal 待确认", value: "三包条件成立", meta: "仅限本次核验数据" },
          onDone: () => {
            setAgentStates((current) => ({ ...current, legal: "done" }));
            setStage("waiting_investigation_approvals");
          },
        }), 2200);
        },
      }), 2000),
    });
  };

  const executeCommand = (value: string) => {
    if (!value || !canSend) return;
    addMessage({ role: "user", body: value });
    setInput("");

    if (stage === "ready_create") {
      setStage("ready_retention");
      setCcoId("CCO-CMP-2026-0096");
      streamAssistant("", "我已经把这通来电整理成 CCO 投诉，客户原话和高风险信号都完整保留了。", {
        notes: [{ label: "为什么按高风险处理", text: "客户描述了行驶中失去动力，并明确提出退车诉求。", tone: "evidence" }, { label: "已经完成", text: "CCO-CMP-2026-0096 创建成功。", tone: "decision" }, { label: "我建议下一步", text: "启动维修挽留流程，先确认有没有不同于前五次维修的新方案。", tone: "next" }],
        card: { label: "CCO Complaint", value: "CCO-CMP-2026-0096", meta: "高风险" },
        actions: ["启动维修挽留流程"],
      });
    } else if (stage === "ready_retention") {
      completePhase("intake", "retention");
      setAgentStates((current) => ({ ...current, retention: "running", technical: "waiting", legal: "waiting", warranty: "waiting", strategy: "waiting", parts: "waiting", "claim-process": "waiting" }));
      setStage("ready_investigation");
      streamAssistant("", "我会先查清同一故障到底维修了几次、现在有没有不同于以往的可执行方案，以及方案需要哪些零件。与此同时，我会独立核验三包条件；拿到准确零件号后，再确认库存和到货时间。", {
        notes: [{ label: "这次要回答的问题", text: "维修次数、可执行维修方案、所需零件、是否满足三包条件，以及零件预计何时到店。", tone: "next" }, { label: "我会怎么推进", text: "技术方案与三包核验同时开始；零件库存要等准确零件号确认后再查。" }, { label: "为什么这样安排", text: "先把事实和边界确认清楚，Customer Care 后续给客户的方案才可执行、可信。" }],
        card: { label: "当前 Process", value: "客户维修挽留", meta: "6 Agents" },
        actions: ["按建议运行调查"],
        onDone: () => setAgentStates((current) => ({ ...current, retention: "done" })),
      });
    } else if (stage === "ready_investigation") {
      runParallelInvestigation();
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

  const resetDemo = () => {
    clearTimers();
    initialStarted.current = false;
    setStage("classifying");
    setMessages(initialMessages);
    setInput("");
    setBusy(true);
    setProfileReady(false);
    setCcoId(null);
    setCcaId(null);
    setHistory([]);
    setGraphView(null);
    setEnabledExtras({ intake: [], retention: [], claim: [] });
    setDocumentsComplete(true);
    setDealerModal(null);
    setTaskView("main");
    setApprovals({ technical: false, legal: false, parts: false });
    setPartsReady(false);
    setAgentInstructions({});
    setDemoVersion((current) => current + 1);
    remainingStarted.current = false;
    timers.current.push(setTimeout(() => {
      initialStarted.current = true;
      setProfileReady(true);
      setAgentStates({ router: "done" });
      setStage("ready_create");
      setBusy(false);
    }, 220));
  };

  const mockLabel = stage === "waiting_repair" ? "模拟维修与 CLAIM 回写" : stage === "waiting_supplement" ? "模拟 Dealer 补件" : null;

  return (
    <main className="chat-app">
      <header className="chat-topbar">
        <Link className="chat-brand" href="/">AFS AI Workbench</Link>
        <nav className="top-mock-nav" aria-label="主菜单">
          <button type="button">流程管理</button>
          <button type="button">权限管理</button>
        </nav>
        <div className="chat-topbar-spacer" />
        <ThemeToggle />
        <button className="chat-mobile-button" onClick={() => setDrawer("tasks")} aria-label="打开任务列表"><FlowArrow size={20} /></button>
        <button className="chat-icon-button" aria-label="通知"><Bell size={21} /></button>
        <button className="chat-profile" aria-label="账户"><UserCircle size={22} /></button>
      </header>

      <div className="chat-layout">
        <TaskSidebar
          stage={stage}
          taskView={taskView}
          approvals={approvals}
          partsReady={partsReady}
          onSelectTask={(task) => { setTaskView(task); setDrawer(null); }}
          mockLabel={mockLabel}
          onMock={() => setDealerModal(stage === "waiting_repair" ? "repair" : "supplement")}
          onReset={resetDemo}
          drawer={drawer === "tasks"}
          onClose={() => setDrawer(null)}
        />

        <section className="chat-main" aria-label="任务对话工作区">
          <ProcessTracker
            phase={phase}
            stage={stage}
            taskView={taskView}
            approvalCompleted={taskView === "technical" ? approvals.technical : taskView === "legal" ? approvals.legal : taskView === "parts" ? approvals.parts : false}
            progress={progress}
            history={history}
            graphView={graphView}
            onViewHistory={setGraphView}
          />
          {taskView === "main" ? <>
            <CustomerCard open={customerOpen} onToggle={() => setCustomerOpen((current) => !current)} ready={profileReady} ccoId={ccoId} ccaId={ccaId} phase={phase} />
            <div className="chat-thread" aria-live="polite" aria-busy={busy}>
            <div className="chat-thread-heading">
              <div><span><Sparkle size={17} weight="fill" /></span><div><b>AI 协作对话</b><small>每次只显示当前结论和下一步</small></div></div>
              <button onClick={() => setDrawer("agents")} className="chat-mobile-button"><Robot size={18} /> Agents</button>
            </div>
            <div className="chat-messages">
              {messages.map((message) => <ChatMessage key={`${demoVersion}-${message.id}`} message={message} onAction={executeCommand} actionsDisabled={!canSend || message.id !== latestActionMessageId} />)}
              {waitingCustomerCareFeedback && <div className="a7-wait"><Clock size={20} /><div><strong>等待 Customer Care 与客户线下沟通</strong><span>沟通完成后，请在下方直接输入客户是否接受方案。</span></div></div>}
              {waitingExternal && <div className="external-wait"><Clock size={20} /><div><strong>等待 Dealer 线下处理</strong><span>请从左侧当前任务使用带 Mock 标识的 CCO 回写。</span></div></div>}
              {waitingApproval && <div className="approval-wait"><Clock size={20} /><div><strong>主任务已暂停</strong><span>请完成左侧仍待处理的跨部门审批任务。</span></div></div>}
              <div ref={messageEnd} />
            </div>
            </div>
            <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-command">业务指令</label>
            <div>
              <button className="file-upload-button" type="button" onClick={() => fileInput.current?.click()} aria-label="上传附件"><Paperclip size={20} /></button>
              <input ref={fileInput} className="sr-only" type="file" tabIndex={-1} onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }} />
              <input
                id="chat-command"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={waitingExternal ? "等待 CCO 回写后继续" : waitingApproval ? "等待审批任务完成" : stagePrompt(stage)}
                disabled={!canSend}
              />
              <button type="submit" disabled={!canSend || !input.trim()} aria-label="发送指令"><PaperPlaneTilt size={20} weight="fill" /></button>
            </div>
            </form>
          </> : <ApprovalTask key={taskView} type={taskView} approved={taskView === "technical" ? approvals.technical : taskView === "legal" ? approvals.legal : approvals.parts} onApprove={taskView === "technical" ? approveTechnical : taskView === "legal" ? approveLegal : approveParts} onBack={() => setTaskView("main")} />}
        </section>

        <AgentWorkspace
          phase={displayPhase}
          currentPhase={phase}
          nodes={graphNodes}
          readOnly={readOnlyGraph}
          onExpand={() => { setSelectedNode(graphNodes[0]?.id ?? null); setGraphOpen(true); }}
          drawer={drawer === "agents"}
          onClose={() => setDrawer(null)}
          stage={stage}
          statuses={agentStates}
          onOpenNode={(id) => { setSelectedNode(id); setGraphOpen(true); }}
        />
      </div>

      {graphOpen && <AgentGraphModal
        phase={displayPhase}
        nodes={graphNodes}
        selected={selected}
        readOnly={readOnlyGraph}
        enabledExtras={enabledExtras[displayPhase]}
        onSelect={setSelectedNode}
        onToggleExtra={(id) => setEnabledExtras((current) => ({ ...current, [displayPhase]: current[displayPhase].includes(id) ? current[displayPhase].filter((item) => item !== id) : [...current[displayPhase], id] }))}
        onClose={() => setGraphOpen(false)}
        stage={stage}
        statuses={agentStates}
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

function TaskSidebar({ stage, taskView, approvals, partsReady, onSelectTask, mockLabel, onMock, onReset, drawer, onClose }: { stage: Stage; taskView: TaskView; approvals: { technical: boolean; legal: boolean; parts: boolean }; partsReady: boolean; onSelectTask: (task: TaskView) => void; mockLabel: string | null; onMock: () => void; onReset: () => void; drawer: boolean; onClose: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const [createdTasks, setCreatedTasks] = useState<{ id: string; title: string; status: string }[]>([]);
  const isStarted = !["classifying", "ready_create", "ready_retention"].includes(stage);
  const isFinished = ["complete", "blocked"].includes(stage);
  const currentStatus = !isStarted ? "待处理" : stage === "complete" ? "已完成" : stage === "blocked" ? "已转出" : stage === "waiting_investigation_approvals" ? "等待审批" : stage === "waiting_customer" ? "等待 Customer Care" : stage.startsWith("waiting") ? "等待外部" : "处理中";
  const currentTitle = stage === "classifying" || stage === "ready_create" ? "AI 识别高风险投诉｜陈女士" : stage === "ready_retention" ? "高风险投诉待启动挽留｜陈女士" : ["ready_investigation", "running_investigation"].includes(stage) ? "高风险投诉调查中｜陈女士" : stage === "waiting_investigation_approvals" ? "高风险投诉等待跨部门审批｜陈女士" : stage === "waiting_customer" ? "维修挽留等待 Customer Care 反馈｜陈女士" : stage === "waiting_repair" ? "客户已接受，等待 Dealer 上传材料｜陈女士" : phaseForStage(stage) === "claim" ? "CCA 案件审批｜陈女士｜CCA-2026-0068" : "高风险投诉案件｜陈女士";
  const approvalTasks: { id: TaskView; title: string }[] = [];
  if (stage === "waiting_investigation_approvals" && !approvals.technical) approvalTasks.push({ id: "technical", title: "审批 Technical Service｜维修方案与零件号" });
  if (stage === "waiting_investigation_approvals" && !approvals.legal) approvalTasks.push({ id: "legal", title: "审批 Legal｜本次三包核验数据" });
  if (stage === "waiting_investigation_approvals" && partsReady && !approvals.parts) approvalTasks.push({ id: "parts", title: "审批 Parts｜库存与 3 天调拨时间" });
  const completedApprovalTasks = [
    approvals.technical ? { id: "technical" as TaskView, title: "Technical Service 已确认｜维修方案与零件号" } : null,
    approvals.legal ? { id: "legal" as TaskView, title: "Legal 已确认｜本次三包核验" } : null,
    approvals.parts ? { id: "parts" as TaskView, title: "Parts 已确认｜库存与调拨时间" } : null,
  ].filter((task): task is { id: TaskView; title: string } => task !== null);
  const visiblePending = showAll ? [...createdTasks, ...pendingTaskItems] : [...createdTasks, ...pendingTaskItems].slice(0, 4);
  const visibleCompleted = showAll ? completedTaskItems : completedTaskItems.slice(0, 2);
  const totalTasks = 1 + pendingTaskItems.length + completedTaskItems.length + approvalTasks.length + completedApprovalTasks.length + createdTasks.length;
  const createTask = () => setCreatedTasks((current) => current.length ? current : [{ id: "new-demo", title: "新建客户关怀任务｜待补充信息", status: "待处理" }]);
  const demoTask = <button className={`task-list-item primary risk-task ${taskView === "main" ? "active" : ""}`} onClick={() => onSelectTask("main")}><WarningCircle size={18} weight="fill" /><span>{currentTitle}</span><b>{currentStatus}</b></button>;
  return <aside className={`task-sidebar ${drawer ? "drawer-open" : ""}`} aria-label="任务列表">
    <header><div><span>任务中心</span><strong>{totalTasks} 个任务</strong></div><button className="drawer-close" onClick={onClose} aria-label="关闭任务列表"><X size={20} /></button></header>
    <button className="new-task-button" onClick={createTask}><Plus size={17} />新建任务</button>
    {isStarted && !isFinished && <><div className="task-section-label">进行中</div>{demoTask}{mockLabel && <button className="mock-task-button" onClick={onMock}><span>MOCK</span>{mockLabel}<ArrowRight size={16} /></button>}</>}
    <div className="task-section-label">待处理</div>
    {!isStarted && demoTask}
    {approvalTasks.map((task) => <button className={`task-list-item approval ${taskView === task.id ? "active" : ""}`} key={task.id} onClick={() => onSelectTask(task.id)}><span>{task.title}</span><b>需审批</b></button>)}
    {visiblePending.map((task) => <button className="task-list-item" key={task.id}><span>{task.title}</span><b>{task.status}</b></button>)}
    <div className="task-section-label">已完成</div>
    {isFinished && demoTask}
    {completedApprovalTasks.map((task) => <button className={`task-list-item muted ${taskView === task.id ? "active" : ""}`} key={task.id} onClick={() => onSelectTask(task.id)}><span>{task.title}</span><b>已审批</b></button>)}
    {visibleCompleted.map((task) => <button className="task-list-item muted" key={task.id}><span>{task.title}</span><b>{task.status}</b></button>)}
    <button className="show-all-tasks" onClick={() => setShowAll((current) => !current)}>{showAll ? "收起任务列表" : `展开完整列表（${totalTasks}）`}<CaretDown size={15} /></button>
    <button className="reset-demo" onClick={onReset}>重新演示</button>
  </aside>;
}

function ApprovalTask({ type, approved, onApprove, onBack }: { type: Exclude<TaskView, "main">; approved: boolean; onApprove: () => void; onBack: () => void }) {
  const isTechnical = type === "technical";
  const isLegal = type === "legal";
  const role = isTechnical ? "Technical Service" : isLegal ? "Legal" : "Parts";
  const approvalNotes = isTechnical ? [
    { label: "我对比了", text: "同故障的 5 张维修工单，以及 TSARA SI-61-2026-08。" },
    { label: "新的发现", text: "这次可以更换高压功率控制模块并刷新软件，零件号为 12-36-8-099-417。" },
    { label: "确认后会发生", text: "系统会拿这个零件号继续查询 Parts 库存。" },
  ] : isLegal ? [
    { label: "本次参考", text: "车龄 18 个月、里程 18,420 km、同故障维修 5 次。" },
    { label: "我的判断", text: "维修次数超过当前流程的 4 次阈值，三包条件成立。" },
    { label: "确认范围", text: "只确认这次核验，不包含客户沟通或其他历史案件。" },
  ] : [
    { label: "查询依据", text: "Technical Service 已确认的零件号 12-36-8-099-417。" },
    { label: "我找到的", text: "调拨单 TR-2026-0827-031 有可用库存，预计 3 天到店。" },
    { label: "确认后会发生", text: "到店时间会被放进最终的客户沟通方案。" },
  ];
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
      <button onClick={onBack}>返回主任务</button>
      <div><span>{role.toUpperCase()} APPROVAL</span><h2 id="approval-task-title">高风险投诉案件 · 审批 {role}</h2></div>
      <b className={approved ? "approved" : ""}>{approved ? "已确认" : "待审批"}</b>
    </header>
    <div className="approval-customer"><UserCircle size={22} /><strong>陈女士 · BMW iX3</strong><span>VIN WBY7X210…9342</span><span>18,420 km</span></div>
    <div className="approval-conversation">
    <article className="approval-recommendation chat-style">
      <div className="approval-ai-icon"><Robot size={24} /></div>
      <div>
        <p>{isTechnical ? "我把过去的维修记录和最新技术方案放在一起看了一遍。前五次并没有采用这次的新方案，所以我认为它值得继续推进，但需要你先确认数据是否准确。" : isLegal ? "我只查看了完成这次核验所需的数据。基于车辆当前状态和维修次数，我认为三包条件已经成立，请你确认这个判断能否用于主案件。" : "我使用 Technical Service 刚确认的零件号查询了实时库存。现在有一笔调拨可以支持方案，请你确认库存和到店时间。"}</p>
        <div className="approval-ai-notes">{approvalNotes.map((note) => <section key={note.label}><b>{note.label}</b><span>{note.text}</span></section>)}</div>
      </div>
    </article>
    {!approved && <nav className="message-actions approval-message-actions" aria-label={`${role} 快捷审批操作`}><button onClick={() => approveWith(`我确认 ${role} 的数据，可以继续`)}>确认数据并继续</button><button onClick={() => setReply("请补充说明证据来源")}>要求补充证据</button></nav>}
    <article className="approval-user-prompt"><UserCircle size={22} /><p>请确认以上数据是否可以用于主案件后续处理。</p></article>
    {submittedReply && <article className="approval-user-reply"><UserCircle size={22} /><p>{submittedReply}</p></article>}
    {approved && <article className="approval-confirmed"><Robot size={22} /><p>收到，我已经记录你的审批意见。这个任务会留在当前页面；主案件正在后台继续处理，你可以稍后从左侧手动切换回去。</p></article>}
    </div>
    <form className="approval-chat-composer" onSubmit={submitApproval}>
      <label className="sr-only" htmlFor={`approval-reply-${type}`}>审批意见</label>
      <div><button className="file-upload-button" type="button" onClick={() => approvalFileInput.current?.click()} disabled={approved} aria-label="上传审批附件"><Paperclip size={20} /></button><input ref={approvalFileInput} className="sr-only" type="file" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) setReply(`已附加 ${file.name}，我确认 ${role} 的数据，可以继续`); event.target.value = ""; }} /><input id={`approval-reply-${type}`} value={reply} onChange={(event) => setReply(event.target.value)} disabled={approved} placeholder={approved ? "审批意见已记录" : `例如：我确认 ${role} 的数据，可以继续`} /><button type="submit" disabled={approved || !reply.trim()} aria-label={`发送 ${role} 审批意见`}><PaperPlaneTilt size={19} weight="fill" /></button></div>
    </form>
  </section>;
}

function ProcessTracker({ phase, stage, taskView, approvalCompleted, progress, history, graphView, onViewHistory }: { phase: Phase; stage: Stage; taskView: TaskView; approvalCompleted: boolean; progress: number; history: Phase[]; graphView: Phase | null; onViewHistory: (phase: Phase | null) => void }) {
  if (taskView !== "main") {
    const role = taskView === "technical" ? "Technical Service" : taskView === "legal" ? "Legal" : "Parts";
    return <section className="process-tracker approval-process" aria-label="审批流程进度">
      <header><div><span>当前审批任务</span><strong>高风险投诉案件 · 审批 {role}</strong></div></header>
      <ol><li className="done"><span><Check size={15} weight="bold" /></span><b>高风险投诉案件</b><i /></li><li className={approvalCompleted ? "done" : "active waiting"}><span>{approvalCompleted ? <Check size={15} weight="bold" /> : 2}</span><b>{approvalCompleted ? `${role} 已确认` : `审批 ${role}`}</b></li></ol>
    </section>;
  }
  const definition = processDefinitions[phase];
  return <section className="process-tracker" aria-label="当前流程进度">
    <header>
      <div><span>当前 Process</span><strong>{definition.title}</strong></div>
      <div className="process-history">
        {history.map((item) => <button key={item} className={graphView === item ? "selected" : ""} onClick={() => onViewHistory(graphView === item ? null : item)}><Check size={12} />{processDefinitions[item].short}</button>)}
      </div>
    </header>
    <ol>
      {definition.steps.map((step, index) => {
        const done = progress > index;
        const active = progress === index;
        const waiting = active && stage.startsWith("waiting");
        const blocked = active && stage === "blocked";
        return <li key={step} className={`${done ? "done" : ""} ${active ? "active" : ""} ${waiting ? "waiting" : ""} ${blocked ? "blocked" : ""}`}>
          <span>{done ? <Check size={15} weight="bold" /> : index + 1}</span><b>{step}</b>{index < definition.steps.length - 1 && <i />}
        </li>;
      })}
    </ol>
  </section>;
}

function CustomerCard({ open, onToggle, ready, ccoId, ccaId, phase }: { open: boolean; onToggle: () => void; ready: boolean; ccoId: string | null; ccaId: string | null; phase: Phase }) {
  return <section className={`customer-card ${open ? "open" : ""}`}>
    <button onClick={onToggle} aria-expanded={open}>
      <span className="customer-avatar"><UserCircle size={24} weight="fill" /></span>
      <span><small>客户信息</small><strong>{ready ? "陈女士 · BMW iX3" : "正在识别客户信息…"}</strong></span>
      {ready && <><em>高风险</em><b>{ccaId ?? ccoId ?? "待创建案件"}</b><i>{processDefinitions[phase].short}</i></>}
      <CaretDown size={18} />
    </button>
    {open && <dl>
      <div><dt>联系电话</dt><dd>{ready ? "138 **** 6821" : "识别中"}</dd></div>
      <div><dt>VIN</dt><dd>{ready ? "WBY7X210…9342" : "识别中"}</dd></div>
      <div><dt>当前里程</dt><dd>{ready ? "18,420 km" : "识别中"}</dd></div>
      <div><dt>服务 Dealer</dt><dd>{ready ? "上海宝诚 BMW" : "识别中"}</dd></div>
      <div><dt>维修历史</dt><dd>{ready ? "同一故障维修 5 次" : "识别中"}</dd></div>
      <div><dt>投诉摘要</dt><dd>{ready ? "行驶中动力中断，客户要求退车" : "正在从电话中提取"}</dd></div>
    </dl>}
  </section>;
}

function ChatMessage({ message, onAction, actionsDisabled }: { message: Message; onAction: (value: string) => void; actionsDisabled: boolean }) {
  const visibleBody = message.body.slice(0, message.visible);
  return <article className={`chat-message ${message.role} ${message.tone ?? ""}`}>
    {message.role === "assistant" && <span className="message-avatar"><Robot size={18} /></span>}
    <div>
      {message.role !== "assistant" && message.title && <h3>{message.title}</h3>}
      {message.tone === "risk" && <span className="chat-risk-label"><WarningCircle size={14} weight="fill" />高风险诉求</span>}
      <p>{visibleBody}{message.streaming && <i className="stream-cursor" />}</p>
      {!message.streaming && message.bullets && <ul>{message.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
      {!message.streaming && message.notes && <div className="ai-notes">{message.notes.map((note) => <section className={note.tone ?? ""} key={`${note.label}-${note.text}`}><b>{note.label}</b><span>{note.text}</span></section>)}</div>}
      {!message.streaming && message.card && <div className="compact-result"><span>{message.card.label}</span><strong>{message.card.value}</strong>{message.card.meta && <b>{message.card.meta}</b>}</div>}
      {message.tone === "risk" && <CallRecording />}
    </div>
    {!message.streaming && message.actions?.length && <nav className="message-actions" aria-label="AI 建议操作">{message.actions.map((action) => <button key={action} disabled={actionsDisabled} onClick={() => onAction(action)}>{action}</button>)}</nav>}
  </article>;
}

function CallRecording() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(0);
  const duration = 24;
  const elapsed = Math.min(duration, Math.round((visible / callTranscript.length) * duration));

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

  return <section className={`call-recording ${playing ? "playing" : ""}`} aria-label="客户与 ST 的原始通话录音">
    <button type="button" onClick={toggle} aria-label={playing ? "暂停原始录音" : "播放原始录音"}>{playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}</button>
    <div className="recording-track">
      <div className="recording-meta"><span><SpeakerHigh size={14} />客户与 ST 原始录音</span><time>{`0:${String(elapsed).padStart(2, "0")} / 0:${duration}`}</time></div>
      <div className="recording-wave" aria-hidden="true">{Array.from({ length: 24 }).map((_, index) => <i key={index} style={{ height: `${6 + ((index * 7) % 15)}px` }} />)}</div>
      <div className="recording-progress"><i style={{ width: `${(visible / callTranscript.length) * 100}%` }} /></div>
    </div>
    {started && <div className="recording-transcript"><b>录音转写</b><p>{callTranscript.slice(0, visible)}{playing && <i className="stream-cursor" />}</p></div>}
  </section>;
}

function AgentWorkspace({ phase, currentPhase, nodes, readOnly, onExpand, onOpenNode, drawer, onClose, stage, statuses }: { phase: Phase; currentPhase: Phase; nodes: AgentNode[]; readOnly: boolean; onExpand: () => void; onOpenNode: (id: string) => void; drawer: boolean; onClose: () => void; stage: Stage; statuses: Record<string, AgentStatus> }) {
  return <aside className={`agent-workspace ${drawer ? "drawer-open" : ""}`} aria-label="Agent 工作区">
    <header><div><span>{readOnly ? "历史记录 · 只读" : "当前流程"}</span><strong>{processDefinitions[phase].title}</strong></div><button className="drawer-close" onClick={onClose} aria-label="关闭 Agent 区"><X size={20} /></button></header>
    <button className="agent-mini-map" onClick={onExpand} aria-label="展开 Agent 编排">
      <MiniGraph nodes={nodes} stage={stage} active={phase === currentPhase} statuses={statuses} />
      <span><CornersOut size={16} />展开编排</span>
    </button>
    <AgentCallList phase={phase} nodes={nodes} statuses={statuses} onSelect={onOpenNode} compact />
    <div className="agent-list-heading"><span>Agents</span><b>{nodes.filter((node) => node.kind === "agent").length}</b></div>
    <div className="agent-list">
      {nodes.filter((node) => node.kind === "agent").map((node, index) => {
        const status = agentStatus(index, stage, statuses, node.id);
        return <button className={`agent-result-button ${status}`} key={node.id} onClick={() => onOpenNode(node.id)} aria-busy={status === "running"}>
          <span className={`agent-status ${status}`}><Robot size={17} /></span>
          <div><strong>{node.name}</strong><small>{node.type}</small></div>
          <b>{status === "running" ? <span className="agent-running-copy">执行中<i /><i /><i /></span> : statusLabel(status)}<CaretRight size={13} /></b>
        </button>;
      })}
    </div>
    <button className="agent-add" onClick={onExpand}><Plus size={17} />调整编排</button>
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
  const calls = getAgentCalls(phase, nodes).filter((call) => call.protocol === "MCP" || call.protocol === "A2A");
  if (!calls.length) return null;
  const dataCalls = calls.filter((call) => call.protocol === "MCP");
  const visible = compact ? calls.filter((call) => call.protocol === "A2A") : calls;
  return <section className={`agent-call-list ${compact ? "compact" : ""}`} aria-label="Agent 调用关系">
    <header>调用链路 <small>Mock</small></header>
    {compact && dataCalls.length > 0 && <button onClick={() => onSelect(dataCalls.find((call) => getCallStatus(call, statuses) === "running")?.target ?? dataCalls[0].target)}><b className="protocol-badge mcp">MCP</b><span>Retention Process → Data Agents<small>{dataCalls.filter((call) => getCallStatus(call, statuses) === "done").length}/{dataCalls.length} 已返回 · {dataCalls.filter((call) => getCallStatus(call, statuses) === "running").length} 调用中</small></span></button>}
    {visible.map((call) => <button key={call.id} onClick={() => onSelect(call.target)}><b className={`protocol-badge ${call.protocol.toLowerCase()}`}>{call.protocol}</b><span>{call.sourceName} → {call.targetName}<small>{callStatusLabel(getCallStatus(call, statuses))}</small></span></button>)}
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

function AgentGraphModal({ phase, nodes, selected, readOnly, enabledExtras, onSelect, onToggleExtra, onClose, stage, statuses, instructionValue, onInstructionChange }: { phase: Phase; nodes: AgentNode[]; selected?: AgentNode; readOnly: boolean; enabledExtras: string[]; onSelect: (id: string) => void; onToggleExtra: (id: string) => void; onClose: () => void; stage: Stage; statuses: Record<string, AgentStatus>; instructionValue: string; onInstructionChange: (value: string) => void }) {
  const calls = getAgentCalls(phase, nodes);
  const selectedStatus = selected?.kind === "agent" ? agentStatus(Math.max(nodes.indexOf(selected), 0), stage, statuses, selected.id) : "done";
  const metrics = phase === "intake" ? [["92%", "自动分类准确率"], ["3.2 分钟", "平均节省时间"], ["100%", "原话可追溯"]] : phase === "retention" ? [["68%", "人工检索减少"], ["5 个", "自动核验问题"], ["11 分钟", "单案节省时间"]] : [["74%", "资料预审提速"], ["3 份", "自动核验文件"], ["100%", "审批证据留痕"]];
  return <div className="chat-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="agent-modal" role="dialog" aria-modal="true" aria-labelledby="agent-modal-title">
      <header><div><span>{readOnly ? "历史编排 · 只读" : "Agent 编排"}</span><h2 id="agent-modal-title">{processDefinitions[phase].title}</h2></div><button onClick={onClose} aria-label="关闭 Agent 编排"><X size={22} /></button></header>
      <div className="agent-modal-layout">
        <aside className="agent-library">
          <span>可用节点</span>
          <p>{readOnly ? "历史流程不可修改。" : "按当前 Process 添加系统或数据源。"}</p>
          {graphExtras[phase].map((node) => <button key={node.id} disabled={readOnly} onClick={() => onToggleExtra(node.id)} className={enabledExtras.includes(node.id) ? "added" : ""}>
            {node.kind === "source" ? <Database size={18} /> : <FlowArrow size={18} />}
            <span><b>{node.name}</b><small>{node.type}</small></span>
            {enabledExtras.includes(node.id) ? <Check size={16} /> : <Plus size={16} />}
          </button>)}
        </aside>
        <div className="graph-center"><div className="graph-scroll"><div className="graph-detail-canvas protocol-canvas">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id="call-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 6 3 L 0 6 z" fill="context-stroke" /></marker></defs>
            {calls.map((call) => <path key={call.id} className={`call-edge ${call.protocol.toLowerCase()} ${getCallStatus(call, statuses)}`} d={call.route.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ")} markerEnd="url(#call-arrow)" />)}
          </svg>
          {calls.map((call) => <button key={call.id} className={`call-edge-label ${call.protocol.toLowerCase()} ${getCallStatus(call, statuses)}`} style={{ left: `${call.label[0]}%`, top: `${call.label[1]}%` }} onClick={() => onSelect(call.target)} aria-label={`${call.sourceName} 通过 ${call.protocol} 调用 ${call.targetName}，${callStatusLabel(getCallStatus(call, statuses))}，查看详情`}>{call.protocol}<span>{getCallStatus(call, statuses) === "running" ? "调用中" : getCallStatus(call, statuses) === "done" ? "✓" : "待调用"}</span></button>)}
          {nodes.map((node, index) => <button
            key={node.id}
            onClick={() => onSelect(node.id)}
            className={`graph-node ${node.kind} ${selected?.id === node.id ? "selected" : ""} ${node.kind === "agent" ? agentStatus(index, stage, statuses, node.id) : "done"}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            {node.kind === "agent" ? <Robot size={19} /> : node.kind === "source" ? <Database size={19} /> : <FlowArrow size={19} />}
            <span><strong>{node.name}</strong><small>{node.type}</small></span>
          </button>)}
        </div></div><AgentCallList phase={phase} nodes={nodes} statuses={statuses} onSelect={onSelect} /><div className="agent-metrics" aria-label="Agent 效率指标">{metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></div>
        <aside className="node-inspector">
          {selected && <>
            <span>节点详情</span>
            <div className="inspector-icon">{selected.kind === "agent" ? <Robot size={24} /> : <Database size={24} />}</div>
            <h3>{selected.name}</h3>
            <b>{selected.type}</b>
            <dl>
              {calls.filter((call) => call.target === selected.id || call.source === selected.id).map((call) => <div className="agent-call-record" key={call.id}>
                <dt>{call.protocol} · {callStatusLabel(getCallStatus(call, statuses))} · Mock</dt>
                <dd>{call.sourceName} → {call.targetName}</dd>
                <dd><code>{call.command}</code></dd>
                <dd>{getCallStatus(call, statuses) === "waiting" ? "计划输入" : "请求输入"}：{call.input}</dd>
                <dd>{getCallStatus(call, statuses) === "waiting" ? (call.protocol === "A2A" ? "客户接受方案且 Dealer 上传材料后，才会委派审批任务。" : "尚未发送调用，不展示返回结果。") : getCallStatus(call, statuses) === "running" ? "请求已发出，正在等待 Agent 返回。" : "Agent 已返回；点击对应节点查看结果和依据。"}</dd>
              </div>)}
              <div><dt>它刚刚接到的任务</dt>{readOnly ? <dd>{instructionValue}</dd> : <textarea aria-label={`编辑 ${selected.name} 的任务`} value={instructionValue} onChange={(event) => onInstructionChange(event.target.value)} />}</div>
              {selected.kind !== "agent" || selectedStatus === "done" ? <>
                <div><dt>它是怎么回答的</dt><dd>{selected.detail}</dd></div>
                <div><dt>它参考了这些内容</dt><dd>{selected.evidence}</dd></div>
              </> : <div className={`inspector-pending ${selectedStatus}`}><dt>{selectedStatus === "running" ? "正在处理" : "尚未执行"}</dt><dd>{selectedStatus === "running" ? "Agent 正在逐步执行任务。完成后，这里才会显示它的回答和引用证据。" : "这个 Agent 还没有开始。回答和证据会在执行完成后出现。"}</dd></div>}
              <div><dt>现在的状态</dt><dd>{selected.kind === "agent" ? statusLabel(selectedStatus) : "已连接"}</dd></div>
            </dl>
          </>}
        </aside>
      </div>
      <footer><span>{nodes.length} 个节点 · 自动连线</span><button onClick={onClose}>{readOnly ? "返回当前流程" : "保存编排"}</button></footer>
    </section>
  </div>;
}

function DealerMockModal({ type, documentsComplete, onDocumentsComplete, onClose, onSubmit }: { type: "repair" | "supplement"; documentsComplete: boolean; onDocumentsComplete: (value: boolean) => void; onClose: () => void; onSubmit: () => void }) {
  const title = type === "repair" ? "维修与 CLAIM 回写" : "Dealer 补件回写";
  return <div className="chat-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dealer-modal" role="dialog" aria-modal="true" aria-labelledby="dealer-modal-title">
      <header><div><span>MOCK · CCO EVENT</span><h2 id="dealer-modal-title">{title}</h2></div><button onClick={onClose} aria-label="关闭 Mock 回写"><X size={22} /></button></header>
      {type === "repair" && <><div className="mock-receipt"><Wrench size={22} /><div><strong>车辆维修与一年延保已完成</strong><span>Dealer 将维修单和 CLAIM 文件回写 CCO。</span></div></div><fieldset><legend>演示资料状态</legend><label className={documentsComplete ? "selected" : ""}><input type="radio" checked={documentsComplete} onChange={() => onDocumentsComplete(true)} /><span><FileText size={20} /><b>资料完整</b><small>进入正常审批</small></span></label><label className={!documentsComplete ? "selected" : ""}><input type="radio" checked={!documentsComplete} onChange={() => onDocumentsComplete(false)} /><span><WarningCircle size={20} /><b>缺少授权签字</b><small>演示补件路径</small></span></label></fieldset></>}
      {type === "supplement" && <div className="mock-receipt"><FileText size={22} /><div><strong>客户授权文件已补充</strong><span>提交后将重新触发 OCR 审核。</span></div></div>}
      <footer><button onClick={onClose}>取消</button><button onClick={onSubmit}>提交 CCO 回写</button></footer>
    </section>
  </div>;
}

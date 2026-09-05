/** Demo topology only: protocol labels do not initiate network requests. */
/** Hide the future process entirely until its handoff actually starts.
 * @template {{id: string}} T
 * @param {T[]} nodes
 * @param {Record<string, "waiting" | "running" | "done">} statuses
 * @returns {T[]}
 */
export function visibleAgentNodes(nodes, statuses) {
  const claimStarted = statuses["claim-process"] === "running" || statuses["claim-process"] === "done";
  return nodes.filter((node) => node.id !== "claim-process" || claimStarted);
}

const retentionCalls = [
  { source: "retention", target: "repair-history", protocol: "MCP", command: "tools/call · repair_history", input: "CCO-CMP-2026-0096 · VIN · 购车日附近维修工单", route: [[50, 12], [50, 27], [15, 27], [15, 36]], label: [15, 28] },
  { source: "retention", target: "technical", protocol: "MCP", command: "tools/call · technical_service", input: "VIN · 已登记维修方案", route: [[50, 12], [50, 36]], label: [39, 29] },
  { source: "retention", target: "mobility", protocol: "MCP", command: "tools/call · mobility_availability", input: "Dealer · 未来一周代步车", route: [[50, 12], [50, 27], [63, 27], [63, 36]], label: [63, 28] },
  { source: "retention", target: "warranty", protocol: "MCP", command: "tools/call · warranty_status", input: "VIN · FRD 保修开始日 · 当前里程", route: [[50, 12], [50, 27], [85, 27], [85, 36]], label: [85, 28] },
  { source: "retention", target: "customer-care", protocol: "编排", command: "生成客户补偿方案与沟通话术", input: "已审批的维修、代步车与 Warranty 结果", route: [[50, 12], [50, 68]], label: [50, 54] },
  { source: "retention", target: "claim-process", protocol: "A2A", command: "委派 CCA 审批任务", input: "CCA-2026-0068 · DealerRepairAndClaimSubmitted · 待审核材料", route: [[50, 12], [97, 12], [97, 88], [85, 88]], label: [94, 76] },
];

/** @param {string} phase @param {{id: string, name: string, x: number, y: number, kind: string}[]} nodes */
export function getAgentCalls(phase, nodes) {
  const find = (id) => nodes.find((node) => node.id === id);
  const known = phase === "intake" ? [
    { source: "router", target: "cco-execution", protocol: "编排", command: "创建 CCO 投诉案件", input: "已识别的客户投诉与原始录音", route: [[50, 52], [50, 74]], label: [50, 63] },
  ] : phase === "retention" ? retentionCalls : phase === "claim" ? [
    { source: "retention", target: "claim-process", protocol: "A2A", command: "委派 CCA 审批任务", input: "CCA-2026-0068 · DealerRepairAndClaimSubmitted · 待审核材料", route: [[18, 15], [50, 15], [50, 31]], label: [35, 15] },
    { source: "claim-process", target: "ocr", protocol: "编排", command: "核验 CLAIM 文件", input: "Dealer 上传的申请表、维修单和授权文件", route: [[50, 38], [28, 63]], label: [36, 51] },
    { source: "claim-process", target: "writer", protocol: "编排", command: "审批完成后回写 CCO", input: "Approved 审批决定 · CCA-2026-0068", route: [[50, 38], [72, 63]], label: [64, 51] },
  ] : [];
  const calls = known.filter((call) => find(call.source) && find(call.target));
  const root = find(phase === "retention" ? "retention" : phase === "claim" ? "claim-process" : "router");
  if (root) for (const node of nodes.filter((node) => node.kind !== "agent")) {
    calls.push({ source: root.id, target: node.id, protocol: "连接", command: "连接系统 / 数据源", input: "当前案件上下文", route: [[root.x, root.y], [node.x, node.y]], label: [(root.x + node.x) / 2, (root.y + node.y) / 2] });
  }
  return calls.map((call) => ({ ...call, id: `${call.source}:${call.target}`, sourceName: find(call.source).name, targetName: find(call.target).name }));
}

/** Never infer that a planned call ran just because a phase is complete.
 * @param {{target: string}} call
 * @param {Record<string, "waiting" | "running" | "done">} statuses
 */
export function getCallStatus(call, statuses) {
  return statuses[call.target] ?? "waiting";
}

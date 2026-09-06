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
  { source: "retention", target: "repair-history", protocol: "MCP", command: "tools/call · repair_history", input: "CCO-CMP-2026-0096 · VIN · 购车日附近维修工单" },
  { source: "retention", target: "technical", protocol: "MCP", command: "tools/call · technical_service", input: "VIN · 已登记维修方案" },
  { source: "retention", target: "mobility", protocol: "MCP", command: "tools/call · mobility_availability", input: "Dealer · 未来一周代步车" },
  { source: "retention", target: "warranty", protocol: "MCP", command: "tools/call · warranty_status", input: "VIN · FRD 保修开始日 · 当前里程" },
  { source: "retention", target: "customer-care", protocol: "编排", command: "生成客户补偿方案与沟通话术", input: "已审批的维修、代步车与 Warranty 结果" },
  { source: "retention", target: "claim-process", protocol: "A2A", command: "委派 CCA 审批任务", input: "CCA-2026-0068 · DealerRepairAndClaimSubmitted · 待审核材料" },
];

/** @param {string} phase @param {{id: string, name: string, x: number, y: number, kind: string}[]} nodes */
export function getAgentCalls(phase, nodes) {
  const find = (id) => nodes.find((node) => node.id === id);
  const known = phase === "intake" ? [
    { source: "router", target: "cco-execution", protocol: "编排", command: "创建 CCO 投诉案件", input: "已识别的客户投诉与原始录音" },
  ] : phase === "retention" ? retentionCalls : phase === "claim" ? [
    { source: "retention", target: "claim-process", protocol: "A2A", command: "委派 CCA 审批任务", input: "CCA-2026-0068 · DealerRepairAndClaimSubmitted · 待审核材料" },
    { source: "claim-process", target: "ocr", protocol: "编排", command: "核验 CLAIM 文件", input: "Dealer 上传的申请表、维修单和授权文件" },
    { source: "claim-process", target: "writer", protocol: "编排", command: "审批完成后回写 CCO", input: "Approved 审批决定 · CCA-2026-0068" },
  ] : [];
  const calls = known.filter((call) => find(call.source) && find(call.target));
  // A resource belongs to the agent that uses it, rather than every resource
  // being attached to the process root. Do not invent a missing caller.
  const resourceOwners = {
    "cco-intake": "cco-execution", frd: find("warranty") ? "warranty" : "technical",
    "cco-retention": "retention", "cco-claim": "writer",
  };
  for (const node of nodes.filter((node) => node.kind !== "agent")) {
    const owner = find(resourceOwners[node.id]);
    if (owner) calls.push({ source: owner.id, target: node.id, protocol: "连接", command: "连接系统 / 数据源", input: "当前案件上下文" });
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

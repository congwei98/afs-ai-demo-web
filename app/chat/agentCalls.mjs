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
  { source: "retention", target: "technical", protocol: "MCP", command: "tools/call · technical_investigation", input: "CCO-CMP-2026-0096 · VIN · 维修工单", route: [[50, 12], [50, 27], [15, 27], [15, 36]], label: [15, 28] },
  { source: "retention", target: "legal", protocol: "MCP", command: "tools/call · legal_risk_validation", input: "车辆基础数据 · 同故障维修记录（不含客户沟通历史）", route: [[50, 12], [50, 36]], label: [50, 29] },
  { source: "retention", target: "warranty", protocol: "MCP", command: "tools/call · warranty_mobility", input: "VIN · Dealer · 在保状态及关怀权益", route: [[50, 12], [50, 27], [85, 27], [85, 36]], label: [85, 28] },
  { source: "retention", target: "parts", protocol: "MCP", command: "tools/call · parts_availability", input: "Technical Service 已确认的零件号 12-36-8-099-417", route: [[50, 12], [3, 12], [3, 68], [15, 68]], label: [7, 56] },
  { source: "retention", target: "strategy", protocol: "编排", command: "生成客户沟通建议", input: "已确认的技术、三包、零件与关怀结论", route: [[50, 12], [68, 12], [68, 68], [50, 68]], label: [68, 56] },
  { source: "retention", target: "claim-process", protocol: "A2A", command: "委派 CCA 审批任务", input: "CCA-2026-0068 · DealerRepairAndClaimSubmitted · 待审核材料", route: [[50, 12], [97, 12], [97, 88], [85, 88]], label: [94, 76] },
];

/** @param {string} phase @param {{id: string, name: string, x: number, y: number, kind: string}[]} nodes */
export function getAgentCalls(phase, nodes) {
  const find = (id) => nodes.find((node) => node.id === id);
  const known = phase === "retention" ? retentionCalls : phase === "claim" ? [
    { ...retentionCalls[5], route: [[18, 15], [50, 15], [50, 31]], label: [35, 15] },
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

/** Fixed node bounds and one coordinate system for cards, ports and SVG edges.
 * @param {string} phase
 * @param {Array<{id:string,name:string,kind:string}>} nodes
 * @param {Array<{id:string,source:string,target:string,sourceName:string,targetName:string,protocol:string,command:string,input:string}>} calls
 */
export function layoutOrchestration(phase, nodes, calls) {
  const ranks = phase === "retention"
    ? { retention: 0, "repair-history": 1, technical: 1, mobility: 1, warranty: 1, "customer-care": 2, "claim-process": 3 }
    : phase === "claim" ? { retention: 0, "claim-process": 1, ocr: 2, writer: 2 }
    : { router: 0, "cco-execution": 1 };
  const rankOf = (node) => ranks[node.id] ?? (node.kind === "agent" ? 0 : (ranks[calls.find((call) => call.target === node.id)?.source] ?? 0) + 1);
  const maxRank = Math.max(0, ...nodes.map(rankOf));
  const rows = Array.from({ length: maxRank + 1 }, (_, rank) => nodes.filter((node) => rankOf(node) === rank));
  const width = Math.max(660, ...rows.map((row) => row.length * 220 + 160));
  const height = (maxRank + 1) * 200 + 40;
  const placed = rows.flatMap((row, rank) => row.map((node, index) => ({ ...node, x: (width - 100) / 2 + (index - (row.length - 1) / 2) * 220, y: 80 + rank * 200, width: 184, height: 104, rank })));
  let bypass = 0;
  const edges = calls.map((call) => {
    const source = placed.find((node) => node.id === call.source);
    const target = placed.find((node) => node.id === call.target);
    const start = [source.x, source.y + source.height / 2];
    const end = [target.x, target.y - target.height / 2];
    const busY = end[1] - 38;
    const route = target.rank - source.rank > 1
      ? [start, [start[0], start[1] + 24], [width - 26 - bypass++ * 16, start[1] + 24], [width - 26 - (bypass - 1) * 16, busY], [end[0], busY], end]
      : [start, [start[0], busY], [end[0], busY], end];
    return { ...call, route, label: [end[0], busY] };
  });
  return { nodes: placed, edges, width, height };
}

const results = {
  router: "新车交付当天出现发动机抖动，客户明确要求退车。已识别为高风险质量投诉，建议创建 CCO 案件。",
  "cco-execution": "已创建 CCO-CMP-2026-0096，并关联客户诉求和原始录音。",
  retention: "已生成调查计划：查询维修记录、技术方案与代步车资源；按确认范围补充 Warranty 查询。",
  "repair-history": "4 月 4 日进店检查：二缸点火线圈工作不良，导致缺火抖动。",
  technical: "4 月 7 日技术反馈：更换全部点火线圈，共 6 个。",
  mobility: "经销商未来一周有一辆 BMW 5 系代步车可用。",
  warranty: "FRD 保修开始日：2026 年 4 月 3 日；当前里程：91 km。",
  "customer-care": "已生成客户关怀方案：维修安排、代步车支持及一年延保，并准备客户沟通话术。",
  "claim-process": "已接收 Dealer 材料并启动文档审核；回写仍需等待审核结果与人工批准。",
  ocr: "已核对 3 份文件的 VIN、日期与签字，资料完整，可交由人工审批。",
  writer: "审批通过后已回写 CCO，收到成功回执 WR-2026-0068。",
};

/** Status-gated mock records: planned nodes never expose results or fake logs. */
export function nodeExecution(node, status, stage) {
  if (node.kind !== "agent" || status === "waiting") return { events: [], result: null };
  const events = [
    { label: "已接收任务与案件上下文", state: "done" },
    { label: "正在按计划处理", state: status === "running" ? "running" : "done" },
  ];
  if (status !== "done") return { events, result: null };
  events[1].label = "已完成计划中的处理步骤";
  events.push({ label: "已返回执行结果", state: "done" });
  const result = node.id === "ocr" && stage === "waiting_supplement"
    ? "客户授权签字缺失，审核已暂停。等待 Dealer 补件后重新核验，当前不能批准。"
    : results[node.id] ?? node.detail;
  return { events, result };
}

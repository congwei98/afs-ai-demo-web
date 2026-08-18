export type EvidenceBlock =
  | { kind: "records"; title: string; summary: string; rows: Array<{ date: string; record: string; finding: string; highlight?: boolean }> }
  | { kind: "diagnosis"; title: string; summary: string; documents: Array<{ title: string; date: string; statements: Array<{ text: string; highlight?: boolean }> }> }
  | { kind: "cases"; title: string; summary: string; cases: Array<{ id: string; score: number; issue: string; request: string; repairs: string; outcome: string; differences: string }> }
  | { kind: "parts"; title: string; summary: string; rows: Array<{ date: string; part: string; order: string; result: string; highlight?: boolean }> }
  | { kind: "ocr"; title: string; summary: string; fields: Array<{ label: string; value: string; confidence: string; highlight?: boolean }> };

export type ReviewAgent = {
  id: string;
  name: string;
  system: string;
  role: "Data Agent" | "Knowledge Agent" | "Document Agent";
  category: "warranty" | "technical" | "knowledge" | "parts" | "ocr";
  purpose: string;
  requirement: string;
  resultSummary: string;
  decisionImpact: string;
  evidence: EvidenceBlock;
  addedBy?: "Human";
};

export const reviewPlanContext = {
  objective: "Check the policy and suggest how BMW and the dealer should share the cost.",
  recommendation:
    "Check the repair history, confirm the fault source, and compare similar cases before suggesting the cost share.",
  evidence: [
    { label: "Complaint", value: "Recurring loss of power" },
    { label: "Repair history", value: "Customer stated 3 visits" },
    { label: "Customer request", value: "Vehicle return" },
  ],
};

export const recommendedReviewAgents: ReviewAgent[] = [
  {
    id: "warranty",
    name: "Warranty Agent",
    system: "BBS-A-4",
    role: "Data Agent",
    category: "warranty",
    purpose: "Check repair count and policy fit",
    requirement: "Get the repair and warranty records for this VIN. Count repairs for the same fault and check the Three Guarantees rule.",
    resultSummary: "The same fault was repaired three times. The policy rule is met.",
    decisionImpact: "Supports handling this case under Three Guarantees.",
    evidence: {
      kind: "records",
      title: "Warranty & repair records",
      summary: "3 related repair orders found for the same loss-of-power symptom.",
      rows: [
        { date: "18 Oct 2025", record: "RO-450218", finding: "Power loss reported; software reset performed" },
        { date: "02 Dec 2025", record: "RO-468011", finding: "Same symptom returned; control unit replaced", highlight: true },
        { date: "11 Feb 2026", record: "RO-492674", finding: "Third repair attempt; issue remains unresolved", highlight: true },
      ],
    },
  },
  {
    id: "technical",
    name: "Technical Service Agent",
    system: "C5-CN-A-6",
    role: "Data Agent",
    category: "technical",
    purpose: "Check the TSARA result and fault source",
    requirement: "Get the latest TSARA result. Check whether the fault comes from the product, is still open, and was not caused by dealer repair work.",
    resultSummary: "TSARA says the fault comes from the product. No dealer-caused damage was found.",
    decisionImpact: "Confirms the fault source. The cost share is checked separately.",
    evidence: {
      kind: "diagnosis",
      title: "TSARA Result",
      summary: "Two decisive TSARA findings establish product responsibility and exclude dealer workmanship.",
      documents: [
        {
          title: "TSARA Result TS-2026-117",
          date: "20 May 2026",
          statements: [
            { text: "Intermittent power-control failure reproduced during road test." },
            { text: "Root cause is assessed as an internal product issue; no evidence of dealer-induced damage.", highlight: true },
            { text: "Available repair measures cannot provide a stable resolution at this time.", highlight: true },
          ],
        },
      ],
    },
  },
  {
    id: "knowledge",
    name: "Case Knowledge Agent",
    system: "Enterprise Knowledge",
    role: "Knowledge Agent",
    category: "knowledge",
    purpose: "Compare cost shares in similar cases",
    requirement: "Find past Three Guarantees cases with the same fault and customer request. Compare the repair count and the BMW/dealer cost share.",
    resultSummary: "The closest cases use BMW 20% and dealer 80%.",
    decisionImpact: "Supports BMW 20% and dealer 80% for this case.",
    evidence: {
      kind: "cases",
      title: "Comparable case analysis",
      summary: "Cases are ranked by product issue, customer request and repair-history similarity.",
      cases: [
        { id: "CC-2025-1123", score: 96, issue: "Recurring power loss · close match", request: "Vehicle return · exact match", repairs: "3 repairs · exact match", outcome: "Applicable · BMW 20% / Dealer 80%", differences: "Same fault origin, repair count and customer request." },
        { id: "CC-2025-0876", score: 88, issue: "High-voltage shutdown · close match", request: "Vehicle return · exact match", repairs: "4 repairs · close match", outcome: "Applicable · BMW 20% / Dealer 80%", differences: "One additional repair attempt; commercial allocation is the same." },
        { id: "CC-2025-0542", score: 67, issue: "Product control-unit fault · related", request: "Vehicle return · exact match", repairs: "1 repair · low match", outcome: "Not covered · case closed", differences: "Repair count was below the Three Guarantees threshold." },
      ],
    },
  },
];

export const optionalReviewAgents: ReviewAgent[] = [
  {
    id: "data-custom",
    name: "New Data Agent",
    system: "BBS-A-3 Parts",
    role: "Data Agent",
    category: "parts",
    purpose: "Check whether key parts took over 30 days to arrive",
    requirement: "Check BBS-A-3 for parts linked to these repairs. Compare order and arrival dates. Flag any key part that took more than 30 days.",
    resultSummary: "The power-control module took 36 days to arrive, 6 days over the limit.",
    decisionImpact: "Adds context about parts supply for the final decision.",
    evidence: {
      kind: "parts",
      title: "Parts delivery timeline",
      summary: "One critical replacement part exceeded the 30-day arrival threshold.",
      rows: [
        { date: "Ordered 03 Jan", part: "Power control module", order: "PO-88341", result: "Arrived 08 Feb · 36 days", highlight: true },
        { date: "Ordered 12 Feb", part: "Control module harness", order: "PO-92407", result: "Arrived 24 Feb · 12 days" },
      ],
    },
    addedBy: "Human",
  },
  {
    id: "ocr",
    name: "OCR Agent",
    system: "Document Services",
    role: "Document Agent",
    category: "ocr",
    purpose: "Check the scanned complaint against the call",
    requirement: "Read the complaint scan. Get the customer, vehicle, issue, and request. Compare them with the call.",
    resultSummary: "The scanned complaint matches the customer, vehicle, issue and return request in the call.",
    decisionImpact: "Confirms the scan and the call describe the same complaint.",
    evidence: {
      kind: "ocr",
      title: "Scanned complaint verification",
      summary: "4 fields extracted and matched to the complaint record.",
      fields: [
        { label: "Customer", value: "Mr. Wang", confidence: "99%" },
        { label: "Vehicle", value: "DEMO-VIN-0088", confidence: "99%" },
        { label: "Issue", value: "Repeated loss of driving power", confidence: "96%", highlight: true },
        { label: "Requested resolution", value: "Vehicle return", confidence: "98%", highlight: true },
      ],
    },
    addedBy: "Human",
  },
];

export const settlementRecommendation = {
  type: "Suggested result",
  title: "Apply Three Guarantees and share the cost",
  applicability: "Applicable",
  bmwShare: 20,
  dealerShare: 80,
  summary: "The same fault remained after three repairs. It comes from the product. Similar cases support BMW 20% and dealer 80%.",
  conclusions: [
    { id: "coverage", label: "Policy check", value: "Three Guarantees applies", agentId: "warranty", rationale: "The same fault remained after three repairs." },
    { id: "origin", label: "Fault source", value: "Product issue", agentId: "technical", rationale: "TSARA found a product issue and no dealer-caused damage." },
    { id: "allocation", label: "Cost share", value: "BMW 20% / Dealer 80%", agentId: "knowledge", rationale: "The closest past cases used the same share." },
  ],
};

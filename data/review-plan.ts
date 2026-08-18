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
  objective: "Determine Three Guarantees applicability and recommend the compensation allocation between BMW and the dealer.",
  recommendation:
    "Verify Three Guarantees eligibility, establish the technical fault origin, then benchmark comparable cases to recommend the commercial compensation shares between BMW and the dealer.",
  evidence: [
    { label: "Complaint", value: "Recurring loss of power" },
    { label: "Repair history", value: "Customer stated 3 visits" },
    { label: "Customer request", value: "Vehicle return" },
  ],
};

export const recommendedReviewAgents: ReviewAgent[] = [
  {
    id: "warranty",
    name: "Warranty",
    system: "BBS-A-4",
    role: "Data Agent",
    category: "warranty",
    purpose: "Verify repair frequency and Three Guarantees eligibility",
    requirement: "Retrieve all repair orders and warranty claims for this VIN. Confirm how many times the same loss-of-power issue was repaired and whether the return threshold is met.",
    resultSummary: "Three repair visits for the same issue were confirmed; the repeated-repair threshold is met.",
    decisionImpact: "Supports the conclusion that the case is covered by the Three Guarantees repeated-repair provision.",
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
    name: "Technical Service",
    system: "C5-CN-A-6",
    role: "Data Agent",
    category: "technical",
    purpose: "Use the TSARA Result to determine responsibility allocation",
    requirement: "Retrieve the latest TSARA Result. Identify whether the fault is product-related, remains unresolved, and was not introduced by dealer repair work so responsibility can be allocated between BMW and the dealer.",
    resultSummary: "The TSARA Result attributes the unresolved fault to the product and finds no dealer-induced damage.",
    decisionImpact: "Confirms the product-origin basis for Three Guarantees handling. The commercial BMW/dealer compensation split is determined separately from technical fault attribution.",
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
    name: "Previous Case Guidance",
    system: "Enterprise Knowledge",
    role: "Knowledge Agent",
    category: "knowledge",
    purpose: "Benchmark BMW and dealer compensation allocations",
    requirement: "Find previous Three Guarantees cases involving recurring product faults and vehicle-return requests. Rank relevance using fault origin, customer request and repair count; compare the BMW/dealer compensation allocation in each case.",
    resultSummary: "Highly comparable cases use a BMW 20% / Dealer 80% commercial compensation allocation.",
    decisionImpact: "Supports 20% BMW and 80% dealer as the recommended commercial allocation for this Three Guarantees case.",
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
    id: "parts",
    name: "Parts",
    system: "BBS-A-3",
    role: "Data Agent",
    category: "parts",
    purpose: "Check whether critical parts arrival exceeded 30 days",
    requirement: "Query BBS-A-3 for parts ordered against the related repair orders. Compare each order date with its actual dealer arrival date and flag any critical part that took more than 30 days to arrive.",
    resultSummary: "The replacement power-control module arrived after 36 days—6 days beyond the 30-day threshold.",
    decisionImpact: "Provides additional context on BMW parts-supply responsibility if this step is included in the plan.",
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
    name: "Complaint Document OCR",
    system: "Document Services",
    role: "Document Agent",
    category: "ocr",
    purpose: "Validate the scanned complaint against the call record",
    requirement: "Read the regulator complaint scan. Extract the claimant, vehicle, reported issue and requested resolution, then compare them with the call transcript.",
    resultSummary: "The scanned complaint matches the customer, vehicle, issue and return request in the call.",
    decisionImpact: "Confirms that the written complaint supports the same issue and requested resolution used in the recommendation.",
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
  applicability: "Applicable",
  bmwShare: 20,
  dealerShare: 80,
  summary: "Three Guarantees applies. The TSARA Result confirms a product-origin fault; comparable cases support a commercial compensation allocation of 20% BMW and 80% dealer.",
  conclusions: [
    { id: "coverage", label: "Three Guarantees", value: "Applicable", agentId: "warranty", rationale: "Three repairs for the same unresolved fault meet the repeated-repair threshold." },
    { id: "origin", label: "Technical fault origin", value: "Product-related", agentId: "technical", rationale: "The TSARA Result identifies a product-origin fault and excludes dealer-induced damage." },
    { id: "allocation", label: "Recommended compensation", value: "BMW 20% / Dealer 80%", agentId: "knowledge", rationale: "Highly comparable Three Guarantees cases consistently use a 20% BMW / 80% dealer commercial allocation." },
  ],
};

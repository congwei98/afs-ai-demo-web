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
  evidence: EvidenceBlock;
  addedBy?: "Human";
};

export const reviewPlanContext = {
  objective: "Determine whether this complaint qualifies for a Three Guarantees vehicle return.",
  recommendation:
    "Verify repeated-repair eligibility, confirm that the unresolved fault is product-related, then compare similar return decisions before recommending an outcome.",
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
    purpose: "Confirm fault origin and whether further repair is viable",
    requirement: "Retrieve the latest diagnostic report and technical escalation. Identify whether the fault is product-related, remains unresolved, and was not introduced by dealer repair work.",
    resultSummary: "The fault is product-related, unresolved with the current repair method, and not caused by dealer workmanship.",
    evidence: {
      kind: "diagnosis",
      title: "Technical diagnosis",
      summary: "Two decisive statements matched the eligibility criteria.",
      documents: [
        {
          title: "Technical Escalation TE-2026-117",
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
    purpose: "Compare prior decisions and explain case relevance",
    requirement: "Find previous cases involving recurring product faults and vehicle-return requests. Rank relevance using issue type, customer request and repair count; explain both matches and differences.",
    resultSummary: "Two highly relevant return cases and one partially relevant case were found.",
    evidence: {
      kind: "cases",
      title: "Comparable case analysis",
      summary: "Cases are ranked by product issue, customer request and repair-history similarity.",
      cases: [
        { id: "CC-2025-1123", score: 96, issue: "Recurring power loss · close match", request: "Vehicle return · exact match", repairs: "3 repairs · exact match", outcome: "Vehicle return completed", differences: "Same fault pattern and request; no material difference." },
        { id: "CC-2025-0876", score: 88, issue: "High-voltage shutdown · close match", request: "Vehicle return · exact match", repairs: "4 repairs · close match", outcome: "Vehicle return completed", differences: "One additional repair attempt before approval." },
        { id: "CC-2025-0542", score: 67, issue: "Product control-unit fault · related", request: "Vehicle return · exact match", repairs: "1 repair · low match", outcome: "Further repair offered", differences: "Repair count was below the repeated-repair threshold." },
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
    purpose: "Verify parts ordered during previous repairs",
    requirement: "Query BBS-A-3 for parts ordered against the three repair orders. Confirm whether the same power-control components were repeatedly replaced.",
    resultSummary: "The same power-control component family was ordered twice across related repairs.",
    evidence: {
      kind: "parts",
      title: "Parts order history",
      summary: "2 related component orders found.",
      rows: [
        { date: "02 Dec 2025", part: "Power control module", order: "PO-88341", result: "Installed under RO-468011", highlight: true },
        { date: "11 Feb 2026", part: "Control module harness", order: "PO-92407", result: "Installed under RO-492674", highlight: true },
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

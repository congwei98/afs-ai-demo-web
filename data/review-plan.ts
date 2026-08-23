export type AgentSources =
  | {
      type: "data";
      title: string;
      records: Array<{ id: string; date?: string; facts: string[]; relevance: string; rawPreview?: string }>;
    }
  | {
      type: "knowledge";
      title: string;
      matches: Array<{ id: string; title: string; sourceType: string; relevance: number; matchedOn: string[]; caveat?: string; contribution: string; excerpt?: string }>;
    };

export type ReviewAgent = {
  id: string;
  name: string;
  system: string;
  role: "Data Agent" | "Knowledge Agent";
  category: "warranty" | "technical" | "knowledge" | "parts";
  purpose: string;
  requirement: string;
  resultSummary: string;
  decisionImpact: string;
  sources: AgentSources;
  addedBy?: "Human";
};

export const reviewPlanContext = {
  objective: "Check policy applicability and return conditions before considering the customer remedy and internal allocation.",
  recommendation:
    "Verify scope, test every relevant return condition, trace the fault and parts timeline, then compare approved cases.",
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
    purpose: "Verify coverage and repair history",
    requirement: "Get the repair and warranty records for this VIN. Verify the Three Guarantees period and map the repair facts to each relevant rule without treating three visits as a standalone return condition.",
    resultSummary: "Coverage is active. Three visits are verified, but that count alone does not meet the more-than-four-repairs condition.",
    decisionImpact: "Confirms scope and prevents an incorrect repair-count conclusion; other independent conditions still require review.",
    sources: {
      type: "data",
      title: "Warranty & repair records",
      records: [
        { id: "RO-450218", date: "18 Oct 2025", facts: ["Power loss reported", "Software reset performed"], relevance: "Starts the recurring-fault history.", rawPreview: "Repair order confirms the first recorded loss-of-power complaint and software reset." },
        { id: "RO-468011", date: "02 Dec 2025", facts: ["Same symptom returned", "Control unit replaced"], relevance: "Confirms the same fault returned after repair.", rawPreview: "Repair order records the repeated symptom and control-unit replacement." },
        { id: "RO-492674", date: "11 Feb 2026", facts: ["Third repair attempt", "Issue remains unresolved"], relevance: "Supports repeated unsuccessful repair history; not a standalone legal threshold.", rawPreview: "Repair order confirms the third visit and unresolved customer complaint." },
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
    resultSummary: "TSARA classifies the recurring loss of driving power as a serious safety-performance fault that remains unresolved after two repair attempts. No dealer-caused damage was found.",
    decisionImpact: "Supports a separate return-condition pathway; the final eligibility and remedy remain a human decision.",
    sources: {
      type: "data",
      title: "Technical records",
      records: [
        { id: "TS-2026-117", date: "20 May 2026", facts: ["Serious safety-performance fault reproduced", "Product-related root cause", "No dealer-induced damage", "No stable repair measure available"], relevance: "Supports a separate vehicle-return condition based on the unresolved safety fault.", rawPreview: "TSARA road-test and root-cause statements used by the Technical Service Agent." },
      ],
    },
  },
  {
    id: "knowledge",
    name: "Case Knowledge Agent",
    system: "Enterprise Knowledge",
    role: "Knowledge Agent",
    category: "knowledge",
    purpose: "Compare policy reasoning and internal allocations",
    requirement: "Find approved cases with a comparable serious safety-performance fault and return request. Compare rule reasoning, evidence gaps and internal allocations without copying a historical outcome.",
    resultSummary: "The closest cases use BMW 20% and dealer 80%.",
    decisionImpact: "Supports BMW 20% and dealer 80% for this case.",
    sources: {
      type: "knowledge",
      title: "Comparable knowledge matches",
      matches: [
        { id: "CC-2025-1123", title: "Approved serious power-loss return case", sourceType: "Approved case", relevance: 94, matchedOn: ["Same safety-performance fault", "Same vehicle-return request", "Same policy pathway"], caveat: "Different vehicle model and repair dates.", contribution: "Supports BMW 20% / Dealer 80% as an internal allocation reference.", excerpt: "Approved return after the safety-performance fault remained unresolved following two repair attempts." },
        { id: "CC-2025-0876", title: "High-voltage shutdown return case", sourceType: "Approved case", relevance: 88, matchedOn: ["Comparable safety issue", "Same requested remedy", "Similar unsuccessful repair history"], caveat: "One additional repair attempt.", contribution: "Confirms the same internal allocation was used in a close case.", excerpt: "Vehicle return approved with BMW 20% / Dealer 80% internal allocation." },
        { id: "CC-2025-0542", title: "Control-unit fault case", sourceType: "Closed case", relevance: 67, matchedOn: ["Related product fault", "Same vehicle-return request"], caveat: "Only one repair and no matching safety classification.", contribution: "Provides a counterexample and prevents copying an outcome without checking differences.", excerpt: "Return request was not approved because the evidence did not establish the same policy condition." },
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
    sources: {
      type: "data",
      title: "Parts delivery timeline",
      records: [
        { id: "PO-88341", date: "Ordered 03 Jan", facts: ["Power control module", "Arrived 08 Feb", "36-day delivery"], relevance: "Confirms the critical part exceeded the 30-day arrival threshold.", rawPreview: "Parts order and receipt timestamps show a 36-day delivery interval." },
        { id: "PO-92407", date: "Ordered 12 Feb", facts: ["Control module harness", "Arrived 24 Feb", "12-day delivery"], relevance: "Provides the comparison record for a normal delivery interval.", rawPreview: "Parts order and receipt timestamps show a 12-day delivery interval." },
      ],
    },
    addedBy: "Human",
  },
];

export const settlementRecommendation = {
  type: "AI assessment · human decision required",
  title: "Likely eligible for vehicle return",
  applicability: "Likely eligible",
  bmwShare: 20,
  dealerShare: 80,
  summary: "The vehicle is in scope and TSARA classifies the unresolved loss of driving power as a serious safety-performance fault after repeated repair attempts. Three visits are supporting history, not the standalone legal basis. Internal allocation is assessed separately.",
  conclusions: [
    { id: "coverage", label: "Scope & repair count", value: "In scope · 3 visits not standalone threshold", agentId: "warranty", rationale: "Coverage is active, while the more-than-four-repairs condition is not met by three visits alone." },
    { id: "origin", label: "Fault source", value: "Product issue", agentId: "technical", rationale: "TSARA found a product issue and no dealer-caused damage." },
    { id: "allocation", label: "Internal allocation", value: "BMW 20% / Dealer 80%", agentId: "knowledge", rationale: "Comparable approved cases inform this internal proposal; it is not a statutory customer entitlement." },
  ],
};

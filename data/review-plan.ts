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
    }
  | {
      type: "ocr";
      title: string;
      documents: Array<{
        id: string;
        name: string;
        pages: number;
        confidence: number;
        fields: Array<{ label: string; value: string; confidence: number }>;
        rawText?: string;
      }>;
    };

export type ReviewAgent = {
  id: string;
  name: string;
  role: "Data Agent" | "Knowledge Agent" | "Document Agent";
  category: "warranty" | "technical" | "knowledge" | "parts" | "ocr";
  purpose: string;
  requirement: string;
  resultSummary: string;
  decisionImpact: string;
  sources: AgentSources;
  addedBy?: "Human";
};

export const reviewPlanContext = {
  recommendation:
    "Verify scope, test every relevant return condition, trace the fault and parts timeline, then compare approved cases.",
  complaintSummary:
    "The customer reports recurring loss of driving power after three dealer visits and requests a vehicle return under the Three Guarantees policy. Customer Care classified the call as a return-candidate complaint; eligibility has not yet been decided.",
};

export const recommendedReviewAgents: ReviewAgent[] = [
  {
    id: "warranty",
    name: "Warranty Agent",
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
    role: "Data Agent",
    category: "parts",
    purpose: "Check whether key parts took over 30 days to arrive",
    requirement: "Check the parts records linked to these repairs. Compare order and arrival dates. Flag any key part that took more than 30 days.",
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
  {
    id: "ocr-custom",
    name: "New OCR Agent",
    role: "Document Agent",
    category: "ocr",
    purpose: "Extract structured fields from dealer attachments",
    requirement: "Read the selected dealer attachments. Extract the document date, repair order number, reported symptom and repair action, and flag fields that need human verification.",
    resultSummary: "Two dealer documents were read and the requested fields were extracted. One lower-confidence field is flagged for review.",
    decisionImpact: "Turns dealer attachments into structured facts that other review steps can use without treating OCR output as a final decision.",
    sources: {
      type: "ocr",
      title: "Extracted dealer documents",
      documents: [
        {
          id: "DOC-01",
          name: "Repair orders.pdf",
          pages: 3,
          confidence: 96,
          fields: [
            { label: "Repair order", value: "RO-492674", confidence: 99 },
            { label: "Document date", value: "11 Feb 2026", confidence: 98 },
            { label: "Reported symptom", value: "Recurring loss of driving power", confidence: 95 },
            { label: "Repair action", value: "Control unit inspection and software update", confidence: 91 },
          ],
          rawText: "Customer reports repeated loss of driving power. Vehicle inspected; control unit and software checked. Customer states the concern remains unresolved.",
        },
        {
          id: "DOC-02",
          name: "Customer contact record.pdf",
          pages: 1,
          confidence: 89,
          fields: [
            { label: "Contact date", value: "20 May 2026", confidence: 97 },
            { label: "Customer request", value: "Vehicle return", confidence: 94 },
            { label: "Dealer response", value: "BMW review required", confidence: 76 },
          ],
          rawText: "Customer requests a vehicle return. Dealer explained that the case must be reviewed by BMW before eligibility can be confirmed.",
        },
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

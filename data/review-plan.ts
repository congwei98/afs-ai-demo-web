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
    "Run the mandatory A6 quality assessment and add A3 because both the complaint and Dealer case information indicate a repair duration over 30 days.",
  complaintSummary:
    "The customer reports recurring loss of driving power, five repair visits for the same issue and one repair lasting more than 30 days while waiting for a part. The customer requests to return the vehicle; 3R eligibility has not yet been decided.",
};

export const recommendedReviewAgents: ReviewAgent[] = [
  {
    id: "warranty",
    name: "Repair History Data Agent",
    role: "Data Agent",
    category: "warranty",
    purpose: "Verify repeated repairs for the same issue",
    requirement: "Get the repair and warranty records for this VIN. Verify the 3R period, confirm that all records concern the same quality issue, and determine whether the repair count exceeds four.",
    resultSummary: "Coverage is active. Five completed repair attempts are verified for the same loss-of-power quality issue, so the more-than-four-repairs condition is met.",
    decisionImpact: "Provides the qualifying 3R condition used by the recommendation: the same quality issue was repaired five times and remains unresolved.",
    sources: {
      type: "data",
      title: "Warranty & repair records",
      records: [
        { id: "RO-DEMO-101", date: "19 Aug 2025", facts: ["Same loss-of-power issue", "Repair attempt 1", "Software update completed"], relevance: "Starts the verified same-issue repair sequence.", rawPreview: "Repair order confirms the first repair attempt for the recurring loss-of-power issue." },
        { id: "RO-DEMO-102", date: "03 Oct 2025", facts: ["Same loss-of-power issue", "Repair attempt 2", "Control unit inspected"], relevance: "Confirms the second repair for the same quality issue.", rawPreview: "Repair order links the repeated symptom to the same fault family." },
        { id: "RO-DEMO-103", date: "12 Dec 2025", facts: ["Same loss-of-power issue", "Repair attempt 3", "Control unit replaced"], relevance: "Confirms the third completed repair attempt.", rawPreview: "Repair order records the same issue and the third completed repair." },
        { id: "RO-DEMO-104", date: "08 Feb 2026", facts: ["Same loss-of-power issue", "Repair attempt 4", "Harness inspected"], relevance: "Confirms the fourth completed repair attempt.", rawPreview: "Repair order records continued recurrence after the fourth repair." },
        { id: "RO-DEMO-105", date: "16 Apr 2026", facts: ["Same loss-of-power issue", "Repair attempt 5", "Issue remains unresolved"], relevance: "Makes the verified repair count exceed four for the same quality issue.", rawPreview: "Repair order confirms the fifth completed repair attempt and unresolved symptom." },
      ],
    },
  },
  {
    id: "technical",
    name: "Technical Quality Assessment Agent",
    role: "Data Agent",
    category: "technical",
    purpose: "Mandatory quality issue and Dealer responsibility check",
    requirement: "Get the latest Technical Service and TSARA findings. Determine whether the symptom matches a known quality issue and whether the dealer failed to follow the required diagnosis or repair procedure.",
    resultSummary: "The symptom matches a known product quality issue. The dealer followed the prescribed diagnosis and repair procedure; no dealer repair negligence was identified.",
    decisionImpact: "Supports Buyback on the product-quality pathway. Dealer contribution in the proposal is a commercial allocation, not a finding of repair negligence.",
    sources: {
      type: "data",
      title: "Technical records",
      records: [
        { id: "TS-DEMO-204", date: "08 May 2026", facts: ["Known product quality issue matched", "Required diagnostic steps completed", "Repair procedure followed", "No dealer repair negligence identified"], relevance: "Establishes the product-quality pathway and separates product responsibility from dealer repair conduct.", rawPreview: "Technical Service review compares the observed symptom with known quality patterns and checks the dealer's diagnosis and repair steps." },
      ],
    },
  },
  {
    id: "parts",
    name: "Parts Timeline Data Agent",
    role: "Data Agent",
    category: "parts",
    purpose: "Check the part order and arrival time behind the 30+ day repair",
    requirement: "Query the parts orders linked to the repair that exceeded 30 days. Compare order and arrival timestamps, identify the delayed part, and calculate the exact waiting duration.",
    resultSummary: "The power-control module was ordered on 03 Jan and arrived on 08 Feb. The 36-day delivery time exceeded the 30-day trigger by 6 days.",
    decisionImpact: "Confirms that the reported repair duration over 30 days was linked to a delayed parts order and requires A3 approval.",
    sources: {
      type: "data",
      title: "A3 parts order timeline",
      records: [
        { id: "PO-DEMO-341", date: "Ordered 03 Jan", facts: ["Power-control module", "Arrived 08 Feb", "36-day delivery"], relevance: "Confirms the part behind the over-30-day repair and calculates the delay.", rawPreview: "CCO-linked parts timestamps show an order on 03 Jan and receipt on 08 Feb." },
        { id: "PO-DEMO-407", date: "Ordered 12 Feb", facts: ["Control-module harness", "Arrived 24 Feb", "12-day delivery"], relevance: "Provides a normal-duration comparison record.", rawPreview: "Parts timestamps show a 12-day order-to-arrival interval." },
      ],
    },
  },
  {
    id: "knowledge",
    name: "Case Knowledge Agent",
    role: "Knowledge Agent",
    category: "knowledge",
    purpose: "Compare policy reasoning and internal allocations",
    requirement: "Find approved cases with a comparable known quality issue and Buyback request. Compare rule reasoning, dealer-conduct findings and itemized cost allocations without copying a historical outcome.",
    resultSummary: "The closest cases use the same valuation and cost-allocation structure, with case-specific amounts.",
    decisionImpact: "Supports an itemized proposal while keeping every amount subject to human review.",
    sources: {
      type: "knowledge",
      title: "Comparable knowledge matches",
      matches: [
        { id: "3R-DEMO-0071", title: "Approved serious power-loss Buyback case", sourceType: "Approved case", relevance: 94, matchedOn: ["Same safety-performance fault", "Same Buyback request", "Same policy pathway"], caveat: "Different vehicle model and repair dates.", contribution: "Supports the valuation and party-allocation structure, not the example amounts.", excerpt: "Buyback was approved after the safety-performance fault remained unresolved following repeated repair attempts." },
        { id: "3R-DEMO-0058", title: "High-voltage shutdown Buyback case", sourceType: "Approved case", relevance: 88, matchedOn: ["Comparable safety issue", "Same requested remedy", "Similar unsuccessful repair history"], caveat: "One additional repair attempt.", contribution: "Confirms that vehicle cost and humanity care are assessed separately.", excerpt: "Buyback approved with case-specific vehicle and humanity-care allocations." },
        { id: "3R-DEMO-0034", title: "Control-unit fault case", sourceType: "Closed case", relevance: 67, matchedOn: ["Related product fault", "Same Buyback request"], caveat: "Only one repair and no matching safety classification.", contribution: "Provides a counterexample and prevents copying an outcome without checking differences.", excerpt: "Buyback was not approved because the evidence did not establish the same policy condition." },
      ],
    },
  },
];

export const optionalReviewAgents: ReviewAgent[] = [
  {
    id: "data-custom",
    name: "Custom Data Agent",
    role: "Data Agent",
    category: "parts",
    purpose: "Add another structured business-data query",
    requirement: "Describe the business question, records to query, filters to apply and the conclusion format required for this investigation.",
    resultSummary: "The configured data query completed and returned structured facts for human review.",
    decisionImpact: "Adds a configurable data point without changing the mandatory approval gates.",
    sources: {
      type: "data",
      title: "Configured business data",
      records: [
        { id: "DATA-DEMO-01", facts: ["Configured query executed", "Requested filters applied", "Structured result returned"], relevance: "Supports the additional investigation question configured by the user.", rawPreview: "Demo preview of the configured business-data query result." },
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
            { label: "Customer request", value: "Buyback", confidence: 94 },
            { label: "Dealer response", value: "BMW review required", confidence: 76 },
          ],
          rawText: "Customer requests a Buyback review. Dealer explained that the case must be reviewed by BMW before eligibility can be confirmed.",
        },
      ],
    },
    addedBy: "Human",
  },
];

export const settlementRecommendation = {
  type: "AI assessment · human decision required",
  title: "Buyback recommended · 3R condition met",
  applicability: "Likely eligible",
  summary: "Warranty verifies five completed repairs for the same quality issue, which exceeds the more-than-four-repairs condition. Technical Service confirms a known product quality issue and finds no dealer repair negligence. Buyback is therefore recommended; the proposed dealer contribution is a commercial allocation rather than a fault finding.",
  eligibility: {
    condition: "Same quality issue repaired more than four times",
    evidence: "5 verified repair orders · same loss-of-power issue · still unresolved",
    result: "3R condition met",
  },
  solution: {
    finalSolution: "Buyback",
    tradeIn: "Yes",
    tradeInModel: "X5 xDrive30Li M Sport",
    usedCarPrice: 398000,
    actualVehiclePrice: 589800,
    customerCoverVehicle: 18000,
    customerCoverHumanityCare: 0,
    purchaseTax: 52195,
    dealerCoverVehicle: 46000,
    dealerCoverHumanityCare: 8000,
    otherCost: 14005,
    bmwCoverVehicle: 194000,
    bmwCoverHumanityCare: 5000,
    totalVehiclePurchaseCost: 656000,
    vehicleCost: 258000,
    humanityCareCost: 13000,
    dealerCover: 54000,
    customerCover: 18000,
    bmwCoverOther: 0,
    bmwTotalCover: 199000,
    bmwRemark: "Demo calculation: accessories and early-termination costs are allocated between BMW and the dealer after case approval.",
  },
  conclusions: [
    { id: "coverage", label: "3R repair-count condition", value: "Met · 5 same-issue repairs", agentId: "warranty", rationale: "Warranty verifies five completed repairs for the same quality issue, exceeding the more-than-four-repairs condition." },
    { id: "origin", label: "Technical Service assessment", value: "Known quality issue · no dealer negligence", agentId: "technical", rationale: "Technical Service matched the symptom to a known quality issue and confirmed that the dealer followed the prescribed repair procedure." },
    { id: "allocation", label: "Internal allocation", value: "Itemized amount proposal", agentId: "knowledge", rationale: "Comparable approved cases inform the cost structure; each amount remains case-specific and requires human approval." },
  ],
};

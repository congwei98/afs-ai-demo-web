export type SemanticType = "reason" | "repair" | "request" | "sentiment" | "outcome";

export type ConversationLine = {
  id: string;
  speaker: "Customer" | "CIC Agent";
  time: string;
  parts: Array<{ text: string; semantic?: SemanticType; correction?: { before: string; after: string } }>;
};

export type CallInsight = {
  key: SemanticType;
  label: string;
  value: string;
  evidenceId?: string;
  evidenceTime?: string;
};

export type HistoricalCall = {
  id: string;
  sequence: number;
  date: string;
  duration: string;
  conversation: ConversationLine[];
  narrative: string;
  insights: CallInsight[];
};

export const historicalCalls: HistoricalCall[] = [
  {
    id: "call-2025-10-18",
    sequence: 1,
    date: "18 Oct 2025",
    duration: "02:18",
    conversation: [
      { id: "call1-reason", speaker: "Customer", time: "00:08", parts: [{ text: "The vehicle briefly " }, { text: "lost power when I accelerated onto the main road", semantic: "reason" }, { text: ". It recovered after I restarted it, but " }, { text: "I would like it checked", semantic: "request" }, { text: "." }] },
      { id: "call1-outcome", speaker: "CIC Agent", time: "00:31", parts: [{ text: "I have recorded this as the first power-loss incident and will " }, { text: "arrange a diagnostic appointment with the dealer", semantic: "outcome" }, { text: "." }] },
      { id: "call1-sentiment", speaker: "Customer", time: "00:48", parts: [{ text: "That is fine. " }, { text: "I am concerned", semantic: "sentiment" }, { text: ", but I hope it is only a software issue." }] },
      { id: "call1-repair", speaker: "CIC Agent", time: "01:04", parts: [{ text: "The dealer will " }, { text: "inspect the power-control system during the first repair visit", semantic: "repair" }, { text: " and update you afterwards." }] },
    ],
    narrative: "The customer reported the first power-loss incident. CIC Agent recorded the issue and arranged the first dealer visit. The customer was concerned but cooperative.",
    insights: [
      { key: "reason", label: "Contact reason", value: "First intermittent loss-of-power incident", evidenceId: "call1-reason", evidenceTime: "00:08" },
      { key: "repair", label: "Repair history", value: "No previous repair; visit 1 arranged", evidenceId: "call1-repair", evidenceTime: "01:04" },
      { key: "request", label: "Customer request", value: "Vehicle inspection", evidenceId: "call1-reason", evidenceTime: "00:08" },
      { key: "sentiment", label: "Customer sentiment", value: "Concerned, cooperative", evidenceId: "call1-sentiment", evidenceTime: "00:48" },
      { key: "outcome", label: "Handling outcome", value: "Diagnostic appointment arranged", evidenceId: "call1-outcome", evidenceTime: "00:31" },
    ],
  },
  {
    id: "call-2025-12-03",
    sequence: 2,
    date: "03 Dec 2025",
    duration: "03:06",
    conversation: [
      { id: "call2-reason", speaker: "Customer", time: "00:06", parts: [{ text: "The " }, { text: "same loss-of-power problem returned yesterday", semantic: "reason" }, { text: ", even though the dealer completed the software reset in October." }] },
      { id: "call2-repair", speaker: "CIC Agent", time: "00:28", parts: [{ text: "I can see the " }, { text: "October repair order and software reset", semantic: "repair" }, { text: ". I will link this call to the same fault." }] },
      { id: "call2-request", speaker: "Customer", time: "00:53", parts: [{ text: "Please " }, { text: "make sure the underlying cause is found this time", semantic: "request" }, { text: ". I use the car every day and " }, { text: "cannot keep returning to the workshop", semantic: "sentiment" }, { text: "." }] },
      { id: "call2-outcome", speaker: "CIC Agent", time: "01:19", parts: [{ text: "The dealer will " }, { text: "perform an extended diagnosis and inspect the control unit", semantic: "outcome" }, { text: " during repair visit 2." }] },
    ],
    narrative: "The same fault returned after the first software reset. AI linked the contact to the existing case, identified increasing frustration, and captured the plan for an extended diagnosis during repair visit 2.",
    insights: [
      { key: "reason", label: "Contact reason", value: "Power loss returned after repair visit 1", evidenceId: "call2-reason", evidenceTime: "00:06" },
      { key: "repair", label: "Repair history", value: "1 visit; software reset completed", evidenceId: "call2-repair", evidenceTime: "00:28" },
      { key: "request", label: "Customer request", value: "Identify and resolve the root cause", evidenceId: "call2-request", evidenceTime: "00:53" },
      { key: "sentiment", label: "Customer sentiment", value: "Frustration increasing", evidenceId: "call2-request", evidenceTime: "00:53" },
      { key: "outcome", label: "Handling outcome", value: "Repair visit 2 and extended diagnosis arranged", evidenceId: "call2-outcome", evidenceTime: "01:19" },
    ],
  },
  {
    id: "call-2026-02-12",
    sequence: 3,
    date: "12 Feb 2026",
    duration: "03:24",
    conversation: [
      { id: "call3-reason", speaker: "Customer", time: "00:09", parts: [{ text: "The vehicle " }, { text: "lost power again after the control unit replacement", semantic: "reason" }, { text: ". This is now the third time I have reported the same problem." }] },
      { id: "call3-repair", speaker: "CIC Agent", time: "00:34", parts: [{ text: "The " }, { text: "first two repair records are linked", semantic: "repair" }, { text: ". I will escalate the recurring fault." }] },
      { id: "call3-request", speaker: "Customer", time: "01:02", parts: [{ text: "I will allow one more repair, but " }, { text: "if the problem comes back I will ask for a formal Three Guarantees resolution", semantic: "request" }, { text: "." }] },
      { id: "call3-outcome", speaker: "CIC Agent", time: "01:31", parts: [{ text: "I have documented the expectation and " }, { text: "safety concern", semantic: "sentiment" }, { text: ". " }, { text: "Repair visit 3 will be arranged with Technical Service support", semantic: "outcome" }, { text: "." }] },
    ],
    narrative: "After the second repair, the fault returned again. The customer accepted one final repair but explicitly stated that another recurrence should trigger formal Three Guarantees handling.",
    insights: [
      { key: "reason", label: "Contact reason", value: "Power loss returned after repair visit 2", evidenceId: "call3-reason", evidenceTime: "00:09" },
      { key: "repair", label: "Repair history", value: "2 linked visits; control unit replaced", evidenceId: "call3-repair", evidenceTime: "00:34" },
      { key: "request", label: "Customer request", value: "One final repair, then formal resolution", evidenceId: "call3-request", evidenceTime: "01:02" },
      { key: "sentiment", label: "Customer sentiment", value: "Strong frustration and safety concern", evidenceId: "call3-outcome", evidenceTime: "01:31" },
      { key: "outcome", label: "Handling outcome", value: "Repair visit 3 with Technical Service arranged", evidenceId: "call3-outcome", evidenceTime: "01:31" },
    ],
  },
];

export const intakeDemo = {
  conversation: [
    { id: "opening", speaker: "CIC Agent", time: "00:03", parts: [{ text: "Good morning. Please tell me what happened with your vehicle." }] },
    { id: "issue", speaker: "Customer", time: "00:12", parts: [{ text: "It " }, { text: "lost power again while I was driving", semantic: "reason" }, { text: ". I have brought it in ", semantic: "repair" }, { text: "—but the same issue came back.", correction: { before: "twice", after: "sorry, three times" } }] },
    { id: "clarify", speaker: "CIC Agent", time: "00:27", parts: [{ text: "To confirm: the vehicle has had " }, { text: "three repair visits for the same loss-of-power issue", semantic: "repair" }, { text: "?" }] },
    { id: "emotion", speaker: "Customer", time: "00:35", parts: [{ text: "Yes. I am " }, { text: "very frustrated, and I no longer feel safe driving it", semantic: "sentiment" }, { text: "." }] },
    { id: "ask", speaker: "CIC Agent", time: "00:46", parts: [{ text: "What outcome would you like us to arrange?" }] },
    { id: "request", speaker: "Customer", time: "00:52", parts: [{ text: "I want BMW to " }, { text: "accept a vehicle return under the Three Guarantees policy", semantic: "request" }, { text: "." }] },
  ] satisfies ConversationLine[],
  narrative: "The same loss-of-power fault returned after three repair visits. The customer now feels unsafe driving the vehicle and formally requests a vehicle return under the Three Guarantees policy.",
  insights: [
    { key: "reason", label: "Contact reason", value: "Recurring loss of power", evidenceId: "issue", evidenceTime: "00:12" },
    { key: "repair", label: "Repair history", value: "3 visits; same fault unresolved", evidenceId: "clarify", evidenceTime: "00:27" },
    { key: "request", label: "Customer request", value: "Vehicle return under Three Guarantees", evidenceId: "request", evidenceTime: "00:52" },
    { key: "sentiment", label: "Customer sentiment", value: "Frustrated; safety concern", evidenceId: "emotion", evidenceTime: "00:35" },
    { key: "outcome", label: "Handling outcome", value: "" },
  ] satisfies CallInsight[],
};

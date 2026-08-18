export type SemanticType = "quality" | "request" | "emotion";

export type ConversationLine = {
  id: string;
  speaker: "Customer" | "Customer Care";
  time: string;
  parts: Array<{ text: string; semantic?: SemanticType; correction?: { before: string; after: string } }>;
};

export type HistoricalCall = {
  id: string;
  sequence: number;
  date: string;
  duration: string;
  title: string;
  relationship: string;
  conversation: Array<{ speaker: "Customer" | "Customer Care"; time: string; text: string }>;
  summary: {
    reason: string;
    outcome: string;
    sentiment: string;
    continuity: string;
  };
};

export const historicalCalls: HistoricalCall[] = [
  {
    id: "call-2025-10-18",
    sequence: 1,
    date: "18 Oct 2025",
    duration: "02:18",
    title: "Initial power-loss report",
    relationship: "First occurrence · Repair visit 1 arranged",
    conversation: [
      { speaker: "Customer", time: "00:08", text: "The vehicle briefly lost power when I accelerated onto the main road. It recovered after I restarted it, but I would like it checked." },
      { speaker: "Customer Care", time: "00:31", text: "I have recorded this as the first power-loss incident and will arrange a diagnostic appointment with the dealer." },
      { speaker: "Customer", time: "00:48", text: "That is fine. I am concerned, but I hope it is only a software issue." },
      { speaker: "Customer Care", time: "01:04", text: "The dealer will inspect the power-control system and update you after the first repair visit." },
    ],
    summary: {
      reason: "First intermittent loss-of-power incident",
      outcome: "Diagnostic appointment and repair visit 1 arranged",
      sentiment: "Concerned, cooperative",
      continuity: "Established the first occurrence later referenced in the repeated-repair complaint",
    },
  },
  {
    id: "call-2025-12-03",
    sequence: 2,
    date: "03 Dec 2025",
    duration: "03:06",
    title: "Fault returned after first repair",
    relationship: "Same symptom · Repair visit 2 arranged",
    conversation: [
      { speaker: "Customer", time: "00:06", text: "The same loss-of-power problem returned yesterday, even though the dealer completed the software reset in October." },
      { speaker: "Customer Care", time: "00:28", text: "I can see the October repair order. I will link this call to the same fault and arrange the second repair visit." },
      { speaker: "Customer", time: "00:53", text: "Please make sure the underlying cause is found this time. I use the car every day and cannot keep returning to the workshop." },
      { speaker: "Customer Care", time: "01:19", text: "The dealer will perform an extended diagnosis and inspect the control unit rather than repeat the same reset." },
    ],
    summary: {
      reason: "Same power-loss symptom returned after repair visit 1",
      outcome: "Linked recurrence created; repair visit 2 arranged",
      sentiment: "Frustration beginning to increase",
      continuity: "Confirmed the issue was recurring rather than a new unrelated complaint",
    },
  },
  {
    id: "call-2026-02-12",
    sequence: 3,
    date: "12 Feb 2026",
    duration: "03:24",
    title: "Escalation after second repair",
    relationship: "Second recurrence · Repair visit 3 completed",
    conversation: [
      { speaker: "Customer", time: "00:09", text: "The vehicle lost power again after the control unit replacement. This is now the third time I have reported the same problem." },
      { speaker: "Customer Care", time: "00:34", text: "The first two repair records are linked. I will escalate the recurring fault and arrange a third repair visit with Technical Service support." },
      { speaker: "Customer", time: "01:02", text: "I will allow one more repair, but if the problem comes back I will ask for a formal Three Guarantees resolution." },
      { speaker: "Customer Care", time: "01:31", text: "I have documented that expectation and the safety concern. The next contact will reference all three linked repair attempts." },
    ],
    summary: {
      reason: "Power loss returned after repair visit 2 and control-unit replacement",
      outcome: "Technical escalation and repair visit 3 completed",
      sentiment: "Strong frustration and explicit safety concern",
      continuity: "Customer stated the next recurrence should trigger formal Three Guarantees handling",
    },
  },
];

export const intakeDemo = {
  conversation: [
    {
      id: "opening",
      speaker: "Customer Care",
      time: "00:03",
      parts: [{ text: "Good morning. Please tell me what happened with your vehicle." }],
    },
    {
      id: "issue",
      speaker: "Customer",
      time: "00:12",
      parts: [
        { text: "It " },
        { text: "lost power again while I was driving", semantic: "quality" },
        { text: ". I have brought it in " },
        { text: "—but the same issue came back.", correction: { before: "twice", after: "sorry, three times" } },
      ],
    },
    {
      id: "clarify",
      speaker: "Customer Care",
      time: "00:27",
      parts: [{ text: "To confirm: the vehicle has had three repair visits for the same loss-of-power issue?" }],
    },
    {
      id: "emotion",
      speaker: "Customer",
      time: "00:35",
      parts: [
        { text: "Yes. I am " },
        { text: "very frustrated, and I no longer feel safe driving it", semantic: "emotion" },
        { text: "." },
      ],
    },
    {
      id: "ask",
      speaker: "Customer Care",
      time: "00:46",
      parts: [{ text: "What outcome would you like us to arrange?" }],
    },
    {
      id: "request",
      speaker: "Customer",
      time: "00:52",
      parts: [
        { text: "I want BMW to " },
        { text: "accept a vehicle return under the Three Guarantees policy", semantic: "request" },
        { text: "." },
      ],
    },
  ] satisfies ConversationLine[],
  consolidatedStatement:
    "The vehicle repeatedly lost power despite three repair visits. The customer feels unsafe driving it and requests a vehicle return under the Three Guarantees policy.",
  summary: [
    { label: "Complaint reason", value: "Recurring loss of power after repeated repairs", evidenceId: "issue", evidenceTime: "00:12" },
    { label: "Customer request", value: "Vehicle return under Three Guarantees", evidenceId: "request", evidenceTime: "00:52" },
    { label: "Customer sentiment", value: "Frustrated with a stated safety concern", evidenceId: "emotion", evidenceTime: "00:35" },
  ],
};

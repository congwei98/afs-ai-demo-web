export type SemanticType = "quality" | "request" | "emotion";

export type ConversationLine = {
  id: string;
  speaker: "Customer" | "Customer Care";
  time: string;
  parts: Array<{ text: string; semantic?: SemanticType; correction?: { before: string; after: string } }>;
};

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

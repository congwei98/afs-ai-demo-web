import type { Metadata } from "next";
import ChatWorkbench from "./ChatWorkbench";
import "./apple-liquid-glass.css";
import "./chat-layout.css";
import "./chat.css";
import "./chat-theme.css";

export const metadata: Metadata = {
  title: "AFS AI Chat Workbench",
  description: "Chat-driven customer retention and CCA approval demo.",
};

export default function ChatPage() {
  return <ChatWorkbench />;
}

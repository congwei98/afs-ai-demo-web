import type { Metadata } from "next";
import ProcessApp from "./ProcessApp";

export const metadata: Metadata = {
  title: "AFS Process Management Center",
  description: "AFS-wide AI-assisted process workbench demo",
};

export default function Home() {
  return <ProcessApp />;
}

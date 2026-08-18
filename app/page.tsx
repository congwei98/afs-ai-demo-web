import type { Metadata } from "next";
import ProcessApp from "./ProcessApp";

export const metadata: Metadata = {
  title: "My Process Management Center",
  description: "Customer complaints and quality handling demo",
};

export default function Home() {
  return <ProcessApp />;
}

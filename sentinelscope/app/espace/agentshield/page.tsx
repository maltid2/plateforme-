import type { Metadata } from "next";
import Module from "./Module";
import "@/components/espace/agentshield/agentshield.css";

export const metadata: Metadata = {
  title: "AgentShield",
  description: "Ce que vos agents IA ont le droit de faire : les outils qu'ils atteignent, et où aucune règle ne les arrête.",
};

export default function Page() {
  return <Module />;
}

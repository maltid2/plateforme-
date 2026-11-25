import type { Metadata } from "next";
import Module from "./Module";
import "@/components/espace/commerce/commerce.css";

export const metadata: Metadata = {
  title: "Veille commerce",
  description: "Les prix de vos concurrents jour après jour, face au vôtre, et les produits qu'ils vendent sans vous.",
};

export default function Page() {
  return <Module />;
}

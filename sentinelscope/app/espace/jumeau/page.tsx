import type { Metadata } from "next";
import Link from "next/link";
import Jumeau from "@/components/jumeau/Jumeau";

export const metadata: Metadata = {
  title: "Jumeau 3D",
  description: "Votre infrastructure, étage par étage : baies, serveurs, postes et bornes Wi-Fi, chaque équipement avec ses constats.",
};

export default function Page() {
  return (
    <main className="fixed inset-0 bg-bg p-3 sm:p-4">
      <Jumeau pleinEcran />
      <Link
        href="/espace"
        className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-line bg-bg2/90 px-4 py-1.5 text-xs font-semibold text-ink backdrop-blur transition-colors hover:border-acc-violet/50"
      >
        ← Espace client
      </Link>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, ShieldCheck, TrendingDown } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";

// Les trois modules de l'espace client. Les textes reprennent ceux de
// l'accueil 3D (/espace) : le visiteur retrouve la même promesse des deux côtés.
const MODULES = [
  {
    id: "jumeau",
    icone: Boxes,
    titre: "Jumeau 3D",
    accroche: "Votre infrastructure, étage par étage",
    texte: "Baies, serveurs, postes et bornes Wi-Fi relevés sur site par un technicien. Chaque équipement porte ses constats.",
    image: "/jumeau-apercu.webp", l: 1020, h: 503,
  },
  {
    id: "agentshield",
    icone: ShieldCheck,
    titre: "AgentShield",
    accroche: "Ce que vos agents IA ont le droit de faire",
    texte: "Une analyse de configuration lancée chez vous : quels outils chaque agent atteint, et où aucune règle ne l'arrête.",
    image: "/espace/agentshield-apercu.webp", l: 1200, h: 720,
  },
  {
    id: "commerce",
    icone: TrendingDown,
    titre: "Veille commerce",
    accroche: "Le marché, face à votre prix",
    texte: "Cherchez un produit chez vos concurrents Shopify : prix, stock et promotions, lus en direct sur leurs vitrines publiques.",
    image: "/espace/commerce-apercu.webp", l: 1200, h: 560,
  },
] as const;

export default function EspaceSection() {
  return (
    <section id="espace" className="relative py-14 sm:py-20">
      <Container>
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <SectionLabel>Espace client</SectionLabel>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Trois outils, un seul espace</h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              Au-delà de l&apos;audit de votre site, l&apos;espace client réunit des modules qui se
              parcourent en 3D. Chacun répond à une question précise.
            </p>
          </div>
          <Link
            href="/espace"
            className="inline-flex flex-none items-center gap-2 self-start rounded-full bg-acc-violet px-5 py-2.5 text-sm font-semibold text-[#0B0B12] transition-transform hover:-translate-y-0.5 sm:self-auto"
          >
            Ouvrir l&apos;espace client <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {MODULES.map((m, i) => (
            <Reveal key={m.id} delay={0.08 * i}>
              <Link
                href={`/espace/${m.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card transition-colors hover:border-acc-violet/40"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-bg">
                  <Image
                    src={m.image}
                    alt=""
                    width={m.l}
                    height={m.h}
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <m.icone className="h-4 w-4 text-acc-violet" aria-hidden="true" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-acc-violet">{m.titre}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{m.accroche}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{m.texte}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                    Ouvrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

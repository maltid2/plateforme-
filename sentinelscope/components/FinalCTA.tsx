"use client";

import { motion } from "framer-motion";
import { Container, Reveal } from "./ui";
import AuditForm from "./AuditForm";

const POINTS = [
  { x: 12, y: 30 },
  { x: 28, y: 62 },
  { x: 40, y: 22 },
  { x: 55, y: 70 },
  { x: 68, y: 34 },
  { x: 82, y: 60 },
  { x: 90, y: 26 },
];

const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [2, 4],
];

function Constellation() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-40"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {LINKS.map(([a, b], i) => (
        <line
          key={i}
          x1={POINTS[a].x}
          y1={POINTS[a].y}
          x2={POINTS[b].x}
          y2={POINTS[b].y}
          stroke="rgba(141,124,255,0.14)"
          strokeWidth="0.15"
        />
      ))}
      {POINTS.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="0.5"
          fill={i % 2 ? "#8D7CFF" : "#8D7CFF"}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{
            duration: 4 + (i % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}
    </svg>
  );
}

export default function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden py-24 sm:py-32">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fade" />
        <motion.div
          aria-hidden
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(141,124,255,0.24),transparent_62%)] blur-3xl"
        />
        <Constellation />
      </div>

      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.75rem]">
            Trouvez vos angles morts{" "}
            <span className="text-gradient">avant les autres.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Entrez l&apos;adresse de votre site et lancez votre premier audit
            de sécurité maintenant.
          </p>

          <div className="mt-9">
            <AuditForm id="audit-cta" align="center" />
          </div>
          <p className="mt-6 text-sm text-muted">
            Paiement unique · Audits illimités · Sans abonnement
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Eye, X } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { viewport } from "@/lib/motion";

type Node = {
  id: string;
  x: number;
  y: number;
  label: string;
  state: "safe" | "risk" | "unknown";
};

const NODES: Node[] = [
  { id: "core", x: 50, y: 50, label: "Core", state: "safe" },
  { id: "n1", x: 20, y: 24, label: "api.prod", state: "safe" },
  { id: "n2", x: 82, y: 30, label: "staging", state: "risk" },
  { id: "n3", x: 16, y: 74, label: "cdn", state: "safe" },
  { id: "n4", x: 84, y: 72, label: "old-service", state: "unknown" },
  { id: "n5", x: 50, y: 14, label: "auth", state: "safe" },
  { id: "n6", x: 50, y: 88, label: "admin-panel", state: "risk" },
];

const EDGES: [string, string][] = [
  ["core", "n1"],
  ["core", "n2"],
  ["core", "n3"],
  ["core", "n4"],
  ["core", "n5"],
  ["core", "n6"],
];

const stateColor = {
  safe: "#57E6D1",
  risk: "#F4576B",
  unknown: "#F5C451",
};

export default function Problem() {
  const [dismissed, setDismissed] = useState(false);
  const [solved, setSolved] = useState(false);

  return (
    <section id="problem" className="relative py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2">
        {/* copy */}
        <Reveal>
          <SectionLabel>The visibility gap</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-[2.6rem]">
            You can&apos;t protect what you can&apos;t{" "}
            <span className="text-gradient-violet">see</span>.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Cloud sprawl, forgotten subdomains, and shadow deployments quietly
            grow your attack surface every week. Most teams only discover an
            exposed asset after it becomes an incident.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              "Unknown assets appear faster than teams can inventory them.",
              "Findings pile up in spreadsheets with no clear priority.",
              "Critical exposures hide inside thousands of low-risk noise.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-sev-critical/10 text-sev-critical">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* interactive asset map */}
        <Reveal delay={0.15}>
          <div className="relative aspect-square w-full max-w-lg rounded-2xl border border-line bg-card/50 p-4 shadow-soft backdrop-blur-sm">
            <div className="absolute inset-0 rounded-2xl bg-grid-fade opacity-40" />
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-xs text-muted">
              <Eye className="h-3.5 w-3.5 text-acc-cyan" /> Live asset map
            </div>

            <svg viewBox="0 0 100 100" className="relative h-full w-full">
              {EDGES.map(([a, b]) => {
                const na = NODES.find((n) => n.id === a)!;
                const nb = NODES.find((n) => n.id === b)!;
                return (
                  <motion.line
                    key={`${a}-${b}`}
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={viewport}
                    transition={{ duration: 1, delay: 0.2 }}
                  />
                );
              })}
              {NODES.map((n, i) => {
                const isRisk = n.state === "risk" && !solved;
                const color = solved && n.id === "n6" ? stateColor.safe : stateColor[n.state];
                return (
                  <g key={n.id}>
                    {isRisk && (
                      <motion.circle
                        cx={n.x}
                        cy={n.y}
                        r={n.id === "core" ? 5 : 3.4}
                        fill="none"
                        stroke={color}
                        strokeWidth="0.5"
                        initial={{ scale: 1, opacity: 0.7 }}
                        animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                      />
                    )}
                    <motion.circle
                      cx={n.x}
                      cy={n.y}
                      r={n.id === "core" ? 4.2 : 2.6}
                      fill={color}
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={viewport}
                      transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                      style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* asset labels */}
            {NODES.filter((n) => n.id !== "core").map((n) => (
              <span
                key={n.id}
                className="pointer-events-none absolute -translate-x-1/2 translate-y-2 font-mono text-[9px] text-muted"
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                {n.label}
              </span>
            ))}

            {/* popup */}
            <AnimatePresence>
              {!dismissed && !solved && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.4 }}
                  className="absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-sev-critical/30 bg-bg2/95 p-3.5 shadow-glow backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg bg-sev-critical/15 text-sev-critical">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">
                        New attack surface issue
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-muted">
                        admin-panel.dev · exposed login
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setSolved(true)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-acc-green/15 px-3 py-2 text-xs font-semibold text-acc-green transition-colors hover:bg-acc-green/25"
                    >
                      <Check className="h-3.5 w-3.5" /> Solve
                    </button>
                    <button
                      onClick={() => setDismissed(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-white/[0.1] hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" /> Ignore
                    </button>
                  </div>
                </motion.div>
              )}
              {solved && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-2.5 rounded-xl border border-acc-green/30 bg-bg2/95 p-3.5 text-sm font-semibold text-acc-green shadow-glow-green backdrop-blur-xl"
                >
                  <Check className="h-4 w-4" /> Exposure remediated and verified.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

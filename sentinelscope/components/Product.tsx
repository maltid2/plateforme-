"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Search, ShieldCheck, Target } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { viewport, ease } from "@/lib/motion";

const STEPS = [
  {
    icon: Search,
    title: "Discover",
    body: "Continuously enumerate your entire external footprint — domains, APIs, cloud buckets, and forgotten hosts.",
  },
  {
    icon: Target,
    title: "Validate",
    body: "Safely test each asset to confirm which weaknesses are real and reachable, cutting out theoretical noise.",
  },
  {
    icon: ShieldCheck,
    title: "Prioritize",
    body: "Rank every confirmed issue by exploitability and impact, then route it to the right owner with fix guidance.",
  },
];

export default function Product() {
  return (
    <section id="product" className="relative border-y border-line bg-bg2/30 py-20 sm:py-28">
      <Container className="grid items-center gap-16 lg:grid-cols-2">
        {/* steps */}
        <Reveal>
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-[2.6rem]">
            From detection to decision
          </h2>
          <p className="mt-4 max-w-lg text-lg text-muted">
            SentinelScope turns raw scan data into a clear, prioritized path to
            a smaller attack surface.
          </p>

          <div className="relative mt-10 pl-6">
            {/* animated vertical line */}
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={viewport}
              transition={{ duration: 1.2, ease }}
              className="absolute left-[10px] top-2 bottom-2 w-px origin-top bg-gradient-to-b from-acc-cyan via-acc-violet to-acc-green"
            />
            <div className="space-y-8">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.title}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={viewport}
                    transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                    className="relative"
                  >
                    <span className="absolute -left-6 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full border border-line bg-bg2 ring-4 ring-bg2">
                      <span className="h-2 w-2 rounded-full bg-acc-cyan shadow-[0_0_8px_#57E6D1]" />
                    </span>
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-5 w-5 text-acc-cyan" strokeWidth={1.8} />
                      <h3 className="text-lg font-semibold tracking-tight">
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {s.body}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* detail card */}
        <Reveal delay={0.15}>
          <div className="rounded-2xl border border-line bg-card/70 p-6 shadow-soft backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted">
                <span className="h-2 w-2 rounded-full bg-sev-critical shadow-[0_0_8px_#F4576B]" />
                Finding detail
              </div>
              <span className="rounded-full bg-sev-critical/15 px-2.5 py-1 text-[11px] font-semibold text-sev-critical">
                Critical
              </span>
            </div>

            <h3 className="mt-4 text-lg font-semibold tracking-tight">
              Exposed admin interface without MFA
            </h3>
            <p className="mt-1 font-mono text-xs text-muted">
              admin-panel.dev · discovered 2h ago
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { l: "Exploitability", v: "High", c: "text-sev-critical" },
                { l: "Impact", v: "Severe", c: "text-sev-high" },
                { l: "Confidence", v: "98%", c: "text-acc-green" },
              ].map((m) => (
                <div
                  key={m.l}
                  className="rounded-xl border border-line bg-bg2/50 p-3"
                >
                  <div className={`text-base font-bold ${m.c}`}>{m.v}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{m.l}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2.5 rounded-xl border border-line bg-bg2/40 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Recommended fix
              </div>
              {[
                "Restrict access to trusted networks",
                "Enforce multi-factor authentication",
                "Rotate exposed admin credentials",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2.5 text-sm text-ink/90">
                  <CheckCircle2 className="h-4 w-4 flex-none text-acc-green" />
                  {t}
                </div>
              ))}
            </div>

            <button className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-acc-violet/15 px-4 py-2.5 text-sm font-semibold text-acc-violet transition-colors hover:bg-acc-violet/25">
              Assign to owner
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

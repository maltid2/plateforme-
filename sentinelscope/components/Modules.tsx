"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  Code2,
  FlaskConical,
  Radar,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { viewport } from "@/lib/motion";

type Module = {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  cards: { title: string; body: string }[];
};

const MODULES: Module[] = [
  {
    id: "attack",
    label: "Attack Surface",
    icon: Radar,
    headline: "See your organization the way an attacker does",
    cards: [
      { title: "External discovery", body: "Continuously map internet-facing assets across every domain and cloud." },
      { title: "Exposure alerts", body: "Get notified the moment a new asset or open port appears online." },
      { title: "Shadow IT detection", body: "Surface unmanaged services and forgotten deployments automatically." },
      { title: "Change tracking", body: "Watch your surface evolve over time with a full historical timeline." },
    ],
  },
  {
    id: "code",
    label: "Code",
    icon: Code2,
    headline: "Catch risky code before it ships",
    cards: [
      { title: "Dependency scanning", body: "Flag vulnerable open-source packages with real reachability context." },
      { title: "Secret detection", body: "Stop hardcoded keys and tokens from reaching your production branches." },
      { title: "SAST checks", body: "Analyze source for injection, auth, and logic flaws on every push." },
      { title: "Owner mapping", body: "Route each finding to the team that owns the affected code path." },
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    icon: Cloud,
    headline: "Keep every cloud environment locked down",
    cards: [
      { title: "Misconfig detection", body: "Identify public buckets, weak IAM, and open groups across accounts." },
      { title: "Posture scoring", body: "Benchmark each environment against your own security baseline." },
      { title: "Drift alerts", body: "Detect when infrastructure quietly moves away from a secure state." },
      { title: "Multi-cloud view", body: "Unify posture across every provider in a single, filterable inventory." },
    ],
  },
  {
    id: "test",
    label: "Testing",
    icon: FlaskConical,
    headline: "Validate real risk with safe, continuous testing",
    cards: [
      { title: "Automated pentests", body: "Run safe, repeatable attack simulations against your live surface." },
      { title: "Proof of exploit", body: "Confirm which findings are genuinely reachable and exploitable." },
      { title: "Regression checks", body: "Verify that fixed issues stay fixed on every future scan." },
      { title: "Scheduled runs", body: "Test on a cadence that matches your release and compliance needs." },
    ],
  },
  {
    id: "defend",
    label: "Defend",
    icon: ShieldCheck,
    headline: "Turn findings into resolved, verified fixes",
    cards: [
      { title: "Guided remediation", body: "Every issue ships with clear, step-by-step fix instructions." },
      { title: "Auto-triage", body: "Deduplicate and rank findings so teams focus only on what matters." },
      { title: "Fix verification", body: "Automatically re-test once a fix lands to confirm the risk is gone." },
      { title: "Reporting", body: "Share posture and progress with stakeholders in one clean view." },
    ],
  },
];

export default function Modules() {
  const [active, setActive] = useState(MODULES[0].id);
  const current = MODULES.find((m) => m.id === active)!;

  return (
    <section id="modules" className="relative py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionLabel>One platform, five modules</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-[2.6rem]">
            Security that spans your whole stack
          </h2>
          <p className="mt-4 text-lg text-muted">
            Start with what you need today and expand coverage without adding
            another tool.
          </p>
        </Reveal>

        {/* tabs */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const on = m.id === active;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  on
                    ? "border-acc-violet/40 bg-acc-violet/15 text-ink"
                    : "border-line bg-white/[0.02] text-muted hover:border-white/15 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* panel */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-card/50 p-6 backdrop-blur-sm sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <h3 className="max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">
                {current.headline}
              </h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {current.cards.map((c, i) => (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="rounded-xl border border-line bg-bg2/40 p-5"
                  >
                    <h4 className="text-sm font-semibold tracking-tight text-ink">
                      {c.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {c.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

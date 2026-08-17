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
  accent: string;
  cards: { title: string; body: string }[];
};

const MODULES: Module[] = [
  {
    id: "attack",
    label: "Attack",
    icon: Radar,
    accent: "#57E6D1",
    headline: "See your organization the way an attacker does",
    cards: [
      { title: "Dynamic Application Testing", body: "Probe running web apps for real, exploitable weaknesses." },
      { title: "API Scanning", body: "Discover and test REST and GraphQL endpoints continuously." },
      { title: "AI Pentesting", body: "Chain findings into attack paths with guided, automated testing." },
      { title: "Surface Monitoring", body: "Watch every internet-facing asset change in near real time." },
    ],
  },
  {
    id: "code",
    label: "Code",
    icon: Code2,
    accent: "#8D7CFF",
    headline: "Catch risky code before it ever ships",
    cards: [
      { title: "Static Code Analysis", body: "Flag injection, auth and logic flaws on every push." },
      { title: "Dependencies", body: "Surface vulnerable packages with real reachability context." },
      { title: "Secrets Detection", body: "Stop hardcoded keys and tokens from reaching production." },
      { title: "IaC Scanning", body: "Catch insecure infrastructure-as-code before it deploys." },
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    icon: Cloud,
    accent: "#A7F36B",
    headline: "Keep every cloud environment locked down",
    cards: [
      { title: "Cloud Posture", body: "Benchmark each account against your security baseline." },
      { title: "Container Images", body: "Scan images for vulnerabilities before they run." },
      { title: "Virtual Machines", body: "Assess exposed hosts and their patch status at scale." },
      { title: "Cloud Asset Search", body: "Query every resource across providers from one place." },
    ],
  },
  {
    id: "test",
    label: "Test",
    icon: FlaskConical,
    accent: "#F5C451",
    headline: "Validate real risk with safe, continuous testing",
    cards: [
      { title: "Automated Testing", body: "Run safe, repeatable attack simulations on a schedule." },
      { title: "Security Validation", body: "Confirm which findings are genuinely reachable." },
      { title: "Vulnerability Verification", body: "Prove exploitability before it reaches your queue." },
      { title: "Continuous Retesting", body: "Re-check fixed issues automatically to confirm closure." },
    ],
  },
  {
    id: "defend",
    label: "Defend",
    icon: ShieldCheck,
    accent: "#57E6D1",
    headline: "Turn findings into resolved, verified fixes",
    cards: [
      { title: "Runtime Protection", body: "Detect and block exploitation attempts in production." },
      { title: "Alerting", body: "Route the right signal to the right team, without noise." },
      { title: "Incident Response", body: "Move from detection to containment with clear playbooks." },
      { title: "Security Workflows", body: "Automate triage and remediation across your tools." },
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
            <SectionLabel>Modules</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Security coverage that grows with you.
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
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${
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
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: `${current.accent}1f`, color: current.accent }}
                >
                  <current.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">
                  {current.headline}
                </h3>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {current.cards.map((c, i) => (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="rounded-xl border border-line bg-bg2/40 p-5 transition-colors hover:border-white/15"
                  >
                    <span
                      className="mb-3 block h-1 w-8 rounded-full"
                      style={{ background: current.accent }}
                    />
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

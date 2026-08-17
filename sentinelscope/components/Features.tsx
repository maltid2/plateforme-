"use client";

import { motion } from "framer-motion";
import {
  Boxes,
  GitBranch,
  Radar,
  ScanLine,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { staggerParent, fadeUp, viewport } from "@/lib/motion";

const FEATURES = [
  {
    icon: Radar,
    title: "Continuous asset discovery",
    body: "Map every domain, subdomain, IP, and cloud resource automatically — including the ones no one remembers deploying.",
    glow: "cyan",
  },
  {
    icon: ScanLine,
    title: "Automated attack testing",
    body: "Run safe, continuous checks against your external surface to surface real, exploitable weaknesses before attackers do.",
    glow: "violet",
  },
  {
    icon: ShieldAlert,
    title: "Risk-based prioritization",
    body: "Every finding is scored by exploitability and business impact, so your team fixes what actually matters first.",
    glow: "green",
  },
  {
    icon: GitBranch,
    title: "Code-to-cloud context",
    body: "Trace an exposed endpoint back to the repository, service, and owner responsible — no more guessing who to ping.",
    glow: "violet",
  },
  {
    icon: Boxes,
    title: "Unified inventory",
    body: "One living source of truth for assets, services, and their security posture across every environment you run.",
    glow: "cyan",
  },
  {
    icon: Workflow,
    title: "Workflow automation",
    body: "Push prioritized issues straight into Jira, Slack, or Linear with full context and clear remediation steps.",
    glow: "green",
  },
] as const;

const glowMap = {
  cyan: "group-hover:shadow-glow-cyan text-acc-cyan bg-acc-cyan/10",
  violet: "group-hover:shadow-glow text-acc-violet bg-acc-violet/10",
  green: "group-hover:shadow-glow-green text-acc-green bg-acc-green/10",
};

export default function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionLabel>Platform</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-[2.6rem]">
            Everything you need to close the gap
          </h2>
          <p className="mt-4 text-lg text-muted">
            From first discovery to verified fix, SentinelScope gives your team
            one continuous view of exposure and risk.
          </p>
        </Reveal>

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="group relative rounded-2xl border border-line bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/15"
              >
                <div
                  className={`grid h-12 w-12 place-items-center rounded-xl transition-shadow duration-300 ${glowMap[f.glow]}`}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {f.body}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}

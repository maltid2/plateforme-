"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";

const FAQS = [
  {
    q: "How is SentinelScope different from a traditional vulnerability scanner?",
    a: "Traditional scanners produce long lists of theoretical issues. SentinelScope continuously discovers your real attack surface, validates which weaknesses are actually reachable, and ranks them by business impact — so your team fixes what matters instead of drowning in noise.",
  },
  {
    q: "Do you need access to our production systems?",
    a: "No. SentinelScope tests your external attack surface the same way an outside attacker would. Optional integrations use least-privilege, read-only access with short-lived tokens, and we never store your customer data.",
  },
  {
    q: "How quickly can we get set up?",
    a: "Most teams are live in minutes. Add a domain, connect the tools you already use, and SentinelScope begins mapping and monitoring your surface automatically — no agents to deploy or infrastructure to manage.",
  },
  {
    q: "Is the automated testing safe to run against live systems?",
    a: "Yes. Every check is designed to be non-destructive and rate-limited. You control the scope and cadence, and all activity is fully logged so you always know exactly what was tested and when.",
  },
  {
    q: "How does prioritization actually work?",
    a: "Each confirmed finding is scored on exploitability, business impact, and confidence. That score determines its rank in the queue and where it gets routed, so the most dangerous, most reachable issues always rise to the top.",
  },
  {
    q: "Which tools does SentinelScope integrate with?",
    a: "SentinelScope connects with source control, ticketing, chat, and compliance tools including GitHub, GitLab, Jira, Slack, Linear, Microsoft Teams, Vanta, and Drata — pushing prioritized issues with full context wherever your team works.",
  },
  {
    q: "Can it scale across multiple teams and environments?",
    a: "Absolutely. SentinelScope unifies assets, code, and cloud across every environment into one inventory, with per-team ownership and reporting so large organizations keep a clear, shared view of risk.",
  },
  {
    q: "What kind of support is included?",
    a: "Every plan includes documentation, onboarding guidance, and responsive support from security engineers. Enterprise customers get a dedicated contact and tailored onboarding for their environment.",
  },
];

function Item({
  q,
  a,
  open,
  onToggle,
  index,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  const panelId = `faq-panel-${index}`;
  const btnId = `faq-button-${index}`;
  return (
    <div className="border-b border-line">
      <h3>
        <button
          id={btnId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 rounded-lg"
        >
          <span className={`text-base font-semibold sm:text-lg ${open ? "text-ink" : "text-ink/85"}`}>
            {q}
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line bg-white/[0.03] text-muted"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={btnId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-12 text-[15px] leading-relaxed text-muted">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <Container className="max-w-3xl">
        <Reveal className="text-center">
          <div className="flex justify-center">
            <SectionLabel>FAQ</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-[2.6rem]">
            Questions, answered
          </h2>
          <p className="mt-4 text-lg text-muted">
            Everything you need to know about how SentinelScope works.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          {FAQS.map((f, idx) => (
            <Item
              key={f.q}
              index={idx}
              q={f.q}
              a={f.a}
              open={open === idx}
              onToggle={() => setOpen(open === idx ? null : idx)}
            />
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

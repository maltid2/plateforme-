"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";

const FAQS = [
  {
    q: "What is attack surface monitoring?",
    a: "Attack surface monitoring continuously discovers and tracks every internet-facing asset you own — domains, subdomains, APIs, certificates, and cloud resources — so you always know what is exposed, even as it changes from one day to the next.",
  },
  {
    q: "How does dynamic application security testing work?",
    a: "Dynamic testing interacts with your running applications the way a real attacker would, sending crafted requests to surface issues like injection, broken access control, and misconfigurations — without needing access to your source code.",
  },
  {
    q: "Can SentinelScope scan authenticated applications?",
    a: "Yes. With authenticated scanning, SentinelScope can log in and test the areas of your application that are only visible to signed-in users, where much of the real risk usually lives.",
  },
  {
    q: "Is it safe to scan production?",
    a: "Every check is designed to be non-destructive and rate-limited. You control the scope and cadence, and all activity is fully logged, so scanning production stays safe and predictable.",
  },
  {
    q: "Does it support REST and GraphQL APIs?",
    a: "It does. SentinelScope maps both REST and GraphQL endpoints, understands their schemas, and tests them for common vulnerabilities such as broken authorization and excessive data exposure.",
  },
  {
    q: "How quickly do scans complete?",
    a: "Most scans finish in minutes to a few hours depending on the size of your surface. Discovery and monitoring run continuously in the background, so you get updates as your environment changes rather than waiting for a scheduled window.",
  },
  {
    q: "Can it integrate with CI/CD tools?",
    a: "Yes. SentinelScope connects to the tools your team already uses — including GitHub, GitLab, Jira, and Slack — so findings flow straight into your existing pipelines and workflows with full context.",
  },
  {
    q: "Does it replace a manual penetration test?",
    a: "It complements rather than replaces one. SentinelScope gives you continuous, automated coverage between engagements, while a manual pentest adds deep, human-driven testing — together they give you the strongest picture of your risk.",
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

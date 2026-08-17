"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import {
  PictoKeyUser,
  PictoMonitor,
  PictoNodes,
  PictoPriority,
  PictoRadar,
  PictoScan,
} from "./Pictograms";
import { staggerParent, fadeUp, viewport } from "@/lib/motion";

type Feature = {
  Picto: (p: { className?: string }) => JSX.Element;
  category: string;
  title: string;
  body: string;
  glow: "cyan" | "violet" | "green";
};

const FEATURES: Feature[] = [
  {
    Picto: PictoRadar,
    category: "Discovery",
    title: "Attack surface discovery",
    body: "Find domains, services and applications that are missing from your inventory.",
    glow: "cyan",
  },
  {
    Picto: PictoMonitor,
    category: "Monitoring",
    title: "Continuous monitoring",
    body: "Track changes across your internet-facing assets every day.",
    glow: "violet",
  },
  {
    Picto: PictoScan,
    category: "AppSec",
    title: "Dynamic application testing",
    body: "Detect security weaknesses in running web applications.",
    glow: "green",
  },
  {
    Picto: PictoNodes,
    category: "API",
    title: "API security testing",
    body: "Map REST and GraphQL endpoints and test them for common vulnerabilities.",
    glow: "violet",
  },
  {
    Picto: PictoKeyUser,
    category: "Access",
    title: "Authenticated scanning",
    body: "Test application areas that are only visible to logged-in users.",
    glow: "cyan",
  },
  {
    Picto: PictoPriority,
    category: "Triage",
    title: "Actionable prioritization",
    body: "Focus your team on the findings that create the highest real-world risk.",
    glow: "green",
  },
];

const glowMap = {
  cyan: "group-hover:shadow-glow-cyan text-acc-cyan bg-acc-cyan/10",
  violet: "group-hover:shadow-glow text-acc-violet bg-acc-violet/10",
  green: "group-hover:shadow-glow-green text-acc-green bg-acc-green/10",
};

const borderHover = {
  cyan: "hover:border-acc-cyan/40",
  violet: "hover:border-acc-violet/40",
  green: "hover:border-acc-green/40",
};

const linkColor = {
  cyan: "text-acc-cyan",
  violet: "text-acc-violet",
  green: "text-acc-green",
};

export default function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionLabel>Platform</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            One platform. Complete external visibility.
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
            const Picto = f.Picto;
            return (
              <motion.a
                href="#modules"
                key={f.title}
                variants={fadeUp}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${borderHover[f.glow]}`}
              >
                {/* decorative animated glow blob */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.04] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="flex items-center justify-between">
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-xl ring-1 ring-inset ring-white/5 transition-all duration-300 group-hover:-translate-y-[3px] ${glowMap[f.glow]}`}
                  >
                    <Picto className="h-[26px] w-[26px] transition-transform duration-300 group-hover:scale-[1.06]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {f.category}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted">
                  {f.body}
                </p>
                <span
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${linkColor[f.glow]}`}
                >
                  Learn more
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </motion.a>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";

const QUOTES = [
  {
    quote:
      "Within the first week, SentinelScope found three exposed services we didn't know existed. It replaced a spreadsheet and two contractors with a single source of truth.",
    name: "Maya Laurent",
    role: "VP of Security",
    company: "Northstar",
    initials: "ML",
  },
  {
    quote:
      "The prioritization is what changed everything for us. My engineers finally trust the queue — they fix what's ranked critical because it genuinely is critical.",
    name: "Jonas Meyer",
    role: "Engineering Director",
    company: "Cloudline",
    initials: "JM",
  },
];

export default function Testimonials() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (d: number) => {
    setDir(d);
    setI((v) => (v + d + QUOTES.length) % QUOTES.length);
  };
  const t = QUOTES[i];

  return (
    <section id="testimonials" className="relative py-20 sm:py-28">
      <Container className="max-w-4xl">
        <Reveal className="text-center">
          <div className="flex justify-center">
            <SectionLabel>Customer stories</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-[2.6rem]">
            Security teams that move faster
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="relative mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-card/60 p-8 shadow-soft backdrop-blur-xl sm:p-12">
            <Quote className="h-9 w-9 text-acc-violet/40" />
            <div className="relative mt-4 min-h-[9.5rem] sm:min-h-[8rem]">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.blockquote
                  key={i}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
                  className="absolute inset-0"
                >
                  <p className="text-xl font-medium leading-relaxed text-ink sm:text-2xl">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </motion.blockquote>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-acc-violet/40 to-acc-cyan/30 text-sm font-bold text-ink ring-1 ring-white/10">
                  {t.initials}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-muted">
                    {t.role} · {t.company}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous testimonial"
                  onClick={() => go(-1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/[0.03] text-muted transition-colors hover:border-white/20 hover:text-ink"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  aria-label="Next testimonial"
                  onClick={() => go(1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/[0.03] text-muted transition-colors hover:border-white/20 hover:text-ink"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            {QUOTES.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Go to testimonial ${idx + 1}`}
                onClick={() => {
                  setDir(idx > i ? 1 : -1);
                  setI(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === i ? "w-8 bg-acc-violet" : "w-2.5 bg-white/15"
                }`}
              />
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

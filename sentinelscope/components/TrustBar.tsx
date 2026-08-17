"use client";

import { motion } from "framer-motion";
import { Container, Reveal } from "./ui";
import { Counter } from "./Counter";
import { viewport } from "@/lib/motion";

const LOGOS = ["Northstar", "Vertex", "Cloudline", "Orbital", "Acme Labs"];

type Stat = { value: React.ReactNode; label: string };

const STATS: Stat[] = [
  { value: <Counter to={50} suffix="k+" />, label: "Sites audités" },
  { value: <Counter to={99.9} decimals={1} suffix="%" />, label: "Disponibilité" },
  { value: "24/7", label: "Analyse continue" },
  { value: <Counter to={4.9} decimals={1} suffix="/5" />, label: "Satisfaction client" },
];

export default function TrustBar() {
  return (
    <section className="relative border-y border-line bg-bg2/40 py-14">
      <Container>
        <Reveal className="text-center text-sm font-semibold text-muted">
          Conçu pour les équipes qui ne peuvent se permettre aucun angle mort.
        </Reveal>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-16">
          {LOGOS.map((name, i) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="text-lg font-semibold tracking-tight text-muted/70 grayscale transition-all duration-300 hover:text-ink hover:grayscale-0 sm:text-xl"
            >
              {name}
            </motion.span>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 border-t border-line pt-10 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="text-gradient">{s.value}</span>
              </div>
              <div className="mt-1.5 text-sm text-muted">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}

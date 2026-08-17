"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button, Container, Reveal } from "./ui";

const POINTS = [
  { x: 12, y: 30 },
  { x: 28, y: 62 },
  { x: 40, y: 22 },
  { x: 55, y: 70 },
  { x: 68, y: 34 },
  { x: 82, y: 60 },
  { x: 90, y: 26 },
];

const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [2, 4],
];

function Constellation() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-40"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {LINKS.map(([a, b], i) => (
        <line
          key={i}
          x1={POINTS[a].x}
          y1={POINTS[a].y}
          x2={POINTS[b].x}
          y2={POINTS[b].y}
          stroke="rgba(87,230,209,0.14)"
          strokeWidth="0.15"
        />
      ))}
      {POINTS.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="0.5"
          fill={i % 2 ? "#57E6D1" : "#A7F36B"}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{
            duration: 4 + (i % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}
    </svg>
  );
}

export default function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden py-24 sm:py-32">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fade" />
        <motion.div
          aria-hidden
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(141,124,255,0.24),transparent_62%)] blur-3xl"
        />
        <Constellation />
      </div>

      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Find your blind spots before{" "}
            <span className="text-gradient">someone else does.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Get a complete view of your external attack surface and start
            reducing risk today.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button href="#" className="px-8 py-3.5 text-[15px]">
              Book a demo
            </Button>
            <Button
              href="#features"
              variant="ghost"
              className="px-8 py-3.5 text-[15px]"
              icon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            >
              Explore the platform
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted">
            No credit card required · See results in minutes
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button, Container, Reveal } from "./ui";

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
      </div>

      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Find your blind spots before{" "}
            <span className="text-gradient">someone else does.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Start mapping your attack surface today and see what SentinelScope
            uncovers in your first scan.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button href="#" className="px-8 py-3.5 text-[15px]">
              Book a demo
            </Button>
            <Button
              href="#"
              variant="ghost"
              className="px-8 py-3.5 text-[15px]"
              icon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            >
              Start free assessment
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

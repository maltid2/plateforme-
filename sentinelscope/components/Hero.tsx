"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Container } from "./ui";
import HeroDashboard from "./HeroDashboard";
import AuditForm from "./AuditForm";
import { ease } from "@/lib/motion";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fade" />
        <motion.div
          aria-hidden
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.06, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-[-12%] h-[560px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(141,124,255,0.22),transparent_60%)] blur-2xl"
        />
        <div className="absolute right-[6%] top-[30%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(141,124,255,0.12),transparent_65%)] blur-2xl" />
      </div>

      <Container className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
        {/* left */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-acc-cyan"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Audit de sécurité web automatisé
          </motion.div>

          <h1 className="mt-6 text-[2.25rem] font-extrabold leading-[1.05] tracking-tight xs:text-[2.75rem] sm:text-[3.5rem] lg:text-[4.5rem]">
            {["Voyez ce qui est", "exposé sur votre site", "avant les attaquants."].map((line, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease, delay: 0.15 + i * 0.12 }}
                className="block"
              >
                {i === 1 ? <span className="text-gradient">{line}</span> : line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.5 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted"
          >
            Entrez l&apos;adresse de votre site et obtenez en quelques minutes
            un audit de sécurité complet : un score clair, les vulnérabilités
            détectées et les actions à mener — sans installation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.65 }}
            className="mt-8"
          >
            <AuditForm id="audit-hero" />
          </motion.div>
        </div>

        {/* right */}
        <HeroDashboard />
      </Container>
    </section>
  );
}

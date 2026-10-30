"use client";

import { motion } from "framer-motion";
import {
  FileSearch,
  Gauge,
  Lock,
  Radar,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { Container } from "./ui";
import HeroDashboard from "./HeroDashboard";
import AuditForm from "./AuditForm";
import NetworkBackground from "./NetworkBackground";
import { ease } from "@/lib/motion";

const CONTROLS = [
  { icon: Lock, label: "SSL/TLS" },
  { icon: ShieldCheck, label: "En-têtes" },
  { icon: FileSearch, label: "Fichiers exposés" },
  { icon: Radar, label: "Réputation" },
  { icon: ScanSearch, label: "Failles connues" },
  { icon: Gauge, label: "RGPD" },
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      {/* fond : aurore + grille + constellation */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* fond animé (canvas) + fondu fixe vers le noir, sans masque recomposé à chaque image */}
        <NetworkBackground className="absolute inset-0 h-full w-full" density={0.00016} opacity={0.8} />
        <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_68%_38%,transparent_50%,#07090D_85%)]" />
        <div className="aurora absolute inset-[-10%]" />
        <div className="absolute inset-0 bg-grid-fade opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <Container className="grid items-center gap-16 lg:grid-cols-[1.15fr_.85fr]">
        {/* gauche */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2.5 rounded-full border border-acc-violet/30 bg-acc-violet/[0.08] py-1.5 pl-2 pr-4 text-xs font-medium text-ink/90"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-acc-violet/25">
              <Radar className="h-3 w-3 text-acc-violet" />
            </span>
            Audit de sécurité web automatisé
          </motion.div>

          <h1 className="mt-7 text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] xs:text-[2.9rem] sm:text-[3.8rem] lg:text-[3.3rem] xl:text-[3.75rem]">
            {["Voyez ce qui est", "exposé sur votre site", "avant les attaquants."].map(
              (line, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease, delay: 0.15 + i * 0.13 }}
                  className="block"
                >
                  {i === 1 ? <span className="headline-shine">{line}</span> : line}
                </motion.span>
              )
            )}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.55 }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-muted"
          >
            Entrez l&apos;adresse de votre site : obtenez en quelques minutes un
            score clair, les points faibles détectés et les actions à mener —
            sans installation.
          </motion.p>

          {/* champ d'audit : cadre lumineux */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease, delay: 0.7 }}
            className="mt-9 max-w-xl"
          >
            <div className="beam-frame">
              <div className="beam-inner p-3 sm:p-4">
                <AuditForm id="audit-hero" />
              </div>
            </div>
          </motion.div>

          {/* contrôles couverts */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="mt-10 max-w-xl border-t border-line pt-6"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
              6 contrôles analysés
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTROLS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-ink/85 transition-colors hover:border-acc-violet/40 hover:bg-acc-violet/[0.08]"
                >
                  <Icon className="h-3.5 w-3.5 text-acc-violet" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* droite */}
        <HeroDashboard />
      </Container>
    </section>
  );
}

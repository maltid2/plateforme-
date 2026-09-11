"use client";

import { motion } from "framer-motion";
import { KeyRound, Lock, ScanFace, ShieldCheck, Timer } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { viewport, ease } from "@/lib/motion";

const BADGES = [
  { icon: ShieldCheck, label: "Audit non intrusif" },
  { icon: ScanFace, label: "Analyse en lecture seule" },
  { icon: KeyRound, label: "Sans compte ni installation" },
  { icon: Lock, label: "Aucune donnée revendue" },
  { icon: Timer, label: "Résultat en minutes" },
];

export default function Security() {
  return (
    <section id="security" className="relative py-20 sm:py-28">
      <Container className="grid items-center gap-16 lg:grid-cols-2">
        {/* shield illustration */}
        <Reveal className="order-2 lg:order-1">
          <div className="relative mx-auto grid aspect-square w-full max-w-md place-items-center">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(141,124,255,0.14),transparent_65%)] blur-2xl" />
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.7, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={viewport}
                transition={{ duration: 0.8, delay: i * 0.15, ease }}
                className="absolute rounded-full border border-line"
                style={{
                  width: `${60 + i * 20}%`,
                  height: `${60 + i * 20}%`,
                }}
              >
                {/* point travelling along the contour */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: i % 2 ? -360 : 360 }}
                  transition={{
                    duration: 10 + i * 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <span
                    className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background: i % 2 ? "#8D7CFF" : "#8D7CFF",
                      boxShadow: `0 0 8px ${i % 2 ? "#8D7CFF" : "#8D7CFF"}`,
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={viewport}
              transition={{ duration: 0.7, ease }}
              className="relative grid h-28 w-28 place-items-center rounded-3xl border border-acc-cyan/30 bg-card/80 shadow-glow-cyan backdrop-blur-xl"
            >
              <ShieldCheck className="h-12 w-12 text-acc-cyan" strokeWidth={1.6} />
              <motion.span
                className="absolute inset-0 rounded-3xl border border-acc-cyan/40"
                animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
              />
            </motion.div>
          </div>
        </Reveal>

        {/* copy */}
        <Reveal delay={0.1} className="order-1 lg:order-2">
          <SectionLabel>En toute confiance</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Une analyse respectueuse de votre site.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            SentinelScope observe uniquement la configuration publique de votre
            site : aucune requête agressive, aucune installation, aucun compte à
            créer et aucune donnée revendue. L&apos;analyse est passive et le
            rapport arrive en quelques minutes.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {BADGES.map((b, i) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewport}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-4 py-2 text-sm font-medium text-ink/90"
                >
                  <Icon className="h-4 w-4 text-acc-green" strokeWidth={1.9} />
                  {b.label}
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

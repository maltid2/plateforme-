"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import {
  PictoAlertBell,
  PictoAlertShield,
  PictoCloudLock,
  PictoCompliance,
  PictoMonitor,
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
    Picto: PictoCloudLock,
    category: "SSL / TLS",
    title: "Connexion sécurisée",
    body: "Vérifie votre HTTPS, la validité du certificat et la solidité du chiffrement.",
    glow: "violet",
  },
  {
    Picto: PictoAlertShield,
    category: "En-têtes",
    title: "Protection du site",
    body: "Contrôle HSTS, CSP, X-Frame-Options et les protections contre les attaques courantes.",
    glow: "violet",
  },
  {
    Picto: PictoScan,
    category: "Fichiers",
    title: "Fichiers sensibles exposés",
    body: "Détecte les fichiers privés (.env, .git, sauvegardes) accessibles publiquement.",
    glow: "violet",
  },
  {
    Picto: PictoMonitor,
    category: "Réputation",
    title: "Réputation en ligne",
    body: "Vérifie si votre site est signalé sur des listes noires ou comme dangereux.",
    glow: "violet",
  },
  {
    Picto: PictoAlertBell,
    category: "CVE",
    title: "Failles connues",
    body: "Repère les technologies obsolètes ou vulnérables exposées par votre site.",
    glow: "violet",
  },
  {
    Picto: PictoCompliance,
    category: "RGPD",
    title: "Protection des données",
    body: "Analyse les cookies et le consentement pour votre conformité RGPD.",
    glow: "violet",
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
            <SectionLabel>L&apos;audit</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Tout ce que nous vérifions sur votre site.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Un seul audit passe votre site au crible sur six dimensions clés,
            puis vous explique quoi corriger et pourquoi.
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
                  En savoir plus
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

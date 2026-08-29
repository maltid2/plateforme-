"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Gauge,
  ListChecks,
  Radar,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import { viewport } from "@/lib/motion";

type Module = {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  accent: string;
  cards: { title: string; body: string }[];
};

const MODULES: Module[] = [
  {
    id: "analyse",
    label: "Analyse",
    icon: Radar,
    accent: "#8D7CFF",
    headline: "Voyez votre site comme le ferait un attaquant",
    cards: [
      { title: "Connexion & certificat (SSL/TLS)", body: "Vérifie votre HTTPS, la validité du certificat et la solidité du chiffrement." },
      { title: "En-têtes de sécurité", body: "Contrôle HSTS, CSP, X-Frame-Options et les protections contre les attaques courantes." },
      { title: "Fichiers sensibles exposés", body: "Détecte les fichiers privés (.env, .git, sauvegardes) accessibles publiquement." },
      { title: "Réputation, failles & RGPD", body: "Vérifie les listes noires, les vulnérabilités connues et la conformité RGPD/cookies." },
    ],
  },
  {
    id: "score",
    label: "Score",
    icon: Gauge,
    accent: "#8D7CFF",
    headline: "Un score de sécurité clair, immédiatement",
    cards: [
      { title: "Note de A à F", body: "Une note globale sur 100, facile à comprendre et à suivre dans le temps." },
      { title: "Verdict en clair", body: "Un résumé en langage simple : ce qui va bien, ce qui est à améliorer." },
      { title: "Points forts & faibles", body: "Chaque dimension (connexion, en-têtes, fichiers…) reçoit son propre statut." },
      { title: "Rapport partageable", body: "Un lien à transmettre à votre équipe ou à votre prestataire." },
    ],
  },
  {
    id: "rapport",
    label: "Rapport",
    icon: FileText,
    accent: "#8D7CFF",
    headline: "Un rapport que tout le monde comprend",
    cards: [
      { title: "Résumé pour les dirigeants", body: "L'essentiel en langage clair, sans jargon technique." },
      { title: "Détails pour les développeurs", body: "Le détail technique de chaque point, prêt à transmettre." },
      { title: "Pourquoi le corriger", body: "Chaque point explique le risque concret pour votre site." },
      { title: "Ce qu'il faut faire", body: "Une action précise pour chaque vulnérabilité détectée." },
    ],
  },
  {
    id: "priorites",
    label: "Priorités",
    icon: ListChecks,
    accent: "#A78BFA",
    headline: "Les bonnes actions d'abord",
    cards: [
      { title: "Tri par gravité", body: "Les points classés du plus critique au moins urgent." },
      { title: "À corriger en priorité", body: "Les problèmes qui exposent réellement votre site arrivent en tête." },
      { title: "Recommandations concrètes", body: "Des correctifs actionnables, pas des alertes vagues." },
      { title: "État des fichiers", body: "Pour chaque fichier sensible : accessible ou non depuis Internet." },
    ],
  },
  {
    id: "confiance",
    label: "Confiance",
    icon: ShieldCheck,
    accent: "#8D7CFF",
    headline: "Une analyse respectueuse de votre site",
    cards: [
      { title: "Sans installation", body: "Rien à installer : vous entrez simplement l'adresse de votre site." },
      { title: "Sans compte", body: "Aucune inscription nécessaire pour lancer une analyse." },
      { title: "Non intrusif", body: "Une analyse passive, sans requête agressive sur votre site." },
      { title: "Aucune donnée revendue", body: "Vos résultats restent les vôtres." },
    ],
  },
];

export default function Modules() {
  const [active, setActive] = useState(MODULES[0].id);
  const current = MODULES.find((m) => m.id === active)!;

  return (
    <section id="modules" className="relative py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionLabel>Ce que vous obtenez</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            De l&apos;analyse au rapport, tout est clair.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Un seul audit de votre site vous donne un score, un rapport lisible
            et des priorités concrètes — sans jargon.
          </p>
        </Reveal>

        {/* tabs */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const on = m.id === active;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${
                  on
                    ? "border-acc-violet/40 bg-acc-violet/15 text-ink"
                    : "border-line bg-white/[0.02] text-muted hover:border-white/15 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* panel */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-card/50 p-6 backdrop-blur-sm sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: `${current.accent}1f`, color: current.accent }}
                >
                  <current.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">
                  {current.headline}
                </h3>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {current.cards.map((c, i) => (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="rounded-xl border border-line bg-bg2/40 p-5 transition-colors hover:border-white/15"
                  >
                    <span
                      className="mb-3 block h-1 w-8 rounded-full"
                      style={{ background: current.accent }}
                    />
                    <h4 className="text-sm font-semibold tracking-tight text-ink">
                      {c.title}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {c.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

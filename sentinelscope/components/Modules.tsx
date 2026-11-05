"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Gauge, ListChecks, type LucideIcon } from "lucide-react";
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

// Cette section répond à « qu'est-ce que j'obtiens à la fin ? ».
// Elle ne redit PAS les six contrôles analysés : c'est le rôle de la
// section « L'audit » (Features), juste au-dessus. L'onglet « Analyse »
// a été retiré pour cette raison, et l'onglet « Confiance » parce que la
// section « En toute confiance » (Security) dit déjà la même chose.
const MODULES: Module[] = [
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
    accent: "#8D7CFF",
    headline: "Les bonnes actions d'abord",
    cards: [
      { title: "Tri par gravité", body: "Les points classés du plus critique au moins urgent." },
      { title: "À corriger en priorité", body: "Les problèmes qui exposent réellement votre site arrivent en tête." },
      { title: "Recommandations concrètes", body: "Des correctifs actionnables, pas des alertes vagues." },
      { title: "État des fichiers", body: "Pour chaque fichier sensible : accessible ou non depuis Internet." },
    ],
  },
];

export default function Modules() {
  const [active, setActive] = useState(MODULES[0].id);
  const current = MODULES.find((m) => m.id === active)!;

  return (
    <section id="modules" className="relative py-14 sm:py-20">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionLabel>Ce que vous obtenez</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Un score, un rapport, des priorités.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Ce que l&apos;audit vous remet à la fin, et dans quel ordre traiter
            ce qu&apos;il a trouvé.
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
        <div className="mt-10 overflow-hidden rounded-[20px] border border-white/[0.07] bg-card/50 p-6 sm:p-8">
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

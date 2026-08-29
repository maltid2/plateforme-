"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";

const FAQS = [
  {
    q: "Qu'est-ce que SentinelScope analyse exactement ?",
    a: "À partir de l'adresse de votre site, SentinelScope vérifie six dimensions clés : la connexion sécurisée (SSL/TLS), les en-têtes de sécurité HTTP, les fichiers sensibles exposés, la réputation en ligne, les failles connues (CVE) et la conformité RGPD/cookies. Vous obtenez un score global et un rapport détaillé.",
  },
  {
    q: "Est-ce un vrai audit ou une simulation ?",
    a: "C'est un vrai audit. SentinelScope se connecte réellement à votre site et analyse sa configuration en direct : le score et les vulnérabilités affichés viennent de votre site réel, pas d'un exemple.",
  },
  {
    q: "L'analyse est-elle dangereuse pour mon site ?",
    a: "Non. L'analyse est passive et non intrusive : elle observe la configuration publique de votre site sans envoyer de requêtes agressives ni tenter d'exploiter quoi que ce soit. Elle ne perturbe pas votre site.",
  },
  {
    q: "En combien de temps ai-je le résultat ?",
    a: "En quelques minutes. Vous entrez l'adresse de votre site, l'analyse se lance immédiatement et le rapport complet s'ouvre à la fin.",
  },
  {
    q: "Dois-je installer quelque chose ou créer un compte ?",
    a: "Non. Aucune installation, aucune inscription : il suffit d'entrer l'adresse de votre site pour lancer l'analyse.",
  },
  {
    q: "Que contient le rapport ?",
    a: "Un score clair sur 100, un résumé en langage simple, puis, pour chaque point : ce que c'est, pourquoi le corriger et l'action à mener. Pour les fichiers sensibles, il indique s'ils sont accessibles ou non depuis Internet. Le rapport est partageable par lien.",
  },
  {
    q: "Remplace-t-il un vrai test d'intrusion ?",
    a: "Non, et il ne le prétend pas. SentinelScope est un premier niveau d'audit automatisé qui repère rapidement les faiblesses les plus courantes. Un test d'intrusion manuel apporte une analyse humaine approfondie ; les deux sont complémentaires.",
  },
  {
    q: "Mes données sont-elles conservées ou revendues ?",
    a: "Vos résultats restent les vôtres et ne sont pas revendus. Le rapport est fourni à titre informatif ; il ne constitue pas une garantie d'absence de vulnérabilité.",
  },
];

function Item({
  q,
  a,
  open,
  onToggle,
  index,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  const panelId = `faq-panel-${index}`;
  const btnId = `faq-button-${index}`;
  return (
    <div className="border-b border-line">
      <h3>
        <button
          id={btnId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 rounded-lg"
        >
          <span className={`text-base font-semibold sm:text-lg ${open ? "text-ink" : "text-ink/85"}`}>
            {q}
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line bg-white/[0.03] text-muted"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={btnId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-12 text-[15px] leading-relaxed text-muted">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <Container className="max-w-3xl">
        <Reveal className="text-center">
          <div className="flex justify-center">
            <SectionLabel>FAQ</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Vos questions, nos réponses
          </h2>
          <p className="mt-4 text-lg text-muted">
            Tout ce qu'il faut savoir sur le fonctionnement de SentinelScope.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          {FAQS.map((f, idx) => (
            <Item
              key={f.q}
              index={idx}
              q={f.q}
              a={f.a}
              open={open === idx}
              onToggle={() => setOpen(open === idx ? null : idx)}
            />
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

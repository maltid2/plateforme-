"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";

const FAQS = [
  {
    q: "Qu'est-ce que la surveillance de la surface d'attaque ?",
    a: "La surveillance de la surface d'attaque découvre et suit en continu chacun de vos actifs exposés sur Internet — domaines, sous-domaines, API, certificats et ressources cloud — pour que vous sachiez toujours ce qui est exposé, même lorsque cela change d'un jour à l'autre.",
  },
  {
    q: "Comment fonctionne le test dynamique de sécurité des applications ?",
    a: "Le test dynamique interagit avec vos applications en fonctionnement comme le ferait un véritable attaquant, en envoyant des requêtes conçues pour révéler des failles telles que les injections, les contrôles d'accès défaillants et les mauvaises configurations — sans nécessiter l'accès à votre code source.",
  },
  {
    q: "SentinelScope peut-il analyser des applications authentifiées ?",
    a: "Oui. Grâce à l'analyse authentifiée, SentinelScope peut se connecter et tester les zones de votre application visibles uniquement par les utilisateurs connectés, là où se concentre souvent l'essentiel du risque réel.",
  },
  {
    q: "Est-il sûr d'analyser un environnement de production ?",
    a: "Chaque contrôle est conçu pour être non destructif et à débit limité. Vous maîtrisez le périmètre et la fréquence, et toute l'activité est journalisée : analyser la production reste sûr et prévisible.",
  },
  {
    q: "Prend-il en charge les API REST et GraphQL ?",
    a: "Oui. SentinelScope cartographie les points d'accès REST comme GraphQL, comprend leurs schémas et les teste contre les vulnérabilités courantes telles que les autorisations défaillantes et l'exposition excessive de données.",
  },
  {
    q: "En combien de temps les analyses se terminent-elles ?",
    a: "La plupart des analyses se terminent en quelques minutes à quelques heures selon la taille de votre surface. La découverte et la surveillance s'exécutent en continu en arrière-plan : vous êtes informé au fil des changements de votre environnement, sans attendre une fenêtre planifiée.",
  },
  {
    q: "S'intègre-t-il aux outils CI/CD ?",
    a: "Oui. SentinelScope se connecte aux outils que votre équipe utilise déjà — dont GitHub, GitLab, Jira et Slack — pour que les résultats remontent directement dans vos pipelines et flux existants, avec tout le contexte.",
  },
  {
    q: "Remplace-t-il un test d'intrusion manuel ?",
    a: "Il le complète plutôt qu'il ne le remplace. SentinelScope assure une couverture automatisée et continue entre les missions, tandis qu'un test d'intrusion manuel apporte une analyse humaine approfondie — ensemble, ils offrent la vision la plus complète de votre risque.",
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

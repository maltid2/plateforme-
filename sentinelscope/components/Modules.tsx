"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  Code2,
  FlaskConical,
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
    id: "attack",
    label: "Attaque",
    icon: Radar,
    accent: "#C084FC",
    headline: "Voyez votre organisation comme le ferait un attaquant",
    cards: [
      { title: "Test dynamique des applications", body: "Sondez vos applications web en fonctionnement à la recherche de failles réellement exploitables." },
      { title: "Analyse des API", body: "Découvrez et testez en continu vos points d'accès REST et GraphQL." },
      { title: "Pentest assisté par IA", body: "Enchaînez les vulnérabilités en chemins d'attaque grâce à des tests automatisés et guidés." },
      { title: "Surveillance de la surface", body: "Observez chaque changement de vos actifs exposés en quasi temps réel." },
    ],
  },
  {
    id: "code",
    label: "Code",
    icon: Code2,
    accent: "#8D7CFF",
    headline: "Interceptez le code à risque avant sa mise en production",
    cards: [
      { title: "Analyse statique du code", body: "Signalez les failles d'injection, d'authentification et de logique à chaque push." },
      { title: "Dépendances", body: "Faites remonter les paquets vulnérables avec leur contexte d'exploitabilité réel." },
      { title: "Détection de secrets", body: "Empêchez les clés et jetons codés en dur d'atteindre la production." },
      { title: "Analyse IaC", body: "Détectez l'infrastructure-as-code non sécurisée avant son déploiement." },
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    icon: Cloud,
    accent: "#A78BFA",
    headline: "Gardez chaque environnement cloud verrouillé",
    cards: [
      { title: "Posture cloud", body: "Évaluez chaque compte par rapport à votre référentiel de sécurité." },
      { title: "Images de conteneurs", body: "Analysez les images à la recherche de vulnérabilités avant leur exécution." },
      { title: "Machines virtuelles", body: "Évaluez à grande échelle les hôtes exposés et leur niveau de correctifs." },
      { title: "Recherche d'actifs cloud", body: "Interrogez toutes vos ressources, tous fournisseurs confondus, depuis un seul endroit." },
    ],
  },
  {
    id: "test",
    label: "Test",
    icon: FlaskConical,
    accent: "#F5C451",
    headline: "Validez le risque réel par des tests continus et sans danger",
    cards: [
      { title: "Tests automatisés", body: "Lancez des simulations d'attaque sûres et reproductibles, à intervalle régulier." },
      { title: "Validation de sécurité", body: "Confirmez quelles vulnérabilités sont réellement atteignables." },
      { title: "Vérification des vulnérabilités", body: "Prouvez l'exploitabilité avant que la vulnérabilité n'arrive dans votre file." },
      { title: "Re-test continu", body: "Revérifiez automatiquement les problèmes corrigés pour confirmer leur clôture." },
    ],
  },
  {
    id: "defend",
    label: "Défense",
    icon: ShieldCheck,
    accent: "#C084FC",
    headline: "Transformez les vulnérabilités en correctifs résolus et vérifiés",
    cards: [
      { title: "Protection à l'exécution", body: "Détectez et bloquez les tentatives d'exploitation en production." },
      { title: "Alertes", body: "Acheminez le bon signal vers la bonne équipe, sans bruit." },
      { title: "Réponse à incident", body: "Passez de la détection au confinement grâce à des playbooks clairs." },
      { title: "Flux de sécurité", body: "Automatisez le tri et la remédiation à travers vos outils." },
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
            <SectionLabel>Modules</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Une couverture de sécurité qui grandit avec vous.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Commencez avec ce dont vous avez besoin aujourd'hui et étendez votre
            couverture sans ajouter un autre outil.
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

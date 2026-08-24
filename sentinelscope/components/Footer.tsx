"use client";

import Link from "next/link";
import { Github, Linkedin, Radar } from "lucide-react";
import { Container } from "./ui";

const COLUMNS = [
  {
    title: "Produit",
    links: ["Surface d'attaque", "Sécurité du code", "Posture cloud", "Tests", "Tarifs"],
  },
  {
    title: "Solutions",
    links: ["Pour les startups", "Pour les grands comptes", "Pour les équipes sécurité", "Pour l'ingénierie"],
  },
  {
    title: "Ressources",
    links: ["Documentation", "Sécurité", "Journal des versions", "Statut", "Blog"],
  },
  {
    title: "Entreprise",
    links: ["À propos", "Carrières", "Clients", "Contact"],
  },
  {
    title: "Légal",
    links: ["Confidentialité", "Conditions", "Cookies", "Conformité"],
  },
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="relative border-t border-line bg-bg2/40">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
          {/* brand */}
          <div className="max-w-xs">
            <Link href="#top" className="flex items-center gap-2.5 text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-acc-violet/30 to-acc-cyan/20 ring-1 ring-white/10">
                <Radar className="h-4.5 w-4.5 text-acc-cyan" strokeWidth={2.2} />
              </span>
              Sentinel<span className="text-acc-cyan">Scope</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Le renseignement continu sur la surface d&apos;attaque, pour les
              équipes qui veulent voir chaque actif exposé avant les attaquants.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Linkedin, label: "LinkedIn" },
                { icon: Github, label: "GitHub" },
                { icon: XIcon, label: "X" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.label}
                    href="#"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/[0.03] text-muted transition-colors hover:border-white/20 hover:text-ink"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/80">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="#"
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
          <p className="text-sm text-muted">
            © 2026 SentinelScope. Tous droits réservés.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-acc-green shadow-[0_0_8px_#8D7CFF]" />
            Tous les systèmes opérationnels
          </div>
        </div>
      </Container>
    </footer>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "./ui";
import { CONTACT_HREF } from "@/lib/contact";

const LINKS = [
  { label: "Produit", href: "#features" },
  { label: "Sécurité", href: "#security" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: CONTACT_HREF },
];

// Ancres internes, dans l'ordre du document : c'est ce qui permet de
// départager deux sections visibles en même temps. « Contact » n'en est pas
// une (lien mailto), donc elle ne s'allume jamais.
const SECTION_IDS = LINKS.filter((l) => l.href.startsWith("#")).map((l) =>
  l.href.slice(1)
);

/**
 * Renvoie l'identifiant de la section actuellement lue, ou null quand aucune
 * ne l'est (hero en haut de page, pied de page en bas) — dans ce cas aucun
 * lien n'est allumé, ce qui vaut mieux qu'un lien faussement actif.
 */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  // Chaque entrée de l'observateur ne concerne qu'une section ; on garde
  // donc l'état de toutes pour pouvoir choisir la première du document.
  const visible = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.current[e.target.id] = e.isIntersecting;
        setActive(SECTION_IDS.find((id) => visible.current[id]) ?? null);
      },
      // Zone de lecture : sous la barre fixe (64 px) et jusqu'à mi-écran.
      // Une section compte comme lue quand elle y entre, pas dès qu'elle
      // pointe en bas de l'écran.
      { rootMargin: "-80px 0px -50% 0px", threshold: 0 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return active;
}

export function Logo() {
  return (
    <Link href="#top" className="flex items-center" aria-label="SentinelScope">
      {/* Le fichier source fait 1600x288 px pour 492 Ko, alors qu'il s'affiche
          sur 40 px de haut. next/image sert la taille réellement utile, en
          WebP quand le navigateur l'accepte : environ 7 Ko en 1x, 14 Ko en 2x.
          priority : le logo est au-dessus de la ligne de flottaison, il ne
          doit pas être chargé paresseusement. */}
      <Image
        src="/logo-full.png"
        alt="SentinelScope — Sécurité, Analyse, Surveillance"
        width={444}
        height={80}
        priority
        className="h-9 w-auto sm:h-10"
      />
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-line bg-bg/90"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const on = l.href === `#${active}`;
            return (
              <Link
                key={l.label}
                href={l.href}
                aria-current={on ? "true" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  on
                    ? "bg-acc-violet/10 text-acc-violet"
                    : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button href="#audit-hero" className="px-5 py-2.5">
            Analyser mon site
          </Button>
        </div>

        <button
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white/[0.03] text-ink md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden border-t border-line bg-bg md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {LINKS.map((l) => {
                const on = l.href === `#${active}`;
                return (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={on ? "true" : undefined}
                    className={`rounded-lg px-3 py-3 text-base font-medium ${
                      on
                        ? "bg-acc-violet/10 text-acc-violet"
                        : "text-muted hover:bg-white/[0.04] hover:text-ink"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <div className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
                <Button href="#audit-hero" className="w-full" onClick={() => setOpen(false)}>
                  Analyser mon site
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

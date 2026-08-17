"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Radar, X } from "lucide-react";
import { Button } from "./ui";

const LINKS = [
  { label: "Product", href: "#features" },
  { label: "Solutions", href: "#modules" },
  { label: "Resources", href: "#faq" },
  { label: "Pricing", href: "#cta" },
];

export function Logo() {
  return (
    <Link href="#top" className="flex items-center gap-2.5 font-bold text-lg">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-acc-violet/30 to-acc-cyan/20 ring-1 ring-white/10">
        <Radar className="h-4.5 w-4.5 text-acc-cyan" strokeWidth={2.2} />
      </span>
      <span>
        Sentinel<span className="text-acc-cyan">Scope</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          ? "border-b border-line bg-bg/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="#"
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <Button href="#cta" className="px-5 py-2.5">
            Book a demo
          </Button>
        </div>

        <button
          aria-label={open ? "Close menu" : "Open menu"}
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
            className="overflow-hidden border-t border-line bg-bg/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-muted hover:bg-white/[0.04] hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
                <Link
                  href="#"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-muted"
                >
                  Log in
                </Link>
                <Button href="#cta" className="w-full" onClick={() => setOpen(false)}>
                  Book a demo
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

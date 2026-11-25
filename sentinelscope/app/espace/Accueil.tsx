"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, ShieldCheck, TrendingDown } from "lucide-react";

// Recopié de hub/scene.js plutôt qu'importé : importer ce module tirerait
// three.js dans le premier chargement de la page, même sur mobile.
const MODULES = [
  { id: "jumeau", titre: "Jumeau 3D", accroche: "Votre infrastructure, étage par étage",
    texte: "Baies, serveurs, postes et bornes Wi-Fi relevés sur site. On ouvre chaque baie, chaque équipement porte ses constats.",
    icone: Boxes, apercu: "/jumeau-apercu.webp", l: 1020, h: 503 },
  { id: "agentshield", titre: "AgentShield", accroche: "Ce que vos agents IA ont le droit de faire",
    texte: "Analyse de configuration lancée chez vous : quels outils chaque agent atteint, et où aucune règle ne l'arrête.",
    icone: ShieldCheck, apercu: "/espace/agentshield-apercu.webp", l: 1200, h: 720 },
  { id: "commerce", titre: "Veille commerce", accroche: "Le marché, face à votre prix",
    texte: "Les prix de vos concurrents jour après jour, et les produits qu'ils vendent sans vous.",
    icone: TrendingDown, apercu: "/espace/commerce-apercu.webp", l: 1200, h: 560 },
] as const;

export default function Accueil() {
  const router = useRouter();
  const racine = useRef<HTMLDivElement>(null);
  const [large, setLarge] = useState<boolean | null>(null);
  const [survol, setSurvol] = useState(-1);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const lire = () => setLarge(mq.matches);
    lire();
    mq.addEventListener("change", lire);
    return () => mq.removeEventListener("change", lire);
  }, []);

  useEffect(() => {
    if (!large || !racine.current) return;
    let arret: (() => void) | null = null;
    let annule = false;
    MODULES.forEach((m) => router.prefetch(`/espace/${m.id}`));
    import("@/components/espace/hub/scene.js").then(({ demarrer }) => {
      if (annule || !racine.current) return;
      arret = demarrer(racine.current, {
        aller: (id: string) => router.push(`/espace/${id}`),
        survoler: setSurvol,
      });
    });
    return () => { annule = true; arret?.(); };
  }, [large, router]);

  if (large === null) return <div className="fixed inset-0 bg-bg" />;

  if (!large) {
    return (
      <main className="min-h-screen bg-bg px-5 pb-16 pt-10">
        <Entete />
        <div className="mt-8 grid gap-4">
          {MODULES.map((m) => (
            <Link key={m.id} href={`/espace/${m.id}`} className="overflow-hidden rounded-2xl border border-line bg-card">
              <Image src={m.apercu} alt="" width={m.l} height={m.h} className="h-auto w-full" sizes="100vw" />
              <div className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-acc-violet">{m.titre}</p>
                <p className="mt-1 font-semibold">{m.accroche}</p>
                <p className="mt-1 text-sm text-muted">{m.texte}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  const m = survol >= 0 ? MODULES[survol] : null;
  return (
    <main className="fixed inset-0 bg-bg">
      <div ref={racine} className="absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute left-8 top-7">
        <Entete />
      </div>

      {/* La fiche du module survolé : elle répond à « c'est quoi, ça ? » avant le clic. */}
      <div
        className={`pointer-events-none absolute left-1/2 top-[13%] w-[min(440px,90vw)] -translate-x-1/2 rounded-2xl border border-line bg-bg2/90 px-5 py-4 text-center backdrop-blur transition-all duration-300 ${
          m ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-acc-violet">{m?.titre}</p>
        <p className="mt-1 text-lg font-semibold">{m?.accroche}</p>
        <p className="mt-1 text-sm text-muted">{m?.texte}</p>
      </div>

      <nav aria-label="Modules" className="absolute inset-x-0 bottom-7 flex justify-center gap-3 px-6">
        {MODULES.map((mod, i) => (
          <Link
            key={mod.id}
            href={`/espace/${mod.id}`}
            onMouseEnter={() => setSurvol(i)}
            onMouseLeave={() => setSurvol(-1)}
            onFocus={() => setSurvol(i)}
            onBlur={() => setSurvol(-1)}
            className={`group flex w-72 items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur transition-colors ${
              survol === i ? "border-acc-violet bg-acc-violet/12" : "border-line bg-bg2/85 hover:border-acc-violet/40"
            }`}
          >
            <mod.icone className="h-5 w-5 flex-none text-acc-violet" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{mod.titre}</span>
              <span className="block truncate text-xs text-muted">{mod.accroche}</span>
            </span>
            <ArrowRight className="h-4 w-4 flex-none text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <span className="absolute bottom-8 right-8 rounded-md border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-muted/70">
        Données de démonstration
      </span>
    </main>
  );
}

function Entete() {
  return (
    <>
      <Link href="/" className="pointer-events-auto text-xs text-muted transition-colors hover:text-ink">
        ← sentrylescope.fr
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Votre espace SentinelScope</h1>
      <p className="mt-1 text-sm text-muted">Choisissez un module. Chacun se parcourt à la souris.</p>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Demarrer = (root: HTMLElement) => () => void;

/**
 * Enveloppe commune des modules de l'espace client.
 *
 * La scène three.js n'est téléchargée que sur grand écran, et seulement au
 * montage : elle pèse plusieurs centaines de kilo-octets. Sur un écran
 * étroit, une image fixe de la même scène la remplace — un plateau 3D
 * complet est illisible sur 390 pixels, et la bibliothèque coûterait cher
 * en données mobiles. À la sortie du module, la scène défait tout ce
 * qu'elle a créé.
 */
export default function Scene3D({
  charger,
  classe,
  apercu,
  titre,
  texte,
  mobile,
}: {
  charger: () => Promise<{ demarrer: Demarrer }>;
  classe: string;
  apercu: { src: string; alt: string; largeur: number; hauteur: number };
  titre: string;
  texte: string;
  /** Remplace l'image fixe quand le module a une vraie version sans 3D. */
  mobile?: React.ReactNode;
}) {
  const racine = useRef<HTMLDivElement>(null);
  const [large, setLarge] = useState<boolean | null>(null);
  const [panne, setPanne] = useState(false);

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
    charger()
      .then(({ demarrer }) => {
        if (!annule && racine.current) arret = demarrer(racine.current);
      })
      .catch(() => !annule && setPanne(true));
    return () => {
      annule = true;
      arret?.();
    };
  }, [large, charger]);

  if (large === null) return <div className="fixed inset-0 bg-bg" />;

  if (!large || panne) {
    return (
      <main className="min-h-screen bg-bg px-5 pb-16 pt-20">
        <Retour />
        <h1 className="text-2xl font-bold tracking-tight">{titre}</h1>
        <p className="mt-2 text-sm text-muted">{texte}</p>
        {mobile ? <div className="mt-6">{mobile}</div> : (
        <figure className="mt-6 overflow-hidden rounded-2xl border border-line">
          <Image src={apercu.src} alt={apercu.alt} width={apercu.largeur} height={apercu.hauteur} className="h-auto w-full" sizes="100vw" priority />
          <figcaption className="border-t border-line px-4 py-3 text-xs text-muted">
            {panne
              ? "Votre navigateur n'affiche pas la 3D. Voici la scène telle qu'elle se présente."
              : "Aperçu. La scène se parcourt sur écran large."}
          </figcaption>
        </figure>
        )}
      </main>
    );
  }

  return (
    <>
      <div ref={racine} className={classe} />
      <Retour />
    </>
  );
}

function Retour() {
  return (
    <Link
      href="/espace"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-line bg-bg2/90 px-4 py-1.5 text-xs font-semibold text-ink backdrop-blur transition-colors hover:border-acc-violet/50"
    >
      ← Espace client
    </Link>
  );
}

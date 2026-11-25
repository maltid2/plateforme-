"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SITE, type Severite } from "./donnees";
import type { Fiche, Pilote, Survol } from "./scene";

const SEV_LABEL: Record<Severite, string> = { crit: "Critique", high: "Élevé", med: "Moyen" };
const SEV_COULEUR: Record<Severite, string> = { crit: "#FF5B5B", high: "#FF9F43", med: "#FFD166" };

/**
 * L'habillage du jumeau 3D. La scène vit dans scene.ts et ne connaît que
 * trois rappels ; tout ce qui est lisible — fil d'Ariane, étages, fiche —
 * est rendu ici, donc reste dans le flux React et dans le thème du site.
 */
export default function Jumeau({ pleinEcran = false }: { pleinEcran?: boolean } = {}) {
  const hote = useRef<HTMLDivElement>(null);
  const pilote = useRef<Pilote | null>(null);
  const [iEtage, setEtage] = useState(0);
  const [baie, setBaie] = useState<string | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [survol, setSurvol] = useState<Survol>(null);
  const [etat, setEtat] = useState<"attente" | "prete" | "impossible">("attente");
  // Sur un écran étroit, le plateau entier tient dans quelques centaines de
  // pixels : illisible, et 600 Ko de three.js téléchargés en données
  // mobiles pour ça. On y sert un aperçu, la 3D reste au grand écran.
  const [large, setLarge] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const lire = () => setLarge(mq.matches);
    lire();
    mq.addEventListener("change", lire);
    return () => mq.removeEventListener("change", lire);
  }, []);

  useEffect(() => {
    if (large !== true) return;
    const el = hote.current;
    if (!el) return;
    let annule = false;
    let p: Pilote | null = null;

    // three.js pèse plusieurs centaines de kilo-octets : on ne le charge que
    // lorsque la section approche de l'écran, jamais pour un visiteur qui
    // s'arrête avant. Le repli statique reste affiché jusque-là.
    const io = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting)) return;
        io.disconnect();
        import("./scene")
          .then(({ demarrer }) => {
            if (annule || !hote.current) return;
            p = demarrer(hote.current, {
              surBaie: setBaie,
              surFiche: setFiche,
              surSurvol: setSurvol,
            });
            pilote.current = p;
            setEtat("prete");
          })
          .catch(() => { if (!annule) setEtat("impossible"); });
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);

    return () => {
      annule = true;
      io.disconnect();
      p?.detruire();
      pilote.current = null;
    };
  }, [large]);

  const allerEtage = useCallback((i: number) => {
    setEtage(i);
    setFiche(null);
    pilote.current?.allerEtage(i);
  }, []);

  const et = SITE.etages[iEtage];

  if (large !== true) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-line bg-bg">
        <Image
          src="/jumeau-apercu.webp"
          alt="Maquette 3D d'un rez-de-chaussée : deux baies dans le local technique, cloison vitrée, et un plateau de douze postes relié par son câblage."
          width={1020}
          height={503}
          className="h-auto w-full"
          sizes="100vw"
        />
        <figcaption className="border-t border-line px-4 py-3 text-xs text-muted">
          Aperçu. La maquette se parcourt sur écran large — ou pendant la visite
          du technicien, directement sur votre infrastructure.
        </figcaption>
      </figure>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-line bg-bg ${pleinEcran ? "h-full" : "h-[clamp(420px,62vh,660px)]"}`}>
      <div ref={hote} className="absolute inset-0" aria-hidden="true" />

      {etat !== "prete" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <p className="max-w-sm text-sm text-muted">
            {etat === "impossible"
              ? "Votre navigateur n'affiche pas la 3D. La maquette reste consultable lors de la visite sur site."
              : "Chargement de la maquette…"}
          </p>
        </div>
      )}

      {/* ----- fil d'Ariane et titre ----- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-2 text-xs text-muted">
          <span>{SITE.nom}</span>
          <span className="opacity-40">›</span>
          {baie ? (
            <>
              <button
                type="button"
                onClick={() => { pilote.current?.revenirEtage(); }}
                className="rounded text-muted transition-colors hover:text-acc-violet focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc-violet"
              >
                {et.nom}
              </button>
              <span className="opacity-40">›</span>
              <b className="font-semibold text-ink">{baie}</b>
            </>
          ) : (
            <b className="font-semibold text-ink">{et.nom}</b>
          )}
        </div>
        <h3 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{baie ?? et.nom}</h3>
        <p className="mt-0.5 text-xs text-muted sm:text-sm">
          {baie ? et.baies.find((b) => b.nom === baie)?.sous : et.sous}
        </p>
        {baie && (
          <button
            type="button"
            onClick={() => pilote.current?.revenirEtage()}
            className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-white/[0.09]"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Revenir à l&apos;étage
          </button>
        )}
      </div>

      {/* ----- sélecteur d'étages : le RDC en bas, comme dans un ascenseur ----- */}
      <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col-reverse gap-2 sm:left-6">
        {SITE.etages.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => allerEtage(i)}
            aria-current={i === iEtage ? "true" : undefined}
            className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors sm:gap-3 sm:px-3 ${
              i === iEtage
                ? "border-acc-violet bg-acc-violet/12"
                : "border-line bg-bg2/90 hover:border-acc-violet/40"
            }`}
          >
            <span className={`w-7 font-mono text-[11px] ${i === iEtage ? "text-acc-violet" : "text-muted"}`}>
              {e.num}
            </span>
            <span className="hidden sm:block">
              <span className="block text-[13px] font-semibold">{e.nom}</span>
              <span className="block text-[11px] text-muted">
                {e.baies.length} baie{e.baies.length > 1 ? "s" : ""} · {e.postes.length} postes ·{" "}
                {e.bornes.length} bornes
              </span>
            </span>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: SEV_COULEUR[e.pire] }} />
          </button>
        ))}
      </div>

      {/* ----- étiquette de survol ----- */}
      {survol && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-9 whitespace-nowrap rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-semibold"
          style={{ left: survol.x, top: survol.y }}
        >
          {survol.nom}
        </div>
      )}

      {/* ----- fiche d'équipement ----- */}
      {fiche && (
        <div className="absolute inset-x-3 bottom-3 max-h-[70%] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-bg2/95 p-4 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-1/2 sm:max-h-[calc(100%-3rem)] sm:w-[370px] sm:-translate-y-1/2 sm:p-5">
          <button
            type="button"
            onClick={() => setFiche(null)}
            aria-label="Fermer la fiche"
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-muted transition-colors hover:text-ink"
          >
            ×
          </button>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-acc-violet">{fiche.kind}</span>
          <h4 className="mt-2 pr-8 text-lg font-bold tracking-tight">{fiche.name}</h4>
          <p className="mt-1 font-mono text-xs text-muted">{fiche.pos}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {fiche.kv.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
          {fiche.vulns.length > 0 ? (
            <>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Points relevés</p>
              {fiche.vulns.map((v) => (
                <div key={v.id} className="mt-2.5 rounded-xl border border-line bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs font-semibold">{v.id}</code>
                    <span
                      className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: `${SEV_COULEUR[v.sev]}22`, color: SEV_COULEUR[v.sev] }}
                    >
                      {SEV_LABEL[v.sev]}
                      {v.score ? ` · ${v.score}` : ""}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{v.txt}</p>
                </div>
              ))}
            </>
          ) : (
            <p className="mt-4 text-[13px] text-sev-low">✓ Aucun point relevé sur cet équipement</p>
          )}
        </div>
      )}

      {/* ----- bas de cadre ----- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6">
        <p className="text-xs text-muted">
          {baie ? "Cliquez sur un équipement pour sa fiche" : "Cliquez sur une baie pour l'ouvrir · sur un poste pour sa fiche"}
        </p>
        <span className="hidden rounded-md border border-line px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-muted/70 sm:block">
          Données de démonstration
        </span>
      </div>
    </div>
  );
}

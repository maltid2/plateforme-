"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

type Phase = "idle" | "scanning" | "done";

const STEPS = [
  "Résolution du domaine",
  "Connexion sécurisée (TLS)",
  "En-têtes de sécurité",
  "Exposition & services",
  "Génération du rapport",
];

/** Deterministic pseudo-score from the hostname (illustrative preview). */
function fakeAudit(host: string) {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  const score = 58 + (h % 40); // 58–97
  const grade =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const pool = [
    { ok: true, label: "Connexion HTTPS valide et à jour" },
    { ok: score < 92, label: "En-tête Content-Security-Policy manquant" },
    { ok: score < 75, label: "En-tête HSTS absent" },
    { ok: score < 84, label: "Version du serveur exposée" },
    { ok: true, label: "Aucun port sensible ouvert détecté" },
    { ok: score < 68, label: "Cookie sans attribut Secure" },
  ];
  const findings = pool.slice(0, 4);
  return { score, grade, findings };
}

function normalize(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    if (!u.hostname.includes(".")) return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const gradeColor: Record<string, string> = {
  A: "#8D7CFF",
  B: "#8D7CFF",
  C: "#F5C451",
  D: "#FF9715",
  F: "#F4576B",
};

export default function AuditForm({
  id = "audit",
  align = "start",
}: {
  id?: string;
  align?: "start" | "center";
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [host, setHost] = useState("");
  const [error, setError] = useState(false);

  const result = useMemo(() => (host ? fakeAudit(host) : null), [host]);

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const h = normalize(value);
    if (!h) {
      setError(true);
      return;
    }
    setError(false);
    setHost(h);
    setPhase("scanning");
    setStep(0);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const per = reduce ? 90 : 520;

    STEPS.forEach((_, i) => {
      setTimeout(() => setStep(i), per * i);
    });
    setTimeout(() => setPhase("done"), per * STEPS.length);
  };

  const reset = () => {
    setPhase("idle");
    setHost("");
    setStep(0);
  };

  return (
    <div className={align === "center" ? "mx-auto w-full max-w-xl" : "w-full max-w-xl"}>
      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="votre-site.fr"
            aria-label="Adresse de votre site à auditer"
            aria-invalid={error}
            className={`h-[52px] w-full rounded-full border bg-white/[0.03] py-3.5 pl-11 pr-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${
              error ? "border-sev-critical/60" : "border-line focus:border-white/20"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={phase === "scanning"}
          className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-gradient-to-br from-acc-violet to-[#6b5cff] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_40px_-16px_rgba(141,124,255,0.8)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 disabled:opacity-70"
        >
          {phase === "scanning" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyse…
            </>
          ) : (
            <>
              Analyser mon site
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p
        className={`mt-3 text-sm ${error ? "text-sev-critical" : "text-muted"} ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {error
          ? "Entrez une adresse de site valide, par exemple votre-site.fr"
          : "Sans inscription · Audit non intrusif · Résultat en quelques minutes"}
      </p>

      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-5 overflow-hidden"
          >
            <div className="rounded-2xl border border-line bg-card/70 p-5 text-left shadow-soft backdrop-blur-xl">
              {phase === "scanning" ? (
                <div>
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-acc-cyan" />
                    Analyse de <span className="font-mono text-ink">{host}</span>
                  </div>
                  <div className="space-y-2.5">
                    {STEPS.map((s, i) => (
                      <div key={s} className="flex items-center gap-2.5 text-sm">
                        {i < step ? (
                          <CheckCircle2 className="h-4 w-4 flex-none text-acc-green" />
                        ) : i === step ? (
                          <Loader2 className="h-4 w-4 flex-none animate-spin text-acc-cyan" />
                        ) : (
                          <span className="h-4 w-4 flex-none rounded-full border border-line" />
                        )}
                        <span className={i <= step ? "text-ink/90" : "text-muted"}>
                          {s}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : result ? (
                <div>
                  <div className="flex items-center gap-4">
                    <div
                      className="grid h-16 w-16 flex-none place-items-center rounded-2xl text-2xl font-extrabold"
                      style={{
                        background: `${gradeColor[result.grade]}1f`,
                        color: gradeColor[result.grade],
                        boxShadow: `0 0 30px -8px ${gradeColor[result.grade]}`,
                      }}
                    >
                      {result.grade}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-ink">
                          {result.score}
                        </span>
                        <span className="text-sm text-muted">/ 100</span>
                      </div>
                      <div className="truncate font-mono text-xs text-muted">
                        {host}
                      </div>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {result.findings.map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-sm">
                        {f.ok ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-acc-green" />
                        ) : (
                          <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-sev-high" />
                        )}
                        <span className={f.ok ? "text-ink/85" : "text-ink"}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <a
                      href="#cta"
                      className="inline-flex items-center gap-1.5 rounded-full bg-acc-violet/15 px-4 py-2 text-sm font-semibold text-acc-violet transition-colors hover:bg-acc-violet/25"
                    >
                      Voir le rapport complet
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <button
                      onClick={reset}
                      className="text-sm font-medium text-muted transition-colors hover:text-ink"
                    >
                      Analyser un autre site
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-muted">
                    Aperçu — lancez l&apos;audit complet pour le détail des
                    vulnérabilités et le rapport PDF.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

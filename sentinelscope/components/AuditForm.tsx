"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

type Phase = "idle" | "scanning" | "done" | "error";

type Finding = { ok: boolean; label: string };
type Result = {
  host: string;
  score: number;
  grade: string;
  meaning?: string;
  findings: Finding[];
  reportHtml?: string;
};

const STEPS = [
  "Résolution du domaine",
  "Connexion sécurisée (TLS)",
  "En-têtes de sécurité",
  "Exposition & services",
  "Génération du rapport",
];

const gradeColor: Record<string, string> = {
  A: "#8D7CFF",
  B: "#8D7CFF",
  C: "#A78BFA",
  D: "#8B5CF6",
  F: "#A855F7",
};

/** Ouvre le rapport HTML complet dans un nouvel onglet (Blob URL, sans serveur). */
function openReport(html?: string) {
  if (!html) return;
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const w = window.open(u, "_blank");
    if (!w) window.location.href = u;
  } catch {
    /* ignore */
  }
}

/** Anneau de score circulaire, cohérent avec le dashboard et le rapport. */
function ScoreRing({
  score,
  grade,
  size = 74,
}: {
  score: number;
  grade: string;
  size?: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = gradeColor[grade] || "#8B5CF6";
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, score)) / 100) }}
          transition={{ duration: 1, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center leading-none">
        <div className="text-center">
          <div className="text-xl font-extrabold text-ink">{score}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted">/ 100</div>
        </div>
      </div>
    </div>
  );
}

export default function AuditForm({
  id,
  align = "start",
}: {
  id?: string;
  align?: "start" | "center";
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [host, setHost] = useState("");
  const [inputError, setInputError] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw || !raw.includes(".")) {
      setInputError(true);
      return;
    }
    setInputError(false);
    setErrMsg("");
    setResult(null);
    setHost(raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""));
    setPhase("scanning");
    setStep(0);

    // Fait avancer les étapes visuellement jusqu'à l'avant-dernière, en
    // attendant la vraie réponse du moteur.
    stopTimer();
    timer.current = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 650);

    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const j = await r.json();
      stopTimer();
      if (!r.ok) {
        setErrMsg(j?.error || "Une erreur est survenue pendant l'analyse.");
        setPhase("error");
        return;
      }
      setResult(j as Result);
      setStep(STEPS.length);
      setPhase("done");
    } catch (err) {
      stopTimer();
      setErrMsg(
        "Impossible de contacter le service d'analyse. Réessayez dans un instant."
      );
      setPhase("error");
    }
  };

  const reset = () => {
    stopTimer();
    setPhase("idle");
    setHost("");
    setStep(0);
    setResult(null);
    setErrMsg("");
  };

  return (
    <div
      id={id}
      className={align === "center" ? "mx-auto w-full max-w-xl scroll-mt-28" : "w-full max-w-xl scroll-mt-28"}
    >
      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setInputError(false);
            }}
            placeholder="votre-site.fr"
            aria-label="Adresse de votre site à auditer"
            aria-invalid={inputError}
            className={`h-[52px] w-full rounded-full border bg-white/[0.03] py-3.5 pl-11 pr-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${
              inputError ? "border-sev-critical/60" : "border-line focus:border-white/20"
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
        className={`mt-3 text-sm ${inputError ? "text-sev-critical" : "text-muted"} ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {inputError
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
                    <Loader2 className="h-4 w-4 animate-spin text-acc-violet" />
                    Analyse de <span className="font-mono text-ink">{host}</span>
                  </div>
                  <div className="space-y-2.5">
                    {STEPS.map((s, i) => (
                      <div key={s} className="flex items-center gap-2.5 text-sm">
                        {i < step ? (
                          <CheckCircle2 className="h-4 w-4 flex-none text-acc-violet" />
                        ) : i === step ? (
                          <Loader2 className="h-4 w-4 flex-none animate-spin text-acc-violet" />
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
              ) : phase === "error" ? (
                <div>
                  <div className="flex items-start gap-2.5 text-sm">
                    <ShieldAlert className="mt-0.5 h-4 w-4 flex-none text-sev-critical" />
                    <span className="text-ink">{errMsg}</span>
                  </div>
                  <button
                    onClick={reset}
                    className="mt-4 text-sm font-medium text-acc-violet transition-colors hover:text-ink"
                  >
                    Réessayer
                  </button>
                </div>
              ) : result ? (
                <div>
                  <div className="flex items-center gap-4">
                    <ScoreRing score={result.score} grade={result.grade} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-ink">
                          Note {result.grade}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: `${gradeColor[result.grade] || "#8B5CF6"}22`,
                            color: gradeColor[result.grade] || "#8B5CF6",
                          }}
                        >
                          {result.score}/100
                        </span>
                      </div>
                      {result.meaning && (
                        <div className="mt-1 text-sm text-ink/80">
                          {result.meaning}
                        </div>
                      )}
                      <div className="mt-1 truncate font-mono text-xs text-muted">
                        {result.host}
                      </div>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {result.findings.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        {f.ok ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-acc-violet" />
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
                    <button
                      onClick={() => openReport(result.reportHtml)}
                      disabled={!result.reportHtml}
                      className="inline-flex items-center gap-1.5 rounded-full bg-acc-violet/15 px-4 py-2 text-sm font-semibold text-acc-violet transition-colors hover:bg-acc-violet/25 disabled:opacity-50"
                    >
                      Voir le rapport complet
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={reset}
                      className="text-sm font-medium text-muted transition-colors hover:text-ink"
                    >
                      Analyser un autre site
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-muted">
                    Audit réel et non intrusif — le rapport complet détaille chaque
                    point, pourquoi le corriger et l&apos;état des fichiers exposés.
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

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

type Phase = "idle" | "scanning" | "done" | "error";

type Sev = "high" | "medium" | "low" | "info";
type SectionFinding = { severity: Sev; message: string };
type Section = {
  name: string;
  status: "ok" | "warn" | "error";
  findings: SectionFinding[];
  more: number;
};
type Finding = { ok: boolean; label: string };
type Result = {
  host: string;
  score: number;
  grade: string;
  meaning?: string;
  findings: Finding[];
  sections?: Section[];
  reportHtml?: string;
};

const STEPS = [
  "Résolution du domaine",
  "Connexion sécurisée (TLS)",
  "En-têtes de sécurité",
  "Exposition & services",
  "Génération du rapport",
];

const CONSENT_KEY = "ss-audit-consent-v1";

const gradeColor: Record<string, string> = {
  A: "#7C5CFF",
  B: "#7C5CFF",
  C: "#A78BFA",
  D: "#6D28D9",
  F: "#6D28D9",
};

// Gravité d'une alerte : libellé + couleur (rouge = vraiment grave).
const SEV_META: Record<Sev, { label: string; color: string; bg: string }> = {
  high: { label: "Élevé", color: "#F87171", bg: "rgba(248,113,113,0.14)" },
  medium: { label: "Moyen", color: "#F0A93B", bg: "rgba(240,169,59,0.14)" },
  low: { label: "Faible", color: "#A78BFA", bg: "rgba(167,139,250,0.16)" },
  info: { label: "Info", color: "#8B98A8", bg: "rgba(139,152,168,0.14)" },
};

// Verdict d'une section.
const STATUS_META: Record<
  Section["status"],
  { label: string; color: string; bg: string }
> = {
  ok: { label: "Conforme", color: "#5FD68A", bg: "rgba(95,214,138,0.14)" },
  warn: { label: "À corriger", color: "#F0A93B", bg: "rgba(240,169,59,0.14)" },
  error: { label: "Non vérifié", color: "#8B98A8", bg: "rgba(139,152,168,0.14)" },
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
  const color = gradeColor[grade] || "#6D28D9";
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(0,0,0,0.12)"
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
          <div className="js-score-num text-xl font-extrabold text-ink">{score}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted">/ 100</div>
        </div>
      </div>
    </div>
  );
}

/** Pastille de gravité / statut. */
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="flex-none rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: bg, color }}
    >
      {label}
    </span>
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
  const [consentOpen, setConsentOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const pendingUrl = useRef<string | null>(null);

  // Animation premium à l'apparition du résultat (anime.js) : le score monte
  // de 0 à sa valeur et les lignes apparaissent en cascade. Repli sans effet
  // si la librairie ne se charge pas.
  useEffect(() => {
    if (phase !== "done" || !result) return;
    let stopped = false;
    (async () => {
      try {
        const { animate, stagger } = await import("animejs");
        if (stopped) return;
        const root = resultRef.current;
        if (!root) return;
        const numEl = root.querySelector<HTMLElement>(".js-score-num");
        if (numEl) {
          const obj = { v: 0 };
          animate(obj, {
            v: result.score,
            duration: 1000,
            ease: "out(3)",
            onUpdate: () => {
              numEl.textContent = String(Math.round(obj.v));
            },
          });
        }
        const rows = root.querySelectorAll(".audit-finding");
        if (rows.length) {
          animate(rows, {
            opacity: [0, 1],
            translateY: [8, 0],
            duration: 420,
            delay: stagger(55),
            ease: "out(2)",
          });
        }
      } catch {
        /* anime.js indisponible : le résultat s'affiche normalement */
      }
    })();
    return () => {
      stopped = true;
    };
  }, [phase, result]);

  const stopTimer = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  /** Lance réellement l'analyse (après acceptation de la décharge). */
  const doAudit = async (raw: string) => {
    setInputError(false);
    setErrMsg("");
    setResult(null);
    setHost(raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""));
    setPhase("scanning");
    setStep(0);

    const startedAt = Date.now();
    const MIN_LOADER_MS = 5200; // durée minimale d'affichage du loader
    stopTimer();
    timer.current = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 900);

    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const j = await r.json();
      if (!r.ok) {
        stopTimer();
        setErrMsg(j?.error || "Une erreur est survenue pendant l'analyse.");
        setPhase("error");
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADER_MS) {
        await new Promise((res) => setTimeout(res, MIN_LOADER_MS - elapsed));
      }
      stopTimer();
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

  const hasConsent = () => {
    try {
      return localStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      return false;
    }
  };

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw || !raw.includes(".")) {
      setInputError(true);
      return;
    }
    // Décharge de responsabilité : à accepter avant toute analyse.
    if (!hasConsent()) {
      pendingUrl.current = raw;
      setConsentOpen(true);
      return;
    }
    doAudit(raw);
  };

  const acceptConsent = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setConsentOpen(false);
    const raw = pendingUrl.current;
    pendingUrl.current = null;
    if (raw) doAudit(raw);
  };

  const declineConsent = () => {
    pendingUrl.current = null;
    setConsentOpen(false);
  };

  const reset = () => {
    stopTimer();
    setPhase("idle");
    setHost("");
    setStep(0);
    setResult(null);
    setErrMsg("");
  };

  const sections = result?.sections;

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
            className={`h-[52px] w-full rounded-full border bg-black/[0.03] py-3.5 pl-11 pr-4 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 ${
              inputError ? "border-sev-critical/60" : "border-line focus:border-black/15"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={phase === "scanning"}
          className="group inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-gradient-to-br from-acc-violet to-[#6D28D9] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_40px_-16px_rgba(124,92,255,0.8)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-violet/60 disabled:opacity-70"
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
                <div ref={resultRef}>
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
                            background: `${gradeColor[result.grade] || "#6D28D9"}22`,
                            color: gradeColor[result.grade] || "#6D28D9",
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

                  {/* Alertes classées par section, avec gravité */}
                  {sections && sections.length > 0 ? (
                    <div className="mt-4 space-y-2.5">
                      {sections.map((sec, i) => {
                        const st = STATUS_META[sec.status];
                        return (
                          <div
                            key={i}
                            className="audit-finding rounded-xl border border-line bg-black/[0.02] p-3.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-ink">
                                {sec.name}
                              </span>
                              <Badge label={st.label} color={st.color} bg={st.bg} />
                            </div>
                            {sec.findings.length > 0 && (
                              <ul className="mt-2.5 space-y-1.5">
                                {sec.findings.map((f, j) => {
                                  const sv = SEV_META[f.severity] || SEV_META.info;
                                  return (
                                    <li key={j} className="flex items-start gap-2 text-sm">
                                      <Badge label={sv.label} color={sv.color} bg={sv.bg} />
                                      <span className="text-ink/85">{f.message}</span>
                                    </li>
                                  );
                                })}
                                {sec.more > 0 && (
                                  <li className="text-xs text-muted">
                                    +{sec.more} autre(s) — voir le rapport complet
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {result.findings.map((f, i) => (
                        <li key={i} className="audit-finding flex items-start gap-2.5 text-sm">
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
                  )}

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

      {/* Pop-up de décharge — à accepter avant toute analyse */}
      {consentOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Avant de lancer l'analyse"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={declineConsent}
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              className="relative w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-soft"
            >
              <button
                onClick={declineConsent}
                aria-label="Fermer"
                className="absolute right-4 top-4 text-muted transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-acc-violet/15">
                  <ShieldAlert className="h-5 w-5 text-acc-violet" />
                </span>
                <h3 className="text-lg font-bold text-ink">
                  Avant de lancer l&apos;analyse
                </h3>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                <p>
                  Vous devez être <strong className="text-ink">propriétaire</strong> du
                  site analysé, ou disposer d&apos;une{" "}
                  <strong className="text-ink">autorisation explicite</strong> pour
                  l&apos;auditer.
                </p>
                <p>
                  SentinelScope réalise un audit non intrusif, à titre informatif, et{" "}
                  <strong className="text-ink">
                    décline toute responsabilité
                  </strong>{" "}
                  quant à l&apos;usage des résultats ou à une analyse effectuée sans
                  autorisation.
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={declineConsent}
                  className="rounded-full border border-line bg-black/[0.03] px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-black/15"
                >
                  Annuler
                </button>
                <button
                  onClick={acceptConsent}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-acc-violet to-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_40px_-16px_rgba(124,92,255,0.8)] transition-all hover:-translate-y-0.5"
                >
                  J&apos;accepte et je lance l&apos;analyse
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
}
